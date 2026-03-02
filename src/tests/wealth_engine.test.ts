import { describe, it, expect } from 'vitest';
import { WealthEngine } from '../wealth_engine';

describe('WealthEngine', () => {
  describe('allocate', () => {
    it('should allocate salary according to 50/25/15/10 rule', () => {
      const allocation = WealthEngine.allocate(4000);
      expect(allocation.total).toBe(4000);
      expect(allocation.necessities).toBe(2000);    // 50%
      expect(allocation.investment).toBe(1000);     // 25%
      expect(allocation.securityBuffer).toBe(600);  // 15%
      expect(allocation.lifestyle).toBe(400);       // 10%
    });
  });

  describe('getStatus', () => {
    it('should return INACTIVE for zero salary', () => {
      expect(WealthEngine.getStatus(WealthEngine.allocate(0))).toBe('INACTIVE');
    });

    it('should return HYPER_ACCELERATOR for high investment ratio', () => {
      // 25% is > 20%
      expect(WealthEngine.getStatus(WealthEngine.allocate(2000))).toBe('HYPER_ACCELERATOR');
    });

    it('should return STABLE_GROWTH for standard ratio if it was lower (not possible with current allocate, but testing function)', () => {
      const lowInvest = { total: 1000, necessities: 500, investment: 150, securityBuffer: 250, lifestyle: 100 };
      expect(WealthEngine.getStatus(lowInvest)).toBe('STABLE_GROWTH');
    });
  });

  describe('calculateCompound', () => {
    it('should calculate basic compound interest correctly', () => {
      // 100/mo, 0% rate, 2 months
      const results = WealthEngine.calculateCompound(100, 0, 2, 0);
      expect(results[0].balance).toBe(0);
      expect(results[1].balance).toBe(100);
      expect(results[2].balance).toBe(200);
    });

    it('should apply monthly interest correctly', () => {
      // 1000 initial, 0 deposit, 12% annual (1% monthly), 1 month
      const results = WealthEngine.calculateCompound(0, 12, 1, 1000);
      // month 0: 1000
      // month 1: (1000 + 0) * 1.01 = 1010
      expect(results[1].balance).toBe(1010);
    });
  });

  describe('calculateWeightedYield', () => {
    it('should calculate weighted average accurately', () => {
      const platforms = [
        { amount: 1000, annual_yield: 10 }, // 100 yield
        { amount: 3000, annual_yield: 2 }   // 60 yield
      ];
      // Total amount: 4000. Total yield: 160. Weighted = 160 / 4000 = 4%
      expect(WealthEngine.calculateWeightedYield(platforms)).toBe(4);
    });

    it('should skip dynamic assets', () => {
      const platforms = [
        { amount: 1000, annual_yield: 10, type: 'fixed' as const },
        { amount: 5000, annual_yield: 500, type: 'dynamic' as const } // Should be ignored
      ];
      expect(WealthEngine.calculateWeightedYield(platforms)).toBe(10);
    });

    it('should return 0 if no fixed assets', () => {
      expect(WealthEngine.calculateWeightedYield([])).toBe(0);
    });
  });
});
