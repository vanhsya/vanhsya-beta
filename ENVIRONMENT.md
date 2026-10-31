# Environment Configuration Guide

## Overview

VANHSYA Neural Radio Terminal uses environment variables to configure the Gemini API connection. This guide covers setup for all environments: **Development**, **Preview**, and **Production**.

---

## 🔒 Security Notice

**NEVER commit `.env.local` or any file containing real API keys to version control.**

All sensitive credentials must be stored securely in:

- **Local Development:** `.env.local` (gitignored)
- **Hosting Platform:** Platform-specific environment variables
- **Other Platforms:** Platform-specific secret managers

---

## 📋 Environment Variables

| Variable            | Required | Description                   | Example              |
| ------------------- | -------- | ----------------------------- | -------------------- |
| `GEMINI_API_KEY`    | **Yes**  | Your Google Gemini API key    | `AIzaSy...`          |
| `GOOGLE_AI_API_KEY` | No       | Alternative Google AI API key | `AIzaSy...`          |
| `VITE_DEV_PORT`     | No       | Custom dev server port        | `3000`, `5173`, etc. |

---

## 🚀 Development Environment

### Local Setup

1. **Copy the example environment file:**

   ```bash
   cp .env.example .env.local
   ```

2. **Add your Gemini API key:**

   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```

3. **Optional: Customize dev server port:**

   ```env
   VITE_DEV_PORT=5173
   ```

4. **Start the development server:**
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:3000` (or your custom port).

### How It Works

- Vite's `loadEnv` reads `.env.local` during development
- `vite.config.ts` injects `process.env.GEMINI_API_KEY` into the client bundle
- The key is available to `services/liveService.ts` via `process.env.API_KEY`

---

## 🌐 Production Deployment

### Option 1: Netlify (Recommended - Free Tier Available)

**Advantages:**

- Free tier with generous limits
- Simple Git-based deployment
- Automatic SSL
- Global CDN
- No region restrictions

**Setup:**

1. **Push your code to GitHub** (already done)

2. **Connect to Netlify:**
   - Go to [Netlify](https://app.netlify.com/)
   - Click "New site from Git"
   - Select your GitHub repo: `vanhsya/vanhsya-beta`

3. **Configure build settings:**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: `20`

4. **Add environment variables:**
   - Go to **Site settings** → **Environment variables** → **Add a variable**
   - Key: `GEMINI_API_KEY`
   - Value: `your_production_api_key_here`
   - Click "Save"

5. **Deploy:**
   - Netlify will automatically build and deploy
   - Your site will be live at `https://your-site.netlify.app`

**Configuration file:** `netlify.toml` is included in the repo with:

- Build settings
- Security headers
- SPA routing redirect
- Cache policies

---

### Option 2: Cloudflare Pages (Free Tier Available)

**Advantages:**

- Free unlimited bandwidth
- Global CDN with 275+ locations
- Automatic SSL
- Fast builds

**Setup:**

1. **Push your code to GitHub** (already done)

2. **Connect to Cloudflare Pages:**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - Navigate to **Workers & Pages** → **Pages** → **Create a project**
   - Select "Connect to Git"
   - Choose your GitHub repo: `vanhsya/vanhsya-beta`

3. **Configure build settings:**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: `20`

4. **Add environment variables:**
   - Go to **Settings** → **Environment variables**
   - Key: `GEMINI_API_KEY`
   - Value: `your_production_api_key_here`
   - Environment: ✅ Production

5. **Deploy:**
   - Cloudflare Pages will build and deploy
   - Your site will be live at `https://your-project.pages.dev`

---

### Option 3: Vercel (Free Tier Available)

**Note:** Multi-region deployment requires Pro/Enterprise plans, but single-region free tier works fine.

**Setup:**

1. **Push your code to GitHub** (already done)

2. **Import to Vercel:**
   - Go to [Vercel](https://vercel.com/)
   - Click "Add New Project"
   - Import `vanhsya/vanhsya-beta`

3. **Add environment variables:**
   - In project settings, add `GEMINI_API_KEY`
   - Set for both Preview and Production

4. **Deploy:**
   - Vercel will auto-deploy from GitHub

---

### Option 4: GitHub Pages (Free)

**Limitation:** No built-in environment variable support for static sites.

**Setup:**

1. **Build locally with env:**

   ```bash
   npm run build
   ```

2. **Deploy to GitHub Pages:**

   ```bash
   npm install -g gh-pages
   gh-pages -d dist -b gh-pages
   ```

3. **Enable GitHub Pages** in repo settings

---

## 🔧 Environment Files

### `.env.local` (Development)

```env
GEMINI_API_KEY=AIzaSy...
VITE_DEV_PORT=3000
```

- **Local only**
- **Gitignored**
- Used by `npm run dev`

### `.env.example` (Template)

```env
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
VITE_DEV_PORT=3000
```

- **Committed to git**
- Used as a template for new developers

### Platform Dashboard (Production)

- Managed through hosting platform UI
- Secure encrypted storage
- Automatic injection during build

---

## 🛡️ Security Best Practices

### 1. Never Expose Secrets

- ✅ Use `.env.local` for development
- ✅ Use platform environment variables for production
- ❌ Never hardcode API keys in source code
- ❌ Never commit `.env.local` to git

### 2. Monitor API Usage

- Check Google AI Studio regularly for usage spikes
- Set up quota alerts in Google Cloud Console
- Consider implementing request validation

### 3. Rate Limiting

The Gemini API has built-in rate limits, but consider:

- Debouncing rapid user interactions
- Caching frequent queries
- Implementing client-side request throttling

---

## 🐛 Troubleshooting

### "GEMINI_API_KEY is not defined"

**Development:**

- Ensure `.env.local` exists and contains `GEMINI_API_KEY`
- Restart the dev server after changing env vars
- Check for typos in variable names

**Production:**

- Verify the environment variable is set in hosting platform
- Check that the variable name matches exactly: `GEMINI_API_KEY`
- Redeploy after adding new environment variables

### "Invalid API Key" Error

- Verify the key is correct in Google AI Studio
- Check if the key has been revoked
- Ensure the key has Gemini API enabled

### Build Fails

- Check platform build logs for missing dependencies
- Ensure `package.json` scripts are correct
- Verify Node.js version compatibility (use Node 20+)

---

## 📊 Environment Matrix

| Environment | API Key Source     | Build Command   | Deploy Trigger |
| ----------- | ------------------ | --------------- | -------------- |
| Development | `.env.local`       | `npm run dev`   | Manual         |
| Preview     | Platform Dashboard | `npm run build` | Push to branch |
| Production  | Platform Dashboard | `npm run build` | Push to `main` |

---

## 🔗 Quick Deploy Links

- **Netlify:** [https://app.netlify.com/](https://app.netlify.com/)
- **Cloudflare Pages:** [https://dash.cloudflare.com/](https://dash.cloudflare.com/)
- **Vercel:** [https://vercel.com/](https://vercel.com/)
- **GitHub Pages:** Enable in repo settings

---

**Last Updated:** 2026-09-06  
**Maintained by:** VANHSYA Group
