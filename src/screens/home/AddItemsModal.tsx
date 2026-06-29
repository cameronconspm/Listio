import React, { useState } from 'react';
import { Text, StyleSheet, View, Linking } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../design/ThemeContext';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { TextField } from '../../components/ui/TextField';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { parseItems } from '../../utils/parseItems';
import { titleCaseWords } from '../../utils/titleCaseWords';
import { recordItemAdded } from '../../services/recentItemsStore';
import { isSyncEnabled } from '../../services/supabaseClient';
import { useAuthUserId } from '../../context/AuthContext';
import { PRIVACY_POLICY_URL } from '../../constants/legalUrls';
import { AI_SMART_CATEGORIZATION_DISCLOSURE_LEAD } from '../../constants/aiPrivacyDisclosure';
import { useHomeListMutations } from '../../hooks/useHomeListMutations';
import { getCachedHomeListBundle } from '../../query/homeListBundle';
import type { ZoneKey } from '../../types/models';
import { DEFAULT_ZONE_ORDER, ZONE_LABELS } from '../../data/zone';
import { spacing } from '../../design/spacing';
import { ensureFreeTierCapacity } from '../../services/freeTierLimits';
import { usePremiumEntitlement } from '../../context/PremiumEntitlementContext';

type AddItemsModalProps = {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
};

export function AddItemsModal({ visible, onClose, onAdded }: AddItemsModalProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { insertItems } = useHomeListMutations();
  const { isPremium, isPremiumLoading } = usePremiumEntitlement();
  const authUserId = useAuthUserId();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const raw = parseItems(text).map((line) => titleCaseWords(line));
    if (raw.length === 0) {
      setError('Enter or paste at least one item');
      return;
    }
    const userId = typeof authUserId === 'string' ? authUserId : null;
    if (!userId) {
      setError('Not signed in');
      return;
    }
    setLoading(true);
    try {
      const currentBundle = getCachedHomeListBundle(queryClient, userId);
      const currentCount = currentBundle?.listItems.length ?? 0;
      const ok = await ensureFreeTierCapacity('list', currentCount, raw.length, isPremium, isPremiumLoading);
      if (!ok) {
        setLoading(false);
        return;
      }
      const storeType = currentBundle?.store?.store_type ?? 'generic';
      const zoneLabelsInOrder = DEFAULT_ZONE_ORDER.map((zoneKey) => ZONE_LABELS[zoneKey]);
      const { categorizeItems, phraseKeyForCategorize } = await import('../../services/aiService');
      const { results } = await categorizeItems(raw, storeType, zoneLabelsInOrder, {
        premiumHint: { isPremium, isLoading: isPremiumLoading },
      });
      await insertItems.mutateAsync({
        userId,
        items: results.map((r, i) => ({
          user_id: userId,
          name: raw[i] ?? r.input,
          normalized_name: phraseKeyForCategorize(raw[i] ?? r.input),
          category: r.category,
          zone_key: r.zone_key as ZoneKey,
          quantity_value: null,
          quantity_unit: null,
          notes: null,
          is_checked: false,
          linked_meal_ids: [],
        })),
      });
      results.forEach((r, i) => {
        const display = raw[i] ?? r.input;
        recordItemAdded(phraseKeyForCategorize(display), display, null);
      });
      setText('');
      onAdded();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add items');
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} surfaceVariant="solid">
      <View style={styles.wrapper}>
        <Text style={[theme.typography.headline, { color: theme.textPrimary, marginBottom: theme.spacing.sm }]}>
          Add items
        </Text>
        <View style={{ marginBottom: theme.spacing.lg }}>
          <Text style={[theme.typography.footnote, { color: theme.textSecondary, marginBottom: theme.spacing.xs }]}>
            One per line or comma-separated. Sorted into store sections.
          </Text>
          {isSyncEnabled() ? (
            <Text style={[theme.typography.footnote, { color: theme.textSecondary, lineHeight: 20 }]}>
              {AI_SMART_CATEGORIZATION_DISCLOSURE_LEAD}{' '}
              <Text
                onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)}
                style={{ color: theme.accent }}
                accessibilityRole="link"
                accessibilityLabel="Open privacy policy"
              >
                Privacy policy
              </Text>
              .
            </Text>
          ) : null}
        </View>
        <TextField
          label="Items"
          value={text}
          onChangeText={(s) => {
            setText(s);
            setError(null);
          }}
          placeholder="milk\nchicken thighs 2 lb\nbananas"
          multiline
          numberOfLines={5}
          style={styles.input}
          error={error ?? undefined}
        />
        <PrimaryButton title="Add" onPress={handleSubmit} loading={loading} style={styles.cta} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, paddingBottom: spacing.xl },
  input: { minHeight: 120 },
  cta: { marginTop: spacing.md },
});
