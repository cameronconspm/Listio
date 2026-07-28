/** Result of evaluating whether the live paywall sheet should open. */
export type PaywallPresentationDecision =
  | { action: 'show_sheet' }
  | { action: 'skip'; reason: 'gate_disabled' | 'already_premium' }
  | { action: 'alert'; reason: 'not_ios' | 'rc_skipped' | 'no_api_key' };

export function resolveLivePaywallPresentation(input: {
  platformIos: boolean;
  gateEnforced: boolean;
  rcSkipped: boolean;
  hasApiKey: boolean;
  alreadyPremium: boolean;
}): PaywallPresentationDecision {
  if (!input.platformIos) {
    return { action: 'alert', reason: 'not_ios' };
  }
  if (!input.gateEnforced) {
    return { action: 'skip', reason: 'gate_disabled' };
  }
  if (input.rcSkipped) {
    return { action: 'alert', reason: 'rc_skipped' };
  }
  if (!input.hasApiKey) {
    return { action: 'alert', reason: 'no_api_key' };
  }
  if (input.alreadyPremium) {
    return { action: 'skip', reason: 'already_premium' };
  }
  return { action: 'show_sheet' };
}

/** Whether the Settings hub should show the Listio+ / Plan row. */
export function shouldShowSettingsPlanRow(input: {
  platformIos: boolean;
  gateEnforced: boolean;
}): boolean {
  return input.platformIos && input.gateEnforced;
}
