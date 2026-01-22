// MUST be first - suppress warnings before any other imports
import { Platform, LogBox } from 'react-native';

if (Platform.OS === 'web') {
  LogBox.ignoreAllLogs(true);
  if (typeof console !== 'undefined') {
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = function(...args) {
      const msg = String(args[0] || '');
      if (msg.includes('deprecated') || msg.includes('Text strings') || msg.includes('SafeAreaView')) {
        return;
      }
      originalWarn.apply(console, args);
    };
    console.error = function(...args) {
      const msg = String(args[0] || '');
      if (msg.includes('Text strings') || msg.includes('rendered within')) {
        return;
      }
      originalError.apply(console, args);
    };
  }
}

import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity, Modal } from 'react-native';
import { PostHogProvider, usePostHog } from 'posthog-react-native';
import { AuthProvider, useAuth } from './AuthContext';
import LoginScreen from './LoginScreen';
import SettingsScreen from './SettingsScreen';
import ManageNotesScreen from './ManageNotesScreen';
import AddNotesScreen from './AddNotesScreen';
import LadderOnboardingScreen from './LadderOnboardingScreen';
import BackgroundProcessingService from './BackgroundProcessingService';
import LadderService from './LadderService';
import Constants from 'expo-constants';

const logWithTime = (message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}]`, message, ...args);
};

const BOOT_LOG_ID = 'BOOT-2025-11-20-001';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.log('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Something went wrong</Text>
          <Text style={errorStyles.text}>{String(this.state.error?.message || 'Unknown error')}</Text>
          <TouchableOpacity
            style={errorStyles.button}
            onPress={() => {
              this.setState({ hasError: false, error: null });
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            }}
          >
            <Text style={errorStyles.buttonText}>Reload App</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

// Error styles defined inline to avoid hoisting issues
const errorStyles = {
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#dc3545',
    marginBottom: 16,
  },
  text: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#FF986F',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
};

// Debug trace for PostHog configuration
const posthogKey = Constants.expoConfig?.extra?.posthogKey || process.env.EXPO_PUBLIC_POSTHOG_KEY || 'phc_kPyeAFr7w2UR4RZP1UVV2NzXSxumGTvzYbMr65BEyoO';
const posthogHost = Constants.expoConfig?.extra?.posthogHost || process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

if (typeof console !== 'undefined') {
  console.log('🔍 [POSTHOG CONFIG DEBUG]');
  console.log('  - Key from Constants.expoConfig.extra:', Constants.expoConfig?.extra?.posthogKey ? `${Constants.expoConfig.extra.posthogKey.substring(0, 15)}...` : 'undefined');
  console.log('  - Key from process.env:', process.env.EXPO_PUBLIC_POSTHOG_KEY ? `${process.env.EXPO_PUBLIC_POSTHOG_KEY.substring(0, 15)}...` : 'undefined');
  console.log('  - Final posthogKey:', posthogKey ? `${posthogKey.substring(0, 15)}...` : 'undefined');
  console.log('  - Host from Constants.expoConfig.extra:', Constants.expoConfig?.extra?.posthogHost || 'undefined');
  console.log('  - Host from process.env:', process.env.EXPO_PUBLIC_POSTHOG_HOST || 'undefined');
  console.log('  - Final posthogHost:', posthogHost || 'undefined');
  console.log('  - Platform:', Platform.OS);
  console.log('  - Session Replay enabled:', Platform.OS !== 'web');
}

function AppContent() {
  const { session, loading } = useAuth();
  const posthog = usePostHog();
  const [currentScreen, setCurrentScreen] = useState('manage'); // 'manage' | 'add' | 'settings'
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  // Track app opened on mount
  useEffect(() => {
    logWithTime(`App boot sequence started (${BOOT_LOG_ID})`);

    // Track app opened event
    if (posthog?.capture) {
      posthog.capture('app_opened', {
        screen: 'App',
        timestamp: new Date().toISOString()
      });
    }
  }, [posthog]);

  // Check if onboarding is needed
  useEffect(() => {
    const checkOnboarding = async () => {
      if (session) {
        const completed = await LadderService.hasCompletedOnboarding();
        logWithTime('Onboarding check:', { completed });
        setShowOnboarding(!completed);
        setCheckingOnboarding(false);
      }
    };

    checkOnboarding();
  }, [session]);

  useEffect(() => {
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

  const handleOnboardingComplete = () => {
    logWithTime('Onboarding completed');
    setShowOnboarding(false);
  };

  // Show loading screen while checking auth state
  if (loading || checkingOnboarding) {
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

  // Show onboarding if needed
  if (showOnboarding) {
    return <LadderOnboardingScreen onComplete={handleOnboardingComplete} />;
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
    <ErrorBoundary>
      <PostHogProvider
        apiKey={posthogKey}
        options={{
          host: posthogHost,
          enableSessionReplay: Platform.OS !== 'web',
        }}
        autocapture={false}
      >
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </PostHogProvider>
    </ErrorBoundary>
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