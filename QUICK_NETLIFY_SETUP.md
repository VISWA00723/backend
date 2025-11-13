# Quick Netlify Deployment (5 minutes)

## What You Need
- Netlify account (free)
- GitHub account
- OpenRouter API key

## Step 1: Prepare Backend (2 min)

### Install serverless-http:
```bash
cd d:\exp\backend
npm install serverless-http
```

### Create `netlify.toml`:
```toml
[build]
  command = "npm install"
  functions = "functions"

[[redirects]]
  from = "/*"
  to = "/.netlify/functions/server"
  status = 200
```

### Create `functions` folder:
```bash
mkdir functions
```

### Move server.js to functions:
```bash
move server.js functions/server.js
```

### Wrap functions/server.js with serverless:
Add at the end:
```javascript
import serverless from 'serverless-http';
export const handler = serverless(app);
```

## Step 2: Push to GitHub (2 min)

```bash
git init
git add .
git commit -m "Deploy to Netlify"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/expense-tracker-backend.git
git push -u origin main
```

## Step 3: Deploy to Netlify (1 min)

1. Go to netlify.com
2. Click "New site from Git"
3. Connect GitHub
4. Select your repository
5. Click "Deploy"

## Step 4: Add Environment Variables

1. Go to Site settings
2. Build & deploy → Environment
3. Add: `OPENROUTER_API_KEY` = Your key
4. Redeploy

## Step 5: Test

Your backend is now at:
```
https://your-site-name.netlify.app
```

Test with:
```bash
curl https://your-site-name.netlify.app/health
```

## Flutter App Already Configured

The app is set to use:
```
https://expense-tracker-backend.netlify.app
```

Just run:
```bash
flutter run
```

And test AI features!

---

**Total time**: ~5 minutes
**Cost**: Free
**Status**: Production ready
