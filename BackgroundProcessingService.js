import StorageService from './StorageService';

const logWithTime = (message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}]`, message, ...args);
};

// Webhook URLs for easy maintenance and debugging
const WEBHOOK_URLS = {
  EXTRACTION: 'https://primary-production-97918.up.railway.app/webhook/fab624fa-c5e7-4439-b39c-3a7e13cca74f'
};

class BackgroundProcessingService {
  constructor() {
    this.processingQueue = new Set();
    this.isProcessing = false;
  }

  // Singleton pattern
  static getInstance() {
    if (!BackgroundProcessingService.instance) {
      BackgroundProcessingService.instance = new BackgroundProcessingService();
    }
    return BackgroundProcessingService.instance;
  }

  /**
   * Add a note to the processing queue
   * @param {string} entryId - Entry ID to process
   * @param {Object} processingData - Data needed for processing
   */
  async addToProcessingQueue(entryId, processingData) {
    try {
      // Add to queue
      this.processingQueue.add(entryId);
      
      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
      
      logWithTime(`Added entry ${entryId} to processing queue`);
    } catch (error) {
      console.error('Failed to add to processing queue:', error);
    }
  }

  /**
   * Process the queue of notes waiting for LLM extraction
   */
  async processQueue() {
    if (this.isProcessing || this.processingQueue.size === 0) {
      return;
    }

    this.isProcessing = true;
    logWithTime(`Starting to process ${this.processingQueue.size} notes`);

    while (this.processingQueue.size > 0) {
      const entryId = this.processingQueue.values().next().value;
      this.processingQueue.delete(entryId);
      
      try {
        await this.processNote(entryId);
      } catch (error) {
        console.error(`Failed to process note ${entryId}:`, error);
        await StorageService.markNoteProcessingFailed(entryId, error.message);
      }
    }

    this.isProcessing = false;
    logWithTime('Finished processing queue');
  }

  /**
   * Process a single note for LLM extraction
   * @param {string} entryId - Entry ID to process
   */
  async processNote(entryId) {
    try {
      // Get the note data
      const logs = await StorageService.getFoodLogs();
      const note = logs.find(log => log.id === entryId);
      
      if (!note) {
        throw new Error('Note not found');
      }

      if (note.processingStatus !== 'processing') {
        logWithTime(`Note ${entryId} is not in processing status, skipping`);
        return;
      }

      logWithTime(`Processing note ${entryId} for LLM extraction`);

      // Set up timeout for LLM extraction (60 seconds for background processing)
      const extractionTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('LLM extraction timeout after 60 seconds'));
        }, 60000);
      });
      
      // Send transcription to LLM extraction webhook
      const extractionFetchPromise = fetch(WEBHOOK_URLS.EXTRACTION, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: note.text,
          timestamp: note.timestamp,
          source: note.source,
          confidence: note.confidence,
          editedFromTranscription: note.editedFromTranscription,
          audioUri: note.processingData?.audioUri,
          duration: note.processingData?.duration,
          transcriptionJobId: note.transcriptionJobId
        })
      });
      
      const extractionResponse = await Promise.race([extractionFetchPromise, extractionTimeoutPromise]);
      
      if (!extractionResponse.ok) {
        throw new Error(`LLM extraction failed: ${extractionResponse.status} ${extractionResponse.statusText}`);
      }
      
      const extractionResponseData = await extractionResponse.json();
      
      // Parse the LLM extraction response format (handles both n8n and direct formats)
      let extractedData = null;
      
      if (Array.isArray(extractionResponseData) && extractionResponseData.length > 0) {
        // n8n webhook format: [{ values: { status: "success", extractedData: {...} } }]
        const webhookData = extractionResponseData[0];
        if (webhookData.values && webhookData.values.status === 'success' && webhookData.values.extractedData) {
          extractedData = webhookData.values.extractedData;
        } else {
          throw new Error('Invalid n8n extraction response format or status');
        }
      } else if (extractionResponseData.status === 'success' && extractionResponseData.extractedData) {
        // Direct format: { status: "success", extractedData: {...} }
        extractedData = extractionResponseData.extractedData;
      } else {
        throw new Error('Invalid extraction response format - expected n8n array or direct object');
      }
      
      // Update the note with extraction results
      const success = await StorageService.updateNoteWithExtraction(entryId, extractedData);
      
      if (success) {
        const foodCount = extractedData.foods ? extractedData.foods.length : 0;
        const reactionCount = extractedData.reactions ? extractedData.reactions.length : 0;
        logWithTime(`Successfully processed note ${entryId}: ${foodCount} foods, ${reactionCount} reactions`);
        
        // Trigger notification (this would be implemented based on your notification system)
        this.triggerProcessingCompleteNotification(entryId, foodCount, reactionCount);
      } else {
        throw new Error('Failed to update note with extraction results');
      }
      
    } catch (error) {
      console.error(`Error processing note ${entryId}:`, error);
      await StorageService.markNoteProcessingFailed(entryId, error.message);
      throw error;
    }
  }

  /**
   * Trigger notification when processing completes
   * @param {string} entryId - Entry ID that completed processing
   * @param {number} foodCount - Number of foods extracted
   * @param {number} reactionCount - Number of reactions extracted
   */
  triggerProcessingCompleteNotification(entryId, foodCount, reactionCount) {
    // This is where you would implement your notification system
    // For now, we'll just log it and could use a simple alert
    logWithTime(`Processing complete notification for ${entryId}: ${foodCount} foods, ${reactionCount} reactions`);
    
    // You could implement:
    // - Push notifications
    // - In-app notifications
    // - Toast messages
    // - Update a notification state in your app
  }

  /**
   * Get current processing status
   * @returns {Object} Processing status information
   */
  getProcessingStatus() {
    return {
      isProcessing: this.isProcessing,
      queueSize: this.processingQueue.size,
      queueItems: Array.from(this.processingQueue)
    };
  }

  /**
   * Clear the processing queue (useful for debugging or reset)
   */
  clearQueue() {
    this.processingQueue.clear();
    this.isProcessing = false;
    logWithTime('Processing queue cleared');
  }
}

// Export singleton instance
export default BackgroundProcessingService.getInstance();

