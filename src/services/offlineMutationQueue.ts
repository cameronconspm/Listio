import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@listio/offline-mutation-queue-v1';

const OFFLINE_QUEUE_ENABLED =
  process.env.EXPO_PUBLIC_OFFLINE_MUTATION_QUEUE?.trim() === '1' ||
  process.env.EXPO_PUBLIC_OFFLINE_MUTATION_QUEUE?.trim().toLowerCase() === 'true';

export type QueuedMutation = {
  id: string;
  type: 'list_toggle' | 'list_delete' | 'list_insert';
  payload: Record<string, unknown>;
  createdAt: number;
};

export function isOfflineMutationQueueEnabled(): boolean {
  return OFFLINE_QUEUE_ENABLED;
}

export async function readOfflineMutationQueue(): Promise<QueuedMutation[]> {
  if (!OFFLINE_QUEUE_ENABLED) return [];
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueuedMutation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function enqueueOfflineMutation(entry: Omit<QueuedMutation, 'id' | 'createdAt'>): Promise<void> {
  if (!OFFLINE_QUEUE_ENABLED) return;
  const queue = await readOfflineMutationQueue();
  queue.push({
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/** Replay hook point — callers wire concrete mutation replay when the feature is enabled. */
export async function clearOfflineMutationQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
