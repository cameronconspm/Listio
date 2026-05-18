import { contextualPaywallDismissToast } from '../src/context/contextualPaywallReasons';

describe('contextualPaywallDismissToast', () => {
  it('returns list-specific copy for list_limit', () => {
    const { title, message } = contextualPaywallDismissToast('list_limit');
    expect(title).toMatch(/free plan/i);
    expect(message).toMatch(/3 items/);
  });

  it('returns smart add copy that mentions entry is preserved', () => {
    const { message } = contextualPaywallDismissToast('smart_add');
    expect(message).toMatch(/still here/i);
  });
});
