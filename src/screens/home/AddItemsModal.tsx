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
import { getUserId, isSyncEnabled } from '../../services/supabaseClient';
import { PRIVACY_POLICY_URL } from '../../constants/legalUrls';
import { AI_SMART_CATEGORIZATION_DISCLOSURE_LEAD } from '../../constants/aiPrivacyDisclosure';
import { useHomeListMutations } from '../../hooks/useHomeListMutations';
import { queryKeys } from '../../query/keys';
import type { HomeListBundle } from '../../query/homeListBundle';
import type { ZoneKey } from '../../types/models';
import { spacing } from '../../design/spacing';

type AddItemsModalProps = {
  visible: boolean;
  onClose: () => void;
  onAdded: () => void;
};

export function AddItemsModal({ visible, onClose, onAdded }: AddItemsModalProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { insertItems } = useHomeListMutations();
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
    const userId = await getUserId();
    if (!userId) {
      setError('Not signed in');
      return;
    }
    setLoading(true);
    try {
      const storeType =
        queryClient.getQueryData<HomeListBundle>(queryKeys.homeList(userId))?.store?.store_type ??
        'generic';
      const { categorizeItems } = await import('../../services/aiService');
      const { results } = await categorizeItems(raw, storeType);
      await insertItems.mutateAsync({
        userId,
        items: results.map((r, i) => ({
          user_id: userId,
          name: r.normalized_name,
          normalized_name: r.normalized_name,
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
        recordItemAdded(r.normalized_name, raw[i] ?? r.normalized_name, null);
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
            One per line or comma-separated. Categorized by section.
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
