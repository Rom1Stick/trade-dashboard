/**
 * [L'ARCHITECTE] Cloud Sync Manager — E2EE
 * Zero-knowledge push/pull of encrypted data to our relay API.
 * The server never sees plaintext — all encryption happens client-side via SafeVault.
 */
import { PersistenceEngine } from './persistence';
import { SafeVault } from './vault';
import { showToast } from './ui_utils';

export class SyncManager {
  private static readonly API_BASE = '/api/sync';
  private static readonly LS_KEY = 'hw_last_sync';

  /**
   * Push encrypted data to the cloud relay
   */
  static async push(): Promise<void> {
    try {
      // 1. Get the vault password from the UI input
      const pw = (document.getElementById('vault-password-v2') as HTMLInputElement)?.value;
      if (!pw || pw.length < 8) {
        showToast('Entrez le mot de passe du coffre (8+ car.).', 'error');
        return;
      }

      showToast('🔒 Chiffrement & envoi...', 'info');

      // 2. Export all data as JSON, then encrypt with SafeVault
      const encrypted = await PersistenceEngine.exportEncrypted(pw);

      // 3. Push to relay
      const response = await fetch(`${this.API_BASE}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: 'default_user', data: encrypted })
      });

      if (!response.ok) throw new Error('Erreur serveur lors de la synchronisation.');

      const result = await response.json();
      console.log('[SyncManager] Push success:', result);

      // 4. Save last sync timestamp locally
      localStorage.setItem(this.LS_KEY, String(result.timestamp));

      showToast('☁️ Synchronisation cloud réussie !', 'success');
    } catch (err: any) {
      console.error('[SyncManager] Push error:', err);
      showToast(err.message || 'Erreur de synchro', 'error');
    }
  }

  /**
   * Pull encrypted data from the cloud relay and restore
   */
  static async pull(): Promise<void> {
    try {
      const pw = (document.getElementById('vault-password-v2') as HTMLInputElement)?.value;
      if (!pw || pw.length < 8) {
        showToast('Entrez le mot de passe du coffre pour déchiffrer.', 'error');
        return;
      }

      showToast('🔓 Récupération & déchiffrement...', 'info');

      const response = await fetch(`${this.API_BASE}/pull/default_user`);

      if (response.status === 404) {
        throw new Error('Aucune donnée de synchronisation trouvée.');
      }
      if (!response.ok) throw new Error('Erreur serveur lors de la récupération.');

      const { data, timestamp } = await response.json();
      if (!data) throw new Error('Données corrompues ou vides.');

      // Decrypt and import
      await PersistenceEngine.importEncrypted(data, pw);

      localStorage.setItem(this.LS_KEY, String(timestamp));
      showToast('☁️ Données cloud restaurées ! Rechargement...', 'success');

      // Reload to refresh all managers
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      console.error('[SyncManager] Pull error:', err);
      showToast(err.message || 'Erreur de restauration', 'error');
    }
  }

  static getLastSync(): number | null {
    const ts = localStorage.getItem(this.LS_KEY);
    return ts ? parseInt(ts, 10) : null;
  }
}
