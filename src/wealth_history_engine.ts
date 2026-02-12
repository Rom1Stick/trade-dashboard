import { PersistenceEngine } from './persistence';
import type { Allocation, AllocationItem } from './models';
import { ALLOCATION_RATIOS } from './wealth_engine';

/**
 * WealthHistoryEngine [3FN]
 * Gestion des allocations patrimoniales normalisées.
 * Chaque soumission crée une NOUVELLE entrée (plus d'écrasement).
 */

export interface AllocationWithItems extends Allocation {
  items: AllocationItem[];
}

// Re-export pour compatibilité avec WealthManager
export type WealthEntry = AllocationWithItems;

export class WealthHistoryEngine {

  /**
   * Enregistrer une allocation et ses 4 catégories.
   * Crée toujours une nouvelle entrée (autoIncrement).
   */
  static async addEntry(total: number, breakdown: {
    besoins: number;
    investissement: number;
    securite: number;
    loisirs: number;
  }): Promise<number> {
    const now = new Date();
    const label = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const allocation: Allocation = {
      total,
      timestamp: now.getTime(),
      label
    };

    const items: Omit<AllocationItem, 'id' | 'allocation_id'>[] = [
      { category: 'besoins', amount: breakdown.besoins, percentage: ALLOCATION_RATIOS.necessities * 100 },
      { category: 'investissement', amount: breakdown.investissement, percentage: ALLOCATION_RATIOS.investment * 100 },
      { category: 'securite', amount: breakdown.securite, percentage: ALLOCATION_RATIOS.securityBuffer * 100 },
      { category: 'loisirs', amount: breakdown.loisirs, percentage: ALLOCATION_RATIOS.lifestyle * 100 }
    ];

    return PersistenceEngine.saveAllocation(allocation, items);
  }

  /**
   * Récupérer toutes les allocations avec leurs items.
   * Triées par timestamp décroissant.
   */
  static async getHistory(): Promise<AllocationWithItems[]> {
    return PersistenceEngine.getAllocations();
  }

  /**
   * Somme de toutes les allocations enregistrées.
   */
  static async getTotalAccumulated(): Promise<number> {
    return PersistenceEngine.getTotalAccumulated();
  }
}
