import { requireNativeModule } from 'expo-modules-core';

type ListioWidgetBridgeModule = {
  setWidgetData: (appGroup: string, key: string, json: string) => void;
};

export const ListioWidgetBridge =
  requireNativeModule<ListioWidgetBridgeModule>('ListioWidgetBridge');
