import { createSlice } from '@reduxjs/toolkit';

// Helper function to ensure dates are serialized
const serializeDate = (obj) => {
  if (!obj) return obj;
  
  // Create a shallow copy to avoid mutating the original object
  const result = {...obj};
  
  // Convert Date objects to strings
  if (result.createdAt instanceof Date) {
    result.createdAt = result.createdAt.toISOString();
  }
  if (result.updatedAt instanceof Date) {
    result.updatedAt = result.updatedAt.toISOString();
  }
  
  return result;
};

const initialState = {
  transactions: [],
  status: 'idle',
  error: null,
  filters: {},
};

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    fetchTransactionsStart(state) {
      state.status = 'loading';
    },
    fetchTransactionsSuccess(state, action) {
      state.status = 'succeeded';
      // Ensure all transaction dates are serialized
      state.transactions = action.payload.map(serializeDate);
      state.error = null;
    },
    fetchTransactionsFailure(state, action) {
      state.status = 'failed';
      state.error = action.payload;
    },
    updateFilters(state, action) {
      // Only update if there are actual changes to prevent unnecessary rerenders
      const newFilters = { ...state.filters, ...action.payload };
      
      // Remove null/undefined values
      Object.keys(newFilters).forEach(key => {
        if (newFilters[key] === null || newFilters[key] === undefined) {
          delete newFilters[key];
        }
      });
      
      // Only update state if filters actually changed
      if (JSON.stringify(newFilters) !== JSON.stringify(state.filters)) {
        state.filters = newFilters;
      }
    },
    clearFilters(state) {
      state.filters = {};
    },
    addTransactionSuccess(state, action) {
      // Ensure the transaction is serialized
      state.transactions.unshift(serializeDate(action.payload));
    },
    updateTransactionSuccess(state, action) {
      const { id, changes } = action.payload;
      const index = state.transactions.findIndex(transaction => transaction.id === id);
      if (index !== -1) {
        // Ensure date fields are serialized in changes
        const serializedChanges = serializeDate(changes);
        state.transactions[index] = { ...state.transactions[index], ...serializedChanges };
      }
    },
    deleteTransactionSuccess(state, action) {
      state.transactions = state.transactions.filter(
        transaction => transaction.id !== action.payload
      );
    },
  },
});

export const {
  fetchTransactionsStart,
  fetchTransactionsSuccess,
  fetchTransactionsFailure,
  updateFilters,
  clearFilters,
  addTransactionSuccess,
  updateTransactionSuccess,
  deleteTransactionSuccess,
} = transactionsSlice.actions;

export default transactionsSlice.reducer;