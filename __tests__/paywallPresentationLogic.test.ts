import {
  resolveLivePaywallPresentation,
  shouldShowSettingsPlanRow,
} from '../src/context/paywallPresentationLogic';

describe('resolveLivePaywallPresentation', () => {
  const liveReady = {
    platformIos: true,
    gateEnforced: true,
    rcSkipped: false,
    hasApiKey: true,
    alreadyPremium: false,
  };

  it('shows the sheet when all live guards pass', () => {
    expect(resolveLivePaywallPresentation(liveReady)).toEqual({ action: 'show_sheet' });
  });

  it('alerts on non-iOS', () => {
    expect(
      resolveLivePaywallPresentation({ ...liveReady, platformIos: false })
    ).toEqual({ action: 'alert', reason: 'not_ios' });
  });

  it('skips silently when the gate is disabled', () => {
    expect(
      resolveLivePaywallPresentation({ ...liveReady, gateEnforced: false })
    ).toEqual({ action: 'skip', reason: 'gate_disabled' });
  });

  it('alerts when RevenueCat native layer is skipped', () => {
    expect(
      resolveLivePaywallPresentation({ ...liveReady, rcSkipped: true })
    ).toEqual({ action: 'alert', reason: 'rc_skipped' });
  });

  it('alerts when the RevenueCat API key is missing', () => {
    expect(
      resolveLivePaywallPresentation({ ...liveReady, hasApiKey: false })
    ).toEqual({ action: 'alert', reason: 'no_api_key' });
  });

  it('skips when the user is already premium', () => {
    expect(
      resolveLivePaywallPresentation({ ...liveReady, alreadyPremium: true })
    ).toEqual({ action: 'skip', reason: 'already_premium' });
  });
});

describe('shouldShowSettingsPlanRow', () => {
  it('shows on iOS when the subscription gate is enforced', () => {
    expect(
      shouldShowSettingsPlanRow({ platformIos: true, gateEnforced: true })
    ).toBe(true);
  });

  it('hides when the gate is off or platform is not iOS', () => {
    expect(
      shouldShowSettingsPlanRow({ platformIos: true, gateEnforced: false })
    ).toBe(false);
    expect(
      shouldShowSettingsPlanRow({ platformIos: false, gateEnforced: true })
    ).toBe(false);
  });
});
