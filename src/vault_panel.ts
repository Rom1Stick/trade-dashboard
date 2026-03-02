/**
 * [L'ARCHITECTE] Vault Panel Manager
 * Handles SafeVault configuration, encrypted export/import.
 */
import { PersistenceEngine } from './persistence';
import { SafeVault } from './vault';
import { showToast, triggerHaptic } from './ui_utils';
import { SyncManager } from './sync_manager';

export class VaultPanel {
  static init() {
    this.updateStatus();

    // Configure vault password
    document.getElementById('vault-configure-btn')?.addEventListener('click', async () => {
      const pw = (document.getElementById('vault-password-v2') as HTMLInputElement)?.value;
      if (!pw || pw.length < 8) {
        showToast('Mot de passe requis (8+ caractères).', 'error');
        return;
      }
      await SafeVault.setVaultPassword(pw);
      this.updateStatus();
      showToast('🔐 Coffre-fort configuré.', 'success');
      triggerHaptic('success');
    });

    // Encrypted export
    document.getElementById('vault-export-btn')?.addEventListener('click', async () => {
      const pw = (document.getElementById('vault-password-v2') as HTMLInputElement)?.value;
      if (!pw || pw.length < 8) {
        showToast('Entrez le mot de passe du coffre.', 'error');
        return;
      }
      try {
        showToast('🔒 Chiffrement en cours...', 'info');
        const encrypted = await PersistenceEngine.exportEncrypted(pw);
        const blob = new Blob([encrypted], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `heavyweight_vault_${new Date().toISOString().slice(0, 10)}.vault`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 200);
        showToast('📤 Export chiffré téléchargé.', 'success');
        triggerHaptic('success');
      } catch (e) {
        console.error('[Vault V2] Export failed:', e);
        showToast("Échec de l'export chiffré.", 'error');
      }
    });

    // Encrypted import
    document.getElementById('vault-import-file')?.addEventListener('change', async (evt) => {
      const file = (evt.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const pw = (document.getElementById('vault-password-v2') as HTMLInputElement)?.value;
      if (!pw || pw.length < 8) {
        showToast('Entrez le mot de passe du coffre.', 'error');
        return;
      }

      try {
        showToast('🔓 Déchiffrement en cours...', 'info');
        const content = await file.text();
        await PersistenceEngine.importEncrypted(content, pw);
        showToast('📥 Import chiffré restauré ! Rechargement...', 'success');
        triggerHaptic('success');
        setTimeout(() => location.reload(), 1500);
      } catch (e: any) {
        console.error('[Vault V2] Import failed:', e);
        if (e.message?.includes('VAULT_PURGED')) {
          showToast('🚨 ALERTE : Trop de tentatives. Données purgées.', 'error');
          this.updateStatus();
        } else if (e.message?.includes('VAULT_BREACH')) {
          showToast('🔒 Mot de passe incorrect.', 'error');
        } else {
          showToast('Fichier invalide ou corrompu.', 'error');
        }
      }

      // Reset file input
      (evt.target as HTMLInputElement).value = '';
    });

    // Cloud Sync Push
    document.getElementById('vault-sync-push-btn')?.addEventListener('click', async () => {
      triggerHaptic('click');
      await SyncManager.push();
      this.updateStatus();
    });

    // Cloud Sync Pull
    document.getElementById('vault-sync-pull-btn')?.addEventListener('click', async () => {
      triggerHaptic('click');
      if (confirm('Restaurer les données depuis le cloud ? Cela remplacera vos données locales.')) {
        await SyncManager.pull();
      }
    });

    this.updateLastSync();
  }

  static updateLastSync() {
    const lastSync = SyncManager.getLastSync();
    const lastSyncEl = document.getElementById('vault-last-sync');
    if (lastSyncEl && lastSync) {
      lastSyncEl.textContent = `Dernière synchro : ${new Date(lastSync).toLocaleString()}`;
    }
  }

  static updateStatus() {
    this.updateLastSync();
    const indicator = document.getElementById('vault-status-indicator');
    const label = document.getElementById('vault-status-text');
    const configured = SafeVault.isVaultConfigured();

    if (indicator) {
      indicator.classList.toggle('vault-indicator--on', configured);
      indicator.classList.toggle('vault-indicator--off', !configured);
    }
    if (label) {
      label.textContent = configured ? 'Coffre actif — AES-256-GCM' : 'Non configuré';
    }
  }
}
