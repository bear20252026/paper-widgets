const CLIENT_ID_STORAGE_KEY = "folio_storybook_client_id_v1";
let memoryClientId: string | null = null;

/**
 * Returns a persistent per-browser client session identifier (`x-client-id`)
 * stored in `sessionStorage` (with in-memory fallback for sandboxed iframes).
 */
export function getClientId(): string {
  if (memoryClientId) return memoryClientId;
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      const existing = window.sessionStorage.getItem(CLIENT_ID_STORAGE_KEY);
      if (existing && /^[a-zA-Z0-9_-]{8,128}$/.test(existing)) {
        memoryClientId = existing;
        return existing;
      }
      const generated =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `cid-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
      window.sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, generated);
      memoryClientId = generated;
      return generated;
    }
  } catch {
    // Ignore storage access errors in restricted/null-origin iframes
  }
  memoryClientId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `cid-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  return memoryClientId;
}
