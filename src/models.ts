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

export interface AllocationItem {
  id?: number;           // autoIncrement PK
  allocation_id: number; // FK → Allocation.id
  category: 'besoins' | 'investissement' | 'securite' | 'loisirs';
  amount: number;
  percentage: number;
}

// ─── Trades ───────────────────────────────────────────────

export interface Trade {
  id: string;
  pair: string;
  type: 'LONG' | 'SHORT';
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
  active: boolean;       // true = actif, false = résilié
}

// ─── Configuration ────────────────────────────────────────

export interface AppConfig {
  key: string;           // PK
  value: string;
}
