import AsyncStorage from '@react-native-async-storage/async-storage';

const logWithTime = (message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}]`, message, ...args);
};

// TypeScript-style interfaces (as JSDoc comments for better IDE support)
/**
 * @typedef {Object} FoodLogEntry
 * @property {string} id - Unique identifier (timestamp-based)
 * @property {string} timestamp - ISO datetime string when entry was logged
 * @property {string} reactionTime - ISO datetime string when reaction occurred
 * @property {number} reactionDelay - Minutes between timestamp and reactionTime
 * @property {string} date - YYYY-MM-DD format date
 * @property {string} text - User's food log description
 * @property {'voice'|'manual'} source - How the entry was created
 * @property {Array} reactions - Array of reaction objects (LLM extracted)
 * @property {Array} foods - Array of food objects (LLM extracted)
 * @property {number} confidence - Transcription confidence score (0-1)
 * @property {boolean} editedFromTranscription - Whether text was edited from transcription
 * @property {Object} extractionData - LLM extraction results
 * @property {string} extractionTimestamp - When LLM extraction was performed
 * @property {string} transcriptionJobId - Original transcription job ID
 */

/**
 * @typedef {Object} AppMetadata
 * @property {string} version - App version
 * @property {number} totalEntries - Total number of food log entries
 * @property {string} lastUpdated - ISO datetime string of last update
 * @property {Object} stats - App usage statistics
 */

class StorageService {
  constructor() {
    this.STORAGE_KEYS = {
      FOOD_LOGS: 'foodLogs',
      APP_METADATA: 'appMetadata'
    };
    
    // Initialize metadata if it doesn't exist
    this.initializeMetadata();
  }

  // Singleton pattern
  static getInstance() {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Initialize app metadata if it doesn't exist
   */
  async initializeMetadata() {
    try {
      const existingMetadata = await AsyncStorage.getItem(this.STORAGE_KEYS.APP_METADATA);
      if (!existingMetadata) {
        const initialMetadata = {
          version: '1.0.0',
          totalEntries: 0,
          lastUpdated: new Date().toISOString(),
          stats: {
            voiceEntries: 0,
            manualEntries: 0,
            totalReactions: 0
          }
        };
        await AsyncStorage.setItem(
          this.STORAGE_KEYS.APP_METADATA, 
          JSON.stringify(initialMetadata)
        );
      }
    } catch (error) {
      console.error('Failed to initialize metadata:', error);
    }
  }

  /**
   * Generate unique ID using timestamp + random suffix
   * @returns {string} Unique identifier
   */
  generateUniqueId() {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 9);
    return `${timestamp}_${randomSuffix}`;
  }

  /**
   * Format date for display in UI
   * @param {Date|string} date - Date to format
   * @returns {string} Formatted date string
   */
  formatDateForDisplay(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Calculate reaction delay in minutes
   * @param {string} timestamp - Entry timestamp
   * @param {string} reactionTime - Reaction timestamp
   * @returns {number} Delay in minutes
   */
  calculateReactionDelay(timestamp, reactionTime) {
    const entryTime = new Date(timestamp);
    const reaction = new Date(reactionTime);
    return Math.round((reaction - entryTime) / (1000 * 60)); // Convert to minutes
  }

  /**
   * Validate food log entry data
   * @param {Object} entry - Entry to validate
   * @returns {boolean} Whether entry is valid
   */
  validateFoodLogEntry(entry) {
    const requiredFields = ['id', 'timestamp', 'text', 'source'];
    
    for (const field of requiredFields) {
      if (!entry[field]) {
        console.error(`Missing required field: ${field}`);
        return false;
      }
    }

    if (!['voice', 'manual'].includes(entry.source)) {
      console.error('Invalid source type:', entry.source);
      return false;
    }

    if (entry.confidence !== undefined && (entry.confidence < 0 || entry.confidence > 1)) {
      console.error('Invalid confidence score:', entry.confidence);
      return false;
    }

    return true;
  }

  /**
   * Save a new food log entry
   * @param {Object} entryData - Entry data to save
   * @returns {Promise<boolean>} Success status
   */
  async saveFoodLogEntry(entryData) {
    try {
      // Create complete entry with defaults
      const entry = {
        id: entryData.id || this.generateUniqueId(),
        timestamp: entryData.timestamp || new Date().toISOString(),
        reactionTime: entryData.reactionTime || entryData.timestamp || new Date().toISOString(),
        reactionDelay: entryData.reactionDelay || 0,
        date: entryData.date || new Date().toISOString().split('T')[0],
        text: entryData.text || '',
        source: entryData.source || 'manual',
        reactions: entryData.reactions || [],
        foods: entryData.foods || [],
        confidence: entryData.confidence || null,
        editedFromTranscription: entryData.editedFromTranscription || false,
        extractionData: entryData.extractionData || null,
        extractionTimestamp: entryData.extractionTimestamp || null,
        transcriptionJobId: entryData.transcriptionJobId || null,
        processingStatus: entryData.processingStatus || 'complete', // 'processing', 'complete', 'failed'
        processingStartedAt: entryData.processingStartedAt || null,
        processingCompletedAt: entryData.processingCompletedAt || null
      };

      // Validate entry
      if (!this.validateFoodLogEntry(entry)) {
        throw new Error('Invalid entry data');
      }

      // Calculate reaction delay if not provided
      if (!entryData.reactionDelay && entry.reactionTime !== entry.timestamp) {
        entry.reactionDelay = this.calculateReactionDelay(entry.timestamp, entry.reactionTime);
      }

      // Get existing logs
      const existingLogs = await this.getFoodLogs();
      
      // Add new entry
      const updatedLogs = [entry, ...existingLogs];
      
      // Save to storage
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.FOOD_LOGS, 
        JSON.stringify(updatedLogs)
      );

      // Update metadata
      await this.updateMetadata('totalEntries', updatedLogs.length);
      await this.updateMetadata('lastUpdated', new Date().toISOString());
      
      // Update stats
      const statsKey = entry.source === 'voice' ? 'voiceEntries' : 'manualEntries';
      const currentStats = await this.getMetadata();
      await this.updateMetadata('stats', {
        ...currentStats.stats,
        [statsKey]: currentStats.stats[statsKey] + 1
      });

      logWithTime('Food log entry saved successfully:', entry.id);
      return true;

    } catch (error) {
      console.error('Failed to save food log entry:', error);
      return false;
    }
  }

  /**
   * Get all food log entries, sorted by timestamp (newest first)
   * @returns {Promise<Array<FoodLogEntry>>} Array of food log entries
   */
  async getFoodLogs() {
    try {
      const logsJson = await AsyncStorage.getItem(this.STORAGE_KEYS.FOOD_LOGS);
      const logs = logsJson ? JSON.parse(logsJson) : [];
      
      // Sort by timestamp (newest first)
      return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('Failed to get food logs:', error);
      return [];
    }
  }

  /**
   * Update existing food log entry
   * @param {string} id - Entry ID to update
   * @param {Object} updatedEntry - Updated entry data
   * @returns {Promise<boolean>} Success status
   */
  async updateFoodLogEntry(id, updatedEntry) {
    try {
      const logs = await this.getFoodLogs();
      const entryIndex = logs.findIndex(log => log.id === id);
      
      if (entryIndex === -1) {
        console.error('Entry not found:', id);
        return false;
      }

      // Merge with existing entry
      const mergedEntry = {
        ...logs[entryIndex],
        ...updatedEntry,
        id: logs[entryIndex].id, // Preserve original ID
        timestamp: logs[entryIndex].timestamp // Preserve original timestamp
      };

      // Validate updated entry
      if (!this.validateFoodLogEntry(mergedEntry)) {
        throw new Error('Invalid updated entry data');
      }

      // Update the entry
      logs[entryIndex] = mergedEntry;

      // Save back to storage
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.FOOD_LOGS, 
        JSON.stringify(logs)
      );

      // Update metadata
      await this.updateMetadata('lastUpdated', new Date().toISOString());

      logWithTime('Food log entry updated successfully:', id);
      return true;

    } catch (error) {
      console.error('Failed to update food log entry:', error);
      return false;
    }
  }

  /**
   * Delete food log entry
   * @param {string} id - Entry ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteFoodLogEntry(id) {
    try {
      const logs = await this.getFoodLogs();
      const filteredLogs = logs.filter(log => log.id !== id);
      
      if (filteredLogs.length === logs.length) {
        console.error('Entry not found for deletion:', id);
        return false;
      }

      // Save filtered logs
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.FOOD_LOGS, 
        JSON.stringify(filteredLogs)
      );

      // Update metadata
      await this.updateMetadata('totalEntries', filteredLogs.length);
      await this.updateMetadata('lastUpdated', new Date().toISOString());

      logWithTime('Food log entry deleted successfully:', id);
      return true;

    } catch (error) {
      console.error('Failed to delete food log entry:', error);
      return false;
    }
  }

  /**
   * Get food logs filtered by date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Promise<Array<FoodLogEntry>>} Filtered food log entries
   */
  async getFoodLogsByDateRange(startDate, endDate) {
    try {
      const logs = await this.getFoodLogs();
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include entire end date

      return logs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= start && logDate <= end;
      });
    } catch (error) {
      console.error('Failed to get food logs by date range:', error);
      return [];
    }
  }

  /**
   * Export all app data as JSON string
   * @returns {Promise<string>} JSON string of all data
   */
  async exportAllData() {
    try {
      const logs = await this.getFoodLogs();
      const metadata = await this.getMetadata();
      
      const exportData = {
        exportDate: new Date().toISOString(),
        version: metadata.version,
        foodLogs: logs,
        metadata: metadata,
        totalEntries: logs.length
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('Failed to export data:', error);
      return null;
    }
  }

  /**
   * Clear all app data
   * @returns {Promise<boolean>} Success status
   */
  async clearAllData() {
    try {
      logWithTime('Starting clearAllData...');

      // Get all keys for debugging
      const allKeys = await AsyncStorage.getAllKeys();
      logWithTime('All AsyncStorage keys before clear:', allKeys);

      // Remove food logs
      logWithTime('Removing FOOD_LOGS key:', this.STORAGE_KEYS.FOOD_LOGS);
      await AsyncStorage.removeItem(this.STORAGE_KEYS.FOOD_LOGS);

      // Reset metadata
      logWithTime('Resetting metadata...');
      await this.initializeMetadata();

      // Verify deletion
      const remainingKeys = await AsyncStorage.getAllKeys();
      logWithTime('Remaining AsyncStorage keys after clear:', remainingKeys);

      logWithTime('✅ All data cleared successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to clear data:', error);
      logWithTime('Clear data error details:', {
        message: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  /**
   * Get app metadata
   * @returns {Promise<AppMetadata>} App metadata
   */
  async getMetadata() {
    try {
      const metadataJson = await AsyncStorage.getItem(this.STORAGE_KEYS.APP_METADATA);
      return metadataJson ? JSON.parse(metadataJson) : null;
    } catch (error) {
      console.error('Failed to get metadata:', error);
      return null;
    }
  }

  /**
   * Update specific metadata field
   * @param {string} key - Metadata key to update
   * @param {*} value - New value
   * @returns {Promise<boolean>} Success status
   */
  async updateMetadata(key, value) {
    try {
      const metadata = await this.getMetadata();
      if (!metadata) {
        await this.initializeMetadata();
        return this.updateMetadata(key, value);
      }

      metadata[key] = value;
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.APP_METADATA, 
        JSON.stringify(metadata)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to update metadata:', error);
      return false;
    }
  }

  /**
   * Get food logs count
   * @returns {Promise<number>} Number of food log entries
   */
  async getFoodLogsCount() {
    try {
      const logs = await this.getFoodLogs();
      return logs.length;
    } catch (error) {
      console.error('Failed to get food logs count:', error);
      return 0;
    }
  }

  /**
   * Search food logs by text content
   * @param {string} searchTerm - Term to search for
   * @returns {Promise<Array<FoodLogEntry>>} Matching entries
   */
  async searchFoodLogs(searchTerm) {
    try {
      const logs = await this.getFoodLogs();
      const term = searchTerm.toLowerCase();
      
      return logs.filter(log => 
        log.text.toLowerCase().includes(term)
      );
    } catch (error) {
      console.error('Failed to search food logs:', error);
      return [];
    }
  }

  /**
   * Save a note with processing status (for async LLM processing)
   * @param {Object} entryData - Entry data to save
   * @returns {Promise<{success: boolean, entryId: string}>} Success status and entry ID
   */
  async saveNoteForProcessing(entryData) {
    try {
      const entry = {
        id: entryData.id || this.generateUniqueId(),
        timestamp: entryData.timestamp || new Date().toISOString(),
        reactionTime: entryData.reactionTime || entryData.timestamp || new Date().toISOString(),
        reactionDelay: entryData.reactionDelay || 0,
        date: entryData.date || new Date().toISOString().split('T')[0],
        text: entryData.text || '',
        source: entryData.source || 'manual',
        reactions: [],
        foods: [],
        confidence: entryData.confidence || null,
        editedFromTranscription: entryData.editedFromTranscription || false,
        extractionData: null,
        extractionTimestamp: null,
        transcriptionJobId: entryData.transcriptionJobId || null,
        processingStatus: 'processing',
        processingStartedAt: new Date().toISOString(),
        processingCompletedAt: null,
        // Store processing data for later use
        processingData: {
          audioUri: entryData.audioUri,
          duration: entryData.duration,
          transcriptionJobId: entryData.transcriptionJobId
        }
      };

      // Validate entry
      if (!this.validateFoodLogEntry(entry)) {
        throw new Error('Invalid entry data');
      }

      // Get existing logs
      const existingLogs = await this.getFoodLogs();
      
      // Add new entry
      const updatedLogs = [entry, ...existingLogs];
      
      // Save to storage
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.FOOD_LOGS, 
        JSON.stringify(updatedLogs)
      );

      // Update metadata
      await this.updateMetadata('totalEntries', updatedLogs.length);
      await this.updateMetadata('lastUpdated', new Date().toISOString());
      
      // Update stats
      const statsKey = entry.source === 'voice' ? 'voiceEntries' : 'manualEntries';
      const currentStats = await this.getMetadata();
      await this.updateMetadata('stats', {
        ...currentStats.stats,
        [statsKey]: currentStats.stats[statsKey] + 1
      });

      logWithTime('Note saved for processing:', entry.id);
      return { success: true, entryId: entry.id };

    } catch (error) {
      console.error('Failed to save note for processing:', error);
      return { success: false, entryId: null };
    }
  }

  /**
   * Update a note with completed LLM extraction results
   * @param {string} entryId - Entry ID to update
   * @param {Object} extractionData - LLM extraction results
   * @returns {Promise<boolean>} Success status
   */
  async updateNoteWithExtraction(entryId, extractionData) {
    try {
      const logs = await this.getFoodLogs();
      const entryIndex = logs.findIndex(log => log.id === entryId);
      
      if (entryIndex === -1) {
        console.error('Entry not found for extraction update:', entryId);
        return false;
      }

      // Update the entry with extraction results
      logs[entryIndex] = {
        ...logs[entryIndex],
        extractionData: extractionData,
        extractionTimestamp: new Date().toISOString(),
        foods: extractionData.foods || [],
        reactions: extractionData.reactions || [],
        processingStatus: 'complete',
        processingCompletedAt: new Date().toISOString()
      };

      // Save back to storage
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.FOOD_LOGS, 
        JSON.stringify(logs)
      );

      // Update metadata
      await this.updateMetadata('lastUpdated', new Date().toISOString());

      logWithTime('Note updated with extraction results:', entryId);
      return true;

    } catch (error) {
      console.error('Failed to update note with extraction:', error);
      return false;
    }
  }

  /**
   * Mark a note as failed processing
   * @param {string} entryId - Entry ID to mark as failed
   * @param {string} errorMessage - Error message
   * @returns {Promise<boolean>} Success status
   */
  async markNoteProcessingFailed(entryId, errorMessage) {
    try {
      const logs = await this.getFoodLogs();
      const entryIndex = logs.findIndex(log => log.id === entryId);
      
      if (entryIndex === -1) {
        console.error('Entry not found for failure update:', entryId);
        return false;
      }

      // Update the entry with failure status
      logs[entryIndex] = {
        ...logs[entryIndex],
        processingStatus: 'failed',
        processingCompletedAt: new Date().toISOString(),
        processingError: errorMessage
      };

      // Save back to storage
      await AsyncStorage.setItem(
        this.STORAGE_KEYS.FOOD_LOGS, 
        JSON.stringify(logs)
      );

      // Update metadata
      await this.updateMetadata('lastUpdated', new Date().toISOString());

      logWithTime('Note marked as processing failed:', entryId);
      return true;

    } catch (error) {
      console.error('Failed to mark note as processing failed:', error);
      return false;
    }
  }

  /**
   * Get notes that are currently being processed
   * @returns {Promise<Array<FoodLogEntry>>} Processing entries
   */
  async getProcessingNotes() {
    try {
      const logs = await this.getFoodLogs();
      return logs.filter(log => log.processingStatus === 'processing');
    } catch (error) {
      console.error('Failed to get processing notes:', error);
      return [];
    }
  }
}

// Export singleton instance
export default StorageService.getInstance();
