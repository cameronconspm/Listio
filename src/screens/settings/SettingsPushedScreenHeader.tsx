import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '../../navigation/types';
import { PushedScreenHeader } from '../../components/ui/PushedScreenHeader';

type SettingsPushedScreenHeaderProps = {
  title: string;
};

export function SettingsPushedScreenHeader({ title }: SettingsPushedScreenHeaderProps) {
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();
  return <PushedScreenHeader title={title} onBack={() => navigation.goBack()} />;
}
