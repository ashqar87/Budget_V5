import React, { useEffect, useState } from 'react';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { Provider as StoreProvider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActivityIndicator, View, Text } from 'react-native';

import { store } from './src/store';
import { DatabaseProvider } from './src/context/DatabaseContext';
import AppNavigator from './src/navigation/AppNavigator';
import { setupDatabase } from './src/db/setup';

// Define theme
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2196F3',
    accent: '#03A9F4',
    background: '#F5F5F5',
    surface: '#FFFFFF',
    text: '#212121',
    error: '#D32F2F',
    success: '#4CAF50',
  },
};

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function initializeApp() {
      try {
        console.log("Initializing app...");
        await setupDatabase();
        console.log("Database setup complete");
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setError(error.message);
        setIsReady(true); // Continue anyway to show error message
      }
    }

    initializeApp();
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Loading Budget Wise App...</Text>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: 'red' }}>
          Error Initializing App
        </Text>
        <Text style={{ marginBottom: 20 }}>{error}</Text>
        <Text>Please check the console for more details.</Text>
      </View>
    );
  }

  return (
    <StoreProvider store={store}>
      <PaperProvider theme={theme}>
        <DatabaseProvider>
          <SafeAreaProvider>
            <NavigationContainer>
              <StatusBar style="auto" />
              <AppNavigator />
            </NavigationContainer>
          </SafeAreaProvider>
        </DatabaseProvider>
      </PaperProvider>
    </StoreProvider>
  );
}