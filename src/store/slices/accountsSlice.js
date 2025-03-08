import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  accounts: [],
  totalBalance: 0,
  readyToAssign: 0,
  status: 'idle',
  error: null,
};

const accountsSlice = createSlice({
  name: 'accounts',
  initialState,
  reducers: {
    fetchAccountsStart(state) {
      state.status = 'loading';
    },
    fetchAccountsSuccess(state, action) {
      state.status = 'succeeded';
      state.accounts = action.payload;
      state.totalBalance = action.payload.reduce(
        (sum, account) => sum + account.currentBalance, 
        0
      );
    },
    fetchAccountsFailure(state, action) {
      state.status = 'failed';
      state.error = action.payload;
    },
    addAccountSuccess(state, action) {
      state.accounts.push(action.payload);
      state.totalBalance += action.payload.currentBalance;
      state.readyToAssign += action.payload.currentBalance;
    },
    updateAccountSuccess(state, action) {
      const { id, changes } = action.payload;
      const accountIndex = state.accounts.findIndex(account => account.id === id);
      
      if (accountIndex !== -1) {
        const oldBalance = state.accounts[accountIndex].currentBalance;
        state.accounts[accountIndex] = { ...state.accounts[accountIndex], ...changes };
        
        if (changes.currentBalance !== undefined) {
          const balanceDifference = changes.currentBalance - oldBalance;
          state.totalBalance += balanceDifference;
          state.readyToAssign += balanceDifference;
        }
      }
    },
    updateReadyToAssign(state, action) {
      state.readyToAssign = action.payload;
    },
  },
});

export const {
  fetchAccountsStart,
  fetchAccountsSuccess,
  fetchAccountsFailure,
  addAccountSuccess,
  updateAccountSuccess,
  updateReadyToAssign,
} = accountsSlice.actions;

export default accountsSlice.reducer;