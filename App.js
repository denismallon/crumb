import React, { useState, useEffect } from 'react';
import SettingsScreen from './SettingsScreen';
import ManageNotesScreen from './ManageNotesScreen';
import AddNotesScreen from './AddNotesScreen';
import BackgroundProcessingService from './BackgroundProcessingService';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('manage'); // 'manage' | 'add' | 'settings'

  useEffect(() => {
    // Initialize background processing service
    // This will start processing any notes that were left in processing state
    BackgroundProcessingService.processQueue();
  }, []);

  const handleAddNote = () => {
    setCurrentScreen('add');
  };

  const handleCloseAddNote = () => {
    setCurrentScreen('manage');
  };

  const openSettings = () => {
    setCurrentScreen('settings');
  };

  if (currentScreen === 'add') {
    return <AddNotesScreen onClose={handleCloseAddNote} />;
  }

  if (currentScreen === 'settings') {
    return <SettingsScreen onClose={() => setCurrentScreen('manage')} />;
  }

  return <ManageNotesScreen onAddNote={handleAddNote} onOpenSettings={openSettings} />;
}
