import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ACCOUNT_LOADING_STATUS_MESSAGES } from '../constants/accountLoadingCopy';
import {
  registerAccountBootstrapReset,
  unregisterAccountBootstrapReset,
} from './accountBootstrapSession';
import { useAuth } from './AuthContext';

export type AccountBootstrapPhase = 'idle' | 'active' | 'completing' | 'complete';

const FINISH_ANIMATION_MS = 340;
const CREEP_INTERVAL_MS = 380;
const CREEP_STEP = 0.028;
const MAX_ACTIVE_PROGRESS = 0.9;

type AccountBootstrapContextValue = {
  phase: AccountBootstrapPhase;
  progress: number;
  statusIndex: number;
  activate: () => void;
  bumpProgress: (floor: number) => void;
  reset: () => void;
  /** Mark home data ready. `skipAnimation` jumps straight to `complete` (warm starts). */
  notifyHomeContentReady: (options?: { skipAnimation?: boolean }) => void;
};

const AccountBootstrapContext = createContext<AccountBootstrapContextValue | null>(null);

export function AccountBootstrapProvider({ children }: { children: React.ReactNode }) {
  const { userId, isAuthenticated } = useAuth();
  const [phase, setPhase] = useState<AccountBootstrapPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeReadyReportedRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const clearFinishTimer = useCallback(() => {
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearFinishTimer();
    homeReadyReportedRef.current = false;
    setPhase('idle');
    setProgress(0);
    setStatusIndex(0);
  }, [clearFinishTimer]);

  const activate = useCallback(() => {
    setPhase((prev) => (prev === 'idle' ? 'active' : prev));
    setProgress((p) => Math.max(p, 0.06));
  }, []);

  const bumpProgress = useCallback((floor: number) => {
    setProgress((p) => {
      const ph = phaseRef.current;
      if (ph === 'completing' || ph === 'complete') return p;
      return Math.max(p, Math.min(floor, MAX_ACTIVE_PROGRESS));
    });
  }, []);

  const notifyHomeContentReady = useCallback(
    (options?: { skipAnimation?: boolean }) => {
      if (homeReadyReportedRef.current) return;
      homeReadyReportedRef.current = true;
      clearFinishTimer();
      if (options?.skipAnimation) {
        setProgress(1);
        setPhase('complete');
        return;
      }
      setPhase('completing');
      setProgress(1);
      finishTimerRef.current = setTimeout(() => {
        setPhase('complete');
        finishTimerRef.current = null;
      }, FINISH_ANIMATION_MS);
    },
    [clearFinishTimer]
  );

  useEffect(() => {
    if (phase !== 'active') return;
    const id = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(MAX_ACTIVE_PROGRESS, p + CREEP_STEP);
        return next <= p ? p : next;
      });
    }, CREEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'active' && phase !== 'completing') return;
    const intervalMs = 1400;
    const id = setInterval(() => {
      setStatusIndex((i) => (i + 1) % ACCOUNT_LOADING_STATUS_MESSAGES.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => () => clearFinishTimer(), [clearFinishTimer]);

  useEffect(() => {
    registerAccountBootstrapReset(reset);
    return () => unregisterAccountBootstrapReset();
  }, [reset]);

  useEffect(() => {
    if (isAuthenticated === null) activate();
  }, [isAuthenticated, activate]);

  useEffect(() => {
    if (userId === null) reset();
    else if (typeof userId === 'string' && userId.length > 0) activate();
  }, [userId, reset, activate]);

  const value = useMemo(
    () => ({
      phase,
      progress,
      statusIndex,
      activate,
      bumpProgress,
      reset,
      notifyHomeContentReady,
    }),
    [phase, progress, statusIndex, activate, bumpProgress, reset, notifyHomeContentReady]
  );

  return (
    <AccountBootstrapContext.Provider value={value}>{children}</AccountBootstrapContext.Provider>
  );
}

export function useAccountBootstrap(): AccountBootstrapContextValue {
  const ctx = useContext(AccountBootstrapContext);
  if (!ctx) {
    throw new Error('useAccountBootstrap must be used within AccountBootstrapProvider');
  }
  return ctx;
}
