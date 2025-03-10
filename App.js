import React, { useEffect, useRef } from 'react';
import { Provider } from 'react-redux';
import { PaperProvider, DefaultTheme } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogBox, AppState, Platform, Text, View } from 'react-native';
import store from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import { DatabaseProvider } from './src/context/DatabaseContext';

// Customize theme
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2196F3',
    accent: '#03A9F4',
    error: '#F44336',
    success: '#4CAF50',
  },
  roundness: 8,
};

// Ignore specific warnings
LogBox.ignoreLogs([
  'ViewPropTypes will be removed',
  'ColorPropType will be removed',
]);

// Add error boundary component
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.log('App Error:', error);
    console.log('Error Info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 20 }}>
            Something went wrong
          </Text>
          <Text style={{ fontSize: 14, marginBottom: 20, textAlign: 'center' }}>
            {this.state.error?.toString()}
          </Text>
          <Text onPress={() => this.setState({ hasError: false })} 
                style={{ color: '#2196F3', padding: 10 }}>
            Try again
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// App component with additional validation
const App = () => {
  // Track app state changes
  const appState = useRef(AppState.currentState);
  
  // Validate critical dependencies
  useEffect(() => {
    // Ensure Redux is working
    if (!store || typeof store.getState !== 'function') {
      console.error('Redux store is not initialized properly');
    }
    
    const subscription = AppState.addEventListener('change', nextAppState => {
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);
  
  // Ensure store exists before rendering Provider
  if (!store) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Failed to initialize app. Please restart.</Text>
      </View>
    );
  }
  
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <PaperProvider theme={theme}>
          <SafeAreaProvider>
            <DatabaseProvider>
              <NavigationContainer>
                <AppNavigator />
              </NavigationContainer>
            </DatabaseProvider>
          </SafeAreaProvider>
        </PaperProvider>
      </Provider>
    </ErrorBoundary>
  );
};

export default App;