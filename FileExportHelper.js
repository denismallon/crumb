import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const logWithTime = (message, ...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  console.log(`[${timestamp}]`, message, ...args);
};

/**
 * Helper for exporting files on web and mobile platforms
 */
class FileExportHelper {
  /**
   * Export CSV file - downloads on web, shares on mobile
   * @param {string} csvContent - CSV content as string
   * @param {string} filename - Desired filename (e.g., 'crumb-export-2024-01-15.csv')
   * @returns {Promise<boolean>} Success status
   */
  static async exportCSV(csvContent, filename = 'crumb-export.csv') {
    try {
      if (!csvContent) {
        throw new Error('No content to export');
      }

      if (Platform.OS === 'web') {
        return await this.downloadCSVWeb(csvContent, filename);
      } else {
        return await this.shareCSVMobile(csvContent, filename);
      }
    } catch (error) {
      console.error('Failed to export CSV:', error);
      return false;
    }
  }

  /**
   * Download CSV file on web browser
   * @param {string} csvContent - CSV content
   * @param {string} filename - Filename
   * @returns {Promise<boolean>} Success status
   */
  static async downloadCSVWeb(csvContent, filename) {
    try {
      logWithTime('[FileExport] Downloading CSV on web');

      // Create a Blob with CSV content
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

      // Create download link
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      URL.revokeObjectURL(url);

      logWithTime('[FileExport] CSV downloaded successfully');
      return true;
    } catch (error) {
      console.error('Failed to download CSV on web:', error);
      return false;
    }
  }

  /**
   * Share CSV file on mobile (iOS/Android)
   * @param {string} csvContent - CSV content
   * @param {string} filename - Filename
   * @returns {Promise<boolean>} Success status
   */
  static async shareCSVMobile(csvContent, filename) {
    try {
      logWithTime('[FileExport] Sharing CSV on mobile');

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing is not available on this device');
      }

      // Create file path in cache directory
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;

      // Write CSV content to file
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8
      });

      logWithTime('[FileExport] File written to:', fileUri);

      // Share the file
      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Crumb Data',
        UTI: 'public.comma-separated-values-text'
      });

      logWithTime('[FileExport] CSV shared successfully');
      return true;
    } catch (error) {
      console.error('Failed to share CSV on mobile:', error);
      return false;
    }
  }

  /**
   * Generate filename with current date
   * @returns {string} Filename like 'crumb-export-2024-01-15.csv'
   */
  static generateFilename() {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return `crumb-export-${dateStr}.csv`;
  }
}

export default FileExportHelper;
