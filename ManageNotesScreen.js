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
import { usePostHog } from 'posthog-react-native';
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
  const posthog = usePostHog();
  const [savedEntries, setSavedEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editedFoods, setEditedFoods] = useState([]);
  const [editedReactions, setEditedReactions] = useState([]);
  const [processingNotes, setProcessingNotes] = useState([]);
  const [editItemModalVisible, setEditItemModalVisible] = useState(false);
  const [editingItemType, setEditingItemType] = useState(null); // 'food' or 'reaction'
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [editingItemData, setEditingItemData] = useState(null);
  const [optimisticNotes, setOptimisticNotes] = useState([]);

  // Track screen view on mount
  useEffect(() => {
    if (posthog?.screen) {
      posthog.screen('ManageNotesScreen');
    }
  }, [posthog]);

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
          setOptimisticNotes((prev) =>
            prev.filter((note) => note.tempId !== payload?.tempId)
          );
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
      
      // Get processing notes
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
      
      // Get processing notes
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
        // Track note deletion
        if (posthog?.capture) {
          posthog.capture('note_deleted', {
            screen: 'ManageNotesScreen'
          });
        }

        // Remove from local state
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

  // Removed Export/Clear UI from homepage per redesign

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
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="auto" />
      
      <View style={styles.header}>
        <Text style={styles.title}>How are they doing?</Text>
        <Text style={styles.subtitle}>staging version</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Simplified homepage: no notifications, no inline data management, FABs below */}

        {/* Notes List */}
        <View style={styles.notesSection}>
          {savedEntries.length > 0 && (
            <Text style={styles.sectionTitle}>You have {savedEntries.length} notes</Text>
          )}
          
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007bff" />
              <Text style={styles.loadingText}>Loading notes...</Text>
            </View>
          ) : savedEntries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyTitle}>No notes yet</Text>
              <Text style={styles.emptySubtitle}>Tap the + button above to add your first note</Text>
            </View>
          ) : (
            <View style={styles.entriesContainer}>
              {optimisticNotes.map((note) =>
                note.status === 'skeleton' ? (
                  <SkeletonNoteCard key={note.tempId} tempId={note.tempId} />
                ) : (
                  <ProcessingNoteCard
                    key={note.tempId}
                    note={note}
                  />
                )
              )}
              {savedEntries.map((entry) => {
                const isProcessing = entry.processingStatus === 'processing';
                return (
                  <View key={entry.id} style={styles.entryCard}>
                    {isProcessing && (
                      <View style={styles.processingIndicator}>
                        <ActivityIndicator size="small" color="#007bff" />
                        <Text style={styles.processingText}>Extracting details...</Text>
                      </View>
                    )}
                    <View style={styles.entryHeader}>
                      <View style={styles.entryInfo}>
                        <Text style={styles.entryDate}>
                          {StorageService.formatDateForDisplay(entry.timestamp)} at {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </Text>
                        <Text style={styles.entrySource}>{entry.source === 'voice' ? '🎤 Voice' : '✏️ Manual'}</Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.editButton}
                        onPress={() => openEditModal(entry)}
                        disabled={isDeleting === entry.id || isProcessing}
                        accessibilityLabel="Edit entry"
                      >
                        <Text style={styles.editButtonText}>✎</Text>
                      </TouchableOpacity>
                    </View>
                    
                    <Text style={styles.entryText}>{entry.text}</Text>
                    
                    {/* Diagnostics removed for simplicity */}

                    {/* Extracted Foods */}
                    {entry.foods && entry.foods.length > 0 && (
                      <View style={styles.extractedDataSection}>
                        <Text style={styles.extractedDataTitle}>🍎 Foods:</Text>
                        {entry.foods.map((food, index) => (
                          <Text key={index} style={styles.extractedDataItem}>
                            • {food.name} ({food.mealType}){food.quantity ? ` - ${food.quantity}` : ''}
                          </Text>
                        ))}
                      </View>
                    )}
                    
                    {/* Extracted Reactions */}
                    {entry.reactions && entry.reactions.length > 0 && (
                      <View style={styles.extractedDataSection}>
                        <Text style={styles.extractedDataTitle}>⚠️ Reactions:</Text>
                        {entry.reactions.map((reaction, index) => (
                          <Text key={index} style={styles.extractedDataItem}>
                            • {reaction.description} ({reaction.type}){reaction.reactionDelayMinutes ? ` - ${reaction.reactionDelayMinutes}min delay` : ''}
                          </Text>
                        ))}
                      </View>
                    )}
                    
                    {/* Confidence and labels removed for simplicity */}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Branding Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 Crumb Health Ltd</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://www.heycrumb.io')}>
            <Text style={styles.footerLink}>www.heycrumb.io</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {/* Floating Action Buttons */}
      <View style={styles.fabContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.primaryFab}
          onPress={onAddNote}
          accessibilityLabel="Add new note"
        >
          <Text style={styles.fabIcon}>＋</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryFab}
          onPress={onOpenSettings}
          accessibilityLabel="Open settings"
        >
          <Text style={styles.settingsIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="none"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <SafeAreaView style={styles.editModalContainer}>
          <View style={styles.editModalHeader}>
            <TouchableOpacity style={styles.editModalCloseButton} onPress={() => setEditModalVisible(false)}>
              <Text style={styles.editModalCloseButtonText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.editModalTitle}>Edit Food Log Entry</Text>
            <View style={styles.editModalPlaceholder} />
          </View>
          
          <ScrollView style={styles.editModalContent}>
            {editingEntry && (
              <View>
                <Text style={styles.editModalLabel}>Original Note</Text>
                <Text style={styles.editOriginalNote}>{editingEntry.text}</Text>

                {/* Foods Section - Matching Home Screen Style */}
                <View style={styles.editExtractedDataSection}>
                  <Text style={styles.editExtractedDataTitle}>🍎 Foods:</Text>
                  {(editedFoods || []).map((food, index) => {
                    const displayText = `• ${food.name || '[food name]'} (${food.mealType || '[meal type]'})${food.quantity ? ` - ${food.quantity}` : ''}`;
                    return (
                      <View key={`food-${index}`} style={styles.editDataItem}>
                        <Text style={styles.editDataItemText}>{displayText}</Text>
                        <TouchableOpacity 
                          style={styles.editItemButton}
                          onPress={() => openEditItemModal('food', index, food)}
                          accessibilityLabel={`Edit food ${index + 1}`}
                        >
                          <Text style={styles.editItemButtonText}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.removeItemButton}
                          onPress={() => setEditedFoods(prev => prev.filter((_, i) => i !== index))}
                          accessibilityLabel={`Remove food ${index + 1}`}
                        >
                          <Text style={styles.removeItemButtonText}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  <TouchableOpacity 
                    style={styles.addItemButton} 
                    onPress={() => setEditedFoods(prev => [...prev, { name: '', mealType: '', timing: '', quantity: '' }])} 
                    accessibilityLabel="Add food"
                  >
                    <Text style={styles.addItemButtonText}>+ Add Food</Text>
                  </TouchableOpacity>
                </View>

                {/* Reactions Section - Matching Home Screen Style */}
                <View style={styles.editExtractedDataSection}>
                  <Text style={styles.editExtractedDataTitle}>⚠️ Reactions:</Text>
                  {(editedReactions || []).map((reaction, index) => {
                    const delayText = reaction.reactionDelayMinutes ? ` - ${reaction.reactionDelayMinutes}min delay` : '';
                    const displayText = `• ${reaction.description || '[description]'} (${reaction.type || '[type]'})${delayText}`;
                    return (
                      <View key={`reaction-${index}`} style={styles.editDataItem}>
                        <Text style={styles.editDataItemText}>{displayText}</Text>
                        <TouchableOpacity 
                          style={styles.editItemButton}
                          onPress={() => openEditItemModal('reaction', index, reaction)}
                          accessibilityLabel={`Edit reaction ${index + 1}`}
                        >
                          <Text style={styles.editItemButtonText}>✎</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.removeItemButton}
                          onPress={() => setEditedReactions(prev => prev.filter((_, i) => i !== index))}
                          accessibilityLabel={`Remove reaction ${index + 1}`}
                        >
                          <Text style={styles.removeItemButtonText}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  <TouchableOpacity 
                    style={styles.addItemButton} 
                    onPress={() => setEditedReactions(prev => [...prev, { type: '', description: '', location: '', severity: '' }])} 
                    accessibilityLabel="Add reaction"
                  >
                    <Text style={styles.addItemButtonText}>+ Add Reaction</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.editModalActions}>
                  <TouchableOpacity
                    style={styles.editModalSaveButton}
                    onPress={async () => {
                      const foods = (editedFoods || []).filter(f => Object.values(f).some(v => (v || '').toString().trim() !== ''));
                      const reactions = (editedReactions || []).filter(r => Object.values(r).some(v => (v || '').toString().trim() !== ''));
                      const success = await StorageService.updateFoodLogEntry(editingEntry.id, { foods, reactions });
                      if (success) {
                        // Track note edit
                        if (posthog?.capture) {
                          posthog.capture('note_edited', {
                            screen: 'ManageNotesScreen',
                            foods_count: foods.length,
                            reactions_count: reactions.length
                          });
                        }

                        await loadSavedEntries();
                        showAlert('Saved', 'Changes have been saved.', [
                          {
                            text: 'OK',
                            onPress: () => {
                              setEditModalVisible(false);
                              setEditingEntry(null);
                            }
                          }
                        ]);
                      } else {
                        showAlert('Error', 'Failed to save changes.');
                      }
                    }}
                    accessibilityLabel="Save changes"
                  >
                    <Text style={styles.editModalSaveButtonText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.editModalDeleteButton}
                  onPress={() => {
                    showAlert(
                      'Delete Entry',
                      'This will permanently delete the entry. Continue?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            setIsDeleting(editingEntry.id);
                            const success = await StorageService.deleteFoodLogEntry(editingEntry.id);
                            setIsDeleting(null);
                            if (success) {
                              await loadSavedEntries();
                              setEditModalVisible(false);
                              setEditingEntry(null);
                              showAlert('Deleted', 'Entry deleted.');
                            } else {
                              showAlert('Error', 'Failed to delete entry.');
                            }
                          }
                        }
                      ]
                    );
                  }}
                  accessibilityLabel="Delete entry"
                >
                  <Text style={styles.editModalDeleteButtonText}>Delete Entry</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Individual Item Edit Modal */}
      <Modal
        visible={editItemModalVisible}
        transparent
        animationType="none"
        onRequestClose={() => setEditItemModalVisible(false)}
      >
        <View style={styles.itemEditModalBackdrop}>
          <View style={styles.itemEditModalCard}>
            <Text style={styles.itemEditModalTitle}>
              Edit {editingItemType === 'food' ? 'Food' : 'Reaction'}
            </Text>
            
            {editingItemType === 'food' && (
              <>
                <TextInput
                  style={styles.itemEditInput}
                  placeholder="Food name"
                  value={editingItemData?.name || ''}
                  onChangeText={(text) => setEditingItemData(prev => ({ ...prev, name: text }))}
                />
                <TextInput
                  style={styles.itemEditInput}
                  placeholder="Meal type (e.g., breakfast, lunch, snack)"
                  value={editingItemData?.mealType || ''}
                  onChangeText={(text) => setEditingItemData(prev => ({ ...prev, mealType: text }))}
                />
                <TextInput
                  style={styles.itemEditInput}
                  placeholder="Quantity (e.g., 1 cup, a big glass)"
                  value={editingItemData?.quantity || ''}
                  onChangeText={(text) => setEditingItemData(prev => ({ ...prev, quantity: text }))}
                />
              </>
            )}
            
            {editingItemType === 'reaction' && (
              <>
                <TextInput
                  style={styles.itemEditInput}
                  placeholder="Reaction type (e.g., behavioral, digestive, skin)"
                  value={editingItemData?.type || ''}
                  onChangeText={(text) => setEditingItemData(prev => ({ ...prev, type: text }))}
                />
                <TextInput
                  style={styles.itemEditInput}
                  placeholder="Description"
                  value={editingItemData?.description || ''}
                  onChangeText={(text) => setEditingItemData(prev => ({ ...prev, description: text }))}
                />
                <TextInput
                  style={styles.itemEditInput}
                  placeholder="Location (optional)"
                  value={editingItemData?.location || ''}
                  onChangeText={(text) => setEditingItemData(prev => ({ ...prev, location: text }))}
                />
                <TextInput
                  style={styles.itemEditInput}
                  placeholder="Severity (optional)"
                  value={editingItemData?.severity || ''}
                  onChangeText={(text) => setEditingItemData(prev => ({ ...prev, severity: text }))}
                />
                <TextInput
                  style={styles.itemEditInput}
                  placeholder="Delay in minutes (optional)"
                  value={editingItemData?.reactionDelayMinutes ? editingItemData.reactionDelayMinutes.toString() : ''}
                  onChangeText={(text) => setEditingItemData(prev => ({ ...prev, reactionDelayMinutes: text ? parseInt(text) : null }))}
                  keyboardType="numeric"
                />
              </>
            )}
            
            <View style={styles.itemEditModalActions}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => saveEditedItem(editingItemData)}
              >
                <Text style={styles.primaryButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setEditItemModalVisible(false)}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 11,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 4,
    fontStyle: 'italic',
  },
  content: {
    flex: 1,
  },
  addButton: {
    backgroundColor: '#28a745',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  addButtonIcon: {
    fontSize: 24,
    color: '#fff',
    marginRight: 10,
    fontWeight: 'bold',
  },
  addButtonText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  // removed data-management card
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 15,
  },
  // removed data-management controls styles
  notesSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 100,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6c757d',
    marginTop: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  entriesContainer: {
    flex: 1,
    marginTop: 15,
  },
  entryCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 8,
    backgroundColor: '#e0e3e7',
    marginBottom: 10,
  },
  skeletonLineShort: {
    width: '40%',
  },
  skeletonLineMedium: {
    width: '70%',
  },
  skeletonLineFull: {
    width: '100%',
  },
  skeletonBlock: {
    height: 60,
    borderRadius: 8,
    backgroundColor: '#e0e3e7',
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryInfo: {
    flex: 1,
  },
  entryDate: {
    fontSize: 12,
    color: '#6c757d',
    fontWeight: '500',
  },
  entrySource: {
    fontSize: 12,
    color: '#007bff',
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dc3545',
  },
  deleteButtonText: {
    fontSize: 16,
  },
  entryText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
    marginBottom: 5,
  },
  entryConfidence: {
    fontSize: 11,
    color: '#28a745',
    fontWeight: '500',
  },
  editedIndicator: {
    fontSize: 11,
    color: '#ffc107',
    fontWeight: '500',
    marginTop: 2,
  },
  extractionIndicator: {
    fontSize: 11,
    color: '#6f42c1',
    fontWeight: '500',
    marginTop: 2,
  },
  extractedDataSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  extractedDataTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 4,
  },
  extractedDataItem: {
    fontSize: 11,
    color: '#6c757d',
    marginLeft: 8,
    marginBottom: 2,
    lineHeight: 16,
  },
  // removed diagnostics/notification styles
  // removed processing diagnostics styles

  fabContainer: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    right: 20,
    bottom: 80,
    alignItems: 'flex-end',
    zIndex: 999,
  },
  primaryFab: {
    backgroundColor: '#28a745',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    marginBottom: 12,
  },
  secondaryFab: {
    backgroundColor: '#e9ecef',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  fabIcon: {
    fontSize: 22,
  },
  settingsIcon: {
    fontSize: 18,
    color: '#6c757d',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#2c3e50'
  },
  modalLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 6,
  },
  originalNote: {
    backgroundColor: '#f1f3f5',
    padding: 10,
    borderRadius: 8,
    color: '#495057',
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: 8,
    marginBottom: 8,
  },
  editRow: {
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  addInlineButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#e9ecef',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  addInlineButtonText: {
    color: '#2c3e50',
    fontWeight: '600',
  },
  removeLink: {
    color: '#dc3545',
    fontSize: 12,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButton: {
    backgroundColor: '#e9ecef',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: '#2c3e50',
    fontWeight: '700',
    textAlign: 'center',
  },
  deleteLink: {
    color: '#dc3545',
    textAlign: 'center',
    marginTop: 12,
    textDecorationLine: 'underline',
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  processingText: {
    fontSize: 12,
    color: '#007bff',
    fontWeight: '500',
    marginLeft: 8,
  },
  editExtractedDataSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
  },
  editExtractedDataTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  editDataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  editDataItemText: {
    flex: 1,
    fontSize: 11,
    color: '#6c757d',
    marginLeft: 8,
    lineHeight: 16,
  },
  editItemButton: {
    padding: 4,
    marginLeft: 8,
  },
  editItemButtonText: {
    fontSize: 14,
    color: '#007bff',
  },
  removeItemButton: {
    padding: 4,
    marginLeft: 4,
  },
  removeItemButtonText: {
    fontSize: 16,
    color: '#dc3545',
    fontWeight: 'bold',
  },
  addItemButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#e9ecef',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 4,
    marginBottom: 15,
  },
  addItemButtonText: {
    color: '#2c3e50',
    fontWeight: '600',
    fontSize: 12,
  },
  itemEditModalCard: {
    backgroundColor: '#fff',
    padding: 20,
    marginHorizontal: 10,
    borderRadius: 16,
    maxHeight: '80%',
    width: '90%',
  },
  itemEditModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#2c3e50',
    textAlign: 'center',
  },
  itemEditInput: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 16,
  },
  itemEditModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  editModalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 30,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  editModalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dc3545',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalCloseButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  editModalPlaceholder: {
    width: 40,
  },
  editModalContent: {
    flex: 1,
    padding: 20,
  },
  editModalLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 6,
  },
  editOriginalNote: {
    backgroundColor: '#f1f3f5',
    padding: 10,
    borderRadius: 8,
    color: '#495057',
    marginBottom: 20,
  },
  editModalActions: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingBottom: 20,
  },
  editModalSaveButton: {
    backgroundColor: '#28a745',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  editModalSaveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  editModalDeleteButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 15,
    alignItems: 'center',
    alignSelf: 'center',
  },
  editModalDeleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  itemEditModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editItemButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  editItemButtonText: {
    fontSize: 14,
    color: '#6c757d',
  },
  removeItemButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8d7da',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  removeItemButtonText: {
    fontSize: 14,
    color: '#dc3545',
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  editButtonText: {
    fontSize: 14,
    color: '#6c757d',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 20,
    marginTop: 20,
  },
  footerText: {
    fontSize: 11,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 4,
  },
  footerLink: {
    fontSize: 11,
    color: '#6c757d',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
