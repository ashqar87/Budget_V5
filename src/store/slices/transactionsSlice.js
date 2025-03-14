import { createSlice } from '@reduxjs/toolkit';

// Function to ensure date objects are serialized
const serializeTransaction = (transaction) => {
  if (!transaction) return transaction;
  
  const serialized = { ...transaction };
  
  // Convert any Date objects to ISO strings
  if (serialized.date instanceof Date) {
    serialized.date = serialized.date.toISOString();
  }
  if (serialized.createdAt instanceof Date) {
    serialized.createdAt = serialized.createdAt.toISOString();
  }
  if (serialized.updatedAt instanceof Date) {
    serialized.updatedAt = serialized.updatedAt.toISOString();
  }
  
  return serialized;
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
      state.transactions = action.payload.map(serializeTransaction);
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
      state.transactions.unshift(serializeTransaction(action.payload));
    },
    updateTransactionSuccess(state, action) {
      const { id, changes } = action.payload;
      const index = state.transactions.findIndex(transaction => transaction.id === id);
      if (index !== -1) {
        // Ensure date fields are serialized in changes
        const serializedChanges = serializeTransaction(changes);
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