import type { NavigationProp, ParamListBase } from '@react-navigation/native';

/** After actions on the settings hub, leave the screen appropriately (modal pop vs switch to List tab). */
export function leaveSettingsHub(navigation: NavigationProp<ParamListBase>) {
  const stackParent = navigation.getParent();
  const tabOrRoot = stackParent?.getParent();
  const state = tabOrRoot?.getState() as { type?: string } | undefined;
  if (state?.type === 'tab') {
    (tabOrRoot as { navigate: (name: string, params?: object) => void }).navigate('ListTab', {
      screen: 'List',
    });
    return;
  }
  if (navigation.canGoBack()) {
    navigation.goBack();
  }
}
