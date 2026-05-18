import { Alert, Platform } from 'react-native';
import {
  customerInfoHasPremium,
  getRevenueCatIosApiKey,
  isRevenueCatNativeLayerSkipped,
  restorePurchases,
  shouldEnforceIosSubscriptionGate,
} from './purchasesService';
import { ensureServerSubscriptionMirror } from './subscriptionEntitlementSyncService';

export type RestorePurchasesFlowOptions = {
  onPremiumActive?: () => void;
};

/**
 * Restores App Store purchases via RevenueCat and surfaces the same user-facing
 * alerts as Settings → Restore purchases.
 *
 * @returns true when an active premium entitlement was found after restore.
 */
export async function restorePurchasesWithUserFeedback(
  options: RestorePurchasesFlowOptions = {}
): Promise<boolean> {
  if (Platform.OS !== 'ios' || !shouldEnforceIosSubscriptionGate()) {
    return false;
  }
  if (isRevenueCatNativeLayerSkipped()) {
    Alert.alert('Not available', 'Subscriptions aren’t available in this build.');
    return false;
  }
  if (!getRevenueCatIosApiKey()) {
    Alert.alert(
      'Not configured',
      'Subscriptions aren’t set up in this build. Install the App Store version to subscribe.'
    );
    return false;
  }

  try {
    const info = await restorePurchases();
    if (customerInfoHasPremium(info)) {
      await ensureServerSubscriptionMirror();
      options.onPremiumActive?.();
      Alert.alert('Restored', 'Your subscription is active.');
      return true;
    }
    Alert.alert(
      'No subscription found',
      'We couldn’t find an active subscription for this account.'
    );
    return false;
  } catch (e) {
    Alert.alert('Restore failed', e instanceof Error ? e.message : 'Please try again.');
    return false;
  }
}
