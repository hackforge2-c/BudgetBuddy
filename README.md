# 💰 ExpenseIQ v4

> AI-powered personal finance dashboard — Milky White + Deep Red theme

## 🚀 Quick Start

```bash
cd my-app
npm install
npm run dev          # Browser mode (localhost:5173)
npm run electron:dev # Desktop app mode
```

## 📦 Build for Production

```bash
npm run dist:win     # Windows .exe
npm run dist:mac     # macOS .dmg
npm run dist:linux   # Linux AppImage
```

## 🔑 Claude API Key (for AI features)

The app calls `https://api.anthropic.com/v1/messages`.

- **In claude.ai**: Works automatically (no key needed)
- **Standalone Electron**: Add your key to `src/App.jsx` in the `callClaude()` function:
  ```js
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_KEY_HERE',
    'anthropic-version': '2023-06-01'
  }
  ```

## ✨ Features

### 📊 Dashboard
- Stat cards: Total Spent, Monthly, Budget, Lent
- Add/Edit expenses with AI auto-classify
- Category + tag filtering, search, sort
- Mini Calendar (click date = expense popup)
- Donut chart + 6-month bar chart + category bars
- AI Insights panel (Claude) + AI Chat
- Monthly budget bar with alerts
- Google Sheets sync
- WhatsApp share

### 💳 EMI & Loans
- EMI Calculator with payment schedule
- Active Loans Tracker (record EMI, progress bar)
- 🎉 Confetti on loan payoff
- 10 Schemes: Health, PPF, SIP, LIC, KVP, RD, NPS, Education, Car, Home

### 🤝 Lent Money
- Track money lent to friends/family
- Overdue detection & alerts
- Mark as returned → 🎉 Confetti
- Filter: All / Pending / Overdue / Returned

### 🔐 Security
- PIN lock (4-digit numpad)
- 5-min auto-lock
- Blur amounts in public
- All data stored locally (localStorage)

## 📁 Structure
```
my-app/
├── src/
│   ├── App.jsx       ← Main app (1200+ lines)
│   ├── index.css     ← White+Red theme
│   └── main.jsx      ← Entry point
├── public/
│   ├── hero-bg.png   ← Banner image
│   ├── manifest.json ← PWA
│   └── sw.js         ← Service worker
├── electron.main.js  ← Electron main
├── electron.preload.js
├── package.json
├── vite.config.js
└── index.html
```
