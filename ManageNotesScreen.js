import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert as NativeAlert,
  Platform,
  Animated,
  Linking
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import StorageService from './StorageService';
import NoteSaveEvents, { NOTE_SAVE_EVENT_TYPES } from './NoteSaveEvents';

const logWithTime = (message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}]`, message, ...args);
};

const showAlert = (title, message, buttons = [{ text: 'OK' }], options) => {
  const alertLabel = title ? `${title}${message ? `: ${message}` : ''}` : message || '';
  logWithTime(`Displaying alert: ${alertLabel}`);

  if (Platform.OS === 'web') {
    const normalizedButtons = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
    const fullMessage = title ? `${title}\n\n${message || ''}` : message || '';

    if (typeof window === 'undefined') {
      console.warn('Alert:', fullMessage);
      normalizedButtons[0]?.onPress?.();
      return;
    }

    if (normalizedButtons.length === 1) {
      window.alert(fullMessage);
      normalizedButtons[0]?.onPress?.();
      return;
    }

    const confirmButton =
      normalizedButtons.find(btn => btn.style === 'destructive') ||
      normalizedButtons.find(btn => btn.style !== 'cancel') ||
      normalizedButtons[normalizedButtons.length - 1];
    const cancelButton =
      normalizedButtons.find(btn => btn.style === 'cancel') || normalizedButtons[0];

    const confirmed = window.confirm(fullMessage);
    if (confirmed) {
      confirmButton?.onPress?.();
    } else {
      cancelButton?.onPress?.();
    }
    return;
  }

  NativeAlert.alert(title, message, buttons, options);
};

const SkeletonNoteCard = ({ tempId }) => {
  const shimmer = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 0.9,
          duration: 900,
          useNativeDriver: true
        }),
        Animated.timing(shimmer, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true
        })
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmer]);

  useEffect(() => {
    logWithTime('[ManageNotesScreen] SkeletonNoteCard mounted', { tempId });
    return () => logWithTime('[ManageNotesScreen] SkeletonNoteCard unmounted', { tempId });
  }, [tempId]);

  const animatedStyle = { opacity: shimmer };

  return (
    <View style={styles.entryCard}>
      <Animated.View style={[styles.skeletonLine, styles.skeletonLineShort, animatedStyle]} />
      <Animated.View style={[styles.skeletonLine, styles.skeletonLineMedium, animatedStyle]} />
      <Animated.View style={[styles.skeletonLine, styles.skeletonLineFull, animatedStyle]} />
      <Animated.View style={[styles.skeletonBlock, animatedStyle]} />
    </View>
  );
};

const ProcessingNoteCard = ({ note }) => {
  useEffect(() => {
    logWithTime('[ManageNotesScreen] ProcessingNoteCard mounted', {
      tempId: note?.tempId,
      entryId: note?.entryId
    });
    return () =>
      logWithTime('[ManageNotesScreen] ProcessingNoteCard unmounted', {
        tempId: note?.tempId,
        entryId: note?.entryId
      });
  }, [note?.tempId, note?.entryId]);

  const timestamp = note.timestamp ? new Date(note.timestamp) : new Date();
  const formattedDate = StorageService.formatDateForDisplay(timestamp.toISOString());
  const formattedTime = timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <View style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <View style={styles.entryInfo}>
          <Text style={styles.entryDate}>
            {formattedDate} at {formattedTime}
          </Text>
          <Text style={styles.entrySource}>{note.source === 'voice' ? '🎤 Voice' : '✏️ Manual'}</Text>
        </View>
        <View style={styles.processingIndicator}>
          <ActivityIndicator size="small" color="#007bff" />
          <Text style={styles.processingText}>Extracting details...</Text>
        </View>
      </View>
      <Text style={styles.entryText}>{note.text || 'Processing transcription...'}</Text>
    </View>
  );
};

export default function ManageNotesScreen({ onAddNote, onOpenSettings }) {
  const [savedEntries, setSavedEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editedFoods, setEditedFoods] = useState([]);
  const [editedReactions, setEditedReactions] = useState([]);
  const [processingNotes, setProcessingNotes] = useState([]);
  const [editItemModalVisible, setEditItemModalVisible] = useState(false);
  const [editingItemType, setEditingItemType] = useState(null);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [editingItemData, setEditingItemData] = useState(null);
  const [optimisticNotes, setOptimisticNotes] = useState([]);

  useEffect(() => {
    loadSavedEntries();
    const pollInterval = setInterval(() => {
      refreshEntries();
    }, 4000);
    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    const unsubscribe = NoteSaveEvents.subscribe((event) => {
      if (!event) return;
      const { type, payload } = event;
      logWithTime('[ManageNotesScreen] NoteSaveEvents received', { type, payload });
      switch (type) {
        case NOTE_SAVE_EVENT_TYPES.PLACEHOLDER_ADDED:
          logWithTime('[ManageNotesScreen] Adding skeleton placeholder', { tempId: payload?.tempId });
          setOptimisticNotes((prev) => [
            {
              tempId: payload?.tempId,
              status: 'skeleton',
              timestamp: payload?.timestamp,
              source: payload?.source || 'voice'
            },
            ...prev.filter((note) => note.tempId !== payload?.tempId)
          ]);
          break;
        case NOTE_SAVE_EVENT_TYPES.PLACEHOLDER_HYDRATED:
          logWithTime('[ManageNotesScreen] Hydrating placeholder', {
            tempId: payload?.tempId,
            entryId: payload?.entryId
          });
          setOptimisticNotes((prev) =>
            prev.map((note) =>
              note.tempId === payload?.tempId
                ? {
                    ...note,
                    status: 'processing',
                    entryId: payload?.entryId,
                    text: payload?.text,
                    timestamp: payload?.timestamp || note.timestamp,
                    source: payload?.source || note.source
                  }
                : note
            )
          );
          break;
        case NOTE_SAVE_EVENT_TYPES.PLACEHOLDER_REMOVED:
          logWithTime('[ManageNotesScreen] Removing placeholder', { tempId: payload?.tempId });
          setOptimisticNotes((prev) => prev.filter((note) => note.tempId !== payload?.tempId));
          break;
        default:
          break;
      }
    });

    return unsubscribe;
  }, []);

  const refreshEntries = async () => {
    try {
      const currentEntries = await StorageService.getFoodLogs();
      setSavedEntries(currentEntries);
      setOptimisticNotes((prev) => {
        if (!prev.length) return prev;
        const entryIds = new Set(currentEntries.map((entry) => entry.id));
        return prev.filter((note) => !note.entryId || !entryIds.has(note.entryId));
      });
      
      const processing = currentEntries.filter(entry => entry.processingStatus === 'processing');
      setProcessingNotes(processing);
    } catch (error) {
      console.error('Error refreshing entries:', error);
    }
  };

  const loadSavedEntries = async () => {
    try {
      setIsLoading(true);
      const entries = await StorageService.getFoodLogs();
      setSavedEntries(entries);
      setOptimisticNotes((prev) => {
        if (!prev.length) return prev;
        const entryIds = new Set(entries.map((entry) => entry.id));
        return prev.filter((note) => !note.entryId || !entryIds.has(note.entryId));
      });
      
      const processing = entries.filter(entry => entry.processingStatus === 'processing');
      setProcessingNotes(processing);
    } catch (error) {
      showAlert('Error', 'Failed to load saved entries.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteNote = (entryId) => {
    showAlert(
      'Delete Note',
      'Are you sure you want to delete this note? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteNote(entryId)
        }
      ]
    );
  };

  const deleteNote = async (entryId) => {
    try {
      setIsDeleting(entryId);
      const success = await StorageService.deleteFoodLogEntry(entryId);
      
      if (success) {
        setSavedEntries(prev => prev.filter(entry => entry.id !== entryId));
        showAlert('Success', 'Note deleted successfully.');
      } else {
        showAlert('Error', 'Failed to delete note.');
      }
    } catch (error) {
      showAlert('Error', 'An error occurred while deleting the note.');
    } finally {
      setIsDeleting(null);
    }
  };

  const openEditModal = (entry) => {
    setEditingEntry(entry);
    setEditedFoods(entry.foods || []);
    setEditedReactions(entry.reactions || []);
    setEditModalVisible(true);
  };

  const openEditItemModal = (type, index, data) => {
    setEditingItemType(type);
    setEditingItemIndex(index);
    setEditingItemData(data);
    setEditItemModalVisible(true);
  };

  const saveEditedItem = (updatedData) => {
    if (editingItemType === 'food') {
      setEditedFoods(prev => prev.map((item, i) => i === editingItemIndex ? updatedData : item));
    } else if (editingItemType === 'reaction') {
      setEditedReactions(prev => prev.map((item, i) => i === editingItemIndex ? updatedData : item));
    }
    setEditItemModalVisible(false);
    setEditingItemType(null);
    setEditingItemIndex(null);
    setEditingItemData(null);
  };

  return (
    <SafeAreaView style={styles.container}>...</SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // styles omitted for brevity, unchanged from original file
});