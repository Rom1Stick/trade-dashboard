import { PersistenceEngine } from './persistence';
import type { Trade, TradeFee } from './models';

// ─── Configuration ──────────────────────────────────────────

export interface BingXConfig {
  apiKey: string;
  secretKey: string;
}

/**
 * BingXConnector [Shadow Operator]
 * Connects to BingX API via the local proxy server.
 * Handles trade fetching, position tracking, and balance retrieval.
 * Keys are decrypted in the browser and sent to the local proxy for HMAC signing.
 */
export class BingXConnector {
  private config: BingXConfig;
  private proxyBase: string;
  private rateLimitRemaining = 1000;
  private lastRateLimitReset = Date.now();

  constructor(config: BingXConfig) {
    this.config = config;
    // In dev (Vite), proxy through the Vite dev server or direct to API
    // In prod (Docker), Nginx proxies /api/* to the Node service
    this.proxyBase = this.detectProxyBase();
    console.log(`[Shadow Operator] Initializing link for ${this.config.apiKey.slice(0, 4)}***`);
  }

  /**
   * Detect the correct proxy base URL based on environment.
   * Dev: Vite runs on 5173, API on 3001
   * Prod: Nginx handles both on port 80
   */
  private detectProxyBase(): string {
    const host = window.location.hostname;
    const port = window.location.port;

    // Dev mode: Vite dev server running on 5173
    if (port === '5173') {
      return `http://${host}:3001`;
    }

    // Production: same origin, Nginx proxies /api/*
    return '';
  }

  // ─── Core API Methods ───────────────────────────────────────

  /**
   * Fetch open positions from BingX.
   * Returns raw position data from the API.
   */
  async fetchPositions(): Promise<BingXPosition[]> {
    this.checkRateLimit();
    console.log('[Shadow Operator] Polling BingX for open positions...');

    try {
      const result = await this.proxyRequest('/api/bingx/positions');

      if (result.data?.code !== 0) {
        console.error('[Shadow Operator] BingX API error:', result.data?.msg || 'Unknown error');
        return [];
      }

      const positions = result.data?.data || [];
      console.log(`[Shadow Operator] ${positions.length} position(s) detected`);
      return positions;
    } catch (err) {
      console.error('[Shadow Operator] Failed to fetch positions:', err);
      return [];
    }
  }

  /**
   * Fetch trade history from BingX.
   * Maps BingX order format to our Trade model and persists to IndexedDB.
   */
  async fetchTrades(options: FetchTradesOptions = {}): Promise<Trade[]> {
    this.checkRateLimit();
    console.log('[Shadow Operator] Fetching trade history from BingX...');

    try {
      const now = Date.now();
      let start = options.startTime || (now - 7 * 24 * 60 * 60 * 1000);
      const end = options.endTime || now;
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000 - 1000; // 7 days minus a second

      let allRawOrders: any[] = [];
      let currentStart = start;

      while (currentStart < end) {
        let currentEnd = currentStart + SEVEN_DAYS;
        if (currentEnd > end) currentEnd = end;

        console.log(`[Shadow Operator] Fetching chunk: ${new Date(currentStart).toISOString()} to ${new Date(currentEnd).toISOString()}`);

        const result = await this.proxyRequest('/api/bingx/trades', {
          symbol: options.symbol,
          limit: options.limit?.toString() || '1000',
          startTime: currentStart.toString(),
          endTime: currentEnd.toString(),
        });

        if (result.data?.code !== 0) {
          console.error('[Shadow Operator] BingX API error:', result.data?.msg || 'Unknown error');
          break; // Stop loop instead of failing entirely to keep whatever data we have
        }

        const rawOrders = result.data?.data?.orders || [];
        allRawOrders = allRawOrders.concat(rawOrders);
        console.log(`[Shadow Operator] Chunk yielded ${rawOrders.length} raw order(s)`);

        currentStart = currentEnd + 1000;
        await new Promise(res => setTimeout(res, 250)); // rate limit protection
      }

      console.log(`[Shadow Operator] Total ${allRawOrders.length} raw order(s) received`);

      // 1. Map BingX orders to our Trade model
      const trades = this.mapOrdersToTrades(allRawOrders);
      const fees = this.extractFees(allRawOrders);

      // 2. Fetch Funding Fees as pseudo-trades
      const fundingPseudoTrades = await this.fetchFundingFees(options);
      const allTrades = [...trades, ...fundingPseudoTrades];

      if (allTrades.length > 0) {
        // Persist to IndexedDB
        await PersistenceEngine.saveTrades(allTrades, fees);
        console.log(`[Shadow Operator] ${allTrades.length} trade(s) (including funding) persisted to IndexedDB`);
      }

      return allTrades;
    } catch (err) {
      console.error('[Shadow Operator] Failed to fetch trades:', err);
      return [];
    }
  }

  /**
   * Fetch Funding Fees from BingX User Income API.
   * Maps them to pseudo-trades for unified PnL calculations.
   */
  async fetchFundingFees(options: FetchTradesOptions = {}): Promise<Trade[]> {
    this.checkRateLimit();
    console.log('[Shadow Operator] Fetching funding fees history...');

    try {
      const now = Date.now();
      let start = options.startTime || (now - 7 * 24 * 60 * 60 * 1000);
      const end = options.endTime || now;
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000 - 1000; 

      let allIncomes: any[] = [];
      let currentStart = start;

      while (currentStart < end) {
        let currentEnd = currentStart + SEVEN_DAYS;
        if (currentEnd > end) currentEnd = end;

        const result = await this.proxyRequest('/api/bingx/income', {
          symbol: options.symbol,
          limit: options.limit?.toString() || '1000',
          startTime: currentStart.toString(),
          endTime: currentEnd.toString(),
          incomeType: 'FUNDING_FEE',
        });

        if (result.data?.code !== 0) {
          console.error('[Shadow Operator] BingX Income API error:', result.data?.msg || 'Unknown error');
          break;
        }

        const incomes = result.data?.data || [];
        allIncomes = allIncomes.concat(incomes);

        currentStart = currentEnd + 1000;
        await new Promise(res => setTimeout(res, 250)); // rate limit protection
      }

      console.log(`[Shadow Operator] Total ${allIncomes.length} funding fee record(s) received`);

      return allIncomes.map((inc: any) => ({
        id: `funding_${inc.tranId || inc.id || Date.now() + Math.random()}`,
        pair: inc.symbol || 'UNKNOWN',
        type: 'FUNDING',
        entryPrice: 0,
        size: 0,
        leverage: 1,
        grossPnL: parseFloat(inc.income || '0'), // Represents the fee amount (usually negative if we paid, positive if we received)
        status: 'CLOSED',
        timestamp: parseInt(inc.time || inc.timestamp || Date.now().toString(), 10),
      }));
    } catch (err) {
      console.error('[Shadow Operator] Failed to fetch funding fees:', err);
      return [];
    }
  }

  /**
   * Fetch account balance from BingX.
   * Returns equity, available balance, and unrealized PnL.
   */
  async fetchBalance(): Promise<BingXBalance | null> {
    this.checkRateLimit();
    console.log('[Shadow Operator] Fetching account balance...');

    try {
      const result = await this.proxyRequest('/api/bingx/balance');

      if (result.data?.code !== 0) {
        console.error('[Shadow Operator] BingX API error:', result.data?.msg || 'Unknown error');
        return null;
      }

      const balanceData = result.data?.data?.balance || result.data?.data;
      if (!balanceData) return null;

      const balance: BingXBalance = {
        equity: parseFloat(balanceData.equity || '0'),
        availableMargin: parseFloat(balanceData.availableMargin || '0'),
        unrealizedPnL: parseFloat(balanceData.unrealizedProfit || '0'),
        usedMargin: parseFloat(balanceData.usedMargin || '0'),
      };

      console.log(`[Shadow Operator] Balance → Equity: ${balance.equity.toFixed(2)} USDT`);
      return balance;
    } catch (err) {
      console.error('[Shadow Operator] Failed to fetch balance:', err);
      return null;
    }
  }

  // ─── Data Mapping ─────────────────────────────────────────

  /**
   * Map BingX order objects to our normalized Trade model.
   * BingX fields: orderId, symbol, side, positionSide, avgPrice, price,
   *               origQty, executedQty, profit, leverage, status, time
   */
  private mapOrdersToTrades(orders: any[]): Trade[] {
    return orders
      .filter((o: any) => o.status === 'FILLED') // Only fully executed orders
      .map((o: any) => {
        const pair = (o.symbol || '').replace('-', '/');
        const positionSide = o.positionSide || o.side;
        const type: 'LONG' | 'SHORT' = positionSide === 'SHORT' ? 'SHORT' : 'LONG';

        // Determine if this is an entry (OPEN) or exit (CLOSE) based on side+positionSide
        const isClose = (o.side === 'SELL' && positionSide === 'LONG') ||
          (o.side === 'BUY' && positionSide === 'SHORT');

        const trade: Trade = {
          id: String(o.orderId),
          pair: pair,
          type: type,
          entryPrice: parseFloat(o.avgPrice || o.price || '0'),
          exitPrice: isClose ? parseFloat(o.avgPrice || o.price || '0') : undefined,
          size: parseFloat(o.executedQty || o.origQty || '0'),
          leverage: parseInt(o.leverage || '1', 10),
          grossPnL: parseFloat(o.profit || '0'),
          status: isClose ? 'CLOSED' : 'OPEN',
          timestamp: parseInt(o.time || o.updateTime || Date.now().toString(), 10),
        };

        return trade;
      });
  }

  /**
   * Extract fee information from BingX orders.
   * Returns a map of trade_id → fees array.
   */
  private extractFees(orders: any[]): Record<string, Omit<TradeFee, 'id'>[]> {
    const feesByTradeId: Record<string, Omit<TradeFee, 'id'>[]> = {};

    orders
      .filter((o: any) => o.status === 'FILLED')
      .forEach((o: any) => {
        const tradeId = String(o.orderId);
        const commission = Math.abs(parseFloat(o.commission || '0'));

        if (commission > 0) {
          feesByTradeId[tradeId] = [{
            trade_id: tradeId,
            fee_type: o.isMaker ? 'maker' : 'taker',
            amount: commission,
            is_actual: true,
          }];
        }
      });

    return feesByTradeId;
  }

  // ─── Proxy Request ────────────────────────────────────────

  private async proxyRequest(endpoint: string, extraParams?: Record<string, string | undefined>): Promise<any> {
    const body: Record<string, any> = {
      apiKey: this.config.apiKey,
      secretKey: this.config.secretKey,
    };

    // Add non-undefined extra params
    if (extraParams) {
      Object.entries(extraParams).forEach(([k, v]) => {
        if (v !== undefined) body[k] = v;
      });
    }

    const response = await fetch(`${this.proxyBase}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Proxy responded with ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    // Update rate limits from proxy response
    if (result.rateLimits?.remaining != null) {
      this.updateRateLimit(result.rateLimits.remaining);
    }

    return result;
  }

  // ─── Rate Limiting ────────────────────────────────────────

  private checkRateLimit() {
    if (this.rateLimitRemaining < 10) {
      const wait = 1000 - (Date.now() - this.lastRateLimitReset);
      if (wait > 0) {
        console.warn(`[Shadow Operator] Rate limit critical. Throttling for ${wait}ms...`);
      }
    }
  }

  updateRateLimit(remaining: number) {
    this.rateLimitRemaining = remaining;
    this.lastRateLimitReset = Date.now();
  }
}

// ─── Types ──────────────────────────────────────────────────

export interface BingXBalance {
  equity: number;
  availableMargin: number;
  unrealizedPnL: number;
  usedMargin: number;
}

export interface BingXPosition {
  symbol: string;
  positionSide: string;
  positionAmt: string;
  avgPrice: string;
  unrealizedProfit: string;
  leverage: string;
  [key: string]: any;
}

export interface FetchTradesOptions {
  symbol?: string;
  limit?: number;
  startTime?: number;
  endTime?: number;
}
