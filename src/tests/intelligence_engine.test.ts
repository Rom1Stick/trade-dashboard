import { describe, it, expect } from 'vitest';
import { IntelligenceEngine } from '../intelligence_engine';

describe('IntelligenceEngine', () => {
  describe('calculateRunway', () => {
    it('should calculate correct runway for typical values', () => {
      // 10000 / 2000 = 5 months
      expect(IntelligenceEngine.calculateRunway(10000, 2000)).toBe(5);
    });

    it('should handle zero expenses by returning 999 (infinity proxy)', () => {
      expect(IntelligenceEngine.calculateRunway(10000, 0)).toBe(999);
    });

    it('should handle zero buffer', () => {
      expect(IntelligenceEngine.calculateRunway(0, 2000)).toBe(0);
    });
  });

  describe('simulateCrash', () => {
    it('should apply -50% correctly on risky assets', () => {
      // Gross: 100k, Liabilities: 20k, Buffer: 20k
      // Risky Assets = 100k - 20k = 80k
      // After Crash = 80k * 0.5 = 40k
      // Total Wealth = 40k + 20k (buffer) = 60k
      // Net Worth = 60k - 20k (liabilities) = 40k
      expect(IntelligenceEngine.simulateCrash(100000, 20000, 20000)).toBe(40000);
    });

    it('should return negative if liabilities exceed crashed assets', () => {
      // Gross: 50k, Liabilities: 40k, Buffer: 10k
      // Risky = 40k -> 20k
      // Total = 20k + 10k = 30k
      // Net = 30k - 40k = -10k
      expect(IntelligenceEngine.simulateCrash(50000, 40000, 10000)).toBe(-10000);
    });
  });

  describe('analyzeExposure', () => {
    it('should detect platform concentration > 30%', () => {
      const items = [
        { category: 'investissement' as any, amount: 7000, platformName: 'Binance' },
        { category: 'investissement' as any, amount: 3000, platformName: 'Coinbase' }
      ];
      const alerts = IntelligenceEngine.analyzeExposure(items);
      expect(alerts).toHaveLength(2); // 1 Platform (Binance) + 1 Category (Investissement)
      expect(alerts.find(a => a.type === 'PLATFORM')?.label).toBe('Binance');
      expect(alerts.find(a => a.type === 'PLATFORM')?.percentage).toBe(70);
      expect(alerts[0].severity).toBe('CRITICAL');
    });

    it('should detect category concentration > 60%', () => {
      const items = [
        { category: 'investissement' as any, amount: 8500 },
        { category: 'securite' as any, amount: 1500 }
      ];
      const alerts = IntelligenceEngine.analyzeExposure(items);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].label).toBe('Investissement');
      expect(alerts[0].severity).toBe('CRITICAL');
    });

    it('should return no alerts for balanced portfolio', () => {
      const items = [
        { category: 'besoins' as any, amount: 2500, platformName: 'Bank A' },
        { category: 'investissement' as any, amount: 2500, platformName: 'Broker B' },
        { category: 'securite' as any, amount: 2500, platformName: 'Bank C' },
        { category: 'loisirs' as any, amount: 2500, platformName: 'Bank D' }
      ];
      const alerts = IntelligenceEngine.analyzeExposure(items);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('calculateDiversificationScore', () => {
    it('should give high score for diverse portfolio', () => {
      const items = [
        { category: 'besoins', platformId: 1 },
        { category: 'investissement', platformId: 2 },
        { category: 'securite', platformId: 3 },
        { category: 'loisirs', platformId: 4 },
        { category: 'investissement', platformId: 5 }
      ];
      const score = IntelligenceEngine.calculateDiversificationScore(items);
      expect(score).toBe(90); // 4 categories * 10 + 5 platforms * 10
    });

    it('should give low score for concentrated portfolio', () => {
      const items = [
        { category: 'investissement', platformId: 1 },
        { category: 'investissement', platformId: 1 }
      ];
      const score = IntelligenceEngine.calculateDiversificationScore(items);
      expect(score).toBe(20); // 1 category * 10 + 1 platform * 10
    });
  });

  describe('analyze', () => {
    it('should return SECURE status for balanced financials', () => {
      const items = [
        { category: 'besoins' as any, amount: 50000, platformId: 1, platformName: 'Bank' },
        { category: 'investissement' as any, amount: 50000, platformId: 2, platformName: 'Binance' },
        { category: 'securite' as any, amount: 50000, platformId: 3, platformName: 'Ledger' },
        { category: 'loisirs' as any, amount: 50000, platformId: 4, platformName: 'Cash' }
      ];
      const result = IntelligenceEngine.analyze({
        grossWealth: 200000,
        netWorth: 180000,
        totalLiabilities: 20000,
        monthlyExpenses: 2000,
        securityBuffer: 20000
      }, items);

      expect(result.status).toBe('SECURE');
      expect(result.exposureAlerts).toHaveLength(0);
      expect(result.diversificationScore).toBeGreaterThan(50);
    });

    it('should return WARNING if exposure alerts exist', () => {
      const items = [
        { category: 'investissement' as any, amount: 80000, platformName: 'Binance' },
        { category: 'securite' as any, amount: 20000 }
      ];
      const result = IntelligenceEngine.analyze({
        grossWealth: 100000,
        netWorth: 100000,
        totalLiabilities: 0,
        monthlyExpenses: 1000,
        securityBuffer: 20000
      }, items);

      // Binance is 80% -> Critical exposure -> Critical overall status
      expect(result.status).toBe('CRITICAL');
      expect(result.exposureAlerts.length).toBeGreaterThan(0);
    });
  });
});
