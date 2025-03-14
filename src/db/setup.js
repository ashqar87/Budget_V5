import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyQuery, Q } from './query';
import { Platform } from 'react-native';

// Configure cache settings based on platform
const CACHE_TTL = Platform.OS === 'web' ? 10000 : 60000; // 10s for web, 60s for mobile
const CACHE_DEBOUNCE = Platform.OS === 'web' ? 50 : 300; // 50ms for web, 300ms for mobile

// Add operation queue to prevent concurrent AsyncStorage operations
const operationQueue = {
  queue: [],
  isProcessing: false,
  
  add: function(operation) {
    return new Promise((resolve, reject) => {
      this.queue.push({ operation, resolve, reject });
      if (!this.isProcessing) {
        this.processNext();
      }
    });
  },
  
  processNext: async function() {
    if (this.queue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    this.isProcessing = true;
    const { operation, resolve, reject } = this.queue.shift();
    
    try {
      const result = await operation();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      // Process next operation after a small delay
      setTimeout(() => this.processNext(), 5);
    }
  }
};

// Modify the memoryCache implementation
const memoryCache = {
  data: {},
  timestamp: {},
  pendingOperations: {}, // Track operations in progress
  maxAge: CACHE_TTL, // 1 minute cache
  
  // Get data from cache or AsyncStorage with request deduplication
  get: async (key) => {
    const now = Date.now();
    
    // Return from cache if still valid
    if (
      memoryCache.data[key] && 
      memoryCache.timestamp[key] && 
      now - memoryCache.timestamp[key] < memoryCache.maxAge
    ) {
      return memoryCache.data[key];
    }
    
    // Deduplicate concurrent requests for same key
    if (memoryCache.pendingOperations[key]) {
      try {
        return await memoryCache.pendingOperations[key];
      } catch (error) {
        console.error(`Cache pending operation error for ${key}:`, error);
        delete memoryCache.pendingOperations[key];
      }
    }
    
    // Create a new promise for this operation and add to queue
    const operation = operationQueue.add(async () => {
      try {
        const value = await AsyncStorage.getItem(key);
        const parsed = value ? JSON.parse(value) : [];
        
        // Update cache
        memoryCache.data[key] = parsed;
        memoryCache.timestamp[key] = Date.now();
        
        return parsed;
      } catch (error) {
        console.error(`Cache error for ${key}:`, error);
        throw error;
      } finally {
        // Clear the pending operation
        delete memoryCache.pendingOperations[key];
      }
    });
    
    // Store the pending operation
    memoryCache.pendingOperations[key] = operation;
    
    return operation;
  },
  
  // Update both cache and AsyncStorage with debouncing
  set: async (key, value) => {
    try {
      // Update cache immediately
      memoryCache.data[key] = value;
      memoryCache.timestamp[key] = Date.now();
      
      // Debounce AsyncStorage writes
      if (memoryCache.pendingOperations[`write_${key}`]) {
        clearTimeout(memoryCache.pendingOperations[`write_${key}`]);
      }
      
      // Queue write operation with debounce
      const writePromise = new Promise((resolve) => {
        memoryCache.pendingOperations[`write_${key}`] = setTimeout(() => {
          operationQueue.add(async () => {
            try {
              await AsyncStorage.setItem(key, JSON.stringify(value));
              delete memoryCache.pendingOperations[`write_${key}`];
              return true;
            } catch (error) {
              console.error(`Cache set error for ${key}:`, error);
              return false;
            }
          }).then(resolve);
        }, CACHE_DEBOUNCE);
      });
      
      return true; // Return immediately without waiting for write
    } catch (error) {
      console.error(`Cache set error for ${key}:`, error);
      return false;
    }
  },
  
  // Clear a specific key from cache
  clear: (key) => {
    delete memoryCache.data[key];
    delete memoryCache.timestamp[key];
    
    // Cancel any pending operations
    if (memoryCache.pendingOperations[key]) {
      delete memoryCache.pendingOperations[key];
    }
    if (memoryCache.pendingOperations[`write_${key}`]) {
      clearTimeout(memoryCache.pendingOperations[`write_${key}`]);
      delete memoryCache.pendingOperations[`write_${key}`];
    }
  },
  
  // Clear entire cache
  clearAll: () => {
    // Cancel all pending timeouts
    Object.keys(memoryCache.pendingOperations).forEach(key => {
      if (key.startsWith('write_')) {
        clearTimeout(memoryCache.pendingOperations[key]);
      }
    });
    
    memoryCache.data = {};
    memoryCache.timestamp = {};
    memoryCache.pendingOperations = {};
  }
};

// Add a utility function to ensure date objects are properly handled
const ensureDatesAreSerialized = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = {...obj};
  
  // Convert Date objects to strings for storage
  Object.keys(result).forEach(key => {
    if (result[key] instanceof Date) {
      result[key] = result[key].toISOString();
    } else if (typeof result[key] === 'object' && result[key] !== null) {
      result[key] = ensureDatesAreSerialized(result[key]);
    }
  });
  
  return result;
};

// Mock database interface that mimics WatermelonDB but uses AsyncStorage with memory caching
export const database = {
  collections: {
    get: (name) => ({
      query: (...queryArgs) => {
        const conditions = queryArgs || [];
        
        return {
          fetch: async () => {
            try {
              const items = await memoryCache.get(name);
              return applyQuery(items, conditions);
            } catch (error) {
              console.error(`Error fetching ${name}:`, error);
              return [];
            }
          },
          fetchCount: async () => {
            try {
              const items = await memoryCache.get(name);
              return applyQuery(items, conditions).length;
            } catch (error) {
              console.error(`Error counting ${name}:`, error);
              return 0;
            }
          },
          observe: () => {
            // Create a simple subscription object that mimics RxJS Observable
            let subscribers = [];
            let active = true;
            
            // Immediately fetch and send data to subscribers
            setTimeout(async () => {
              if (!active) return; // Don't execute if already unsubscribed
              
              try {
                const items = await memoryCache.get(name);
                const filteredItems = applyQuery(items, conditions);
                
                if (active) { // Check again in case unsubscribed during await
                  subscribers.forEach(callback => callback(filteredItems));
                }
              } catch (error) {
                console.error(`Error in observe for ${name}:`, error);
              }
            }, 0);
            
            // Return an object that mimics a subscription
            return {
              subscribe: (callback) => {
                subscribers.push(callback);
                
                // Return an unsubscribe function
                return {
                  unsubscribe: () => {
                    active = false;
                    subscribers = subscribers.filter(cb => cb !== callback);
                  }
                };
              }
            };
          }
        };
      },
      find: async (id) => {
        try {
          const items = await memoryCache.get(name);
          return items.find(item => item.id === id) || null;
        } catch (error) {
          console.error(`Error finding in ${name}:`, error);
          return null;
        }
      },
      create: async (creator) => {
        try {
          // First, get the existing items array
          let items = [];
          try {
            const existingData = await memoryCache.get(name);
            items = Array.isArray(existingData) ? [...existingData] : [];
          } catch (error) {
            console.warn(`Failed to get existing ${name}, creating new array`, error);
            items = [];
          }
          
          // Create a new object directly instead of modifying an existing one
          let newRecord = {};
          
          // Add the basic properties
          newRecord.id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          newRecord.createdAt = new Date().toISOString(); 
          newRecord.updatedAt = new Date().toISOString();
          
          // Apply the creator to create the properties
          if (typeof creator === 'function') {
            // Create a temporary object to collect properties
            const tempObj = {};
            creator(tempObj);
            
            // Copy all properties from tempObj to newRecord
            Object.assign(newRecord, tempObj);
          } else if (typeof creator === 'object') {
            // Directly copy properties from the object
            Object.assign(newRecord, creator);
          }
          
          // Ensure all dates are properly serialized
          if (newRecord.createdAt instanceof Date) {
            newRecord.createdAt = newRecord.createdAt.toISOString();
          }
          if (newRecord.updatedAt instanceof Date) {
            newRecord.updatedAt = newRecord.updatedAt.toISOString();
          }
          
          // If creator provided date objects, convert to ISO strings for storage
          for (const [key, value] of Object.entries(newRecord)) {
            if (value instanceof Date) {
              newRecord[key] = value.toISOString();
            }
          }
          
          // Add to items array
          items.push(newRecord);
          
          // Update storage
          await memoryCache.set(name, items);
          
          // Return the created record
          return newRecord;
        } catch (error) {
          console.error(`Error creating in ${name}:`, error.message, error.stack);
          throw error;
        }
      },
      update: async (id, updater) => {
        try {
          const items = await memoryCache.get(name);
          const index = items.findIndex(item => item.id === id);
          
          if (index !== -1) {
            // Make a deep copy of the original item to avoid mutation issues
            const originalItem = JSON.parse(JSON.stringify(items[index]));
            let updatedItem = {...originalItem};
            
            // Apply updates using either function or object
            if (typeof updater === 'function') {
              // Create a clone to pass to the updater function
              const tempItem = {...updatedItem};
              updater(tempItem);
              // Copy updated properties back
              Object.assign(updatedItem, tempItem);
            } else if (typeof updater === 'object') {
              Object.assign(updatedItem, updater);
            }
            
            // Ensure updatedAt is always set
            updatedItem.updatedAt = new Date().toISOString();
            
            // Parse any number fields to ensure they're stored as numbers
            if (updatedItem.assigned !== undefined) {
              updatedItem.assigned = parseFloat(updatedItem.assigned);
            }
            if (updatedItem.available !== undefined) {
              updatedItem.available = parseFloat(updatedItem.available);
            }
            
            // Replace the item in the array
            items[index] = updatedItem;
            
            // Debug the update
            console.log(`Updated ${name} item ${id}:`, {
              before: originalItem,
              after: updatedItem
            });
            
            // Save to storage
            await memoryCache.set(name, items);
            return updatedItem;
          }
          return null;
        } catch (error) {
          console.error(`Error updating in ${name}:`, error);
          throw error;
        }
      },
      delete: async (id) => {
        try {
          const items = await memoryCache.get(name);
          const newItems = items.filter(item => item.id !== id);
          await memoryCache.set(name, newItems);
          return true;
        } catch (error) {
          console.error(`Error deleting from ${name}:`, error);
          throw error;
        }
      },
      // Add markAsDeleted method
      markAsDeleted: async (id) => {
        try {
          const items = await memoryCache.get(name);
          const index = items.findIndex(item => item.id === id);
          
          if (index !== -1) {
            items.splice(index, 1); // Remove the item
            await memoryCache.set(name, items);
            return true;
          }
          return false;
        } catch (error) {
          console.error(`Error marking as deleted in ${name}:`, error);
          throw error;
        }
      }
    }),
  },
  // Support for batch operations
  batch: async (actions) => {
    if (Array.isArray(actions)) {
      for (const action of actions) {
        await action;
      }
    }
    return true;
  },
  // Direct action support
  action: async (callback) => {
    try {
      return await callback();
    } catch (error) {
      console.error('Error in database action:', error);
      throw error;
    }
  },
};

// Initialize default data - optimize to prevent freezing
export const setupDatabase = async () => {
  try {
    console.log("Setting up database with AsyncStorage...");
    
    // Initialize all collections to ensure they exist
    const collections = ['categories', 'category_budgets', 'accounts', 'transactions'];
    
    // Process collections sequentially with non-blocking delays
    for (const collection of collections) {
      try {
        // Add a small delay between collections to avoid UI freezing
        await new Promise(resolve => setTimeout(resolve, 5));
        
        // Try to get existing data
        const value = await AsyncStorage.getItem(collection);
        let data;
        
        try {
          // Parse the data, defaulting to empty array
          data = value ? JSON.parse(value) : [];
          
          // Ensure it's an array
          if (!Array.isArray(data)) {
            console.warn(`${collection} data is not an array, resetting`);
            data = [];
          }
        } catch (parseError) {
          console.error(`Error parsing ${collection} data:`, parseError);
          data = [];
        }
        
        // Initialize the memory cache
        memoryCache.data[collection] = data;
        memoryCache.timestamp[collection] = Date.now();
        
        // If categories are empty, add default ones
        if (collection === 'categories' && data.length === 0) {
          console.log("Creating default categories...");
          
          const defaultCategories = [
            { 
              id: '1', 
              name: 'Food & Dining', 
              icon: 'food', 
              color: '#4CAF50', 
              createdAt: new Date().toISOString(), 
              updatedAt: new Date().toISOString() 
            },
            { 
              id: '2', 
              name: 'Housing', 
              icon: 'home', 
              color: '#2196F3', 
              createdAt: new Date().toISOString(), 
              updatedAt: new Date().toISOString() 
            },
            { 
              id: '3', 
              name: 'Transportation', 
              icon: 'car', 
              color: '#FFC107', 
              createdAt: new Date().toISOString(), 
              updatedAt: new Date().toISOString() 
            },
            { 
              id: '4', 
              name: 'Entertainment', 
              icon: 'movie', 
              color: '#9C27B0', 
              createdAt: new Date().toISOString(), 
              updatedAt: new Date().toISOString() 
            },
            { 
              id: '5', 
              name: 'Healthcare', 
              icon: 'medical-bag', 
              color: '#F44336', 
              createdAt: new Date().toISOString(), 
              updatedAt: new Date().toISOString() 
            }
          ];
          
          memoryCache.data['categories'] = defaultCategories;
          await AsyncStorage.setItem('categories', JSON.stringify(defaultCategories));
          console.log("Default categories created");
        }
      } catch (error) {
        console.error(`Error initializing ${collection}:`, error);
        // Set to empty array on error
        memoryCache.data[collection] = [];
        memoryCache.timestamp[collection] = Date.now();
      }
    }
    
    console.log("Database setup complete");
    return true;
  } catch (error) {
    console.error('Error during database setup:', error);
    return false;
  }
};