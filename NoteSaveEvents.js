import { posthog } from 'posthog-react-native';

const subscribers = new Set();

export const NOTE_SAVE_EVENT_TYPES = {
  PLACEHOLDER_ADDED: 'PLACEHOLDER_ADDED',
  PLACEHOLDER_HYDRATED: 'PLACEHOLDER_HYDRATED',
  PLACEHOLDER_REMOVED: 'PLACEHOLDER_REMOVED'
};

// Emit an event to both PostHog and all subscribers
const emit = (event) => {
  // Notify all JS subscribers
  subscribers.forEach((callback) => {
    try {
      callback(event);
    } catch (error) {
      console.error('NoteSaveEvents subscriber error:', error);
    }
  });

  // Capture the event in PostHog
  try {
    posthog.capture(event.type, event.payload);
  } catch (error) {
    console.error('PostHog capture error:', error);
  }
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