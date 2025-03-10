import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import accountsReducer from './slices/accountsSlice';
import transactionsReducer from './slices/transactionsSlice';
import categoriesReducer from './slices/categoriesSlice';
import budgetReducer from './slices/budgetSlice';

// Create a more robust store configuration
const store = configureStore({
  reducer: {
    auth: authReducer,
    accounts: accountsReducer,
    transactions: transactionsReducer,
    categories: categoriesReducer,
    budget: budgetReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore certain paths for serialization to avoid warnings about non-serializable values
        ignoredActions: ['budget/fetchBudgetsSuccess', 'transactions/fetchTransactionsSuccess'],
        ignoredPaths: ['budget.budgets', 'transactions.transactions'],
      },
      immutableCheck: { warnAfter: 300 }, // Give more time before warning
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// Add a safety check to help with debugging
if (!store || typeof store.getState !== 'function') {
  console.error('Store initialization failed! This will cause errors in the app.');
}

// Export the store as default
export default store;

// For debugging - log the initial state
console.log('Initial Redux State:', store.getState());