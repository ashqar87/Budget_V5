import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { Platform } from 'react-native';

import { accountSchema, categorySchema, categoryBudgetSchema, transactionSchema } from './schema';
import { Account, Category, CategoryBudget, Transaction } from './schema';

// Build the database schema
const schema = {
  tables: [
    accountSchema,
    categorySchema,
    categoryBudgetSchema,
    transactionSchema
  ],
  version: 1,
};

// Create the adapter
const adapter = new SQLiteAdapter({
  schema,
  jsi: Platform.OS === 'ios', // Enable JSI on iOS for better performance
  onSetUpError: error => {
    console.error('Database setup error:', error);
  }
});

// Create and export the database
export const database = new Database({
  adapter,
  modelClasses: [
    Account,
    Category,
    CategoryBudget,
    Transaction
  ],
});

// Initialize default data if needed
export const setupDatabase = async () => {
  try {
    console.log("Setting up database...");
    
    // Create default categories if none exist
    await database.action(async () => {
      const categoriesCollection = database.collections.get('categories');
      const count = await categoriesCollection.query().fetchCount();
      
      if (count === 0) {
        console.log("Creating default categories...");
        // Create default categories
        await categoriesCollection.create(category => {
          category.name = 'Food & Dining';
          category.icon = 'food';
          category.color = '#4CAF50';
          category.createdAt = new Date();
        });
        
        await categoriesCollection.create(category => {
          category.name = 'Housing';
          category.icon = 'home';
          category.color = '#2196F3';
          category.createdAt = new Date();
        });
        
        await categoriesCollection.create(category => {
          category.name = 'Transportation';
          category.icon = 'car';
          category.color = '#FFC107';
          category.createdAt = new Date();
        });
        
        await categoriesCollection.create(category => {
          category.name = 'Entertainment';
          category.icon = 'movie';
          category.color = '#9C27B0';
          category.createdAt = new Date();
        });
        
        await categoriesCollection.create(category => {
          category.name = 'Healthcare';
          category.icon = 'medical-bag';
          category.color = '#F44336';
          category.createdAt = new Date();
        });

        console.log("Default categories created");
      }
    });
    
    console.log("Database setup complete");
    return true;
  } catch (error) {
    console.error('Error during database setup:', error);
    return false;
  }
};