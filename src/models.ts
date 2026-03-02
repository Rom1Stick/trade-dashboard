/**
 * Trade Dashboard Data Models — 3NF Normalized
 * Chaque entité est atomique, sans objet imbriqué.
 */

// ─── Allocations (Patrimoine) ─────────────────────────────

export interface Allocation {
  id?: number;           // autoIncrement PK
  total: number;
  timestamp: number;
  label: string;         // ex: "Février 2026"
}

export interface Platform {
  id?: number;           // autoIncrement PK
  name: string;
  annual_yield: number;  // percentage, e.g. 5.5 for 5.5%
  type: 'fixed' | 'dynamic'; // 'fixed' = has annual yield, 'dynamic' = no fixed yield (e.g. Bitcoin)
}

export interface AllocationItem {
  id?: number;           // autoIncrement PK
  allocation_id: number; // FK → Allocation.id
  category: 'besoins' | 'investissement' | 'securite' | 'loisirs';
  amount: number;
  percentage: number;
  platform_id?: number;  // FK → Platform.id (optional, mainly for 'investissement')
}

// ─── Trades ───────────────────────────────────────────────

export interface Trade {
  id: string;
  pair: string;
  type: 'LONG' | 'SHORT' | 'FUNDING';
  entryPrice: number;
  exitPrice?: number;
  size: number;
  leverage: number;
  grossPnL: number;
  status: 'OPEN' | 'CLOSED';
  timestamp: number;     // epoch ms — number for IndexedDB indexing
}

export interface TradeFee {
  id?: number;           // autoIncrement PK
  trade_id: string;      // FK → Trade.id
  fee_type: 'maker' | 'taker' | 'funding';
  amount: number;
  is_actual: boolean;    // true = from execution report
}

// ─── Snapshots ────────────────────────────────────────────

export interface PortfolioSnapshot {
  id?: number;           // autoIncrement PK
  timestamp: number;
  equity: number;
  unrealizedPnL: number;
  availableBalance: number;
}

// ─── Dépenses (Finari-Style) ──────────────────────────────

export type ExpenseCategory =
  | 'logement'
  | 'courses'
  | 'transport'
  | 'loisirs'
  | 'sante'
  | 'abonnements'
  | 'shopping'
  | 'autre';

export interface Expense {
  id?: number;           // autoIncrement PK
  amount: number;
  category: ExpenseCategory;
  label: string;         // ex: "Uber Eats", "Loyer"
  timestamp: number;     // epoch ms
  week_key: string;      // ISO week: "2026-W07"
}

// ─── Abonnements (Recurring Subscriptions) ────────────────

export interface Subscription {
  id?: number;           // autoIncrement PK
  label: string;         // ex: "Netflix", "Spotify"
  amount: number;        // montant mensuel
  category: ExpenseCategory;
  startDate: string;     // "2026-02" (YYYY-MM)
  active: number;        // 1 = actif, 0 = résilié (number for IDB indexing)
}

// ─── Passifs (Liabilities) ─────────────────────────────────

export type LiabilityType = 'credit_immo' | 'pret_conso' | 'dette' | 'autre';

export interface Liability {
  id?: number;              // autoIncrement PK
  label: string;            // ex: "Crédit Maison", "Prêt Auto"
  type: LiabilityType;
  initialAmount: number;    // montant initial emprunté
  remainingAmount: number;  // solde restant dû
  monthlyPayment: number;   // mensualité
  interestRate: number;     // taux annuel (ex: 2.5 = 2.5%)
  startDate: string;        // "2024-03" (YYYY-MM)
  endDate?: string;         // "2049-03" (YYYY-MM) — optionnel
  active: number;           // 1 = en cours, 0 = soldé (number for IDB indexing)
  timestamp: number;        // epoch ms — creation date
}

// ─── Configuration ────────────────────────────────────────

export interface AppConfig {
  key: string;           // PK
  value: string;
}
