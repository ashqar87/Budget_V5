import React, { createContext, useContext, useEffect, useState } from 'react';
import { database, setupDatabase } from '../db/setup';
import { ActivityIndicator, View } from 'react-native';

// Create context
const DatabaseContext = createContext(database);

// Provider component
export const DatabaseProvider = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    // Move database initialization to a non-blocking operation
    const timer = setTimeout(() => {
      const initializeDatabase = async () => {
        try {
          await setupDatabase();
          setIsReady(true);
        } catch (error) {
          console.error('Failed to initialize database:', error);
          setIsError(true);
          // Continue anyway to allow app to function
          setIsReady(true); 
        }
      };
  
      initializeDatabase();
    }, 10); // Small delay to allow UI to render first
    
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  // Wrap the returned provider in a non-blocking setTimeout
  // This prevents deep component trees from freezing the UI
  return (
    <DatabaseContext.Provider value={database}>
      {children}
    </DatabaseContext.Provider>
  );
};

// Custom hook for using the database with error handling
export const useDatabase = () => {
  const db = useContext(DatabaseContext);
  if (!db) {
    console.warn('useDatabase must be used within a DatabaseProvider');
    return {}; // Return empty object instead of failing
  }
  return db;
};

export default DatabaseContext;