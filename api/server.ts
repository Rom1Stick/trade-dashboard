import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── BingX API Constants ────────────────────────────────────
const BINGX_BASE = 'https://open-api.bingx.com';

const ENDPOINTS = {
  positions: '/openApi/swap/v2/user/positions',
  trades: '/openApi/swap/v2/trade/allOrders',
  balance: '/openApi/swap/v2/user/balance',
  income: '/openApi/swap/v2/user/income',
} as const;

// ─── Middleware ──────────────────────────────────────────────
app.use(cors({ origin: true }));
app.use(express.json());

// ─── HMAC-SHA256 Signature ──────────────────────────────────
function sign(queryString: string, secretKey: string): string {
  return crypto
    .createHmac('sha256', secretKey)
    .update(queryString)
    .digest('hex');
}

// ─── Generic BingX Proxy Handler ────────────────────────────
async function proxyBingX(
  endpoint: string,
  method: 'GET' | 'POST',
  apiKey: string,
  secretKey: string,
  extraParams: Record<string, string> = {}
) {
  const timestamp = Date.now().toString();
  const params = new URLSearchParams({
    timestamp,
    recvWindow: '5000',
    ...extraParams,
  });

  // Sort parameters alphabetically (BingX requirement)
  const sortedParams = new URLSearchParams(
    [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
  );

  const queryString = sortedParams.toString();
  const signature = sign(queryString, secretKey);

  const url = `${BINGX_BASE}${endpoint}?${queryString}&signature=${signature}`;

  const response = await fetch(url, {
    method,
    headers: {
      'X-BX-APIKEY': apiKey,
      'Content-Type': 'application/json',
    },
  });

  // Parse rate limit headers
  const rateLimitRemaining = response.headers.get('X-BX-RateLimit-Remaining');
  const rateLimitReset = response.headers.get('X-BX-RateLimit-Reset');

  const data = await response.json();

  return {
    data,
    rateLimits: {
      remaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : null,
      reset: rateLimitReset ? parseInt(rateLimitReset) : null,
    },
    status: response.status,
  };
}

// ─── Routes ─────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Fetch open positions
app.post('/api/bingx/positions', async (req, res) => {
  try {
    const { apiKey, secretKey } = req.body;
    if (!apiKey || !secretKey) {
      return res.status(400).json({ error: 'Missing apiKey or secretKey' });
    }

    const result = await proxyBingX(ENDPOINTS.positions, 'GET', apiKey, secretKey);
    res.json(result);
  } catch (err: any) {
    console.error('[BingX Proxy] positions error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Fetch trade history (closed orders)
app.post('/api/bingx/trades', async (req, res) => {
  try {
    const { apiKey, secretKey, symbol, limit, startTime, endTime } = req.body;
    if (!apiKey || !secretKey) {
      return res.status(400).json({ error: 'Missing apiKey or secretKey' });
    }

    const extraParams: Record<string, string> = {};
    if (symbol) extraParams.symbol = symbol;
    if (limit) extraParams.limit = String(limit);
    if (startTime) extraParams.startTime = String(startTime);
    if (endTime) extraParams.endTime = String(endTime);

    const result = await proxyBingX(ENDPOINTS.trades, 'GET', apiKey, secretKey, extraParams);
    res.json(result);
  } catch (err: any) {
    console.error('[BingX Proxy] trades error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Fetch account income (Funding fees, etc.)
app.post('/api/bingx/income', async (req, res) => {
  try {
    const { apiKey, secretKey, symbol, limit, startTime, endTime, incomeType } = req.body;
    if (!apiKey || !secretKey) {
      return res.status(400).json({ error: 'Missing apiKey or secretKey' });
    }

    const extraParams: Record<string, string> = {};
    if (symbol) extraParams.symbol = symbol;
    if (limit) extraParams.limit = String(limit);
    if (startTime) extraParams.startTime = String(startTime);
    if (endTime) extraParams.endTime = String(endTime);
    if (incomeType) extraParams.incomeType = incomeType;

    const result = await proxyBingX(ENDPOINTS.income, 'GET', apiKey, secretKey, extraParams);
    res.json(result);
  } catch (err: any) {
    console.error('[BingX Proxy] income error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Fetch account balance
app.post('/api/bingx/balance', async (req, res) => {
  try {
    const { apiKey, secretKey } = req.body;
    if (!apiKey || !secretKey) {
      return res.status(400).json({ error: 'Missing apiKey or secretKey' });
    }

    const result = await proxyBingX(ENDPOINTS.balance, 'GET', apiKey, secretKey);
    res.json(result);
  } catch (err: any) {
    console.error('[BingX Proxy] balance error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Cloud Sync (E2EE) ──────────────────────────────────────
const SYNC_DIR = path.join(process.cwd(), 'data');

// Ensure sync directory exists
async function ensureSyncDir() {
  try {
    await fs.mkdir(SYNC_DIR, { recursive: true });
  } catch (err) {
    // Ignore if exists
  }
}
void ensureSyncDir();

// Push encrypted blob
app.post('/api/sync/push', async (req, res) => {
  try {
    const { uid, data } = req.body;
    if (!uid || !data) {
      return res.status(400).json({ error: 'Missing uid or data' });
    }

    // Sanitize UID (prevent path traversal)
    const safeUid = uid.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filePath = path.join(SYNC_DIR, `${safeUid}.json.enc`);

    await fs.writeFile(filePath, JSON.stringify({
      uid,
      data,
      timestamp: Date.now()
    }));

    console.log(`[Sync] 🔼 Data pushed for UID: ${uid}`);
    res.json({ success: true, timestamp: Date.now() });
  } catch (err: any) {
    console.error('[Sync] push error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Pull encrypted blob
app.get('/api/sync/pull/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    if (!uid) {
      return res.status(400).json({ error: 'Missing uid' });
    }

    const safeUid = uid.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filePath = path.join(SYNC_DIR, `${safeUid}.json.enc`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const payload = JSON.parse(content);
      console.log(`[Sync] 🔽 Data pulled for UID: ${uid}`);
      res.json(payload);
    } catch (err) {
      res.status(404).json({ error: 'No data found for this UID' });
    }
  } catch (err: any) {
    console.error('[Sync] pull error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Start ──────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[BingX Proxy] ✅ Listening on port ${PORT}`);
  console.log(`[BingX Proxy] Endpoints: /api/bingx/positions | /api/bingx/trades | /api/bingx/balance | /api/bingx/income`);
});
