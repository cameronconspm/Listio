import { parseQuickAddItemFromUrl, buildQuickAddDeepLink } from '../src/services/appDeepLinkService';
import { parseHouseholdInviteTokenFromUrl, buildHouseholdInviteUrl } from '../src/services/householdService';

describe('appDeepLinkService', () => {
  it('parses quick add item URLs', () => {
    expect(parseQuickAddItemFromUrl('listio://add?item=milk')).toBe('milk');
    expect(parseQuickAddItemFromUrl('listio://other')).toBeNull();
  });

  it('builds quick add deep links', () => {
    expect(buildQuickAddDeepLink('Oat milk')).toBe('listio://add?item=Oat%20milk');
  });
});

describe('household invite URLs', () => {
  it('round-trips invite tokens', () => {
    const url = buildHouseholdInviteUrl('abc123');
    expect(parseHouseholdInviteTokenFromUrl(url)).toBe('abc123');
  });
});
