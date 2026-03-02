import { describe, it, expect, vi } from 'vitest';
import { LiabilityManager } from '../liability_manager';
import { PersistenceEngine } from '../persistence';

// Mock PersistenceEngine to avoid DB/LocalStorage issues during unit tests
vi.mock('../persistence', () => ({
  PersistenceEngine: {
    getActiveLiabilities: vi.fn(),
    getLiabilities: vi.fn(),
    getAllocations: vi.fn()
  }
}));

describe('LiabilityManager', () => {
  describe('getTotalLiabilities', () => {
    it('should sum all active liabilities', async () => {
      vi.mocked(PersistenceEngine.getActiveLiabilities).mockResolvedValue([
        { id: 1, label: 'L1', remainingAmount: 1000 } as any,
        { id: 2, label: 'L2', remainingAmount: 500 } as any
      ]);

      const total = await LiabilityManager.getTotalLiabilities();
      expect(total).toBe(1500);
    });

    it('should return 0 if no liabilities', async () => {
      vi.mocked(PersistenceEngine.getActiveLiabilities).mockResolvedValue([]);
      const total = await LiabilityManager.getTotalLiabilities();
      expect(total).toBe(0);
    });
  });
});
