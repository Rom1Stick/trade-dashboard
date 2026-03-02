/**
 * CurrencyManager [QW-3]
 * Widget de conversion multi-devises avec cache local (TTL 15 min).
 * Sources : CoinGecko (gratuit, sans clé) pour EUR/USD et BTC/EUR.
 */

interface CachedRates {
  eurUsd: number;
  btcEur: number;
  timestamp: number;
}

const CACHE_KEY = 'hw_currency_rates';
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export class CurrencyManager {
  private static rates: CachedRates | null = null;

  static async init(): Promise<void> {
    // Try loading from cache first
    this.rates = this.loadCache();

    // Fetch fresh rates if cache is stale or missing
    if (!this.rates || Date.now() - this.rates.timestamp > CACHE_TTL) {
      await this.fetchRates();
    }

    this.renderWidget();
  }

  /** Fetch live rates from CoinGecko (free, no API key) */
  private static async fetchRates(): Promise<void> {
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,usd&vs_currencies=eur,usd'
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // CoinGecko returns: { bitcoin: { eur: X, usd: Y }, usd: { eur: Z } }
      // We need: EUR/USD rate and BTC/EUR rate
      const btcEur = data?.bitcoin?.eur ?? 0;
      const btcUsd = data?.bitcoin?.usd ?? 0;
      const eurUsd = btcUsd && btcEur ? btcUsd / btcEur : 1.08; // fallback

      this.rates = {
        eurUsd: Math.round(eurUsd * 10000) / 10000,
        btcEur: Math.round(btcEur * 100) / 100,
        timestamp: Date.now(),
      };

      this.saveCache(this.rates);
      console.log(`[CurrencyManager] Taux mis à jour — EUR/USD: ${this.rates.eurUsd}, BTC: ${this.rates.btcEur} €`);
    } catch (err) {
      console.warn('[CurrencyManager] API indisponible, utilisation du cache/fallback.', err);
      if (!this.rates) {
        this.rates = { eurUsd: 1.08, btcEur: 85000, timestamp: 0 };
      }
    }
  }

  /** Render the currency widget into the DOM */
  private static renderWidget(): void {
    const container = document.getElementById('currency-widget');
    if (!container || !this.rates) return;

    const isStale = Date.now() - this.rates.timestamp > CACHE_TTL;
    const staleIndicator = isStale ? ' ⚠️' : '';
    const updateTime = this.rates.timestamp
      ? new Date(this.rates.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : '—';

    container.innerHTML = `
      <div class="currency-rate">
        <span class="currency-pair">EUR/USD</span>
        <span class="currency-value">${this.rates.eurUsd.toFixed(4)}${staleIndicator}</span>
      </div>
      <div class="currency-rate">
        <span class="currency-pair">BTC/EUR</span>
        <span class="currency-value">${this.rates.btcEur.toLocaleString('fr-FR')} €${staleIndicator}</span>
      </div>
      <span class="currency-updated">MàJ ${updateTime}</span>
    `;
  }

  /** Convert amount between currencies */
  static convert(amount: number, from: 'EUR' | 'USD' | 'BTC', to: 'EUR' | 'USD' | 'BTC'): number {
    if (!this.rates || from === to) return amount;

    // Convert everything to EUR first, then to target
    let eurAmount: number;
    switch (from) {
      case 'EUR': eurAmount = amount; break;
      case 'USD': eurAmount = amount / this.rates.eurUsd; break;
      case 'BTC': eurAmount = amount * this.rates.btcEur; break;
    }

    switch (to) {
      case 'EUR': return eurAmount;
      case 'USD': return eurAmount * this.rates.eurUsd;
      case 'BTC': return eurAmount / this.rates.btcEur;
    }
  }

  // ─── Cache helpers ──────────────────────────────────────

  private static loadCache(): CachedRates | null {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as CachedRates;
    } catch {
      return null;
    }
  }

  private static saveCache(rates: CachedRates): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(rates));
    } catch { /* storage full — non-critical */ }
  }
}
