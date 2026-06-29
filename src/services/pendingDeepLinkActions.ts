let pendingQuickAddItem: string | null = null;
let pendingInviteToken: string | null = null;

export function setPendingQuickAddItem(name: string): void {
  pendingQuickAddItem = name.trim() || null;
}

export function consumePendingQuickAddItem(): string | null {
  const value = pendingQuickAddItem;
  pendingQuickAddItem = null;
  return value;
}

export function setPendingInviteToken(token: string): void {
  pendingInviteToken = token.trim() || null;
}

export function consumePendingInviteToken(): string | null {
  const value = pendingInviteToken;
  pendingInviteToken = null;
  return value;
}

export function __resetPendingDeepLinksForTests(): void {
  pendingQuickAddItem = null;
  pendingInviteToken = null;
}
