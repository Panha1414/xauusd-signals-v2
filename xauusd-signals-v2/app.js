// ====================== CONFIG ======================
const POLL_INTERVAL = 45000; // 45 seconds (safe for free Twelve Data plan)
const API_BASE = ''; // same origin

// ====================== STATE ======================
let chart = null;
let candleSeries = null;
let ema20Series = null;
let ema50Series = null;
let ema200Series = null;
let lastSignalKey = null; // to detect new signal for Telegram

// ====================== INIT CHART ======================
function initChart() {
  const container = document.getElementById('chart');
  chart = LightweightCharts.createChart(container, {
    layout: {
      background: { type: 'solid', color: '#1a1d27' },
      textColor: '#d1d5db',
    },
    grid: {
      vertLines: { color: '#2a2e3b' },
      horzLines: { color: '#2a2e3b' },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
    },
    rightPriceScale: {
      borderColor: '#2a2e3b',
    },
    timeScale: {
      borderColor: '#2a2e3b',
      timeVisible: true,
      secondsVisible: false,
    },
  });

  candleSeries = chart.addCandlestickSeries({
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderDownColor: '#ef5350',
    borderUpColor: '#26a69a',
    wickDownColor: '#ef5350',
    wickUpColor: '#26a69a',
  });

  ema20Series = chart.addLineSeries({
    color: '#22d3ee',
    lineWidth: 1,
    title: 'EMA 20',
  });

  ema50Series = chart.addLineSeries({
    color: '#f97316',
    lineWidth: 1,
    title: 'EMA 50',
  });

  ema200Series = chart.addLineSeries({
    color: '#ef4444',
    lineWidth: 2,
    title: 'EMA 200',
  });

  // Responsive
  const resizeObserver = new ResizeObserver(entries => {
    if (entries.length === 0 || !entries[0].contentRect) return;
    const { width, height } = entries[0].contentRect;
    chart.applyOptions({ width, height });
  });
  resizeObserver.observe(container);
}

// ====================== RENDER DATA ======================
function renderData(data) {
  if (!data || !data.candles) return;

  // Candles
  const candleData = data.candles.map(c => ({
    time: c.time,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
  candleSeries.setData(candleData);

  // EMAs (filter nulls)
  const makeLine = (arr) => data.candles
    .map((c, i) => arr[i] !== null ? { time: c.time, value: arr[i] } : null)
    .filter(Boolean);

  ema20Series.setData(makeLine(data.ema20));
  ema50Series.setData(makeLine(data.ema50));
  ema200Series.setData(makeLine(data.ema200));

  // Markers
  if (data.markers && data.markers.length) {
    candleSeries.setMarkers(data.markers);
  }

  // Stats
  document.getElementById('wins').textContent = data.stats.wins;
  document.getElementById('losses').textContent = data.stats.losses;
  document.getElementById('winRate').textContent = data.stats.winRate + '%';
  document.getElementById('tradesToday').textContent = `${data.stats.tradesToday}/${data.stats.maxTrades}`;

  // Open trade
  const openBox = document.getElementById('openTradeBox');
  if (data.openTrade) {
    openBox.style.display = 'block';
    document.getElementById('openTradeInfo').textContent =
      `${data.openTrade.direction} @ ${data.openTrade.entry}`;
  } else {
    openBox.style.display = 'none';
  }

  // Latest signal card
  if (data.latestSignal) {
    const s = data.latestSignal;
    const badge = document.getElementById('signalType');
    badge.textContent = s.type;
    badge.className = 'badge ' + s.type;

    document.getElementById('signalTime').textContent = s.datetime.replace(' ', ' • ');
    document.getElementById('sigEntry').textContent = s.entry;
    document.getElementById('sigSL').textContent = s.sl;
    document.getElementById('sigTP').textContent = s.tp;
    document.getElementById('sigRSI').textContent = s.rsi;
  }

  // Recent signals table (last 15)
  const tbody = document.getElementById('signalsTable');
  tbody.innerHTML = '';
  const recent = (data.signals || []).slice(-15).reverse();
  recent.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.datetime.slice(5, 16)}</td>
      <td class="${s.type}">${s.type}</td>
      <td>${s.entry}</td>
      <td>${s.sl}</td>
      <td>${s.tp}</td>
    `;
    tbody.appendChild(tr);
  });

  // Last update time
  const now = new Date();
  document.getElementById('lastUpdate').textContent =
    now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Connection status
  document.getElementById('connectionStatus').className = 'dot online';

  // ===== Telegram Alert on new signal =====
  if (data.latestSignal) {
    const key = data.latestSignal.datetime + data.latestSignal.type;
    if (lastSignalKey && key !== lastSignalKey) {
      // New signal detected → send Telegram
      sendTelegramAlert(data.latestSignal);
    }
    lastSignalKey = key;
  }

  // Fit content on first load
  if (!window._chartFitted) {
    chart.timeScale().fitContent();
    window._chartFitted = true;
  }
}

// ====================== TELEGRAM ======================
async function sendTelegramAlert(signal) {
  const msg = `
🚨 <b>XAUUSD ${signal.type} SIGNAL</b>

📅 ${signal.datetime}
💰 Entry: <b>${signal.entry}</b>
🛑 SL: <b>${signal.sl}</b>
🎯 TP: <b>${signal.tp}</b>
📊 RSI: ${signal.rsi}

Session: KH Time (UTC+7)
`.trim();

  try {
    await fetch(API_BASE + '/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    console.log('Telegram alert sent');
  } catch (err) {
    console.error('Failed to send Telegram:', err);
  }
}

// ====================== FETCH DATA ======================
async function fetchData() {
  try {
    const res = await fetch(API_BASE + '/api/data');
    if (!res.ok) throw new Error('API error ' + res.status);
    const data = await res.json();

    if (data.error) {
      console.error(data);
      document.getElementById('connectionStatus').className = 'dot offline';
      return;
    }

    renderData(data);
  } catch (err) {
    console.error('Fetch failed:', err);
    document.getElementById('connectionStatus').className = 'dot offline';
  }
}

// ====================== START ======================
document.addEventListener('DOMContentLoaded', () => {
  initChart();
  fetchData();
  setInterval(fetchData, POLL_INTERVAL);
});
