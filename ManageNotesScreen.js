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
  const [processingNotes, setProcessingNotes] = useState([]);
  const [editItemModalVisible, setEditItemModalVisible] = useState(false);
  const [editingItemType, setEditingItemType] = useState(null); // 'food' or 'reaction'
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [editingItemData, setEditingItemData] = useState(null);

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
      
      // Get processing notes
      const processing = entries.filter(entry => entry.processingStatus === 'processing');
      setProcessingNotes(processing);
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
              {savedEntries.map((entry) => {
                const isProcessing = entry.processingStatus === 'processing';
                return (
                  <View key={entry.id} style={styles.entryCard}>
                    {isProcessing && (
                      <View style={styles.processingIndicator}>
                        <ActivityIndicator size="small" color="#007bff" />
                        <Text style={styles.processingText}>Processing...</Text>
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
                    <Text style={styles.editModalSaveButtonText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.editModalDeleteButton}
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
    bottom: 80,
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
});
