import { posthog } from 'posthog-react-native';

const subscribers = new Set();

export const NOTE_SAVE_EVENT_TYPES = {
  PLACEHOLDER_ADDED: 'placeholder_added',
  PLACEHOLDER_HYDRATED: 'placeholder_hydrated',
  PLACEHOLDER_REMOVED: 'placeholder_removed',
  NOTE_SAVED: 'note_saved',
  EXTRACTION_COMPLETED: 'extraction_completed',
  EXTRACTION_FOUND_NOTHING: 'extraction_found_nothing'
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
    if (posthog?.capture && typeof posthog.capture === 'function') {
      posthog.capture(event.type, event.payload);
    }
  } catch (error) {
    // Silently fail if PostHog is not initialized
    // This can happen during app initialization before PostHogProvider is ready
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

const emitNoteSaved = (payload) =>
  emit({ type: NOTE_SAVE_EVENT_TYPES.NOTE_SAVED, payload });

const emitExtractionCompleted = (payload) =>
  emit({ type: NOTE_SAVE_EVENT_TYPES.EXTRACTION_COMPLETED, payload });

const emitExtractionFoundNothing = (payload) =>
  emit({ type: NOTE_SAVE_EVENT_TYPES.EXTRACTION_FOUND_NOTHING, payload });

export default {
  subscribe,
  emitPlaceholderAdded,
  emitPlaceholderHydrated,
  emitPlaceholderRemoved,
  emitNoteSaved,
  emitExtractionCompleted,
  emitExtractionFoundNothing
};