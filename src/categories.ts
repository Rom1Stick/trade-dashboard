import type { ExpenseCategory } from './models';

/**
 * Shared Categories [Single Source of Truth]
 * Utilisé par ExpenseManager et SubscriptionManager.
 */

export interface CategoryMeta {
  emoji: string;
  label: string;
  color: string;
}

export const CATEGORIES: Record<ExpenseCategory, CategoryMeta> = {
  logement: { emoji: '🏠', label: 'Logement', color: '#6366F1' },
  courses: { emoji: '🛒', label: 'Courses', color: '#10B981' },
  transport: { emoji: '🚗', label: 'Transport', color: '#F59E0B' },
  loisirs: { emoji: '🎮', label: 'Loisirs', color: '#EC4899' },
  sante: { emoji: '💊', label: 'Santé', color: '#EF4444' },
  abonnements: { emoji: '📱', label: 'Abonnements', color: '#8B5CF6' },
  shopping: { emoji: '🛍️', label: 'Shopping', color: '#3B82F6' },
  autre: { emoji: '📎', label: 'Autre', color: '#6B7280' }
};

/** Valid category keys for runtime validation */
export const VALID_CATEGORIES = new Set<string>(Object.keys(CATEGORIES));
