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

// Add expense via natural language endpoint
app.post('/add-expense', async (req, res) => {
  try {
    const { input, recentExpenses, availableCategories } = req.body;

    // Validate input
    if (!input || !Array.isArray(availableCategories)) {
      return res.status(400).json({
        error: 'Invalid request. Required: input (string), availableCategories (array)',
      });
    }

    if (!OPENROUTER_API_KEY) {
      return res.status(500).json({
        error: 'OpenRouter API key not configured',
      });
    }

    // Format recent expenses for context
    const recentExpensesSummary = (recentExpenses || [])
      .slice(0, 10)
      .map(
        (e) =>
          `- ${e.title}: ₹${e.amount} (${e.category})`
      )
      .join('\n');

    // Create prompt for expense parsing
    const systemPrompt = `You are an AI assistant that helps users add expenses. Parse natural language input and extract expense details.
Return a JSON object with: title, amount, category, notes, date.
- title: Brief description of the expense
- amount: Numeric amount in rupees
- category: One of the available categories provided
- notes: Optional additional notes
- date: ISO date string (YYYY-MM-DD)

If the user's input is not about adding an expense, return null for expenseData.`;

    const userPrompt = `Available categories: ${availableCategories.join(', ')}

Recent expenses for context:
${recentExpensesSummary || 'No recent expenses'}

User input: "${input}"

Extract the expense details and return as JSON. If this is not an expense addition request, set expenseData to null.
Return format:
{
  "answer": "Confirmation message",
  "expenseData": {
    "title": "...",
    "amount": ...,
    "category": "...",
    "notes": "...",
    "date": "YYYY-MM-DD"
  }
}`;

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
        temperature: 0.3, // Lower temperature for more consistent parsing
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://expense-tacker-backend.netlify.app',
          'X-Title': 'Expense Tracker',
        },
      }
    );

    let result;
    try {
      const content = response.data.choices[0].message.content;
      result = JSON.parse(content);
    } catch (parseError) {
      // If JSON parsing fails, return error
      return res.status(400).json({
        answer: 'Could not parse expense details. Please try again with more specific information.',
        expenseData: null,
      });
    }

    // Validate and normalize the result
    if (result.expenseData) {
      // Ensure amount is a number
      result.expenseData.amount = parseFloat(result.expenseData.amount) || 0;
      
      // Ensure date is valid
      if (!result.expenseData.date) {
        result.expenseData.date = new Date().toISOString().split('T')[0];
      }

      // Ensure category exists in available categories (case-insensitive match)
      const matchedCategory = availableCategories.find(
        (cat) => cat.toLowerCase() === result.expenseData.category.toLowerCase()
      );
      if (matchedCategory) {
        result.expenseData.category = matchedCategory;
      }
    }

    // Return response
    res.json(result);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to process expense',
      details: error.message,
      answer: 'Sorry, I could not process your expense request. Please try again.',
      expenseData: null,
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Export for Netlify Functions
export const handler = serverless(app);
