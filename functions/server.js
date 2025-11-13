import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import serverless from 'serverless-http';

dotenv.config();

const app = express();
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Analyze expenses endpoint
app.post('/analyze', async (req, res) => {
  try {
    const { question, expenses } = req.body;

    // Validate input
    if (!question || !Array.isArray(expenses)) {
      return res.status(400).json({
        error: 'Invalid request. Required: question (string), expenses (array)',
      });
    }

    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({
        error: 'OpenRouter API key not configured',
      });
    }

    // Format expenses for the prompt
    const expensesSummary = expenses
      .map(
        (e) =>
          `- ${e.title}: ₹${e.amount} (${e.category}) on ${e.date}${e.notes ? ` - ${e.notes}` : ''}`
      )
      .join('\n');

    // Calculate category totals
    const categoryTotals = {};
    expenses.forEach((e) => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    const categoryBreakdown = Object.entries(categoryTotals)
      .map(([cat, total]) => `${cat}: ₹${total.toFixed(2)}`)
      .join('\n');

    // Create prompt
    const systemPrompt = `You are a helpful financial assistant. Analyze the user's expenses and answer their question concisely and accurately. 
Provide specific numbers and insights. Keep responses brief and actionable.`;

    const userPrompt = `Here are the user's recent expenses:

${expensesSummary}

Category Breakdown:
${categoryBreakdown}

Total Expenses: ₹${expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}

User's Question: ${question}

Please answer the question based on the provided expense data.`;

    // Call OpenRouter API
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://expense-tacker-backend.netlify.app',
          'X-Title': 'Expense Tracker',
        },
      }
    );

    const answer =
      response.data.choices[0].message.content ||
      'Unable to process your question.';

    // Return response
    res.json({
      answer,
      summary: {
        breakdown: categoryTotals,
        totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
        expenseCount: expenses.length,
      },
    });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to analyze expenses',
      details: error.message,
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Export for Netlify Functions
export const handler = serverless(app);
