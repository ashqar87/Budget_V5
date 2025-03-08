import React, { createContext, useContext, useState, useEffect } from 'react';
import { synchronize } from '@nozbe/watermelondb/sync';

// Import database from setup.js
import { database, setupDatabase } from '../db/setup';

// Create context
const DatabaseContext = createContext(database);

// Provider component
export const DatabaseProvider = ({ children }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const setupInitialData = async () => {
      try {
        // Use setupDatabase from setup.js instead of duplicating the logic
        const success = await setupDatabase();
        if (!success) {
          console.warn('Database setup might have had issues');
        }
        setIsReady(true);
      } catch (error) {
        console.error('Error setting up initial data:', error);
        setIsReady(true); // Continue anyway
      }
    };
    
    setupInitialData();
  }, []);

  if (!isReady) {
    return null; // Or a loading indicator
  }

  return (
    <DatabaseContext.Provider value={database}>
      {children}
    </DatabaseContext.Provider>
  );
};

// Custom hook for using the database
export const useDatabase = () => useContext(DatabaseContext);

export default DatabaseContext;