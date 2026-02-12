/**
 * SafeVault [Protocol Zero]
 * Provides AES-GCM encryption for local storage of sensitive keys.
 * Salt aléatoire stocké avec le ciphertext. Clé dérivée du mot de passe utilisateur.
 */
export class SafeVault {
  private static ALGO = 'AES-GCM';
  private static SALT_LENGTH = 16;
  private static IV_LENGTH = 12;

  /**
   * Dérive une clé AES-256 depuis un mot de passe utilisateur + salt aléatoire.
   * Le salt est UNIQUE par opération de chiffrement.
   */
  private static async getEncryptionKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: this.ALGO, length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Chiffre un texte avec un salt et IV aléatoires.
   * Format de sortie : base64(salt[16] + iv[12] + ciphertext)
   */
  static async encrypt(text: string, password: string): Promise<string> {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    const key = await this.getEncryptionKey(password, salt);

    const encrypted = await crypto.subtle.encrypt(
      { name: this.ALGO, iv },
      key,
      enc.encode(text)
    );

    // Format : salt(16) + iv(12) + ciphertext
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  private static failedAttempts = 0;
  private static MAX_ATTEMPTS = 3;

  /**
   * Déchiffre un texte en extrayant salt + iv depuis le ciphertext.
   */
  static async decrypt(encoded: string, password: string): Promise<string> {
    try {
      const combined = new Uint8Array(atob(encoded).split('').map(c => c.charCodeAt(0)));
      const salt = combined.slice(0, this.SALT_LENGTH);
      const iv = combined.slice(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
      const data = combined.slice(this.SALT_LENGTH + this.IV_LENGTH);
      const key = await this.getEncryptionKey(password, salt);

      const decrypted = await crypto.subtle.decrypt(
        { name: this.ALGO, iv },
        key,
        data
      );

      this.failedAttempts = 0;
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      this.failedAttempts++;
      console.error(`[Protocol Zero] Decrypt failed (${this.failedAttempts}/${this.MAX_ATTEMPTS})`);

      if (this.failedAttempts >= this.MAX_ATTEMPTS) {
        this.purgeVault();
        throw new Error("VAULT_PURGED: Maximum authentication attempts exceeded. Security lockdown engaged.");
      }

      throw new Error("VAULT_BREACH: Authentication failed or data corrupted.");
    }
  }

  static purgeVault() {
    console.warn("[Protocol Zero] PANIC MODE: Purging all sensitive credentials.");
    const vaultPatterns = ['BINGX_', 'VAULT_', 'API_KEY', 'API_SECRET'];
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && vaultPatterns.some(p => key.toUpperCase().includes(p))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    this.failedAttempts = 0;
    console.warn(`[Protocol Zero] ${keysToRemove.length} clé(s) purgée(s).`);
  }
}
