import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView
} from 'react-native';
import StorageService from './StorageService';

export default function SettingsScreen({ onClose }) {
  const [isWorking, setIsWorking] = useState(false);

  const exportData = async () => {
    try {
      setIsWorking(true);
      const data = await StorageService.exportAllData();
      if (data) {
        console.log('Exported data:', data);
        Alert.alert('Export Complete', 'Data exported to console.');
      } else {
        Alert.alert('Export Error', 'Failed to export data.');
      }
    } catch (e) {
      Alert.alert('Export Error', 'An error occurred.');
    } finally {
      setIsWorking(false);
    }
  };

  const clearAllData = async () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all saved entries. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsWorking(true);
            const success = await StorageService.clearAllData();
            setIsWorking(false);
            if (success) {
              Alert.alert('Done', 'All data cleared.');
            } else {
              Alert.alert('Error', 'Failed to clear data.');
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={exportData} disabled={isWorking} accessibilityLabel="Export data">
            <Text style={styles.primaryButtonText}>Export Data</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dangerButton} onPress={clearAllData} disabled={isWorking} accessibilityLabel="Clear all data">
            <Text style={styles.dangerButtonText}>Clear All Data</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>
          <Text style={styles.infoText}>Version: 1.0.0</Text>
          <Text style={styles.infoText}>About: Crumb helps track foods and reactions.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coming Soon</Text>
          <Text style={styles.infoText}>Notifications, child profiles, and more.</Text>
        </View>

        <TouchableOpacity style={styles.secondaryButton} onPress={onClose} accessibilityLabel="Close settings">
          <Text style={styles.secondaryButtonText}>Close</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  dangerButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dangerButtonText: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  secondaryButton: {
    backgroundColor: '#e9ecef',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#2c3e50',
    fontWeight: '700',
    textAlign: 'center',
  },
});



