import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

export type AuthStackParamList = {
  AuthSplash: undefined;
  WelcomeIntro: undefined;
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

export type RootStackParamList = {
  AppTabs: { screen?: string } | undefined;
};

export type SettingsStackParamList = {
  SettingsHub: undefined;
  Profile: undefined;
  ChangePassword: undefined;
  Plan: undefined;
  Notifications: undefined;
  ThemePreferences: undefined;
  Onboarding: undefined;
  SettingsPlaceholder: { title: string };
  PrivacyTerms: undefined;
  DeleteAccount: undefined;
};

export type TabsParamList = {
  ListTab: undefined;
  MealsStack: undefined;
  RecipesStack: undefined;
  ProfileStack: undefined;
};

export type MealsStackParamList = {
  MealsList: undefined;
  MealDetails: { mealId: string };
  MealEdit: {
    mealId?: string;
    preFillDate?: string;
    preFillSlot?: string;
    preFillCustomSlotName?: string;
  };
};

export type RecipesStackParamList = {
  RecipesList: undefined;
  RecipeDetails: { recipeId: string };
  RecipeEdit: { recipeId?: string };
};

export type AuthStackScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;

export type TabsScreenProps<T extends keyof TabsParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabsParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

export type MealsStackScreenProps<T extends keyof MealsStackParamList> = NativeStackScreenProps<
  MealsStackParamList,
  T
>;

export type RecipesStackScreenProps<T extends keyof RecipesStackParamList> = NativeStackScreenProps<
  RecipesStackParamList,
  T
>;

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- React Navigation module augmentation
    interface RootParamList extends RootStackParamList {}
  }
}
