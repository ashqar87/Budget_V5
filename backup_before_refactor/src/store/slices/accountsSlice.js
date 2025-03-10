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
      
      // Calculate total balance from accounts
      const totalBalance = action.payload.reduce(
        (sum, account) => sum + account.currentBalance, 
        0
      );
      state.totalBalance = totalBalance;
      
      // Initialize readyToAssign based on account balances
      // Note: This should only set the initial value and not overwrite it once budgets are assigned
      if (state.readyToAssign === 0) {
        state.readyToAssign = totalBalance;
      }
    },
    fetchAccountsFailure(state, action) {
      state.status = 'failed';
      state.error = action.payload;
    },
    addAccountSuccess(state, action) {
      state.accounts.push(action.payload);
      state.totalBalance += action.payload.currentBalance;
      
      // Add new account balance to ready to assign
      state.readyToAssign += action.payload.currentBalance;
    },
    updateAccountSuccess(state, action) {
      const { id, changes } = action.payload;
      const accountIndex = state.accounts.findIndex(account => account.id === id);
      
      if (accountIndex !== -1) {
        const oldBalance = state.accounts[accountIndex].currentBalance;
        
        // Only update existing account properties
        if (changes.currentBalance !== undefined) {
          const balanceDifference = changes.currentBalance - oldBalance;
          state.totalBalance += balanceDifference;
          
          // Only update readyToAssign for income/expense (not transfers)
          if (!changes.isTransfer) {
            state.readyToAssign += balanceDifference;
          }
        }
        
        // Update account with changes
        state.accounts[accountIndex] = {
          ...state.accounts[accountIndex],
          ...changes
        };
      }
    },
    // This action is called from budgetSlice when assigning to budget
    decreaseReadyToAssign(state, action) {
      const amount = action.payload;
      state.readyToAssign -= amount;
      
      // Ensure it doesn't go negative
      if (state.readyToAssign < 0) state.readyToAssign = 0;
    },
    // This action is called from budgetSlice when un-assigning from budget
    increaseReadyToAssign(state, action) {
      const amount = action.payload;
      state.readyToAssign += amount;
    },
    updateReadyToAssign(state, action) {
      state.readyToAssign = action.payload;
    },
    deleteAccountSuccess(state, action) {
      const deletedAccount = state.accounts.find(account => account.id === action.payload);
      if (deletedAccount) {
        state.totalBalance -= deletedAccount.currentBalance;
        // We don't decrease ready to assign here as the money might be already assigned to budgets
        state.accounts = state.accounts.filter(account => account.id !== action.payload);
      }
    },
    resetReadyToAssign(state) {
      // Calculate total of all budgets already assigned
      // This is a placeholder - the actual calculation would come from the budgets slice
      // This method is only for manual intervention when needed
      state.readyToAssign = state.totalBalance;
    },
    // Add this action to sync with budget totals
    syncWithBudgetAssigned(state, action) {
      const totalBudgetAssigned = action.payload;
      state.readyToAssign = state.totalBalance - totalBudgetAssigned;
      
      // Ensure it doesn't go negative
      if (state.readyToAssign < 0) state.readyToAssign = 0;
    }
  },
});

export const {
  fetchAccountsStart,
  fetchAccountsSuccess,
  fetchAccountsFailure,
  addAccountSuccess,
  updateAccountSuccess,
  decreaseReadyToAssign,
  increaseReadyToAssign,
  updateReadyToAssign,
  deleteAccountSuccess,
  resetReadyToAssign,
  syncWithBudgetAssigned
} = accountsSlice.actions;

export default accountsSlice.reducer;