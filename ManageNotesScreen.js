import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  TextInput
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import StorageService from './StorageService';

export default function ManageNotesScreen({ onAddNote, onOpenSettings }) {
  const [savedEntries, setSavedEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editedFoods, setEditedFoods] = useState([]);
  const [editedReactions, setEditedReactions] = useState([]);

  useEffect(() => {
    loadSavedEntries();
    const pollInterval = setInterval(() => {
      refreshEntries();
    }, 4000);
    return () => clearInterval(pollInterval);
  }, []);

  const refreshEntries = async () => {
    try {
      const currentEntries = await StorageService.getFoodLogs();
      setSavedEntries(currentEntries);
    } catch (error) {
      console.error('Error refreshing entries:', error);
    }
  };

  const loadSavedEntries = async () => {
    try {
      setIsLoading(true);
      const entries = await StorageService.getFoodLogs();
      setSavedEntries(entries);
    } catch (error) {
      Alert.alert('Error', 'Failed to load saved entries.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteNote = (entryId) => {
    Alert.alert(
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
        // Remove from local state
        setSavedEntries(prev => prev.filter(entry => entry.id !== entryId));
        Alert.alert('Success', 'Note deleted successfully.');
      } else {
        Alert.alert('Error', 'Failed to delete note.');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while deleting the note.');
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

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="auto" />
      
      <View style={styles.header}>
        <Text style={styles.title}>🍞 Crumb: Food Allergy Tracker</Text>
        <Text style={styles.subtitle}>Manage Your Notes</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Simplified homepage: no notifications, no inline data management, FABs below */}

        {/* Notes List */}
        <View style={styles.notesSection}>
          <Text style={styles.sectionTitle}>Your Notes ({savedEntries.length}):</Text>
          
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
            <ScrollView style={styles.entriesContainer} nestedScrollEnabled>
              {savedEntries.map((entry) => (
                <View key={entry.id} style={styles.entryCard}>
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
                      disabled={isDeleting === entry.id}
                      accessibilityLabel="Edit entry"
                    >
                      <Text style={styles.editButtonText}>✏️</Text>
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
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>
      {/* Floating Action Buttons */}
      <View style={styles.fabContainer} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.secondaryFab}
          onPress={onOpenSettings}
          accessibilityLabel="Open settings"
        >
          <Text style={styles.fabIcon}>⚙️</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryFab}
          onPress={onAddNote}
          accessibilityLabel="Add new note"
        >
          <Text style={styles.fabIcon}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Food Log Entry</Text>
            {editingEntry && (
              <>
                <Text style={styles.modalLabel}>Original Note</Text>
                <Text style={styles.originalNote}>{editingEntry.text}</Text>

                <Text style={styles.sectionHeader}>Foods</Text>
                <View>
                  {(editedFoods || []).map((food, index) => (
                    <View key={`food-${index}`} style={styles.editRow}>
                      <TextInput
                        style={styles.input}
                        placeholder="Name"
                        value={food.name}
                        onChangeText={(t) => setEditedFoods(prev => prev.map((f, i) => i === index ? { ...f, name: t } : f))}
                        accessibilityLabel={`Food ${index + 1} name`}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Meal Type"
                        value={food.mealType}
                        onChangeText={(t) => setEditedFoods(prev => prev.map((f, i) => i === index ? { ...f, mealType: t } : f))}
                        accessibilityLabel={`Food ${index + 1} meal type`}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Timing"
                        value={food.timing}
                        onChangeText={(t) => setEditedFoods(prev => prev.map((f, i) => i === index ? { ...f, timing: t } : f))}
                        accessibilityLabel={`Food ${index + 1} timing`}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Quantity"
                        value={food.quantity}
                        onChangeText={(t) => setEditedFoods(prev => prev.map((f, i) => i === index ? { ...f, quantity: t } : f))}
                        accessibilityLabel={`Food ${index + 1} quantity`}
                      />
                      <TouchableOpacity onPress={() => setEditedFoods(prev => prev.filter((_, i) => i !== index))} accessibilityLabel={`Remove food ${index + 1}`}>
                        <Text style={styles.removeLink}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addInlineButton} onPress={() => setEditedFoods(prev => [...prev, { name: '', mealType: '', timing: '', quantity: '' }])} accessibilityLabel="Add food">
                    <Text style={styles.addInlineButtonText}>Add Food</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.sectionHeader}>Reactions</Text>
                <View>
                  {(editedReactions || []).map((reaction, index) => (
                    <View key={`reaction-${index}`} style={styles.editRow}>
                      <TextInput
                        style={styles.input}
                        placeholder="Type"
                        value={reaction.type}
                        onChangeText={(t) => setEditedReactions(prev => prev.map((r, i) => i === index ? { ...r, type: t } : r))}
                        accessibilityLabel={`Reaction ${index + 1} type`}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Description"
                        value={reaction.description}
                        onChangeText={(t) => setEditedReactions(prev => prev.map((r, i) => i === index ? { ...r, description: t } : r))}
                        accessibilityLabel={`Reaction ${index + 1} description`}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Location"
                        value={reaction.location}
                        onChangeText={(t) => setEditedReactions(prev => prev.map((r, i) => i === index ? { ...r, location: t } : r))}
                        accessibilityLabel={`Reaction ${index + 1} location`}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Severity"
                        value={reaction.severity}
                        onChangeText={(t) => setEditedReactions(prev => prev.map((r, i) => i === index ? { ...r, severity: t } : r))}
                        accessibilityLabel={`Reaction ${index + 1} severity`}
                      />
                      <TouchableOpacity onPress={() => setEditedReactions(prev => prev.filter((_, i) => i !== index))} accessibilityLabel={`Remove reaction ${index + 1}`}>
                        <Text style={styles.removeLink}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity style={styles.addInlineButton} onPress={() => setEditedReactions(prev => [...prev, { type: '', description: '', location: '', severity: '' }])} accessibilityLabel="Add reaction">
                    <Text style={styles.addInlineButtonText}>Add Reaction</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={async () => {
                      const foods = (editedFoods || []).filter(f => Object.values(f).some(v => (v || '').toString().trim() !== ''));
                      const reactions = (editedReactions || []).filter(r => Object.values(r).some(v => (v || '').toString().trim() !== ''));
                      const success = await StorageService.updateFoodLogEntry(editingEntry.id, { foods, reactions });
                      if (success) {
                        await loadSavedEntries();
                        setEditModalVisible(false);
                        setEditingEntry(null);
                        Alert.alert('Saved', 'Changes have been saved.');
                      } else {
                        Alert.alert('Error', 'Failed to save changes.');
                      }
                    }}
                    accessibilityLabel="Save changes"
                  >
                    <Text style={styles.primaryButtonText}>Save Changes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.secondaryButton} onPress={() => setEditModalVisible(false)} accessibilityLabel="Cancel editing">
                    <Text style={styles.secondaryButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
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
                              Alert.alert('Deleted', 'Entry deleted.');
                            } else {
                              Alert.alert('Error', 'Failed to delete entry.');
                            }
                          }
                        }
                      ]
                    );
                  }}
                  accessibilityLabel="Delete entry"
                >
                  <Text style={styles.deleteLink}>Delete Entry</Text>
                </TouchableOpacity>
              </>
            )}
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
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginTop: 5,
  },
  content: {
    flex: 1,
    padding: 20,
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
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
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
    maxHeight: 400,
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
    position: 'absolute',
    right: 20,
    bottom: 20,
    alignItems: 'flex-end',
  },
  primaryFab: {
    backgroundColor: '#28a745',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    marginTop: 12,
  },
  secondaryFab: {
    backgroundColor: '#e9ecef',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  fabIcon: {
    fontSize: 22,
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
});
