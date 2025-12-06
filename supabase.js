import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Debug trace for Supabase configuration
if (typeof console !== 'undefined') {
  console.log('🔍 [SUPABASE CONFIG DEBUG]');
  console.log('  - URL from Constants.expoConfig.extra:', Constants.expoConfig?.extra?.supabaseUrl || 'undefined');
  console.log('  - URL from process.env:', process.env.EXPO_PUBLIC_SUPABASE_URL || 'undefined');
  console.log('  - Final supabaseUrl:', supabaseUrl || 'undefined');
  console.log('  - AnonKey from Constants.expoConfig.extra:', Constants.expoConfig?.extra?.supabaseAnonKey ? `${Constants.expoConfig.extra.supabaseAnonKey.substring(0, 20)}...` : 'undefined');
  console.log('  - AnonKey from process.env:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? `${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...` : 'undefined');
  console.log('  - Final supabaseAnonKey:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'undefined');
}

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file or app.json');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
