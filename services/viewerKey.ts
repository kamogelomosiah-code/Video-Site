/**
 * Anonymous viewer key generator and retriever.
 * Used to deduplicate view counts on a daily basis without storing PII or raw IPs.
 */
export function getOrCreateViewerKey(): string {
  if (typeof window === 'undefined') return 'server-viewer';

  const STORAGE_KEY = 'elysian_viewer_key';
  try {
    let key = localStorage.getItem(STORAGE_KEY);
    if (!key) {
      // Generate standard v4 UUID using crypto.randomUUID or fallback pseudo-random
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        key = crypto.randomUUID();
      } else {
        key = 'vk_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      }
      localStorage.setItem(STORAGE_KEY, key);
    }
    return key;
  } catch {
    return 'fallback_viewer_' + Date.now().toString(36);
  }
}
