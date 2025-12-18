import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import StorageService from './StorageService';

const logWithTime = (message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}]`, message, ...args);
};

// Get webhook URL from environment
const getSummaryWebhookUrl = () => {
  return Constants.expoConfig?.extra?.summaryWebhookUrl || process.env.EXPO_PUBLIC_SUMMARY_WEBHOOK_URL;
};

/**
 * Service for managing AI-generated medical summaries
 */
class AISummaryService {
  constructor() {
    this.STORAGE_KEY_PREFIX = 'ai_summary_';
  }

  // Singleton pattern
  static getInstance() {
    if (!AISummaryService.instance) {
      AISummaryService.instance = new AISummaryService();
    }
    return AISummaryService.instance;
  }

  /**
   * Get storage key for user's summary
   * @param {string} userId - User ID
   * @returns {string} Storage key
   */
  getStorageKey(userId) {
    return `${this.STORAGE_KEY_PREFIX}${userId}`;
  }

  /**
   * Get locally stored summary for user
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Stored summary or null
   */
  async getStoredSummary(userId) {
    try {
      const key = this.getStorageKey(userId);
      const data = await AsyncStorage.getItem(key);

      if (data) {
        const parsed = JSON.parse(data);
        logWithTime('✅ Retrieved stored AI summary:', {
          generated_at: parsed.generated_at,
          entry_count: parsed.entry_count
        });
        return parsed;
      }

      return null;
    } catch (error) {
      console.error('Failed to get stored summary:', error);
      return null;
    }
  }

  /**
   * Save summary to local storage
   * @param {string} userId - User ID
   * @param {Object} summaryData - Summary data to store
   * @returns {Promise<boolean>} Success status
   */
  async saveSummary(userId, summaryData) {
    try {
      const key = this.getStorageKey(userId);
      await AsyncStorage.setItem(key, JSON.stringify(summaryData));
      logWithTime('✅ Saved AI summary locally');
      return true;
    } catch (error) {
      console.error('Failed to save summary:', error);
      return false;
    }
  }

  /**
   * Format food log entries for API payload
   * @param {Array} entries - Food log entries from StorageService
   * @returns {Array} Formatted entries
   */
  formatEntriesForPayload(entries) {
    return entries.map(entry => ({
      timestamp: entry.timestamp,
      foods: entry.foods || [],
      reactions: entry.reactions || []
    }));
  }

  /**
   * Generate AI summary by calling webhook
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Summary response
   */
  async generateSummary(userId) {
    try {
      const webhookUrl = getSummaryWebhookUrl();

      if (!webhookUrl) {
        throw new Error('Summary webhook URL not configured. Please check your .env file.');
      }

      logWithTime('🤖 Generating AI summary...');

      // Get all food log entries
      const entries = await StorageService.getFoodLogs();

      if (!entries || entries.length === 0) {
        throw new Error('No entries found to generate summary');
      }

      // Format payload
      const payload = {
        user_id: userId,
        entries: this.formatEntriesForPayload(entries),
        date_range: 'all'
      };

      logWithTime('📤 Sending to webhook:', {
        url: webhookUrl,
        entry_count: entries.length
      });

      // Call webhook with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timeout after 60 seconds'));
        }, 60000);
      });

      const fetchPromise = fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const rawResponse = await response.json();

      // Parse OpenAI chat completion format
      // Handle both array wrapper and direct object
      // Expected formats:
      // 1. [{ choices: [{ message: { content: { summary_markdown: "..." } } }] }]
      // 2. { choices: [{ message: { content: { summary_markdown: "..." } } }] }
      let summaryMarkdown = null;
      let responseData = Array.isArray(rawResponse) ? rawResponse[0] : rawResponse;

      if (responseData.choices && responseData.choices.length > 0) {
        const content = responseData.choices[0].message?.content;

        if (typeof content === 'string') {
          // If content is already a string, use it directly
          summaryMarkdown = content;
        } else if (content?.summary_markdown) {
          // If content is an object with summary_markdown field
          summaryMarkdown = content.summary_markdown;
        } else if (content?.medical_summary_markdown) {
          // Alternative field name
          summaryMarkdown = content.medical_summary_markdown;
        }
      }

      if (!summaryMarkdown) {
        console.error('Raw response structure:', JSON.stringify(rawResponse, null, 2));
        throw new Error('Invalid response format: missing summary content');
      }

      // Format the response data consistently for storage
      const formattedData = {
        summary: summaryMarkdown,
        entry_count: entries.length,
        generated_at: new Date().toISOString(),
        model: responseData.model || 'unknown',
        raw_response_id: responseData.id
      };

      logWithTime('✅ AI summary generated:', {
        entry_count: formattedData.entry_count,
        generated_at: formattedData.generated_at,
        model: formattedData.model
      });

      // Save to local storage
      await this.saveSummary(userId, formattedData);

      return {
        success: true,
        data: formattedData
      };

    } catch (error) {
      console.error('Failed to generate AI summary:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get or generate summary (convenience method)
   * @param {string} userId - User ID
   * @param {boolean} forceRefresh - Force regeneration even if cached
   * @returns {Promise<Object>} Summary data or error
   */
  async getSummary(userId, forceRefresh = false) {
    try {
      // Check for cached summary first
      if (!forceRefresh) {
        const cached = await this.getStoredSummary(userId);
        if (cached) {
          return {
            success: true,
            data: cached,
            fromCache: true
          };
        }
      }

      // Generate new summary
      return await this.generateSummary(userId);

    } catch (error) {
      console.error('Failed to get summary:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clear stored summary for user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async clearSummary(userId) {
    try {
      const key = this.getStorageKey(userId);
      await AsyncStorage.removeItem(key);
      logWithTime('✅ Cleared AI summary');
      return true;
    } catch (error) {
      console.error('Failed to clear summary:', error);
      return false;
    }
  }
}

// Export singleton instance
export default AISummaryService.getInstance();
