import React, { createContext, useContext, useEffect, useState } from 'react';
import { database, setupDatabase } from '../db/setup';

// Create context
const DatabaseContext = createContext(database);

// Provider component
export const DatabaseProvider = ({ children }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        await setupDatabase();
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        setIsReady(true); // Continue anyway to allow app to function
      }
    };

    initializeDatabase();
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