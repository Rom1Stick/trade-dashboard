import type { Trade, TradeFee, Allocation, AllocationItem, AppConfig, PortfolioSnapshot, Expense, Subscription } from './models';

/**
 * PersistenceEngine [3FN]
 * Couche de persistence normalisée — IndexedDB V5.
 * Stores : allocations, allocation_items, trades, trade_fees, snapshots, expenses, subscriptions, app_config
 */
export class PersistenceEngine {
  private static DB_NAME = 'GridVault_DB';
  private static DB_VERSION = 5;
  private static dbInstance: IDBDatabase | null = null;

  // Store names
  static readonly STORE_ALLOCATIONS = 'allocations';
  static readonly STORE_ALLOCATION_ITEMS = 'allocation_items';
  static readonly STORE_TRADES = 'trades';
  static readonly STORE_TRADE_FEES = 'trade_fees';
  static readonly STORE_SNAPSHOTS = 'snapshots';
  static readonly STORE_EXPENSES = 'expenses';
  static readonly STORE_SUBSCRIPTIONS = 'subscriptions';
  static readonly STORE_CONFIG = 'app_config';

  static async init(): Promise<IDBDatabase> {
    if (this.dbInstance) return this.dbInstance;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // ─── Allocations (patrimoine mensuel) ────────────
        if (!db.objectStoreNames.contains(this.STORE_ALLOCATIONS)) {
          const allocStore = db.createObjectStore(this.STORE_ALLOCATIONS, {
            keyPath: 'id',
            autoIncrement: true
          });
          allocStore.createIndex('by_timestamp', 'timestamp', { unique: false });
        }

        // ─── Allocation Items (répartition par catégorie) ─
        if (!db.objectStoreNames.contains(this.STORE_ALLOCATION_ITEMS)) {
          const itemStore = db.createObjectStore(this.STORE_ALLOCATION_ITEMS, {
            keyPath: 'id',
            autoIncrement: true
          });
          itemStore.createIndex('by_allocation_id', 'allocation_id', { unique: false });
        }

        // ─── Trades ──────────────────────────────────────
        if (!db.objectStoreNames.contains(this.STORE_TRADES)) {
          const tradeStore = db.createObjectStore(this.STORE_TRADES, { keyPath: 'id' });
          tradeStore.createIndex('by_timestamp', 'timestamp', { unique: false });
          tradeStore.createIndex('by_status', 'status', { unique: false });
          tradeStore.createIndex('by_pair', 'pair', { unique: false });
        }

        // ─── Trade Fees ──────────────────────────────────
        if (!db.objectStoreNames.contains(this.STORE_TRADE_FEES)) {
          const feeStore = db.createObjectStore(this.STORE_TRADE_FEES, {
            keyPath: 'id',
            autoIncrement: true
          });
          feeStore.createIndex('by_trade_id', 'trade_id', { unique: false });
        }

        // ─── Snapshots ───────────────────────────────────
        if (!db.objectStoreNames.contains(this.STORE_SNAPSHOTS)) {
          const snapStore = db.createObjectStore(this.STORE_SNAPSHOTS, {
            keyPath: 'id',
            autoIncrement: true
          });
          snapStore.createIndex('by_timestamp', 'timestamp', { unique: false });
        }

        // ─── Expenses (Finari-style tracker) ─────────────
        if (!db.objectStoreNames.contains(this.STORE_EXPENSES)) {
          const expStore = db.createObjectStore(this.STORE_EXPENSES, {
            keyPath: 'id',
            autoIncrement: true
          });
          expStore.createIndex('by_week_key', 'week_key', { unique: false });
          expStore.createIndex('by_category', 'category', { unique: false });
          expStore.createIndex('by_timestamp', 'timestamp', { unique: false });
        }

        // ─── Subscriptions (Abonnements récurrents) ────────
        if (!db.objectStoreNames.contains(this.STORE_SUBSCRIPTIONS)) {
          const subStore = db.createObjectStore(this.STORE_SUBSCRIPTIONS, {
            keyPath: 'id',
            autoIncrement: true
          });
          subStore.createIndex('by_active', 'active', { unique: false });
        }

        // ─── App Config ──────────────────────────────────
        if (!db.objectStoreNames.contains(this.STORE_CONFIG)) {
          db.createObjectStore(this.STORE_CONFIG, { keyPath: 'key' });
        }
      };

      request.onblocked = () => {
        console.warn("[L'Architecte] Base de données bloquée. Fermez les autres onglets.");
      };

      request.onsuccess = () => {
        const db = request.result;

        // Gérer les mises à jour depuis un autre onglet
        db.onversionchange = () => {
          db.close();
          this.dbInstance = null;
          console.warn("[L'Architecte] Base de données mise à jour depuis un autre onglet. Rechargez.");
        };

        this.dbInstance = db;
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // ─── Allocations CRUD ──────────────────────────────────

  static async saveAllocation(alloc: Allocation, items: Omit<AllocationItem, 'id' | 'allocation_id'>[]): Promise<number> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.STORE_ALLOCATIONS, this.STORE_ALLOCATION_ITEMS], 'readwrite');
      const allocStore = tx.objectStore(this.STORE_ALLOCATIONS);
      const itemStore = tx.objectStore(this.STORE_ALLOCATION_ITEMS);

      const req = allocStore.add(alloc);
      req.onsuccess = () => {
        const allocId = req.result as number;
        items.forEach(item => {
          itemStore.add({ ...item, allocation_id: allocId });
        });
        resolve(allocId);
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  static async getAllocations(): Promise<(Allocation & { items: AllocationItem[] })[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.STORE_ALLOCATIONS, this.STORE_ALLOCATION_ITEMS], 'readonly');
      const allocStore = tx.objectStore(this.STORE_ALLOCATIONS);
      const itemStore = tx.objectStore(this.STORE_ALLOCATION_ITEMS);

      const allocReq = allocStore.getAll();
      const itemReq = itemStore.getAll();

      tx.oncomplete = () => {
        const allocs = allocReq.result as Allocation[];
        const items = itemReq.result as AllocationItem[];

        // Map lookup O(n+m) au lieu de filter O(n×m)
        const itemsByAllocId = new Map<number, AllocationItem[]>();
        items.forEach(i => {
          const list = itemsByAllocId.get(i.allocation_id) || [];
          list.push(i);
          itemsByAllocId.set(i.allocation_id, list);
        });

        const result = allocs.map(a => ({
          ...a,
          items: itemsByAllocId.get(a.id!) || []
        }));

        // Trier par timestamp décroissant
        result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(result);
      };

      tx.onerror = () => reject(tx.error);
    });
  }

  static async getTotalAccumulated(): Promise<number> {
    const allocs = await this.getAllocations();
    return allocs.reduce((sum, a) => sum + a.total, 0);
  }

  static async deleteAllocation(allocId: number): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.STORE_ALLOCATIONS, this.STORE_ALLOCATION_ITEMS], 'readwrite');
      const allocStore = tx.objectStore(this.STORE_ALLOCATIONS);
      const itemStore = tx.objectStore(this.STORE_ALLOCATION_ITEMS);
      const itemIndex = itemStore.index('by_allocation_id');

      // Supprimer l'allocation
      allocStore.delete(allocId);

      // Supprimer tous les items associés
      const cursorReq = itemIndex.openCursor(IDBKeyRange.only(allocId));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ─── Trades CRUD ───────────────────────────────────────

  static async saveTrade(trade: Trade, fees: Omit<TradeFee, 'id'>[]): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.STORE_TRADES, this.STORE_TRADE_FEES], 'readwrite');
      const tradeStore = tx.objectStore(this.STORE_TRADES);
      const feeStore = tx.objectStore(this.STORE_TRADE_FEES);

      tradeStore.put(trade);
      fees.forEach(f => feeStore.add(f));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async saveTrades(trades: Trade[], feesByTradeId: Record<string, Omit<TradeFee, 'id'>[]> = {}): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.STORE_TRADES, this.STORE_TRADE_FEES], 'readwrite');
      const tradeStore = tx.objectStore(this.STORE_TRADES);
      const feeStore = tx.objectStore(this.STORE_TRADE_FEES);

      trades.forEach(t => {
        tradeStore.put(t);
        const fees = feesByTradeId[t.id] || [];
        fees.forEach(f => feeStore.add(f));
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getTrades(): Promise<Trade[]> {
    const db = await this.init();
    const tx = db.transaction(this.STORE_TRADES, 'readonly');
    const store = tx.objectStore(this.STORE_TRADES);
    const request = store.getAll();
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
  }

  static async getTradesByStatus(status: 'OPEN' | 'CLOSED'): Promise<Trade[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_TRADES, 'readonly');
      const store = tx.objectStore(this.STORE_TRADES);
      const index = store.index('by_status');
      const req = index.getAll(status);

      req.onsuccess = () => resolve(req.result as Trade[]);
      req.onerror = () => reject(req.error);
    });
  }

  static async getTradesByPair(pair: string): Promise<Trade[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_TRADES, 'readonly');
      const store = tx.objectStore(this.STORE_TRADES);
      const index = store.index('by_pair');
      const req = index.getAll(pair);

      req.onsuccess = () => resolve(req.result as Trade[]);
      req.onerror = () => reject(req.error);
    });
  }

  static async getFeesForTrade(tradeId: string): Promise<TradeFee[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_TRADE_FEES, 'readonly');
      const store = tx.objectStore(this.STORE_TRADE_FEES);
      const index = store.index('by_trade_id');
      const req = index.getAll(tradeId);

      req.onsuccess = () => resolve(req.result as TradeFee[]);
      req.onerror = () => reject(req.error);
    });
  }

  static async getTradeWithFees(tradeId: string): Promise<{ trade: Trade; fees: TradeFee[] } | null> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.STORE_TRADES, this.STORE_TRADE_FEES], 'readonly');
      const tradeStore = tx.objectStore(this.STORE_TRADES);
      const feeStore = tx.objectStore(this.STORE_TRADE_FEES);
      const feeIndex = feeStore.index('by_trade_id');

      const tradeReq = tradeStore.get(tradeId);
      const feesReq = feeIndex.getAll(tradeId);

      tx.oncomplete = () => {
        if (!tradeReq.result) { resolve(null); return; }
        resolve({
          trade: tradeReq.result as Trade,
          fees: feesReq.result as TradeFee[]
        });
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getAllTradesWithFees(): Promise<{ trade: Trade; fees: TradeFee[] }[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.STORE_TRADES, this.STORE_TRADE_FEES], 'readonly');
      const tradeStore = tx.objectStore(this.STORE_TRADES);
      const feeStore = tx.objectStore(this.STORE_TRADE_FEES);

      const tradeReq = tradeStore.getAll();
      const feeReq = feeStore.getAll();

      tx.oncomplete = () => {
        const trades = tradeReq.result as Trade[];
        const fees = feeReq.result as TradeFee[];

        // Map lookup O(n+m) au lieu de filter O(n×m)
        const feesByTradeId = new Map<string, TradeFee[]>();
        fees.forEach(f => {
          const list = feesByTradeId.get(f.trade_id) || [];
          list.push(f);
          feesByTradeId.set(f.trade_id, list);
        });

        resolve(trades.map(t => ({
          trade: t,
          fees: feesByTradeId.get(t.id) || []
        })));
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  static async deleteTrade(tradeId: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([this.STORE_TRADES, this.STORE_TRADE_FEES], 'readwrite');
      const tradeStore = tx.objectStore(this.STORE_TRADES);
      const feeStore = tx.objectStore(this.STORE_TRADE_FEES);
      const feeIndex = feeStore.index('by_trade_id');

      // Supprimer le trade
      tradeStore.delete(tradeId);

      // Supprimer tous les fees associés via cursor
      const cursorReq = feeIndex.openCursor(IDBKeyRange.only(tradeId));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ─── Snapshots CRUD ────────────────────────────────────

  static async saveSnapshot(snapshot: Omit<PortfolioSnapshot, 'id'>): Promise<number> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_SNAPSHOTS, 'readwrite');
      const store = tx.objectStore(this.STORE_SNAPSHOTS);
      const req = store.add(snapshot);

      req.onsuccess = () => resolve(req.result as number);
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getSnapshots(limit?: number): Promise<PortfolioSnapshot[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_SNAPSHOTS, 'readonly');
      const store = tx.objectStore(this.STORE_SNAPSHOTS);
      const index = store.index('by_timestamp');
      const results: PortfolioSnapshot[] = [];

      // Parcourir par timestamp décroissant
      const cursorReq = index.openCursor(null, 'prev');
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor && (!limit || results.length < limit)) {
          results.push(cursor.value as PortfolioSnapshot);
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve(results);
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getLatestSnapshot(): Promise<PortfolioSnapshot | null> {
    const snapshots = await this.getSnapshots(1);
    return snapshots.length > 0 ? snapshots[0] : null;
  }

  // ─── App Config ────────────────────────────────────────

  static async getConfig(key: string): Promise<string | null> {
    const db = await this.init();
    return new Promise((resolve) => {
      const tx = db.transaction(this.STORE_CONFIG, 'readonly');
      const store = tx.objectStore(this.STORE_CONFIG);
      const req = store.get(key);
      req.onsuccess = () => {
        const result = req.result as AppConfig | undefined;
        resolve(result ? result.value : null);
      };
      req.onerror = () => resolve(null);
    });
  }

  static async setConfig(key: string, value: string): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_CONFIG, 'readwrite');
      tx.objectStore(this.STORE_CONFIG).put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ─── Expenses CRUD (Finari-style) ─────────────────────

  static async saveExpense(expense: Omit<Expense, 'id'>): Promise<number> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_EXPENSES, 'readwrite');
      const store = tx.objectStore(this.STORE_EXPENSES);
      const req = store.add(expense);

      req.onsuccess = () => resolve(req.result as number);
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getExpensesByWeek(weekKey: string): Promise<Expense[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_EXPENSES, 'readonly');
      const store = tx.objectStore(this.STORE_EXPENSES);
      const index = store.index('by_week_key');
      const req = index.getAll(weekKey);

      req.onsuccess = () => {
        const results = req.result as Expense[];
        results.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  static async getAllExpenses(): Promise<Expense[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_EXPENSES, 'readonly');
      const store = tx.objectStore(this.STORE_EXPENSES);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = req.result as Expense[];
        results.sort((a, b) => b.timestamp - a.timestamp);
        resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  }

  static async deleteExpense(expenseId: number): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_EXPENSES, 'readwrite');
      const store = tx.objectStore(this.STORE_EXPENSES);
      store.delete(expenseId);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getWeekSummary(weekKey: string): Promise<Record<string, number>> {
    const expenses = await this.getExpensesByWeek(weekKey);
    const summary: Record<string, number> = {};
    expenses.forEach(e => {
      summary[e.category] = (summary[e.category] || 0) + e.amount;
    });
    return summary;
  }

  // ─── Subscriptions (Abonnements) ─────────────────────────

  static async saveSubscription(sub: Omit<Subscription, 'id'>): Promise<number> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_SUBSCRIPTIONS, 'readwrite');
      const store = tx.objectStore(this.STORE_SUBSCRIPTIONS);
      const req = store.add(sub);
      req.onsuccess = () => resolve(req.result as number);
      tx.onerror = () => reject(tx.error);
    });
  }

  static async getActiveSubscriptions(): Promise<Subscription[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_SUBSCRIPTIONS, 'readonly');
      const store = tx.objectStore(this.STORE_SUBSCRIPTIONS);
      const index = store.index('by_active');
      const req = index.getAll(1);  // IDB stores boolean as 0/1
      req.onsuccess = () => resolve(req.result as Subscription[]);
      req.onerror = () => reject(req.error);
    });
  }

  static async getAllSubscriptions(): Promise<Subscription[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_SUBSCRIPTIONS, 'readonly');
      const store = tx.objectStore(this.STORE_SUBSCRIPTIONS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as Subscription[]);
      req.onerror = () => reject(req.error);
    });
  }

  static async updateSubscription(sub: Subscription): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_SUBSCRIPTIONS, 'readwrite');
      const store = tx.objectStore(this.STORE_SUBSCRIPTIONS);
      store.put(sub);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async deleteSubscription(subId: number): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.STORE_SUBSCRIPTIONS, 'readwrite');
      const store = tx.objectStore(this.STORE_SUBSCRIPTIONS);
      store.delete(subId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Matérialise les abonnements actifs en dépenses pour un mois donné.
   * Ne génère que si pas déjà fait (vérifie via app_config).
   * @param monthKey ex: "2026-02"
   */
  static async materializeSubscriptions(monthKey: string): Promise<number> {
    const configKey = `subs_materialized_${monthKey}`;
    const db = await this.init();

    // Vérifier si déjà matérialisé
    const existing = await new Promise<AppConfig | undefined>((resolve) => {
      const tx = db.transaction(this.STORE_CONFIG, 'readonly');
      const req = tx.objectStore(this.STORE_CONFIG).get(configKey);
      req.onsuccess = () => resolve(req.result as AppConfig | undefined);
    });

    if (existing) return 0;

    // Récupérer les abonnements actifs
    const subs = await this.getActiveSubscriptions();
    if (subs.length === 0) return 0;

    // Calculer la première semaine du mois (pour le week_key)
    const [year, month] = monthKey.split('-').map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const dayOfWeek = firstDay.getDay() || 7; // 1=Lundi
    const monday = new Date(firstDay);
    monday.setDate(firstDay.getDate() - dayOfWeek + 1);
    // ISO week number
    const janFirst = new Date(monday.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((monday.getTime() - janFirst.getTime()) / 86400000 + janFirst.getDay() + 1) / 7);
    const weekKey = `${monday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

    // Créer les dépenses
    const tx = db.transaction([this.STORE_EXPENSES, this.STORE_CONFIG], 'readwrite');
    const expenseStore = tx.objectStore(this.STORE_EXPENSES);
    const configStore = tx.objectStore(this.STORE_CONFIG);

    let count = 0;
    for (const sub of subs) {
      if (sub.startDate <= monthKey) {
        expenseStore.add({
          amount: sub.amount,
          category: sub.category,
          label: `🔄 ${sub.label}`,
          timestamp: firstDay.getTime(),
          week_key: weekKey
        });
        count++;
      }
    }

    // Marquer comme matérialisé
    configStore.put({ key: configKey, value: new Date().toISOString() });

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => {
        console.log(`[Abonnements] ${count} abonnement(s) matérialisé(s) pour ${monthKey}`);
        resolve(count);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // ─── Maintenance ───────────────────────────────────────

  static async clearAll(): Promise<void> {
    const db = await this.init();
    const storeNames = [
      this.STORE_ALLOCATIONS,
      this.STORE_ALLOCATION_ITEMS,
      this.STORE_TRADES,
      this.STORE_TRADE_FEES,
      this.STORE_SNAPSHOTS,
      this.STORE_EXPENSES,
      this.STORE_SUBSCRIPTIONS,
      this.STORE_CONFIG
    ];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeNames, 'readwrite');
      storeNames.forEach(name => tx.objectStore(name).clear());
      tx.oncomplete = () => {
        console.warn("[L'Architecte] Purge complète de la base de données.");
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }
}

