import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/** Deep-link to Plan on the Profile tab (e.g. free-tier usage banner). */
export function openPlanScreen(tabNavigation: NavigationProp<ParamListBase>): void {
  tabNavigation.navigate('ProfileStack', { screen: 'Plan' });
}
