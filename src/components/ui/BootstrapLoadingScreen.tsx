import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { useAccountBootstrap } from '../../context/AccountBootstrapContext';
import { useTheme } from '../../design/ThemeContext';
import { AnimatedStatusLoadingPage } from './AnimatedStatusLoadingPage';
import { queryKeys } from '../../query/keys';
import { fetchHomeListBundle, HOME_LIST_STALE_MS } from '../../query/homeListBundle';
import {
  ACCOUNT_LOADING_DETAIL,
  ACCOUNT_LOADING_ICONS,
  ACCOUNT_LOADING_STATUS_MESSAGES,
  ACCOUNT_LOADING_TITLE,
} from '../../constants/accountLoadingCopy';
import { logger } from '../../utils/logger';

/** Don't render the loading card until this long has elapsed — fast warm starts never see it. */
export const BOOTSTRAP_CARD_DELAY_MS = 180;

/** Matches auth/onboarding hang budgets — fail open into the app if home data never resolves. */
const HOME_BOOTSTRAP_HANG_MS = 25_000;

type Props = {
  /**
   * `true` once auth + onboarding gating has resolved and the home bundle should fetch.
   * While `false`, this screen still renders (covers session-resolve and onboarding-check)
   * but no synced data query is fired.
   */
  homeFetchAllowed: boolean;
};

/**
 * Full-screen loading shown until the home list bundle is in cache. Owns the home query
 * so `RootNavigator` doesn't have to mount underneath. On warm starts (data resolved within
 * `BOOTSTRAP_CARD_DELAY_MS`), the card never renders and we transition straight to the app.
 */
export function BootstrapLoadingScreen({ homeFetchAllowed }: Props) {
  const theme = useTheme();
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const {
    progress,
    statusIndex,
    activate,
    bumpProgress,
    notifyHomeContentReady,
  } = useAccountBootstrap();

  const userReady = typeof userId === 'string' && userId.length > 0;
  const [cardVisible, setCardVisible] = useState(false);
  const cardShownRef = useRef(false);

  const listQuery = useQuery({
    queryKey: queryKeys.homeList(userId ?? ''),
    queryFn: () => fetchHomeListBundle(userId!, queryClient),
    enabled: userReady && homeFetchAllowed,
    staleTime: HOME_LIST_STALE_MS,
  });

  useEffect(() => {
    activate();
  }, [activate]);

  useEffect(() => {
    const id = setTimeout(() => {
      setCardVisible(true);
      cardShownRef.current = true;
    }, BOOTSTRAP_CARD_DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!userReady) {
      bumpProgress(0.12);
      return;
    }
    if (!homeFetchAllowed) {
      bumpProgress(0.32);
      return;
    }
    if (listQuery.isFetching && listQuery.data === undefined) {
      bumpProgress(0.55);
      return;
    }
    if (listQuery.data !== undefined) {
      bumpProgress(0.85);
    }
  }, [
    userReady,
    homeFetchAllowed,
    listQuery.isFetching,
    listQuery.data,
    bumpProgress,
  ]);

  const homeReady =
    userReady && homeFetchAllowed && listQuery.data !== undefined;
  const homeErrored =
    userReady &&
    homeFetchAllowed &&
    listQuery.isError &&
    listQuery.data === undefined;

  useEffect(() => {
    if (!homeReady && !homeErrored) return;
    notifyHomeContentReady({ skipAnimation: !cardShownRef.current });
  }, [homeReady, homeErrored, notifyHomeContentReady]);

  useEffect(() => {
    if (!userReady || !homeFetchAllowed) return;
    if (homeReady || homeErrored) return;
    const id = setTimeout(() => {
      logger.warnRelease(
        `Home bootstrap timed out after ${HOME_BOOTSTRAP_HANG_MS}ms; entering app`
      );
      notifyHomeContentReady({ skipAnimation: !cardShownRef.current });
    }, HOME_BOOTSTRAP_HANG_MS);
    return () => clearTimeout(id);
  }, [userReady, homeFetchAllowed, homeReady, homeErrored, notifyHomeContentReady]);

  if (!cardVisible) {
    return <View style={[styles.root, { backgroundColor: theme.background }]} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <AnimatedStatusLoadingPage
        title={ACCOUNT_LOADING_TITLE}
        detail={ACCOUNT_LOADING_DETAIL}
        statusMessages={ACCOUNT_LOADING_STATUS_MESSAGES}
        icons={ACCOUNT_LOADING_ICONS}
        progressFraction={progress}
        statusIndex={statusIndex}
        animateIconsOnMount
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
