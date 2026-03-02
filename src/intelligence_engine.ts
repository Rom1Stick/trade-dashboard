/**
 * [PROFIT ORACLE] IntelligenceEngine
 * Diagnostic financier : Crash Test, Runway et Risk Scoring.
 */
export interface RiskSnapshot {
  grossWealth: number;
  netWorth: number;
  totalLiabilities: number;
  monthlyExpenses: number;
  securityBuffer: number;
}

export interface ExposureAlert {
  type: 'PLATFORM' | 'CATEGORY';
  label: string;
  percentage: number;
  severity: 'WARNING' | 'CRITICAL';
}

export interface IntelligenceV2Result extends RiskAnalysis {
  exposureAlerts: ExposureAlert[];
  diversificationScore: number;
}

export class IntelligenceEngine {
  /**
   * Calcule le nombre de mois de survie avec les réserves actuelles.
   */
  static calculateRunway(buffer: number, expenses: number): number {
    if (expenses <= 0) return 999;
    return buffer / expenses;
  }

  /**
   * Simule un crash de -50% sur le patrimoine brut (actifs risqués).
   * Note : On assume que l'épargne de sécurité (buffer) est en cash/stable.
   */
  static simulateCrash(grossWealth: number, liabilities: number, buffer: number): number {
    const risquedAssets = grossWealth - buffer;
    const crashedAssets = risquedAssets * 0.5;
    return (crashedAssets + buffer) - liabilities;
  }

  /**
   * Analyse l'exposition par plateforme et catégorie.
   */
  static analyzeExposure(items: { category: string, amount: number, platformName?: string }[]): ExposureAlert[] {
    const total = items.reduce((sum, i) => sum + i.amount, 0);
    if (total <= 0) return [];

    const alerts: ExposureAlert[] = [];
    const platformTotals: Record<string, number> = {};
    const categoryTotals: Record<string, number> = {};

    items.forEach(item => {
      if (item.platformName) {
        platformTotals[item.platformName] = (platformTotals[item.platformName] || 0) + item.amount;
      }
      categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.amount;
    });

    // Check Platform Exposure (> 30% Warning, > 50% Critical)
    Object.entries(platformTotals).forEach(([name, amount]) => {
      const pct = (amount / total) * 100;
      if (pct > 30) {
        alerts.push({
          type: 'PLATFORM',
          label: name,
          percentage: Math.round(pct),
          severity: pct > 50 ? 'CRITICAL' : 'WARNING'
        });
      }
    });

    // Check Category Exposure (Focus on 'investissement' > 60%)
    const investPct = ((categoryTotals['investissement'] || 0) / total) * 100;
    if (investPct > 60) {
      alerts.push({
        type: 'CATEGORY',
        label: 'Investissement',
        percentage: Math.round(investPct),
        severity: investPct > 80 ? 'CRITICAL' : 'WARNING'
      });
    }

    return alerts;
  }

  /**
   * Calcule un score de diversification basé sur la répartition.
   * Un score élevé signifie une bonne répartition entre catégories et plateformes.
   */
  static calculateDiversificationScore(items: { category: string, platformId?: number }[]): number {
    if (items.length === 0) return 0;

    const uniqueCategories = new Set(items.map(i => i.category)).size;
    const uniquePlatforms = new Set(items.map(i => i.platformId).filter(id => id !== undefined)).size;

    // Base score on variety (Max points: 5 categories, 5 platforms)
    const catScore = Math.min(50, uniqueCategories * 10);
    const platScore = Math.min(50, uniquePlatforms * 10);

    return catScore + platScore;
  }

  /**
   * Évalue la santé globale avec Intelligence V2.
   */
  static analyze(snap: RiskSnapshot, items: { category: string, amount: number, platformId?: number, platformName?: string }[] = []): IntelligenceV2Result {
    const runway = this.calculateRunway(snap.securityBuffer, snap.monthlyExpenses);
    const crashNet = this.simulateCrash(snap.grossWealth, snap.totalLiabilities, snap.securityBuffer);

    const alerts = this.analyzeExposure(items);
    const divScore = this.calculateDiversificationScore(items);

    // Score Logic (V2)
    // 1. Runway weight (30%)
    // 2. Debt ratio weight (30%)
    // 3. Crash resilience (20%)
    // 4. Diversification (20%)

    let score = 0;
    score += Math.min(30, (runway / 6) * 30);
    const debtRatio = snap.grossWealth > 0 ? snap.totalLiabilities / snap.grossWealth : 1;
    score += Math.max(0, 30 - (debtRatio * 60));
    if (crashNet > 0) score += 20;
    score += (divScore / 100) * 20;

    let status: 'CRITICAL' | 'WARNING' | 'SECURE' = 'SECURE';
    if (score < 40 || runway < 1 || crashNet < 0 || alerts.some(a => a.severity === 'CRITICAL')) status = 'CRITICAL';
    else if (score < 70 || runway < 3 || alerts.length > 0) status = 'WARNING';

    return {
      runwayMonths: runway,
      crashNetWorth: crashNet,
      riskScore: Math.round(score),
      status,
      exposureAlerts: alerts,
      diversificationScore: divScore
    };
  }
}
