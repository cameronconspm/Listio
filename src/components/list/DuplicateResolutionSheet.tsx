import React, { useRef } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { DuplicateResolutionPanel } from './DuplicateResolutionPanel';
import type { DuplicateMatch } from '../../utils/duplicateDetection';
import type { ParsedItem } from '../../utils/parseItems';

type DuplicateResolutionSheetProps = {
  visible: boolean;
  match: DuplicateMatch | null;
  incoming: ParsedItem | null;
  onMerge: () => void;
  onAddSeparately: () => void;
  onCancel: () => void;
};

export function DuplicateResolutionSheet({
  visible,
  match,
  incoming,
  onMerge,
  onAddSeparately,
  onCancel,
}: DuplicateResolutionSheetProps) {
  // Keep last payload while the sheet finishes its exit animation (visible=false). Do not gate on
  // `visible` — that unmounts BottomSheet immediately and skips the dismiss animation.
  const matchRef = useRef<DuplicateMatch | null>(null);
  const incomingRef = useRef<ParsedItem | null>(null);
  if (match) matchRef.current = match;
  if (incoming) incomingRef.current = incoming;
  const effectiveMatch = match ?? matchRef.current;
  const effectiveIncoming = incoming ?? incomingRef.current;

  if (!effectiveMatch || !effectiveIncoming) return null;

  return (
    <BottomSheet visible={visible} onClose={onCancel}>
      <DuplicateResolutionPanel
        match={effectiveMatch}
        incoming={effectiveIncoming}
        onMerge={onMerge}
        onAddSeparately={onAddSeparately}
        onCancel={onCancel}
      />
    </BottomSheet>
  );
}
