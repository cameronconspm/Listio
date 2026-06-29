import { useEffect, useRef } from 'react';
import type { MascotMood } from '../brand/Mascot';
import { showMascotSuccess } from '../../utils/appToast';

export type ReadinessState = {
  mood: MascotMood;
  title: string;
  subtitle: string;
};

export function getReadinessState(totalItems: number, linkedItemCount: number): ReadinessState {
  if (totalItems === 0) {
    return {
      mood: 'empty',
      title: 'Your list is empty',
      subtitle: 'Add items below or plan some meals to get started.',
    };
  }
  if (totalItems < 6) {
    return {
      mood: 'empty',
      title: 'Just getting started',
      subtitle: 'A few more items and you\'ll be set for the week.',
    };
  }
  if (linkedItemCount === 0 && totalItems < 15) {
    return {
      mood: 'hero',
      title: 'List is coming together',
      subtitle: 'Link meals to connect items to your weekly plan.',
    };
  }
  if (linkedItemCount > 0 && totalItems >= 15) {
    return {
      mood: 'celebrate',
      title: 'Well stocked for the week',
      subtitle: `${linkedItemCount} item${linkedItemCount === 1 ? '' : 's'} tied to your meal plan.`,
    };
  }
  if (linkedItemCount > 0) {
    return {
      mood: 'hero',
      title: 'Looking good',
      subtitle: `${linkedItemCount} item${linkedItemCount === 1 ? '' : 's'} linked to meals.`,
    };
  }
  return {
    mood: 'hero',
    title: 'Ready to plan',
    subtitle: 'Tap Meals to link items to your weekly schedule.',
  };
}

const MOOD_RANK: Record<MascotMood, number> = { empty: 0, hero: 1, celebrate: 2 };

const MOOD_UPGRADE_TOAST: Partial<Record<MascotMood, { title: string; message: string }>> = {
  hero: {
    title: 'List is coming together!',
    message: 'Keep adding to build out your week.',
  },
  celebrate: {
    title: 'Well stocked for the week!',
    message: 'Your meals and groceries are all lined up.',
  },
};

/** Toast when list readiness mood improves (formerly tied to the plan readiness card). */
export function useListReadinessCelebration(mood: MascotMood): void {
  const prevMoodRef = useRef<MascotMood | null>(null);
  useEffect(() => {
    const prev = prevMoodRef.current;
    prevMoodRef.current = mood;
    if (prev === null) return;
    if (MOOD_RANK[mood] > MOOD_RANK[prev]) {
      const toast = MOOD_UPGRADE_TOAST[mood];
      if (toast) showMascotSuccess(toast.title, toast.message);
    }
  }, [mood]);
}
