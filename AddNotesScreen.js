import React, { useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput, 
  SafeAreaView,
  ActivityIndicator,
  Platform
} from 'react-native';
import { Audio } from 'expo-av';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import StorageService from './StorageService';
import BackgroundProcessingService from './BackgroundProcessingService';
import NoteSaveEvents from './NoteSaveEvents';

const logWithTime = (message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}]`, message, ...args);
};

// Webhook URLs for easy maintenance and debugging
const WEBHOOK_URLS = {
  TRANSCRIPTION: 'https://primary-production-97918.up.railway.app/webhook/e463b9ed-7503-460b-b7ba-75dbb17e06f8',
  EXTRACTION: 'https://primary-production-97918.up.railway.app/webhook/fab624fa-c5e7-4439-b39c-3a7e13cca74f'
};

export default function AddNotesScreen({ onClose }) {
  const [recordingStatus, setRecordingStatus] = useState('ready');
  const [transcribedText, setTranscribedText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [webhookResponse, setWebhookResponse] = useState(null);
  const [isLoadingWebhook, setIsLoadingWebhook] = useState(false);
  const [webhookError, setWebhookError] = useState(null);
  const [editableTranscription, setEditableTranscription] = useState('');
  const [showTranscriptionConfirmation, setShowTranscriptionConfirmation] = useState(false);
  const [isProcessingLLM, setIsProcessingLLM] = useState(false);
  const recordingRef = useRef(null);
  const durationInterval = useRef(null);
  const webhookTimeoutRef = useRef(null);

  const startRecording = async () => {
    try {
      setRecordingStatus('recording');
      setIsRecording(true);
      setRecordingDuration(0);
      
      // Start duration counter
      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      // Request audio permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setWebhookError('Please grant microphone permission to record audio.');
        setRecordingStatus('ready');
        setIsRecording(false);
        clearInterval(durationInterval.current);
        return;
      }

      // Configure audio recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      recordingRef.current = recording;
      await recording.startAsync();
    } catch (error) {
      // ADD DETAILED ERROR LOGGING
      logWithTime('❌ Recording start failed:', error);
      logWithTime('Error name:', error.name);
      logWithTime('Error message:', error.message);
      logWithTime('Error stack:', error.stack);
      logWithTime('Platform:', Platform.OS);

      setWebhookError(`We couldn't start recording. Please try again. (${error.message})`);
      setRecordingStatus('ready');
      setIsRecording(false);
      clearInterval(durationInterval.current);
    }
  };

  const stopRecording = async () => {
    try {
      setRecordingStatus('processing');
      setIsRecording(false);
      clearInterval(durationInterval.current);

      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        
        // Get the audio file URI
        const uri = recordingRef.current.getURI();
        
        // Send to webhook for transcription
        await sendToWebhook(uri);
      }
    } catch (error) {
      setWebhookError('We couldn’t finish that recording. Please try again.');
      setRecordingStatus('ready');
      setIsRecording(false);
      clearInterval(durationInterval.current);
    }
  };

  const handleRecordPress = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const sendToWebhook = async (audioUri) => {
    try {
      setIsLoadingWebhook(true);
      setWebhookError(null);
      setWebhookResponse(null);
      
      const formData = new FormData();
      
      // Platform-specific handling
      if (Platform.OS === 'web') {
        // For web: fetch the blob and append it
        const response = await fetch(audioUri);
        const blob = await response.blob();
        formData.append('audio0', blob, `recording_${Date.now()}.m4a`);
      } else {
        // For mobile: use the existing approach
        formData.append('audio0', {
          uri: audioUri,
          type: 'audio/m4a',
          name: `recording_${Date.now()}.m4a`
        });
      }
      
      // Set up timeout
      const timeoutPromise = new Promise((_, reject) => {
        webhookTimeoutRef.current = setTimeout(() => {
          reject(new Error('Request timeout after 30 seconds'));
        }, 30000);
      });
      
      const fetchPromise = fetch(WEBHOOK_URLS.TRANSCRIPTION, {
        method: 'POST',
        body: formData
      });
      
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      
      // Clear timeout if request completes
      if (webhookTimeoutRef.current) {
        clearTimeout(webhookTimeoutRef.current);
        webhookTimeoutRef.current = null;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const responseData = await response.json();
      setWebhookResponse(responseData);
      handleWebhookResponse(responseData);
      
    } catch (error) {
      setWebhookError(error.message);
      setRecordingStatus('ready');
    } finally {
      setIsLoadingWebhook(false);
    }
  };
  
  const handleWebhookResponse = (response) => {
    switch (response.status) {
      case 'success':
        setTranscribedText(response.transcription);
        setEditableTranscription(response.transcription);
        setShowTranscriptionConfirmation(true);
        setRecordingStatus('ready');
        break;
        
      case 'processing':
        setRecordingStatus('processing');
        // Poll for updates if job_id is provided
        if (response.job_id) {
          pollForTranscriptionUpdate(response.job_id);
        }
        break;
        
      case 'error':
        setWebhookError(response.error);
        setRecordingStatus('ready');
        break;
        
      default:
        setWebhookError('Unknown response format');
        setRecordingStatus('ready');
    }
  };
  
  const pollForTranscriptionUpdate = async (jobId) => {
    // This would be implemented based on your n8n webhook's polling mechanism
    // For now, we'll simulate a delay and then show success
    setTimeout(() => {
      const mockResponse = {
        status: 'success',
        transcription: `Transcribed audio: "Recorded for ${recordingDuration} seconds - Emma ate 3 pieces of apple and had a small rash on her cheek"`,
        confidence: 0.95
      };
      handleWebhookResponse(mockResponse);
    }, 3000);
  };
  
  const handleSaveNote = async () => {
    const tempId = `note-temp-${Date.now()}`;
    const placeholderTimestamp = new Date().toISOString();
    NoteSaveEvents.emitPlaceholderAdded({
      tempId,
      timestamp: placeholderTimestamp,
      source: 'voice'
    });

    setIsProcessingLLM(true);
    
    const audioUri = recordingRef.current?.getURI();
    
    // Prepare entry payload before clearing local state
    const entryData = {
      text: editableTranscription,
      source: 'voice',
      confidence: webhookResponse?.confidence ? parseFloat(webhookResponse.confidence) : null,
      editedFromTranscription: editableTranscription !== webhookResponse?.transcription,
      audioUri: audioUri,
      duration: recordingDuration,
      transcriptionJobId: webhookResponse?.job_id,
      processingStatus: 'processing' // Ensure processing status
    };
    // Immediately close modal for seamless UX
    resetState();
    onClose();
    
    try {
      const saveResult = await StorageService.saveNoteForProcessing(entryData);
      
      if (saveResult?.success) {
        NoteSaveEvents.emitPlaceholderHydrated({
          tempId,
          entryId: saveResult.entryId,
          text: entryData.text,
          timestamp: entryData.timestamp || placeholderTimestamp,
          source: entryData.source
        });
        try {
          await BackgroundProcessingService.addToProcessingQueue(
            saveResult.entryId, 
            {
              audioUri: audioUri,
              duration: recordingDuration,
              transcriptionJobId: webhookResponse?.job_id
            }
          );
        } catch (queueError) {
          setWebhookError('Processing queue is busy. We’ll keep trying.');
        }
      } else {
        setWebhookError('We couldn’t save your note. Please try again.');
        NoteSaveEvents.emitPlaceholderRemoved({ tempId });
      }
    } catch (error) {
      setWebhookError('We couldn’t save your note. Please try again.');
      NoteSaveEvents.emitPlaceholderRemoved({ tempId });
    } finally {
      setIsProcessingLLM(false);
    }
  };
  
  const handleRetry = () => {
    setWebhookError(null);
    const audioUri = recordingRef.current?.getURI();
    if (audioUri) {
      sendToWebhook(audioUri);
    }
  };
  
  const handleCancelTranscription = () => {
    setShowTranscriptionConfirmation(false);
    setTranscribedText('');
    setEditableTranscription('');
    setWebhookResponse(null);
    setRecordingStatus('ready');
  };

  const resetState = () => {
    setTranscribedText('');
    setEditableTranscription('');
    setShowTranscriptionConfirmation(false);
    setWebhookResponse(null);
    setRecordingStatus('ready');
    setWebhookError(null);
    setIsLoadingWebhook(false);
    setIsProcessingLLM(false);
    setRecordingDuration(0);
    setIsRecording(false);
  };

  const getStatusText = () => {
    switch (recordingStatus) {
      case 'ready':
        return 'Ready to record';
      case 'recording':
        return `Recording... (${recordingDuration}s)`;
      case 'processing':
        return 'Processing...';
      default:
        return 'Ready to record';
    }
  };

  const getStatusColor = () => {
    switch (recordingStatus) {
      case 'ready':
        return '#4CAF50';
      case 'recording':
        return '#F44336';
      case 'processing':
        return '#FF9800';
      default:
        return '#4CAF50';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="auto" />
      
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Add New Note</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.recordingSection}>
          <Text style={[styles.statusText, { color: getStatusColor() }]}>
            {getStatusText()}
          </Text>
          
          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording && styles.recordButtonActive
            ]}
            onPress={handleRecordPress}
            disabled={recordingStatus === 'processing'}
          >
            <Text style={styles.recordButtonText}>
              {isRecording ? '⏹️' : '🎤'}
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.recordHint}>
            {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
          </Text>
        </View>

        {/* Loading State */}
        {isLoadingWebhook && (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="large" color="#007bff" />
            <Text style={styles.loadingText}>Processing audio...</Text>
            <Text style={styles.loadingSubtext}>This may take a few moments</Text>
          </View>
        )}
        
        {/* Processing State */}
        {recordingStatus === 'processing' && !isLoadingWebhook && (
          <View style={styles.processingSection}>
            <ActivityIndicator size="large" color="#FF9800" />
            <Text style={styles.processingText}>Transcription in progress...</Text>
            <Text style={styles.processingSubtext}>Please wait while we process your audio</Text>
          </View>
        )}
        
        {/* Error State */}
        {webhookError && (
          <View style={styles.errorSection}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Transcription Error</Text>
            <Text style={styles.errorText}>{webhookError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Transcription Confirmation */}
        {showTranscriptionConfirmation && (
          <View style={styles.transcriptionSection}>
            <Text style={styles.sectionTitle}>Review Transcription:</Text>
            <Text style={styles.confidenceText}>
              Confidence: {webhookResponse?.confidence ? `${(webhookResponse.confidence * 100).toFixed(1)}%` : 'N/A'}
            </Text>
            <TextInput
              style={styles.textInput}
              value={editableTranscription}
              onChangeText={setEditableTranscription}
              multiline
              placeholder="Your transcribed text will appear here..."
              placeholderTextColor="#999"
            />
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelTranscription}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            
              <TouchableOpacity
                style={[styles.saveButton, isProcessingLLM && styles.saveButtonDisabled]}
                onPress={handleSaveNote}
                disabled={isProcessingLLM}
              >
                {isProcessingLLM ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.saveButtonText}>Processing...</Text>
                  </View>
                ) : (
                  <Text style={styles.saveButtonText}>Save Note</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
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
    flex: 1,
    padding: 20,
  },
  recordingSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 30,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  recordButtonActive: {
    backgroundColor: '#F44336',
  },
  recordButtonText: {
    fontSize: 40,
  },
  recordHint: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 15,
    textAlign: 'center',
  },
  loadingSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 30,
    marginBottom: 20,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007bff',
    marginTop: 15,
    marginBottom: 5,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  processingSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 30,
    marginBottom: 20,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  processingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF9800',
    marginTop: 15,
    marginBottom: 5,
  },
  processingSubtext: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
  },
  errorSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#dc3545',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#dc3545',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  transcriptionSection: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 15,
  },
  confidenceText: {
    fontSize: 14,
    color: '#28a745',
    fontWeight: '500',
    marginBottom: 10,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#2c3e50',
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#f8f9fa',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 15,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#28a745',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    backgroundColor: '#6c757d',
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
