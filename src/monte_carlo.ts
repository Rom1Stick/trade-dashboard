import type { Trade } from './models';

/**
 * Monte Carlo Simulation Engine
 * Simule des trajectoires de croissance de capital basées sur
 * la distribution empirique des rendements de trading.
 */

export interface MonteCarloParams {
  initialCapital: number;       // Capital de départ ($)
  horizonMonths: number;        // Horizon (1, 12, 60, 120)
  tradesPerMonth: number;       // Nombre moyen de trades par mois
  numSimulations: number;       // Nombre de simulations (par défaut 5000)
}

export interface MonteCarloResult {
  params: MonteCarloParams;
  percentiles: {
    p10: number[];   // 10th percentile — pessimistic
    p25: number[];   // 25th percentile
    p50: number[];   // 50th percentile — median
    p75: number[];   // 75th percentile
    p90: number[];   // 90th percentile — optimistic
  };
  finalValues: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    mean: number;
    min: number;
    max: number;
  };
  labels: string[];  // Month labels for X axis
  winRate: number;    // % of sims ending in profit
  stats: {
    avgReturn: number;      // Mean return per trade
    stdReturn: number;      // Std dev of returns
    totalTrades: number;    // Source trades used
  };
}

export class MonteCarloEngine {

  /**
   * Extract return distribution from historical closed trades.
   * Returns array of P&L values (relative returns in $).
   */
  static extractReturns(trades: Trade[]): number[] {
    const closed = trades.filter(t => t.status === 'CLOSED' && t.grossPnL !== 0);
    return closed.map(t => t.grossPnL);
  }

  /**
   * Compute basic statistics from return distribution.
   */
  static computeStats(returns: number[]): { mean: number; std: number } {
    if (returns.length === 0) return { mean: 0, std: 0 };
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    return { mean, std: Math.sqrt(variance) };
  }

  /**
   * Estimate trades per month from historical data.
   */
  static estimateTradesPerMonth(trades: Trade[]): number {
    const closed = trades.filter(t => t.status === 'CLOSED');
    if (closed.length < 2) return 20; // default

    const timestamps = closed.map(t => t.timestamp).sort((a, b) => a - b);
    const spanMs = timestamps[timestamps.length - 1] - timestamps[0];
    const spanMonths = spanMs / (30.44 * 24 * 60 * 60 * 1000);

    if (spanMonths < 0.1) return 20; // default for very short history
    return Math.round(closed.length / spanMonths);
  }

  /**
   * Run Monte Carlo simulation.
   * Uses bootstrap resampling from empirical distribution (no normal assumption).
   */
  static simulate(returns: number[], params: MonteCarloParams): MonteCarloResult {
    const { initialCapital, horizonMonths, tradesPerMonth, numSimulations } = params;
    const n = returns.length;

    if (n === 0) {
      throw new Error('Aucun trade historique disponible pour la simulation.');
    }

    const totalSteps = horizonMonths;
    // Matrix: simulations × months
    const trajectories: number[][] = [];

    for (let sim = 0; sim < numSimulations; sim++) {
      const path = [initialCapital];
      let capital = initialCapital;

      for (let month = 0; month < totalSteps; month++) {
        let monthPnL = 0;
        for (let t = 0; t < tradesPerMonth; t++) {
          // Bootstrap: sample random return from empirical distribution
          const idx = Math.floor(Math.random() * n);
          monthPnL += returns[idx];
        }
        capital += monthPnL;
        // Floor at 0 — capital cannot go negative (in real trading you get liquidated)
        if (capital < 0) capital = 0;
        path.push(capital);
      }

      trajectories.push(path);
    }

    // Compute percentiles at each time step
    const p10: number[] = [];
    const p25: number[] = [];
    const p50: number[] = [];
    const p75: number[] = [];
    const p90: number[] = [];

    for (let step = 0; step <= totalSteps; step++) {
      const values = trajectories.map(t => t[step]).sort((a, b) => a - b);
      p10.push(this.percentile(values, 10));
      p25.push(this.percentile(values, 25));
      p50.push(this.percentile(values, 50));
      p75.push(this.percentile(values, 75));
      p90.push(this.percentile(values, 90));
    }

    // Final values
    const finalValues = trajectories.map(t => t[totalSteps]).sort((a, b) => a - b);
    const mean = finalValues.reduce((s, v) => s + v, 0) / finalValues.length;
    const winCount = finalValues.filter(v => v > initialCapital).length;

    // Generate labels
    const labels = ['Maintenant'];
    for (let i = 1; i <= totalSteps; i++) {
      if (totalSteps <= 12) {
        labels.push(`M${i}`);
      } else {
        labels.push(i % 12 === 0 ? `A${i / 12}` : `M${i}`);
      }
    }

    const stats = this.computeStats(returns);

    return {
      params,
      percentiles: { p10, p25, p50, p75, p90 },
      finalValues: {
        p10: this.percentile(finalValues, 10),
        p25: this.percentile(finalValues, 25),
        p50: this.percentile(finalValues, 50),
        p75: this.percentile(finalValues, 75),
        p90: this.percentile(finalValues, 90),
        mean,
        min: finalValues[0],
        max: finalValues[finalValues.length - 1],
      },
      labels,
      winRate: (winCount / numSimulations) * 100,
      stats: {
        avgReturn: stats.mean,
        stdReturn: stats.std,
        totalTrades: n,
      },
    };
  }

  /**
   * Compute the pth percentile from a sorted array.
   */
  private static percentile(sorted: number[], p: number): number {
    const idx = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
  }
}
