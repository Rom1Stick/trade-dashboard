/**
 * [L'ARCHITECTE] Shared UI Utilities
 * Toast notifications and haptic feedback — used across all modules.
 */

export function showToast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `hw-card glass-card toast-${type}`;
  toast.style.position = 'fixed';
  toast.style.top = '20px';
  toast.style.right = '20px';
  toast.style.padding = '12px 24px';
  toast.style.borderLeft = `4px solid var(--color-${type === 'info' ? 'primary' : type})`;
  toast.style.zIndex = '9999';
  toast.innerText = msg;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

export function triggerHaptic(type: 'click' | 'success') {
  if ('vibrate' in navigator) {
    navigator.vibrate(type === 'success' ? [50, 30, 50] : 10);
  }
}
