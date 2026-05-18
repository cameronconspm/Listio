import React, { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '../../navigation/types';
import { PushedScreenHeader } from '../../components/ui/PushedScreenHeader';

type SettingsPushedScreenHeaderProps = {
  title: string;
};

export function SettingsPushedScreenHeader({ title }: SettingsPushedScreenHeaderProps) {
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();

  const handleBack = useCallback(() => {
    if (navigation.getState().index > 0) {
      navigation.goBack();
      return;
    }
    navigation.navigate('SettingsHub');
  }, [navigation]);

  return <PushedScreenHeader title={title} onBack={handleBack} />;
}
