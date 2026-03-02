/**
 * WealthEngine [The Architect]
 * Manages salary distribution and budget allocation.
 */
export interface SalaryAllocation {
  total: number;
  necessities: number;    // 50%
  investment: number;     // 25%
  securityBuffer: number; // 15%
  lifestyle: number;      // 10%
}

export interface ForecastData {
  month: number;
  balance: number;
}

export const ALLOCATION_RATIOS = {
  necessities: 0.50,
  investment: 0.25,
  securityBuffer: 0.15,
  lifestyle: 0.10
} as const;

export class WealthEngine {
  static allocate(salary: number): SalaryAllocation {
    return {
      total: salary,
      necessities: salary * ALLOCATION_RATIOS.necessities,
      investment: salary * ALLOCATION_RATIOS.investment,
      securityBuffer: salary * ALLOCATION_RATIOS.securityBuffer,
      lifestyle: salary * ALLOCATION_RATIOS.lifestyle
    };
  }

  static getStatus(allocation: SalaryAllocation): string {
    if (allocation.total <= 0) return "INACTIVE";
    if (allocation.investment >= allocation.total * 0.20) return "HYPER_ACCELERATOR";
    return "STABLE_GROWTH";
  }

  /**
   * Calculate compounding trajectory.
   * Formula: A = P(1 + r/n)^(nt) + PMT * (((1 + r/n)^(nt) - 1) / (r/n))
   */
  static calculateCompound(monthlyInvest: number, annualRate: number, months: number = 120, initialBalance: number = 0): ForecastData[] {
    const r = annualRate / 100 / 12; // Monthly rate
    const data: ForecastData[] = [];
    let currentBalance = initialBalance;

    for (let m = 0; m <= months; m++) {
      if (m > 0) {
        currentBalance = (currentBalance + monthlyInvest) * (1 + r);
      }
      data.push({ month: m, balance: currentBalance });
    }
    return data;
  }

  /**
   * Calculates weighted average yield, skipping dynamic (price-based) platforms.
   */
  static calculateWeightedYield(allocations: { amount: number, annual_yield: number, type?: 'fixed' | 'dynamic' }[]): number {
    // Only count 'fixed' yield platforms. Dynamic assets (BTC) are tracked by value variation, not annual %.
    const yieldAllocations = allocations.filter(a => a.type !== 'dynamic');
    const totalAmount = yieldAllocations.reduce((sum, a) => sum + a.amount, 0);
    if (totalAmount === 0) return 0;

    const weightedSum = yieldAllocations.reduce((sum, a) => sum + (a.amount * a.annual_yield), 0);
    return weightedSum / totalAmount;
  }
}
