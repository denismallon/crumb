import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import LadderService from './LadderService';
import { MILK_LADDER, EGG_LADDER, LADDER_TYPES } from './LadderData';

const logWithTime = (message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}]`, message, ...args);
};

export default function LadderOnboardingScreen({ onComplete }) {
  const [screen, setScreen] = useState('type'); // 'type' or 'step'
  const [selectedType, setSelectedType] = useState(null);

  const handleTypeSelection = (type) => {
    logWithTime('Ladder type selected:', type);
    setSelectedType(type);
    setScreen('step');
  };

  const handleSkipType = async () => {
    logWithTime('Ladder onboarding skipped');
    await LadderService.markOnboardingCompleted();
    onComplete();
  };

  const handleStepSelection = async (step) => {
    logWithTime('Ladder step selected:', { type: selectedType, step });

    const success = await LadderService.setLadderProgress(selectedType, step);

    if (success) {
      await LadderService.markOnboardingCompleted();
      onComplete();
    } else {
      console.error('Failed to save ladder progress');
    }
  };

  const handleSkipStep = async () => {
    logWithTime('Step selection skipped');
    await LadderService.markOnboardingCompleted();
    onComplete();
  };

  const handleBack = () => {
    setScreen('type');
    setSelectedType(null);
  };

  const renderTypeSelection = () => {
    return (
      <View style={styles.container}>
        <ExpoStatusBar style="auto" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.content}>
            <View style={styles.headerSection}>
              <Text style={styles.title}>Are you working on milk or eggs?</Text>
              <Text style={styles.subtitle}>You can change this any time in Settings</Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => handleTypeSelection(LADDER_TYPES.MILK)}
                accessibilityLabel="Select milk ladder"
              >
                <Text style={styles.primaryButtonText}>🥛 Milk</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => handleTypeSelection(LADDER_TYPES.EGG)}
                accessibilityLabel="Select egg ladder"
              >
                <Text style={styles.primaryButtonText}>🥚 Eggs</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={handleSkipType}
                accessibilityLabel="Skip ladder selection"
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  };

  const renderStepSelection = () => {
    const ladder = selectedType === LADDER_TYPES.MILK ? MILK_LADDER : EGG_LADDER;
    const ladderName = selectedType === LADDER_TYPES.MILK ? 'Milk' : 'Egg';

    return (
      <View style={styles.container}>
        <ExpoStatusBar style="auto" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{ladderName} Ladder</Text>
            <View style={styles.placeholder} />
          </View>

          <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollContentContainer}>
            <View style={styles.headerSection}>
              <Text style={styles.title}>Which step are you on?</Text>
              <Text style={styles.subtitle}>Select your current step</Text>
            </View>

            <View style={styles.stepsContainer}>
              {ladder.map((stepData) => (
                <TouchableOpacity
                  key={stepData.step}
                  style={styles.stepButton}
                  onPress={() => handleStepSelection(stepData.step)}
                  accessibilityLabel={`Select step ${stepData.step}: ${stepData.name}`}
                >
                  <View style={styles.stepButtonContent}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{stepData.step}</Text>
                    </View>
                    <View style={styles.stepInfo}>
                      <Text style={styles.stepName}>{stepData.name}</Text>
                      <Text style={styles.stepFoods} numberOfLines={1}>
                        {stepData.foods.slice(0, 2).join(', ')}
                        {stepData.foods.length > 2 ? '...' : ''}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.skipButtonBottom}
              onPress={handleSkipStep}
              accessibilityLabel="Skip step selection"
            >
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  };

  if (screen === 'type') {
    return renderTypeSelection();
  } else {
    return renderStepSelection();
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#2c3e50',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerSection: {
    marginTop: 40,
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#28a745',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  skipButtonText: {
    color: '#6c757d',
    fontSize: 16,
    fontWeight: '500',
  },
  stepsContainer: {
    gap: 12,
  },
  stepButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  stepButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  stepInfo: {
    flex: 1,
  },
  stepName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  stepFoods: {
    fontSize: 13,
    color: '#6c757d',
  },
  skipButtonBottom: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
});
