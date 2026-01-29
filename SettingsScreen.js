import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ScrollView,
  Platform,
  Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { usePostHog } from 'posthog-react-native';
import StorageService from './StorageService';
import LadderService from './LadderService';
import LadderOnboardingScreen from './LadderOnboardingScreen';
import FileExportHelper from './FileExportHelper';

const logWithTime = (message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}]`, message, ...args);
};

export default function SettingsScreen({ onClose }) {
  const { user, signOut } = useAuth();
  const posthog = usePostHog();
  const [isWorking, setIsWorking] = useState(false);
  const [ladderProgress, setLadderProgress] = useState(null);
  const [showLadderOnboarding, setShowLadderOnboarding] = useState(false);

  // Track screen view on mount
  useEffect(() => {
    if (posthog?.screen) {
      posthog.screen('SettingsScreen');
    }
    loadLadderProgress();
  }, [posthog]);

  // Load ladder progress
  const loadLadderProgress = async () => {
    const progress = await LadderService.getFormattedProgress();
    setLadderProgress(progress);
  };

  const exportData = async () => {
    try {
      setIsWorking(true);

      // Generate CSV from food logs
      const csvContent = await StorageService.exportAsCSV();

      if (!csvContent) {
        if (Platform.OS === 'web') {
          window.alert('No data to export.');
        } else {
          Alert.alert('Export Error', 'No data to export.');
        }
        return;
      }

      // Generate filename with current date
      const filename = FileExportHelper.generateFilename();

      // Export file (downloads on web, shares on mobile)
      const success = await FileExportHelper.exportCSV(csvContent, filename);

      if (success) {
        const message = Platform.OS === 'web'
          ? 'CSV file has been downloaded.'
          : 'CSV file is ready to share.';

        if (Platform.OS === 'web') {
          window.alert(message);
        } else {
          Alert.alert('Export Complete', message);
        }

        // Track export event
        if (posthog?.capture) {
          posthog.capture('data_exported', {
            format: 'csv',
            platform: Platform.OS
          });
        }
      } else {
        if (Platform.OS === 'web') {
          window.alert('Failed to export data.');
        } else {
          Alert.alert('Export Error', 'Failed to export data.');
        }
      }
    } catch (e) {
      console.error('Export error:', e);
      if (Platform.OS === 'web') {
        window.alert('An error occurred while exporting data.');
      } else {
        Alert.alert('Export Error', 'An error occurred while exporting data.');
      }
    } finally {
      setIsWorking(false);
    }
  };

  const handleClearData = async () => {
    logWithTime('Clear data operation starting, platform:', Platform.OS);
    try {
      setIsWorking(true);

      if (Platform.OS === 'web') {
        // Web-specific: clear localStorage directly
        logWithTime('Using web localStorage clear');

        // Get keys before clearing for debugging
        const keysBefore = Object.keys(localStorage);
        logWithTime('localStorage keys before clear:', keysBefore);

        localStorage.clear();

        // Verify clear
        const keysAfter = Object.keys(localStorage);
        logWithTime('localStorage keys after clear:', keysAfter);
        logWithTime('✅ localStorage cleared');
      } else {
        // Native: use AsyncStorage
        logWithTime('Using native AsyncStorage clear');
        const keys = await AsyncStorage.getAllKeys();
        logWithTime('AsyncStorage keys found:', keys);
        await AsyncStorage.multiRemove(keys);
        logWithTime('✅ AsyncStorage cleared');
      }

      setIsWorking(false);

      // Platform-specific success message
      if (Platform.OS === 'web') {
        window.alert('All data cleared successfully.');
      } else {
        Alert.alert('Done', 'All data cleared successfully.');
      }
    } catch (error) {
      logWithTime('❌ Clear data error:', error);
      console.error('Clear data error:', error);
      setIsWorking(false);

      // Platform-specific error message
      if (Platform.OS === 'web') {
        window.alert(`Failed to clear data: ${error.message}`);
      } else {
        Alert.alert('Error', `Failed to clear data: ${error.message}`);
      }
    }
  };

  const clearAllData = async () => {
    logWithTime('Clear data button clicked');

    // Platform-specific confirmation dialog
    if (Platform.OS === 'web') {
      // Use window.confirm on web
      const confirmed = window.confirm('Clear All Data\n\nThis will delete all saved entries. Continue?');
      logWithTime('Web confirmation result:', confirmed);

      if (confirmed) {
        await handleClearData();
      }
    } else {
      // Use Alert.alert on native
      Alert.alert(
        'Clear All Data',
        'This will delete all saved entries. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear',
            style: 'destructive',
            onPress: handleClearData
          }
        ]
      );
    }
  };

  const handleLogout = async () => {
    // Web doesn't support Alert.alert, use window.confirm
    const confirmed = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to log out?')
      : await new Promise((resolve) => {
          Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Log Out', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        });

    if (!confirmed) return;

    try {
      setIsWorking(true);
      logWithTime('Logging out...');
      await signOut();
      logWithTime('✅ Logged out successfully');
    } catch (error) {
      logWithTime('❌ Logout error:', error);
      if (Platform.OS === 'web') {
        window.alert('Failed to log out. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to log out. Please try again.');
      }
    } finally {
      setIsWorking(false);
    }
  };

  const handleChangeLadder = () => {
    setShowLadderOnboarding(true);
  };

  const handleResetLadder = async () => {
    // Web doesn't support Alert.alert, use window.confirm
    const confirmed = Platform.OS === 'web'
      ? window.confirm('This will clear your current ladder progress. Continue?')
      : await new Promise((resolve) => {
          Alert.alert(
            'Reset Ladder',
            'This will clear your current ladder progress. Continue?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Reset', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        });

    if (!confirmed) return;

    await LadderService.resetLadder();
    await loadLadderProgress();

    if (Platform.OS === 'web') {
      window.alert('Ladder progress has been reset.');
    } else {
      Alert.alert('Done', 'Ladder progress has been reset.');
    }
  };

  const handleLadderOnboardingComplete = async () => {
    setShowLadderOnboarding(false);
    await loadLadderProgress();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ladder Progress</Text>
          {ladderProgress?.ladderName ? (
            <>
              <Text style={styles.infoText}>Current ladder: {ladderProgress.ladderName}</Text>
              <Text style={styles.infoText}>Current step: {ladderProgress.stepInfo}</Text>
              {ladderProgress.daysOnStep !== null && (
                <Text style={styles.infoText}>
                  Days on this step: {ladderProgress.daysOnStep}
                </Text>
              )}
              <TouchableOpacity style={styles.primaryButton} onPress={handleChangeLadder} accessibilityLabel="Change ladder step">
                <Text style={styles.primaryButtonText}>Change Ladder Step</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleResetLadder} accessibilityLabel="Reset ladder">
                <Text style={styles.secondaryButtonText}>Reset Ladder</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.infoText}>No ladder selected</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={handleChangeLadder} accessibilityLabel="Set up ladder">
                <Text style={styles.primaryButtonText}>Set Up Ladder</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.infoText}>Logged in as: {user?.email}</Text>
          <TouchableOpacity style={styles.dangerButton} onPress={handleLogout} disabled={isWorking} accessibilityLabel="Log out">
            <Text style={styles.dangerButtonText}>Log Out</Text>
          </TouchableOpacity>
        </View>

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

      </ScrollView>

      {/* Ladder Onboarding Modal */}
      <Modal
        visible={showLadderOnboarding}
        animationType="none"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowLadderOnboarding(false)}
      >
        <LadderOnboardingScreen onComplete={handleLadderOnboardingComplete} />
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
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dc3545',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 20,
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