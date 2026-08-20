# Signal Desk — Directional Screener

A technical screener that pulls daily price history for any list of tickers
and scores each one on trend, momentum, and volume to flag a **CALL** (bullish),
**PUT** (bearish), or **NEUTRAL** bias. Built with Next.js (App Router) and
deployed on Vercel.

**This is not financial advice.** It's a research tool built from standard
technical indicators — it does not know about earnings, news, fundamentals,
or options pricing/greeks. Treat every signal as a starting point, not a
recommendation.

## How the signal is built

For each ticker, the app pulls ~1 year of daily OHLCV bars and computes:

| Signal | What it checks | Max weight |
|---|---|---|
| Trend regime | Price vs. 50-day and 200-day SMA | ±20 |
| MA crossover | 20-EMA vs. 50-EMA, and whether a cross just happened | ±20 |
| MACD momentum | MACD line vs. signal line, histogram expanding/contracting | ±20 |
| RSI(14) | Momentum zone (bullish 55–70, bearish 30–45, etc.) | ±15 |
| Volume confirmation | Today's volume vs. 20-day average, relative to price direction | ±15 |

The weights sum to a composite score from **-100 to 100**:

- `score >= 22` → **CALL**
- `score <= -22` → **PUT**
- otherwise → **NEUTRAL**

**Confidence** is a separate 0–100 metric blending how many components agree
with the final direction and the ADX(14) trend-strength reading (a strong ADX
means the trend is more likely to persist; a weak one means the market is
choppy and the signal is less trustworthy even if the score is high).

All the math lives in `lib/indicators.ts` (SMA/EMA/RSI/MACD/ADX from scratch,
no external TA library) and `lib/signal.ts` (the composite scoring). Both are
pure functions with no side effects, so you can unit test or tune them
independently of the UI.

Run `npm run test:indicators` to sanity-check the math against synthetic
up/down-trending price series.

## Data source

Price history and live quotes come from [Financial Modeling Prep](https://financialmodelingprep.com)
(`lib/fmp.ts`):

- `GET /api/v3/historical-price-full/{symbol}` — ~1 year of daily OHLCV bars,
  used to compute every indicator.
- `GET /api/v3/quote/{symbol}` — a fresher live/delayed price and change%,
  layered on top of the last daily bar so the header numbers don't lag
  mid-session. If the quote call fails for any reason, the app silently
  falls back to the last daily bar's close — it never blocks the signal.

You need an API key: sign up at
[site.financialmodelingprep.com/developer/docs](https://site.financialmodelingprep.com/developer/docs)
and set it as `FMP_API_KEY` (see **Environment variable** below). Free-tier
FMP plans cap daily request volume and may restrict which endpoints are
available — if you hit 401/403/429 errors, check your plan's limits on the
FMP dashboard. Each ticker in a screen costs 2 requests (history + quote).

If you ever want to swap providers, everything downstream only depends on
the `Bar[]` shape defined in `lib/signal.ts`, so you can point
`app/api/screen/route.ts` at a different `fetchDailyBars`/`fetchQuote`
implementation without touching the scoring engine or UI.

## Environment variable

Required in every environment (local + Vercel):

| Variable | Where it's used | Required |
|---|---|---|
| `FMP_API_KEY` | `lib/fmp.ts`, server-side only (never exposed to the browser) | Yes |

**Local dev:** copy `.env.local.example` to `.env.local` and fill in your key.
`.env.local` is already git-ignored, so your key never gets committed.

```bash
cp .env.local.example .env.local
# then edit .env.local and paste your key in
```

**Vercel:** in the project → **Settings → Environment Variables**, add
`FMP_API_KEY` with your key for the Production (and Preview, if you want)
environment, then redeploy. The app will fail with a clear "Missing
FMP_API_KEY" error in the results panel if it's not set — it won't fail
silently.

## Project structure

```
app/
  api/screen/route.ts   # GET /api/screen?symbols=AAPL,MSFT — runs the screen
  page.tsx              # dashboard UI
  layout.tsx            # fonts + metadata
  globals.css           # design tokens / base styles
components/
  ScreenerRow.tsx        # expandable row: badge, gauge, reasons, raw indicators
  SignalMeter.tsx         # -100..100 gauge (signature UI element)
  DirectionBadge.tsx      # CALL/PUT/NEUTRAL pill
lib/
  indicators.ts          # SMA, EMA, RSI, MACD, ADX (from scratch)
  signal.ts              # composite scoring engine
  fmp.ts                   # Financial Modeling Prep fetch wrapper
scripts/
  test-indicators.ts      # sanity test against synthetic data
```

## Run locally

```bash
npm install
cp .env.local.example .env.local   # then paste in your FMP_API_KEY
npm run dev
```

Open http://localhost:3000, type in some tickers (e.g. `AAPL, MSFT, NVDA`),
and click **Run Screen**.

## Deploy: GitHub → Vercel

### 1. Push to GitHub

```bash
cd signal-dashboard
git init
git add -A
git commit -m "Initial commit: signal desk dashboard"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

(Create the empty repo on GitHub first — no README/license, since this
project already has one — then use the URL GitHub gives you for
`git remote add origin`.)

### 2. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. Import the repository you just pushed.
3. Vercel auto-detects Next.js — leave the build settings as default
   (`npm run build`, output directory auto-detected).
4. Before or right after your first deploy, add the `FMP_API_KEY`
   environment variable under **Settings → Environment Variables** (see
   below) — without it, every screen request will return a clear
   "Missing FMP_API_KEY" error instead of data.
5. Click **Deploy**. You'll get a live URL (`your-repo.vercel.app`) in about
   a minute.

Every future `git push` to `main` will trigger an automatic redeploy.

### 3. (Optional) custom domain

In the Vercel project → **Settings → Domains**, add your own domain and
follow the DNS instructions Vercel gives you.

## Extending it

- **Add more tickers to the default watchlist / presets**: edit
  `DEFAULT_WATCHLIST` and `PRESETS` in `app/page.tsx`.
- **Add options-specific context** (IV rank, put/call skew): the composite
  score currently only reasons about the underlying stock's direction, not
  options pricing. Wiring in an options-chain data provider would let you
  layer IV/skew into the score or into a separate "is this a good time to
  buy premium" indicator.
- **Auto-refresh**: the `/api/screen` route is a plain GET, so it's easy to
  poll on an interval with `setInterval` + `runScreen()` in `app/page.tsx`,
  or trigger it from a Vercel Cron Job for a scheduled scan.
- **Persist watchlists**: currently the watchlist lives in component state
  only. Add a database (Vercel Postgres, Supabase, etc.) if you want saved
  watchlists per user.
