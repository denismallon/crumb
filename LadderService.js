import AsyncStorage from '@react-native-async-storage/async-storage';
import { MILK_LADDER, EGG_LADDER } from './LadderData';

const logWithTime = (message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}]`, message, ...args);
};

/**
 * Service for managing ladder progress (milk/egg allergy introduction)
 */
class LadderService {
  constructor() {
    this.STORAGE_KEYS = {
      ACTIVE_LADDER: 'active_ladder',
      CURRENT_STEP: 'current_step',
      STEP_START_DATE: 'step_start_date',
      ONBOARDING_COMPLETED: 'ladder_onboarding_completed'
    };
  }

  // Singleton pattern
  static getInstance() {
    if (!LadderService.instance) {
      LadderService.instance = new LadderService();
    }
    return LadderService.instance;
  }

  /**
   * Check if user has completed onboarding
   * @returns {Promise<boolean>}
   */
  async hasCompletedOnboarding() {
    try {
      const completed = await AsyncStorage.getItem(this.STORAGE_KEYS.ONBOARDING_COMPLETED);
      return completed === 'true';
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
      return false;
    }
  }

  /**
   * Mark onboarding as completed
   * @returns {Promise<boolean>}
   */
  async markOnboardingCompleted() {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');
      logWithTime('✅ Ladder onboarding marked as completed');
      return true;
    } catch (error) {
      console.error('Failed to mark onboarding completed:', error);
      return false;
    }
  }

  /**
   * Get current ladder configuration
   * @returns {Promise<{activeLadder: string|null, currentStep: number|null, stepStartDate: string|null}>}
   */
  async getLadderProgress() {
    try {
      const [activeLadder, currentStep, stepStartDate] = await Promise.all([
        AsyncStorage.getItem(this.STORAGE_KEYS.ACTIVE_LADDER),
        AsyncStorage.getItem(this.STORAGE_KEYS.CURRENT_STEP),
        AsyncStorage.getItem(this.STORAGE_KEYS.STEP_START_DATE)
      ]);

      return {
        activeLadder: activeLadder,
        currentStep: currentStep ? parseInt(currentStep) : null,
        stepStartDate: stepStartDate
      };
    } catch (error) {
      console.error('Failed to get ladder progress:', error);
      return {
        activeLadder: null,
        currentStep: null,
        stepStartDate: null
      };
    }
  }

  /**
   * Set ladder and step
   * @param {string} ladderType - 'milk' or 'egg'
   * @param {number} step - Step number
   * @returns {Promise<boolean>}
   */
  async setLadderProgress(ladderType, step) {
    try {
      const stepStartDate = new Date().toISOString();

      await Promise.all([
        AsyncStorage.setItem(this.STORAGE_KEYS.ACTIVE_LADDER, ladderType),
        AsyncStorage.setItem(this.STORAGE_KEYS.CURRENT_STEP, step.toString()),
        AsyncStorage.setItem(this.STORAGE_KEYS.STEP_START_DATE, stepStartDate)
      ]);

      logWithTime('✅ Ladder progress saved:', {
        ladderType,
        step,
        stepStartDate
      });

      return true;
    } catch (error) {
      console.error('Failed to set ladder progress:', error);
      return false;
    }
  }

  /**
   * Update current step (when progressing)
   * @param {number} newStep - New step number
   * @returns {Promise<boolean>}
   */
  async updateStep(newStep) {
    try {
      const stepStartDate = new Date().toISOString();

      await Promise.all([
        AsyncStorage.setItem(this.STORAGE_KEYS.CURRENT_STEP, newStep.toString()),
        AsyncStorage.setItem(this.STORAGE_KEYS.STEP_START_DATE, stepStartDate)
      ]);

      logWithTime('✅ Ladder step updated:', {
        newStep,
        stepStartDate
      });

      return true;
    } catch (error) {
      console.error('Failed to update step:', error);
      return false;
    }
  }

  /**
   * Reset ladder (clear all ladder data)
   * @returns {Promise<boolean>}
   */
  async resetLadder() {
    try {
      await Promise.all([
        AsyncStorage.removeItem(this.STORAGE_KEYS.ACTIVE_LADDER),
        AsyncStorage.removeItem(this.STORAGE_KEYS.CURRENT_STEP),
        AsyncStorage.removeItem(this.STORAGE_KEYS.STEP_START_DATE)
      ]);

      logWithTime('✅ Ladder progress reset');
      return true;
    } catch (error) {
      console.error('Failed to reset ladder:', error);
      return false;
    }
  }

  /**
   * Get formatted ladder info for display
   * @returns {Promise<{ladderName: string|null, stepInfo: string|null, daysOnStep: number|null}>}
   */
  async getFormattedProgress() {
    try {
      const progress = await this.getLadderProgress();

      if (!progress.activeLadder || !progress.currentStep) {
        return {
          ladderName: null,
          stepInfo: null,
          daysOnStep: null
        };
      }

      const ladderName = progress.activeLadder === 'milk' ? 'Milk Ladder' : 'Egg Ladder';
      const stepInfo = `Step ${progress.currentStep}`;

      let daysOnStep = null;
      if (progress.stepStartDate) {
        const startDate = new Date(progress.stepStartDate);
        const now = new Date();
        const diffMs = now - startDate;
        daysOnStep = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }

      return {
        ladderName,
        stepInfo,
        daysOnStep
      };
    } catch (error) {
      console.error('Failed to get formatted progress:', error);
      return {
        ladderName: null,
        stepInfo: null,
        daysOnStep: null
      };
    }
  }

  /**
   * Get foods for current ladder step
   * @returns {Promise<string[]|null>} Array of food names or null if no active ladder
   */
  async getCurrentStepFoods() {
    try {
      const progress = await this.getLadderProgress();

      if (!progress.activeLadder || !progress.currentStep) {
        return null;
      }

      const ladder = progress.activeLadder === 'milk' ? MILK_LADDER : EGG_LADDER;
      const stepData = ladder.find(step => step.step === progress.currentStep);

      return stepData ? stepData.foods : null;
    } catch (error) {
      console.error('Failed to get current step foods:', error);
      return null;
    }
  }

  /**
   * Check if extracted food matches any food in current step (case-insensitive substring)
   * @param {string} extractedFoodName - Food name from note
   * @param {string[]} stepFoods - Foods in current ladder step
   * @returns {string|null} Matched step food name or null
   */
  matchesFoodInStep(extractedFoodName, stepFoods) {
    if (!extractedFoodName || !stepFoods) {
      return null;
    }

    const extractedLower = extractedFoodName.toLowerCase().trim();

    for (const stepFood of stepFoods) {
      const stepFoodLower = stepFood.toLowerCase().trim();

      // Check if extracted food contains step food or vice versa
      if (extractedLower.includes(stepFoodLower) || stepFoodLower.includes(extractedLower)) {
        return stepFood;
      }
    }

    return null;
  }

  /**
   * Count attempts for a specific food since step start date
   * @param {string} foodName - Food to count attempts for
   * @param {Array} allEntries - All saved entries
   * @param {string} stepStartDate - ISO date string
   * @returns {number} Number of attempts
   */
  countFoodAttempts(foodName, allEntries, stepStartDate) {
    if (!foodName || !allEntries || !stepStartDate) {
      return 0;
    }

    const startDate = new Date(stepStartDate);
    const foodLower = foodName.toLowerCase().trim();

    let count = 0;

    for (const entry of allEntries) {
      // Skip if entry is before step start date
      if (entry.timestamp) {
        const entryDate = new Date(entry.timestamp);
        if (entryDate < startDate) continue;
      }

      // Check if this entry contains the food
      if (entry.foods && Array.isArray(entry.foods)) {
        const hasFood = entry.foods.some(foodObj => {
          const extractedLower = foodObj.name.toLowerCase().trim();
          return extractedLower.includes(foodLower) || foodLower.includes(extractedLower);
        });

        if (hasFood) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Convert number to ordinal (1st, 2nd, 3rd, etc.)
   * @param {number} num - Number to convert
   * @returns {string} Ordinal string
   */
  getOrdinal(num) {
    const j = num % 10;
    const k = num % 100;

    if (j === 1 && k !== 11) return `${num}st`;
    if (j === 2 && k !== 12) return `${num}nd`;
    if (j === 3 && k !== 13) return `${num}rd`;

    return `${num}th`;
  }
}

// Export singleton instance
export default LadderService.getInstance();
