import type { Trade, TradeFee } from './models';

/**
 * Données de démonstration — Format 3FN normalisé.
 * Les frais sont séparés dans leur propre structure.
 */

export const mockTrades: Trade[] = [
  {
    id: 'TRADE-001',
    pair: 'BTC/USDT',
    type: 'LONG',
    entryPrice: 64200,
    exitPrice: 64500,
    size: 2000,
    leverage: 20,
    grossPnL: 130.50,
    status: 'CLOSED',
    timestamp: new Date('2026-02-12T16:20:03Z').getTime()
  },
  {
    id: 'TRADE-002',
    pair: 'ETH/USDT',
    type: 'SHORT',
    entryPrice: 3450,
    exitPrice: 3420,
    size: 1500,
    leverage: 10,
    grossPnL: 45.00,
    status: 'CLOSED',
    timestamp: new Date('2026-02-11T09:15:00Z').getTime()
  },
  {
    id: 'TRADE-003',
    pair: 'SOL/USDT',
    type: 'LONG',
    entryPrice: 145.20,
    size: 500,
    leverage: 5,
    grossPnL: -12.40,
    status: 'OPEN',
    timestamp: new Date('2026-02-12T18:00:00Z').getTime()
  }
];

export const mockTradeFees: Record<string, Omit<TradeFee, 'id'>[]> = {
  'TRADE-001': [
    { trade_id: 'TRADE-001', fee_type: 'taker', amount: 1.00, is_actual: true },
    { trade_id: 'TRADE-001', fee_type: 'taker', amount: 1.15, is_actual: true }
  ],
  'TRADE-002': [
    { trade_id: 'TRADE-002', fee_type: 'maker', amount: 0.30, is_actual: false },
    { trade_id: 'TRADE-002', fee_type: 'maker', amount: 0.30, is_actual: false }
  ],
  'TRADE-003': [
    { trade_id: 'TRADE-003', fee_type: 'taker', amount: 0.25, is_actual: false },
    { trade_id: 'TRADE-003', fee_type: 'taker', amount: 0.25, is_actual: false }
  ]
};

export const mockEvolution = [12000, 12150, 11900, 12200, 12350, 12450];
