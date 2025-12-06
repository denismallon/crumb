import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { supabase } from './supabase';
import { posthog } from 'posthog-react-native';

const logWithTime = (message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}]`, message, ...args);
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSendCode = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setMessage('');

      logWithTime('📧 Sending OTP to:', email);

      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
        },
      });

      if (signInError) {
        logWithTime('❌ OTP send error:', signInError);
        throw signInError;
      }

      logWithTime('✅ OTP sent successfully');
      setOtpSent(true);
      setMessage('Check your email for the verification code');
    } catch (err) {
      logWithTime('❌ Error sending OTP:', err);
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      setError('Please enter the verification code');
      return;
    }

    if (otp.trim().length < 6) {
      setError('Verification code must be at least 6 digits');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setMessage('');

      logWithTime('🔐 Verifying OTP for:', email);

      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'email',
      });

      if (verifyError) {
        logWithTime('❌ OTP verification error:', verifyError);
        throw verifyError;
      }

      if (!data.session) {
        throw new Error('No session created');
      }

      logWithTime('✅ OTP verified successfully, session created');

      // Identify user in PostHog
      if (data.session.user) {
        try {
          if (posthog?.identify && typeof posthog.identify === 'function') {
            posthog.identify(data.session.user.id, {
              email: data.session.user.email,
              created_at: data.session.user.created_at
            });
            logWithTime('✅ User identified in PostHog:', data.session.user.id);
          }
        } catch (error) {
          // Silently fail if PostHog is not initialized yet
        }
      }

      // Session is automatically stored and managed by Supabase
      // Auth state listener in App.js will handle navigation
    } catch (err) {
      logWithTime('❌ Error verifying OTP:', err);
      setError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setOtp('');
    setOtpSent(false);
    setError('');
    setMessage('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="auto" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Welcome to Crumb</Text>
              <Text style={styles.subtitle}>
                Track your child's food intake and reactions
              </Text>
            </View>

            {/* Login Form */}
            <View style={styles.form}>
              {!otpSent ? (
                <>
                  {/* Email Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor="#999"
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        setError('');
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                    />
                  </View>

                  {/* Send Code Button */}
                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.buttonDisabled]}
                    onPress={handleSendCode}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Send Verification Code</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {/* OTP Input */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Verification Code</Text>
                    <Text style={styles.hint}>
                      Enter the 6-digit code sent to {email}
                    </Text>
                    <TextInput
                      style={[styles.input, styles.otpInput]}
                      placeholder="000000"
                      placeholderTextColor="#999"
                      value={otp}
                      onChangeText={(text) => {
                        setOtp(text.replace(/[^0-9]/g, ''));
                        setError('');
                      }}
                      keyboardType="number-pad"
                      maxLength={8}
                      editable={!loading}
                      autoFocus
                    />
                  </View>

                  {/* Verify Button */}
                  <TouchableOpacity
                    style={[styles.primaryButton, loading && styles.buttonDisabled]}
                    onPress={handleVerifyOtp}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Verify & Login</Text>
                    )}
                  </TouchableOpacity>

                  {/* Resend Code */}
                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={handleResendCode}
                    disabled={loading}
                  >
                    <Text style={styles.secondaryButtonText}>
                      Use a different email
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Error Message */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Success Message */}
              {message ? (
                <View style={styles.messageContainer}>
                  <Text style={styles.messageIcon}>✅</Text>
                  <Text style={styles.messageText}>{message}</Text>
                </View>
              ) : null}
            </View>

            {/* Privacy Notice */}
            <View style={styles.footer}>
              <Text style={styles.privacyText}>🔒 We never share your health data</Text>
              <TouchableOpacity
                onPress={() => Linking.openURL('https://www.heycrumb.io/privacy')}
              >
                <Text style={styles.privacyLink}>Read our Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#2c3e50',
    backgroundColor: '#f8f9fa',
  },
  otpInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#FF986F',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    padding: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FF986F',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8d7da',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  errorIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#721c24',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d4edda',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  messageIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    color: '#155724',
  },
  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  privacyText: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
    textAlign: 'center',
  },
  privacyLink: {
    fontSize: 14,
    color: '#FF986F',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
