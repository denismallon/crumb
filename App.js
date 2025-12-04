import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { PostHogProvider } from 'posthog-react-native';
import { AuthProvider, useAuth } from './AuthContext';
import LoginScreen from './LoginScreen';
import SettingsScreen from './SettingsScreen';
import ManageNotesScreen from './ManageNotesScreen';
import AddNotesScreen from './AddNotesScreen';
import BackgroundProcessingService from './BackgroundProcessingService';

const logWithTime = (message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}]`, message, ...args);
};

const BOOT_LOG_ID = 'BOOT-2025-11-20-001';

function AppContent() {
  const { session, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState('manage'); // 'manage' | 'add' | 'settings'

  useEffect(() => {
    logWithTime(`App boot sequence started (${BOOT_LOG_ID})`);
    // Initialize background processing service
    // This will start processing any notes that were left in processing state
    if (session) {
      BackgroundProcessingService.processQueue();
    }
  }, [session]);

  const handleAddNote = () => {
    setCurrentScreen('add');
  };

  const handleCloseAddNote = () => {
    setCurrentScreen('manage');
  };

  const openSettings = () => {
    setCurrentScreen('settings');
  };

  // Show loading screen while checking auth state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF986F" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Show login screen if not authenticated
  if (!session) {
    return <LoginScreen />;
  }

  // Show appropriate screen based on navigation state
  if (currentScreen === 'add') {
    return <AddNotesScreen onClose={handleCloseAddNote} />;
  }

  if (currentScreen === 'settings') {
    return <SettingsScreen onClose={() => setCurrentScreen('manage')} />;
  }

  return <ManageNotesScreen onAddNote={handleAddNote} onOpenSettings={openSettings} />;
}

export default function App() {
  return (
    <PostHogProvider
      apiKey="phc_kPyeAFr7w2UR4RZP1UVV2NzXSxumGTvzYbMr65BEyoO"
      options={{
        host: 'https://eu.i.posthog.com',
        enableSessionReplay: true,
      }}
      autocapture
    >
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </PostHogProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
  },
});