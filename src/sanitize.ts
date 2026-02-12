/**
 * Sanitize [Protocol Zero]
 * HTML escape utility to prevent XSS via innerHTML injection.
 */
export function escapeHTML(str: string): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
