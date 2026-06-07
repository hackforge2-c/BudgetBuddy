# 🔥 BudgetBuddy — Firebase Setup Guide

## Step 1: Create Firebase Project

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"**
3. Name it: `budgetbuddy`
4. Disable Google Analytics (optional)
5. Click **"Create project"**

---

## Step 2: Enable Authentication

1. In left sidebar → **Authentication** → **Get started**
2. Click **"Email/Password"** → Enable → Save
3. Click **"Google"** → Enable → add your Support Email → Save

---

## Step 3: Create Firestore Database

1. In left sidebar → **Firestore Database** → **Create database**
2. Select **"Start in production mode"**
3. Choose your region (e.g., `asia-south1` for India)
4. Click **"Done"**

### Add Security Rules:
1. Click the **"Rules"** tab in Firestore
2. Delete everything and paste the contents of `firestore.rules`
3. Click **"Publish"**

---

## Step 4: Register Your Web App

1. In left sidebar → **Project Settings** (gear icon)
2. Scroll down to **"Your apps"**
3. Click **"</>"** (Web app icon)
4. App nickname: `budgetbuddy-web`
5. Click **"Register app"**
6. You'll see a config object like this:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "budgetbuddy-xxxxx.firebaseapp.com",
  projectId: "budgetbuddy-xxxxx",
  storageBucket: "budgetbuddy-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## Step 5: Add Config to Your App

1. Open `my-app/src/firebase.js`
2. Replace the placeholder values with your real config:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",          // ← your real key
  authDomain:        "budgetbuddy-xxxxx.firebaseapp.com",
  projectId:         "budgetbuddy-xxxxx",
  storageBucket:     "budgetbuddy-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123"
}
```

---

## Step 6: Run the App

```bash
cd my-app
npm install       # installs firebase + all dependencies
npm run dev       # opens at localhost:5173
```

---

## Step 7: Deploy to the Web (Free)

### Option A — Vercel (Recommended, 2 minutes)
```bash
npm install -g vercel
npm run build
vercel --prod
```
Your app goes live at `https://budgetbuddy-xxxx.vercel.app`

### Option B — Firebase Hosting (Same project)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # select your project, set dist/ as public
npm run build
firebase deploy
```
Your app goes live at `https://budgetbuddy-xxxxx.web.app`

---

## How Data is Stored

```
Firestore (Cloud Database)
└── users/
    └── USER_ID/              ← each user has private folder
        ├── expenses/         ← all their expense records
        ├── lentList/         ← money lent to people
        ├── loans/            ← EMI loans
        ├── schemes/          ← investments & schemes
        └── settings/         ← budget, tags, preferences
            └── main          ← single settings document
```

Each user can ONLY see their own data. Security rules prevent any cross-user access.

---

## Free Tier Limits (Firebase Spark Plan)

| Feature | Free Limit |
|---------|-----------|
| Storage | 1 GB |
| Reads/day | 50,000 |
| Writes/day | 20,000 |
| Auth users | Unlimited |
| Hosting | 10 GB/month |

**For 1,000 users** with normal usage you'll likely stay within free limits.
When you grow, upgrade to **Blaze plan** (pay-as-you-go, ~$25/month).

---

## Troubleshooting

**"Firebase: Error (auth/invalid-api-key)"**
→ Your `firebaseConfig` values are wrong. Double-check from Project Settings.

**Data not saving**
→ Check Firestore Rules are published. Check browser console for errors.

**Google sign-in not working**
→ In Firebase Console → Authentication → Sign-in method → Google → add your domain to "Authorized domains".
→ For localhost add: `localhost`
→ For production add: `yourdomain.com`
