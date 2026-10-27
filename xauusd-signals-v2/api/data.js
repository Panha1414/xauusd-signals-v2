// Vercel Serverless Function
// GET /api/data
// Returns candles + signals + stats calculated from Pine Script logic

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const API_KEY = process.env.TWELVE_DATA_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'TWELVE_DATA_API_KEY is not set in Environment Variables' });
  }

  try {
    // Fetch last 500 candles of 15min XAU/USD
    // outputsize max on free plan is usually 5000, but 400-500 is enough for EMA200
    const url = `https://api.twelvedata.com/time_series?symbol=XAU/USD&interval=15min&outputsize=400&timezone=Asia/Phnom_Penh&apikey=${API_KEY}`;
    
    const response = await fetch(url);
    const json = await response.json();

    if (json.status === 'error' || !json.values) {
      return res.status(502).json({ 
        error: 'Twelve Data error', 
        message: json.message || 'No data returned',
        code: json.code 
      });
    }

    // Twelve Data returns newest first → reverse to oldest first
    const raw = json.values.reverse();

    // Normalize candles
    const candles = raw.map(c => ({
      time: Math.floor(new Date(c.datetime).getTime() / 1000), // unix seconds
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
      datetime: c.datetime
    }));

    // ===== Calculate Indicators & Signals (same logic as Pine Script) =====
    const result = calculateSignals(candles);

    return res.status(200).json({
      success: true,
      symbol: 'XAU/USD',
      interval: '15min',
      timezone: 'Asia/Phnom_Penh',
      lastUpdate: new Date().toISOString(),
      candles: candles,
      ...result
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}

// ====================== INDICATOR FUNCTIONS ======================

function ema(values, period) {
  const k = 2 / (period + 1);
  const result = new Array(values.length).fill(null);
  if (values.length < period) return result;

  // SMA for first value
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  result[period - 1] = sum / period;

  for (let i = period; i < values.length; i++) {
    result[i] = values[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

function rsi(closes, period = 14) {
  const result = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return result;

  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }
  return result;
}

function atr(highs, lows, closes, period = 14) {
  const result = new Array(closes.length).fill(null);
  const trs = [];

  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      trs.push(highs[i] - lows[i]);
    } else {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trs.push(tr);
    }
  }

  // Wilder's smoothing
  let sum = 0;
  for (let i = 0; i < period; i++) sum += trs[i];
  result[period - 1] = sum / period;

  for (let i = period; i < closes.length; i++) {
    result[i] = (result[i - 1] * (period - 1) + trs[i]) / period;
  }
  return result;
}

// ====================== MAIN SIGNAL LOGIC ======================

function calculateSignals(candles) {
  const closes = candles.map(c => c.close);
  const highs  = candles.map(c => c.high);
  const lows   = candles.map(c => c.low);

  const ema20  = ema(closes, 20);
  const ema50  = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const rsi14  = rsi(closes, 14);
  const atr14  = atr(highs, lows, closes, 14);

  // Config from Pine
  const ATR_MULT = 1.5;
  const RR = 1.0;
  const MAX_TRADES = 3;

  // Session times (KH = UTC+7)
  // Session 1: 14:00 - 17:00
  // Session 2: 19:30 - 23:00

  let tradesToday = 0;
  let currentDay = null;
  let dir = 0;          // 1 = long, -1 = short, 0 = flat
  let entry = null, sl = null, tp = null;
  let wins = 0, losses = 0;

  const signals = [];   // all historical signals
  const markers = [];   // for chart

  for (let i = 200; i < candles.length; i++) {  // start after EMA200 is ready
    const c = candles[i];
    const dt = new Date(c.datetime + '+07:00'); // force KH timezone interpretation
    const hour = dt.getHours();
    const minute = dt.getMinutes();
    const dayKey = dt.toISOString().slice(0, 10);

    // Reset daily counter
    if (dayKey !== currentDay) {
      currentDay = dayKey;
      tradesToday = 0;
    }

    // Close previous trade (conservative: SL first)
    if (dir === 1) {
      if (c.low <= sl) {
        losses++;
        dir = 0;
      } else if (c.high >= tp) {
        wins++;
        dir = 0;
      }
    } else if (dir === -1) {
      if (c.high >= sl) {
        losses++;
        dir = 0;
      } else if (c.low <= tp) {
        wins++;
        dir = 0;
      }
    }

    // Session filter
    const inSess1 = (hour > 14 || (hour === 14 && minute >= 0)) && (hour < 17);
    const inSess2 = (hour > 19 || (hour === 19 && minute >= 30)) && (hour < 23);
    const inSession = inSess1 || inSess2;

    // Trend
    const upTrend   = ema50[i] > ema200[i] && c.close > ema200[i];
    const downTrend = ema50[i] < ema200[i] && c.close < ema200[i];

    // Crossover / Crossunder on closed candle
    const crossOver  = closes[i - 1] < ema20[i - 1] && closes[i] > ema20[i];
    const crossUnder = closes[i - 1] > ema20[i - 1] && closes[i] < ema20[i];

    const buyCond  = upTrend && crossOver && rsi14[i] > 50;
    const sellCond = downTrend && crossUnder && rsi14[i] < 50;

    const canTrade = dir === 0 && tradesToday < MAX_TRADES && inSession;

    if (canTrade && (buyCond || sellCond)) {
      const risk = atr14[i] * ATR_MULT;
      entry = c.close;
      dir = buyCond ? 1 : -1;
      sl = buyCond ? entry - risk : entry + risk;
      tp = buyCond ? entry + risk * RR : entry - risk * RR;
      tradesToday++;

      const signal = {
        time: c.time,
        datetime: c.datetime,
        type: buyCond ? 'BUY' : 'SELL',
        entry: +entry.toFixed(2),
        sl: +sl.toFixed(2),
        tp: +tp.toFixed(2),
        atr: +atr14[i].toFixed(2),
        rsi: +rsi14[i].toFixed(1)
      };
      signals.push(signal);

      markers.push({
        time: c.time,
        position: buyCond ? 'belowBar' : 'aboveBar',
        color: buyCond ? '#26a69a' : '#ef5350',
        shape: buyCond ? 'arrowUp' : 'arrowDown',
        text: buyCond ? 'BUY' : 'SELL'
      });
    }
  }

  // Current open trade (if any)
  const openTrade = dir !== 0 ? {
    direction: dir === 1 ? 'BUY' : 'SELL',
    entry: +entry.toFixed(2),
    sl: +sl.toFixed(2),
    tp: +tp.toFixed(2)
  } : null;

  // Latest signal
  const latestSignal = signals.length > 0 ? signals[signals.length - 1] : null;

  // Today's trades count (from last day in data)
  const lastDay = candles[candles.length - 1]?.datetime?.slice(0, 10);
  const todaySignals = signals.filter(s => s.datetime.startsWith(lastDay));

  const total = wins + losses;
  const winRate = total > 0 ? +(wins * 100 / total).toFixed(1) : 0;

  return {
    ema20: ema20.map(v => v !== null ? +v.toFixed(2) : null),
    ema50: ema50.map(v => v !== null ? +v.toFixed(2) : null),
    ema200: ema200.map(v => v !== null ? +v.toFixed(2) : null),
    signals,
    markers,
    openTrade,
    latestSignal,
    stats: {
      wins,
      losses,
      winRate,
      totalTrades: total,
      tradesToday: todaySignals.length,
      maxTrades: MAX_TRADES
    }
  };
}
