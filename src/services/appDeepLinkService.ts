/**
 * Handles custom-scheme deep links for Siri Shortcuts and share extensions.
 * Example: listio://add?item=milk
 */
export function parseQuickAddItemFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'listio:') return null;
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/^\//, '').toLowerCase();
    if (host !== 'add' && path !== 'add') return null;
    const item = parsed.searchParams.get('item')?.trim();
    return item || null;
  } catch {
    return null;
  }
}

export function buildQuickAddDeepLink(itemName: string): string {
  return `listio://add?item=${encodeURIComponent(itemName.trim())}`;
}

/** Siri Shortcut phrase suggestion for Settings documentation. */
export const SIRI_SHORTCUT_INSTRUCTIONS =
  'In the Shortcuts app, create a shortcut that opens URL listio://add?item=YOUR_ITEM when you say “Add to Listio”.';
