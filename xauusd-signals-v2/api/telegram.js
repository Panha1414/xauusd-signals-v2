// Vercel Serverless Function
// POST /api/telegram
// Body: { message: "text to send" }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    return res.status(500).json({ 
      error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set in Environment Variables' 
    });
  }

  try {
    const { message } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: 'Missing message in body' });
    }

    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const tgRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    const data = await tgRes.json();

    if (!data.ok) {
      return res.status(502).json({ error: 'Telegram API error', details: data });
    }

    return res.status(200).json({ success: true, message_id: data.result.message_id });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to send Telegram message', message: err.message });
  }
}
