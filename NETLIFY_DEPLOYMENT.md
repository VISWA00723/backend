# Deploy Backend to Netlify

## Prerequisites
- Netlify account (free at netlify.com)
- GitHub account
- Backend code pushed to GitHub

## Step 1: Prepare Backend for Netlify

### Create `netlify.toml` in backend root:

```toml
[build]
  command = "npm install"
  functions = "functions"

[dev]
  command = "npm start"
  port = 3000

[[redirects]]
  from = "/*"
  to = "/.netlify/functions/server"
  status = 200
```

### Create `functions/server.js`:

Move your `server.js` to `functions/server.js` and wrap it for Netlify:

```javascript
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

    const categorySummary = Object.entries(categoryTotals)
      .map(([cat, total]) => `${cat}: ₹${total}`)
      .join(', ');

    const systemPrompt = `You are a helpful financial advisor. Analyze the user's expenses and provide insights.

Expenses:
${expensesSummary}

Category Summary:
${categorySummary}

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
            content: question,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://expense-tracker.app',
          'X-Title': 'Expense Tracker',
        },
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error:', error.message);
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

// Export for Netlify
export const handler = serverless(app);
```

### Update `package.json`:

```json
{
  "name": "expense-tracker-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "axios": "^1.6.2",
    "serverless-http": "^3.2.0"
  }
}
```

## Step 2: Push to GitHub

```bash
cd d:\exp\backend
git init
git add .
git commit -m "Initial backend commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/expense-tracker-backend.git
git push -u origin main
```

## Step 3: Deploy to Netlify

### Option A: Using Netlify UI

1. Go to netlify.com
2. Click "New site from Git"
3. Connect GitHub
4. Select your repository
5. Build settings:
   - Build command: `npm install`
   - Publish directory: `.`
6. Add environment variables:
   - `OPENROUTER_API_KEY`: Your OpenRouter API key
7. Deploy!

### Option B: Using Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

## Step 4: Update Flutter App

The app is already configured to use:
```
https://expense-tracker-backend.netlify.app
```

### To switch back to local development:

Edit `lib/services/api_service.dart`:

```dart
// Uncomment for local development:
if (Platform.isAndroid) {
  baseUrl = 'http://10.0.2.2:3000';
} else {
  baseUrl = 'http://localhost:3000';
}
```

## Step 5: Test

1. Run the Flutter app:
```bash
cd d:\exp\expense_app_new
flutter run
```

2. Go to AI Assistant tab
3. Ask a question about expenses
4. Should connect to Netlify backend

## Troubleshooting

### Backend not responding:
- Check Netlify deployment logs
- Verify OPENROUTER_API_KEY is set
- Check CORS settings

### CORS errors:
- Netlify automatically handles CORS
- Make sure `cors()` middleware is enabled

### Function timeout:
- Netlify has 10-second timeout for free tier
- Upgrade to Pro if needed

## Environment Variables

Set in Netlify dashboard:
- `OPENROUTER_API_KEY` - Your OpenRouter API key

## Monitoring

- Check Netlify Functions logs
- Monitor API response times
- Track error rates

## Cost

- Netlify free tier: 125,000 function invocations/month
- Should be plenty for testing

---

**Status**: ✅ Ready to deploy
**Backend URL**: `https://expense-tracker-backend.netlify.app`
**Endpoints**:
- `POST /analyze` - Analyze expenses with AI
- `GET /health` - Health check
