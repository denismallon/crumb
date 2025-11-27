const subscribers = new Set();

export const NOTE_SAVE_EVENT_TYPES = {
  PLACEHOLDER_ADDED: 'PLACEHOLDER_ADDED',
  PLACEHOLDER_HYDRATED: 'PLACEHOLDER_HYDRATED',
  PLACEHOLDER_REMOVED: 'PLACEHOLDER_REMOVED'
};

const emit = (event) => {
  subscribers.forEach((callback) => {
    try {
      callback(event);
    } catch (error) {
      console.error('NoteSaveEvents subscriber error:', error);
    }
  });
};

const subscribe = (callback) => {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
};

const emitPlaceholderAdded = (payload) =>
  emit({ type: NOTE_SAVE_EVENT_TYPES.PLACEHOLDER_ADDED, payload });

const emitPlaceholderHydrated = (payload) =>
  emit({ type: NOTE_SAVE_EVENT_TYPES.PLACEHOLDER_HYDRATED, payload });

const emitPlaceholderRemoved = (payload) =>
  emit({ type: NOTE_SAVE_EVENT_TYPES.PLACEHOLDER_REMOVED, payload });

export default {
  subscribe,
  emitPlaceholderAdded,
  emitPlaceholderHydrated,
  emitPlaceholderRemoved
};

