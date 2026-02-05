import Papa from 'papaparse';
import StorageService from './StorageService';

const logWithTime = (message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}]`, message, ...args);
};

// Expected CSV columns (case-insensitive matching)
const COLUMN_MAP = {
  date: ['date'],
  time: ['time'],
  food: ['food'],
  mealType: ['meal type', 'mealtype', 'meal_type'],
  quantity: ['quantity'],
  reactions: ['reactions', 'reaction'],
  transcription: ['transcription', 'notes', 'note', 'text']
};

/**
 * Service for importing food log data from CSV files
 */
class CSVImportService {
  /**
   * Parse a CSV string and return structured import preview data
   * @param {string} csvContent - Raw CSV string
   * @returns {{ rows: Array, columnMap: Object, errors: Array }} Parsed data
   */
  static parseCSV(csvContent) {
    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      trimHeaders: true
    });

    if (result.errors.length > 0) {
      logWithTime('[CSVImport] Parse warnings:', result.errors);
    }

    // Build a map from our expected keys to actual CSV column headers
    const headers = result.meta.fields || [];
    const columnMap = this.mapColumns(headers);

    logWithTime('[CSVImport] Detected columns:', { headers, columnMap });

    return {
      rows: result.data,
      columnMap,
      parseErrors: result.errors
    };
  }

  /**
   * Map CSV column headers to our expected keys (case-insensitive)
   * @param {string[]} headers - Actual CSV headers
   * @returns {Object} Map of our keys to actual header names
   */
  static mapColumns(headers) {
    const map = {};
    const headersLower = headers.map(h => h.toLowerCase().trim());

    for (const [key, aliases] of Object.entries(COLUMN_MAP)) {
      const matchIndex = headersLower.findIndex(h => aliases.includes(h));
      if (matchIndex !== -1) {
        map[key] = headers[matchIndex]; // Store the original-case header
      }
    }

    return map;
  }

  /**
   * Validate that required columns are present
   * @param {Object} columnMap - Mapped columns
   * @returns {{ valid: boolean, missing: string[] }}
   */
  static validateColumns(columnMap) {
    const required = ['date', 'time', 'food'];
    const missing = required.filter(col => !columnMap[col]);

    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Parse a DD/MM/YYYY date and HH:MM time into an ISO 8601 timestamp
   * @param {string} dateStr - DD/MM/YYYY
   * @param {string} timeStr - HH:MM
   * @returns {string|null} ISO timestamp or null if invalid
   */
  static parseTimestamp(dateStr, timeStr) {
    try {
      const dateParts = dateStr.trim().split('/');
      if (dateParts.length !== 3) return null;

      const day = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1; // JS months are 0-indexed
      const year = parseInt(dateParts[2], 10);

      const timeParts = timeStr.trim().split(':');
      if (timeParts.length < 2) return null;

      const hours = parseInt(timeParts[0], 10);
      const minutes = parseInt(timeParts[1], 10);

      const date = new Date(year, month, day, hours, minutes, 0);

      // Sanity check - if any component is NaN, the date is invalid
      if (isNaN(date.getTime())) return null;

      return date.toISOString();
    } catch (error) {
      logWithTime('[CSVImport] Failed to parse timestamp:', { dateStr, timeStr, error });
      return null;
    }
  }

  /**
   * Parse the reactions column string into a structured reaction object
   * Expected format: "type (severity): description"
   * e.g. "skin (moderate): swelling around her mouth"
   * @param {string} reactionStr - Reactions column value
   * @returns {Object|null} Parsed reaction or null if empty
   */
  static parseReaction(reactionStr) {
    if (!reactionStr || !reactionStr.trim()) return null;

    const str = reactionStr.trim();

    // Try to match pattern: "type (severity): description"
    const match = str.match(/^(\w+)\s*\((\w+)\)\s*:\s*(.+)$/);
    if (match) {
      return {
        type: match[1].toLowerCase(),
        severity: match[2].toLowerCase(),
        description: match[3].trim()
      };
    }

    // Fallback: treat the whole string as description
    return {
      type: 'unknown',
      severity: 'unknown',
      description: str
    };
  }

  /**
   * Transform parsed CSV rows into note objects, grouped by timestamp
   * @param {Array} rows - Parsed CSV rows
   * @param {Object} columnMap - Column header mapping
   * @param {string} userId - Current user ID
   * @returns {{ notes: Array, skippedRows: number }} Transformed notes and count of skipped rows
   */
  static transformRows(rows, columnMap, userId) {
    const notesByTimestamp = new Map();
    let skippedRows = 0;

    for (const row of rows) {
      const dateVal = row[columnMap.date]?.trim();
      const timeVal = row[columnMap.time]?.trim();
      const foodVal = row[columnMap.food]?.trim();

      // Skip rows missing required fields
      if (!dateVal || !timeVal || !foodVal) {
        logWithTime('[CSVImport] Skipping row - missing required fields:', { dateVal, timeVal, foodVal });
        skippedRows++;
        continue;
      }

      // Parse timestamp
      const timestamp = this.parseTimestamp(dateVal, timeVal);
      if (!timestamp) {
        logWithTime('[CSVImport] Skipping row - invalid timestamp:', { dateVal, timeVal });
        skippedRows++;
        continue;
      }

      // Extract optional fields
      const mealType = columnMap.mealType ? (row[columnMap.mealType]?.trim() || 'unknown') : 'unknown';
      const quantity = columnMap.quantity ? (row[columnMap.quantity]?.trim() || '') : '';
      const reactionStr = columnMap.reactions ? row[columnMap.reactions]?.trim() : '';
      const transcription = columnMap.transcription ? row[columnMap.transcription]?.trim() : '';

      // Build food object for this row
      const food = { name: foodVal, mealType, quantity };

      // Parse reaction if present
      const reaction = this.parseReaction(reactionStr);

      // Group by timestamp - rows with same date+time belong to the same note
      if (!notesByTimestamp.has(timestamp)) {
        notesByTimestamp.set(timestamp, {
          timestamp,
          transcription,
          foods: [],
          reactions: []
        });
      }

      const group = notesByTimestamp.get(timestamp);
      group.foods.push(food);

      // Add reaction if present and not already added (avoid duplicates within a group)
      if (reaction) {
        const isDuplicate = group.reactions.some(
          r => r.type === reaction.type && r.severity === reaction.severity && r.description === reaction.description
        );
        if (!isDuplicate) {
          group.reactions.push(reaction);
        }
      }
    }

    // Convert grouped data into note objects
    const notes = Array.from(notesByTimestamp.values()).map(group => ({
      id: `import_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      user_id: userId,
      timestamp: group.timestamp,
      text: group.transcription || 'Imported note',
      foods: group.foods,
      reactions: group.reactions,
      source: 'import',
      processingStatus: 'completed'
    }));

    logWithTime('[CSVImport] Transformed', rows.length, 'rows into', notes.length, 'notes (skipped', skippedRows, 'rows)');

    return { notes, skippedRows };
  }

  /**
   * Filter out notes that already exist (matched by timestamp)
   * @param {Array} notes - Notes to import
   * @param {Array} existingEntries - Currently saved entries
   * @returns {{ newNotes: Array, skippedCount: number }}
   */
  static deduplicateNotes(notes, existingEntries) {
    const existingTimestamps = new Set(existingEntries.map(e => e.timestamp));
    const newNotes = [];
    let skippedCount = 0;

    for (const note of notes) {
      if (existingTimestamps.has(note.timestamp)) {
        logWithTime('[CSVImport] Skipping duplicate note at timestamp:', note.timestamp);
        skippedCount++;
      } else {
        newNotes.push(note);
      }
    }

    return { newNotes, skippedCount };
  }

  /**
   * Full import pipeline: parse → validate → transform → deduplicate → save
   * @param {string} csvContent - Raw CSV file content
   * @param {string} userId - Current user ID
   * @returns {{ success: boolean, importedCount: number, skippedDuplicates: number, skippedRows: number, totalRows: number, error: string|null }}
   */
  static async importCSV(csvContent, userId) {
    try {
      // 1. Parse
      const { rows, columnMap } = this.parseCSV(csvContent);

      // 2. Validate columns
      const { valid, missing } = this.validateColumns(columnMap);
      if (!valid) {
        logWithTime('[CSVImport] Missing required columns:', missing);
        return { success: false, error: 'missing_columns', missing };
      }

      if (rows.length === 0) {
        return { success: false, error: 'no_rows' };
      }

      // 3. Transform rows into notes
      const { notes, skippedRows } = this.transformRows(rows, columnMap, userId);

      if (notes.length === 0) {
        return { success: false, error: 'no_valid_rows', skippedRows, totalRows: rows.length };
      }

      // 4. Deduplicate against existing data
      const existingEntries = await StorageService.getFoodLogs();
      const { newNotes, skippedCount: skippedDuplicates } = this.deduplicateNotes(notes, existingEntries);

      logWithTime('[CSVImport] Import summary: total rows =', rows.length,
        ', notes =', notes.length,
        ', new =', newNotes.length,
        ', duplicates =', skippedDuplicates,
        ', skipped rows =', skippedRows);

      // 5. Save new notes
      for (const note of newNotes) {
        await StorageService.saveFoodLogEntry(note);
      }

      return {
        success: true,
        importedCount: newNotes.length,
        skippedDuplicates,
        skippedRows,
        totalRows: rows.length,
        error: null
      };
    } catch (error) {
      logWithTime('[CSVImport] ❌ Import failed:', error);
      return { success: false, error: 'import_failed', details: error.message };
    }
  }

  /**
   * Get a preview of what will be imported (row count, existing note count)
   * without actually saving anything
   * @param {string} csvContent - Raw CSV file content
   * @returns {{ valid: boolean, rowCount: number, noteCount: number, existingCount: number, error: string|null }}
   */
  static async getImportPreview(csvContent) {
    try {
      const { rows, columnMap } = this.parseCSV(csvContent);

      const { valid, missing } = this.validateColumns(columnMap);
      if (!valid) {
        logWithTime('[CSVImport] Preview - missing columns:', missing);
        return { valid: false, error: 'missing_columns' };
      }

      if (rows.length === 0) {
        return { valid: false, error: 'no_rows' };
      }

      // Dry-run transform to count notes
      const { notes, skippedRows } = this.transformRows(rows, columnMap, 'preview');

      // Check for duplicates
      const existingEntries = await StorageService.getFoodLogs();
      const { newNotes, skippedCount } = this.deduplicateNotes(notes, existingEntries);

      return {
        valid: true,
        rowCount: rows.length,
        noteCount: newNotes.length,
        duplicateCount: skippedCount,
        existingCount: existingEntries.length,
        skippedRows,
        error: null
      };
    } catch (error) {
      logWithTime('[CSVImport] Preview failed:', error);
      return { valid: false, error: 'preview_failed' };
    }
  }
}

export default CSVImportService;
