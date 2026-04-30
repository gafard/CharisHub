/**
 * Sanitize user-generated content to prevent XSS attacks.
 *
 * Strips dangerous HTML tags and attributes while preserving
 * safe formatting elements used in community chat/posts.
 */

const DANGEROUS_TAGS = /&lt;\s*\/?\s*(script|iframe|object|embed|form|input|textarea|select|button|link|style|meta|base|applet|svg|math|template)\b[^>]*>/gi;
const EVENT_ATTRS = /\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi;
const JAVASCRIPT_URI = /(href|src|action)\s*=\s*["']?\s*javascript\s*:/gi;
const DATA_URI = /(href|src)\s*=\s*["']?\s*data\s*:\s*(?!image\/(png|jpg|jpeg|gif|webp|svg\+xml))/gi;

/**
 * Sanitize HTML string — strips scripts, event handlers, and dangerous URIs.
 * Safe for inserting into community chat messages and group posts.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  return html
    // Remove dangerous tags entirely
    .replace(DANGEROUS_TAGS, '')
    // Remove event handler attributes
    .replace(EVENT_ATTRS, '')
    // Remove javascript: URIs
    .replace(JAVASCRIPT_URI, '$1=""')
    // Remove non-image data: URIs
    .replace(DATA_URI, '$1=""');
}

/**
 * Sanitize plain text — escapes all HTML entities.
 * Use for user names, titles, and any text that should never contain HTML.
 */
export function escapeHtml(text: string): string {
  if (!text) return '';

  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
  };

  return text.replace(/[&<>"'\/`]/g, (char) => map[char] || char);
}

/**
 * Sanitize a URL — only allows http, https, and mailto protocols.
 */
export function sanitizeUrl(url: string): string {
  if (!url) return '';

  const trimmed = url.trim();
  
  // Allow only safe protocols
  if (/^(https?:|mailto:|\/|#)/i.test(trimmed)) {
    return trimmed;
  }
  
  // Block everything else (javascript:, data:, vbscript:, etc.)
  return '';
}

/**
 * Strip all HTML tags — returns plain text.
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}
