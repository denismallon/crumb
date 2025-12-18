import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Platform
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import Markdown from 'react-native-markdown-display';
import * as Clipboard from 'expo-clipboard';
import { usePostHog } from 'posthog-react-native';
import { useAuth } from './AuthContext';
import AISummaryService from './AISummaryService';

const logWithTime = (message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}]`, message, ...args);
};

export default function AISummaryScreen({ onClose }) {
  const { user } = useAuth();
  const posthog = usePostHog();
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Track screen view on mount
  useEffect(() => {
    if (posthog?.screen) {
      posthog.screen('AISummaryScreen');
    }
  }, [posthog]);

  // Load summary on mount
  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await AISummaryService.getSummary(user.id);

      if (result.success) {
        setSummary(result.data);

        // Track event
        if (posthog?.capture) {
          posthog.capture('ai_summary_viewed', {
            screen: 'AISummaryScreen',
            from_cache: result.fromCache,
            entry_count: result.data.entry_count
          });
        }
      } else {
        setError(result.error);

        // Track error
        if (posthog?.capture) {
          posthog.capture('error_occurred', {
            screen: 'AISummaryScreen',
            error_type: 'summary_load_failed',
            message: result.error
          });
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setError(null);

      // Track refresh event
      if (posthog?.capture) {
        posthog.capture('ai_summary_refreshed', {
          screen: 'AISummaryScreen'
        });
      }

      const result = await AISummaryService.generateSummary(user.id);

      if (result.success) {
        setSummary(result.data);
      } else {
        setError(result.error);

        // Track error
        if (posthog?.capture) {
          posthog.capture('error_occurred', {
            screen: 'AISummaryScreen',
            error_type: 'summary_refresh_failed',
            message: result.error
          });
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopy = async () => {
    try {
      if (!summary?.summary) return;

      await Clipboard.setStringAsync(summary.summary);
      setCopyFeedback(true);

      // Track copy event
      if (posthog?.capture) {
        posthog.capture('ai_summary_copied', {
          screen: 'AISummaryScreen',
          character_count: summary.summary.length
        });
      }

      // Reset feedback after 2 seconds
      setTimeout(() => {
        setCopyFeedback(false);
      }, 2000);

      logWithTime('✅ Summary copied to clipboard');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleClose = () => {
    // Track close event
    if (posthog?.capture) {
      posthog.capture('ai_summary_closed', {
        screen: 'AISummaryScreen',
        had_summary: !!summary
      });
    }

    onClose();
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <View style={styles.container}>
      <ExpoStatusBar style="auto" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.headerContent}>
            <Text style={styles.title}>Your summary</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={[styles.copyHeaderButton, copyFeedback && styles.copyHeaderButtonSuccess]}
                onPress={handleCopy}
                disabled={!summary || isLoading}
                activeOpacity={0.6}
              >
                <Text style={styles.copyHeaderButtonText}>
                  {copyFeedback ? '✓' : '📋'}
                </Text>
              </TouchableOpacity>

              {isRefreshing ? (
                <View style={styles.refreshButton}>
                  <ActivityIndicator size="small" color="#666666" />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.refreshButton}
                  onPress={handleRefresh}
                  disabled={isLoading}
                  activeOpacity={0.6}
                >
                  <Text style={styles.refreshButtonText}>↻</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {isLoading ? (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="large" color="#007bff" />
              <Text style={styles.loadingText}>Generating your first summary...</Text>
              <Text style={styles.loadingSubtext}>This may take a minute</Text>
            </View>
          ) : error ? (
            <View style={styles.errorSection}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorTitle}>Unable to Generate Summary</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : summary ? (
            <>
              <View style={styles.introSection}>
                <Text style={styles.introText}>
                  We've detected these patterns from the notes you've shared so far. Keep adding more notes and refresh the summary for even more intelligence insights that you can share with your medical professional.{'\n\n'}
                  Remember that Crumb is not a substitute for medical advice - always discuss with your practitioner before starting any new treatment.
                </Text>
                <Text style={styles.timestamp}>
                  Last refreshed {formatDate(summary.generated_at)}
                </Text>
              </View>

              <View style={styles.summarySection}>
                <Markdown style={markdownStyles}>
                  {summary.summary}
                </Markdown>
              </View>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  safeArea: {
    flex: 1,
  },
  headerContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#666666',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  closeButtonText: {
    color: '#666666',
    fontSize: 18,
    fontWeight: 'normal',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  copyHeaderButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#666666',
    borderRadius: 8,
    backgroundColor: 'transparent',
    opacity: 1,
  },
  copyHeaderButtonSuccess: {
    opacity: 0.6,
  },
  copyHeaderButtonText: {
    fontSize: 20,
    color: '#666666',
  },
  refreshButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#666666',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  refreshButtonText: {
    color: '#666666',
    fontSize: 20,
    fontWeight: 'normal',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  loadingSection: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007bff',
    marginTop: 20,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 8,
  },
  errorSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#dc3545',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#007bff',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  introSection: {
    backgroundColor: '#e7f3ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#007bff',
  },
  introText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 22,
    marginBottom: 12,
  },
  timestamp: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  summarySection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
  },
});

const markdownStyles = {
  body: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
  },
  heading1: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 20,
    marginBottom: 12,
  },
  heading2: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginTop: 16,
    marginBottom: 10,
  },
  heading3: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginTop: 12,
    marginBottom: 8,
  },
  paragraph: {
    marginBottom: 12,
    lineHeight: 24,
  },
  strong: {
    fontWeight: '600',
  },
  em: {
    fontStyle: 'italic',
  },
  bullet_list: {
    marginBottom: 12,
  },
  ordered_list: {
    marginBottom: 12,
  },
  list_item: {
    marginBottom: 6,
  },
  code_inline: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
  },
  code_block: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
  },
  blockquote: {
    backgroundColor: '#f8f9fa',
    borderLeftWidth: 4,
    borderLeftColor: '#dee2e6',
    paddingLeft: 16,
    paddingVertical: 8,
    marginBottom: 12,
  },
};
