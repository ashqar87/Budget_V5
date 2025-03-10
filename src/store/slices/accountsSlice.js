import { createSlice } from '@reduxjs/toolkit';

// Helper function to ensure date values are serialized
const serializeAccount = (account) => {
  if (!account) return account;
  
  const result = { ...account };
  
  // Convert Date objects to strings
  if (result.createdAt instanceof Date) {
    result.createdAt = result.createdAt.toISOString();
  }
  
  if (result.updatedAt instanceof Date) {
    result.updatedAt = result.updatedAt.toISOString();
  }
  
  return result;
};

// Helper to serialize changes object for updateAccountSuccess
const serializeChanges = (changes) => {
  if (!changes) return changes;
  
  const result = { ...changes };
  
  // Convert updatedAt Date object to string if it exists
  if (result.updatedAt instanceof Date) {
    result.updatedAt = result.updatedAt.toISOString();
  }
  
  return result;
};

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
      // Ensure all accounts have serialized dates
      state.accounts = action.payload.map(serializeAccount);
      
      // Calculate total balance from accounts
      const totalBalance = action.payload.reduce(
        (sum, account) => sum + account.currentBalance, 
        0
      );
      state.totalBalance = totalBalance;
      state.error = null;
    },
    fetchAccountsFailure(state, action) {
      state.status = 'failed';
      state.error = action.payload;
    },
    addAccountSuccess(state, action) {
      // Serialize the account before adding to state
      state.accounts.push(serializeAccount(action.payload));
      state.totalBalance += action.payload.currentBalance;
    },
    updateAccountSuccess(state, action) {
      const { id, changes } = action.payload;
      // Serialize changes before updating state
      const serializedChanges = serializeChanges(changes);
      
      const accountIndex = state.accounts.findIndex(account => account.id === id);
      
      if (accountIndex !== -1) {
        const oldBalance = state.accounts[accountIndex].currentBalance;
        
        // Only update existing account properties
        if (serializedChanges.currentBalance !== undefined) {
          const balanceDifference = serializedChanges.currentBalance - oldBalance;
          state.totalBalance += balanceDifference;
        }
        
        // Update account with changes
        state.accounts[accountIndex] = {
          ...state.accounts[accountIndex],
          ...serializedChanges
        };
      }
    },
    deleteAccountSuccess(state, action) {
      const deletedAccount = state.accounts.find(account => account.id === action.payload);
      if (deletedAccount) {
        state.totalBalance -= deletedAccount.currentBalance;
        state.accounts = state.accounts.filter(account => account.id !== action.payload);
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
  deleteAccountSuccess,
  updateReadyToAssign,
} = accountsSlice.actions;

export default accountsSlice.reducer;