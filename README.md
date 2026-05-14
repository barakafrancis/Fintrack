# FinTrack KE 🇰🇪

Personal financial dashboard for Kenyan bank statements. Auto-parses, categorizes, and visualizes all your accounts in one place.

## Features
- 📊 Dashboard: income/expense stats, monthly cash flow chart, category breakdown
- 🏷️ 14 built-in categories with keyword matching + fully customizable via Settings
- 🔄 Inline recategorize any transaction
- 🌙/☀️ Dark & light mode
- 📄 Configurable page size (10/20/30/50/100/All)
- 🔍 Full-text search (narration, source, receipt, amount)
- ✅ Mark as Reconciled — saves full transaction set to MongoDB
- 📱 Fully responsive

## Supported Formats

| Source | Format | Notes |
|--------|--------|-------|
| M-PESA (Safaricom) | PDF | Both number formats (0116…, 0714…) |
| M-PESA (Safaricom) | XLSX | Multi-sheet export — all pages parsed |
| Equity Bank | CSV | Standard statement export |
| KCB | XLS / XLSX | Standard statement export |
| Timiza (Absa) | PDF | Wallet transaction statement |
| ABSA Bank | CSV / XLSX | Debit/Credit column format |
| Any Bank | CSV / XLSX | Auto-detects columns |

## Quick Start

```bash
npm install
cp .env.example .env   # fill in your MongoDB URI
npm run dev            # Frontend on :5173
npm run server         # Backend API on :3001 (for Reconcile feature)
```

## Deploy to Vercel

1. Push to GitHub
2. Import on vercel.com — Vite auto-detected
3. Set env var: `VITE_API_URL=https://your-api.railway.app`

> The Express server (`server/index.js`) must be hosted separately (Railway, Render, Fly.io) for MongoDB reconciliation. The frontend works fully standalone — MongoDB is only needed for the Reconcile feature.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `PORT` | Server port (default 3001) |
| `FRONTEND_URL` | Frontend URL for CORS |
| `VITE_API_URL` | API base URL used by the frontend |
