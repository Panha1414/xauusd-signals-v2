# XAUUSD 1:1 Session Signals Dashboard

Dashboard តាមដានសញ្ញា XAUUSD (Gold) ផ្អែកលើ Pine Script របស់អ្នក  
**Session: 14:00–17:00 & 19:30–23:00 (Asia/Phnom_Penh)**  
**Max 3 trades/day • RR 1:1 • SL = ATR × 1.5**

---

## លក្ខណៈពិសេស

- Live Candlestick Chart + EMA 20 / 50 / 200
- BUY / SELL markers លើ chart
- Entry / SL / TP បង្ហាញច្បាស់
- Win Rate + ចំនួន trade ថ្ងៃនេះ
- **Telegram Alert** ពេលមានសញ្ញាថ្មី
- API key លាក់ក្នុង Serverless Function (សុវត្ថិភាព)

---

## តម្រូវការ (ឥតគិតថ្លៃទាំងអស់)

1. **GitHub account**
2. **Vercel account** (ភ្ជាប់ GitHub)
3. **Twelve Data** API key → https://twelvedata.com (Free plan: ~800 credits/day)
4. **Telegram Bot** (សម្រាប់ Alert)

---

## របៀប Deploy លើ Vercel (ជំហានៗ)

### 1. បង្កើត Telegram Bot
1. បើក Telegram → ស្វែងរក `@BotFather`
2. ផ្ញើ `/newbot` → តាមការណែនាំ → យក **Bot Token**
3. បង្កើត Group ឬ Chat ផ្ទាល់ជាមួយ Bot
4. យក **Chat ID**:
   - ផ្ញើសារទៅ Bot
   - បើក: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - រក `"chat":{"id": 123456789}` → នោះជា Chat ID

### 2. Clone / Upload កូដទៅ GitHub
```bash
# បើមាន git
git init
git add .
git commit -m "XAUUSD 1:1 Signals Dashboard"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/xauusd-signals.git
git push -u origin main
```

### 3. Deploy លើ Vercel
1. ចូល https://vercel.com → **Add New Project**
2. Import repository ពី GitHub
3. Framework Preset: **Other**
4. Root Directory: `.` (default)
5. មុន Deploy → ចុច **Environment Variables** បន្ថែម 3 យ៉ាង:

| Name                  | Value                                      | Environment     |
|-----------------------|--------------------------------------------|-----------------|
| `TWELVE_DATA_API_KEY` | `e85cf1bb766e426194fe10e46883a1f9`          | Production, Preview, Development |
| `TELEGRAM_BOT_TOKEN`  | `8764009621:AAEk82ApXmo06eNyGkIeGetf5fg_9Zj_LDg` | Production, Preview, Development |
| `TELEGRAM_CHAT_ID`    | `-1003855500888`                           | Production, Preview, Development |

6. ចុច **Deploy**

### 4. Deploy រួច!

Vercel នឹង detect `index.html` នៅ root និង folder `/api` ដោយស្វ័យប្រវត្តិ។  
មិនចាំបាច់កំណត់ Output Directory ទេ។

---

## រចនាសម្ព័ន្ធ Project

```
xauusd-signals/
├── api/
│   ├── data.js          ← ទាញតម្លៃ + គណនាសញ្ញា
│   └── telegram.js      ← ផ្ញើ Telegram Alert
├── index.html
├── app.js
├── style.css
├── package.json
├── vercel.json
└── README.md
```

---

## ការកំណត់ដែលអាចផ្លាស់ប្តូរបាន

នៅក្នុង `api/data.js`:
- `ATR_MULT = 1.5`
- `RR = 1.0`
- `MAX_TRADES = 3`
- Session times (14:00-17:00 & 19:30-23:00)

នៅក្នុង `public/app.js`:
- `POLL_INTERVAL = 45000` (45 វិនាទី) — កុំតិចពេក ដើម្បីមិនអស់ credit Twelve Data

---

## ការពិនិត្យ

1. បើក website របស់អ្នក (`https://your-project.vercel.app`)
2. Chart ត្រូវបង្ហាញ candlestick + EMA
3. បើមានសញ្ញាថ្មី → ទទួល Telegram ភ្លាម
4. Stats (Wins / Losses / Win Rate) ត្រូវបង្ហាញ

---

## កំណត់ចំណាំសំខាន់

- **Free Twelve Data**: ប្រហែល 800 API calls/day → 1 call / 45s ≈ 1920 calls/day លើស → បើចង់ប្រើច្រើន ប្តូរ POLL_INTERVAL ទៅ 60s ឬ 90s
- សញ្ញាត្រូវបានគណនាតែលើ **candle បិទហើយ** ប៉ុណ្ណោះ (ដូច Pine Script)
- Win Rate គឺជា backtest លើទិន្នន័យប្រវត្តិសាស្ត្រដែលទាញមក (មិនមែន live tracking ពេញលេញ)
- នេះ **មិនមែនជាការណែនាំវិនិយោគ** — សាកល្បងលើ Demo យ៉ាងហោចណាស់ 1 ខែមុនប្រើលុយពិត

---

## បញ្ហាទូទៅ

| បញ្ហា | ដំណោះស្រាយ |
|------|-----------|
| Chart ទទេ | ពិនិត្យ Browser Console + API key ត្រឹមត្រូវ |
| Telegram មិនមក | ពិនិត្យ BOT_TOKEN + CHAT_ID + Bot ត្រូវបាន Start |
| 429 Rate Limit | បង្កើន POLL_INTERVAL |
| EMA មិនចេញ | ត្រូវការយ៉ាងហោច 200 candles → outputsize=400 គ្រប់គ្រាន់ |

---

រីករាយជាមួយ Dashboard!  
បើត្រូវការកែប្រែ logic ឬបន្ថែម feature ប្រាប់ខ្ញុំបាន។
