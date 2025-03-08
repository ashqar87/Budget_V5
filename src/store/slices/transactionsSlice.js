import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  transactions: [],
  status: 'idle',
  error: null,
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
      state.transactions = action.payload;
    },
    fetchTransactionsFailure(state, action) {
      state.status = 'failed';
      state.error = action.payload;
    },
    addTransactionSuccess(state, action) {
      state.transactions.push(action.payload);
    },
    updateTransactionSuccess(state, action) {
      const { id, changes } = action.payload;
      const index = state.transactions.findIndex(transaction => transaction.id === id);
      if (index !== -1) {
        state.transactions[index] = { ...state.transactions[index], ...changes };
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
  addTransactionSuccess,
  updateTransactionSuccess,
  deleteTransactionSuccess,
} = transactionsSlice.actions;

export default transactionsSlice.reducer;