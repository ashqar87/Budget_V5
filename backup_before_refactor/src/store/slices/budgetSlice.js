import { createSlice } from '@reduxjs/toolkit';
import { format } from 'date-fns';
import { decreaseReadyToAssign, increaseReadyToAssign, syncWithBudgetAssigned } from './accountsSlice';

const initialState = {
  budgets: [],
  currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM format
  status: 'idle',
  error: null,
  totalAssigned: 0,
  totalAvailable: 0,
};

const budgetSlice = createSlice({
  name: 'budget',
  initialState,
  reducers: {
    fetchBudgetsStart(state) {
      state.status = 'loading';
      state.error = null;
    },
    fetchBudgetsSuccess(state, action) {
      state.status = 'succeeded';
      state.budgets = action.payload;
      
      // Calculate totals
      state.totalAssigned = action.payload.reduce(
        (sum, budget) => sum + budget.assigned, 
        0
      );
      state.totalAvailable = action.payload.reduce(
        (sum, budget) => sum + budget.available, 
        0
      );
    },
    fetchBudgetsFailure(state, action) {
      state.status = 'failed';
      state.error = action.payload;
    },
    setCurrentMonth(state, action) {
      state.currentMonth = action.payload;
    },
    addBudgetSuccess(state, action) {
      state.budgets.push(action.payload);
      state.totalAssigned += action.payload.assigned;
      state.totalAvailable += action.payload.available;
    },
    updateBudgetSuccess(state, action) {
      const index = state.budgets.findIndex(
        budget => budget.id === action.payload.id
      );
      if (index !== -1) {
        const oldAssigned = state.budgets[index].assigned;
        const newAssigned = action.payload.changes.assigned !== undefined 
          ? action.payload.changes.assigned 
          : oldAssigned;
        
        // Calculate the difference for total updates
        const assignedDifference = newAssigned - oldAssigned;
        
        // Apply changes to the budget
        state.budgets[index] = {
          ...state.budgets[index],
          ...action.payload.changes
        };
        
        // Update totals if assigned value changed
        if (assignedDifference !== 0) {
          state.totalAssigned += assignedDifference;
          
          // Also update available if it wasn't explicitly set in changes
          if (action.payload.changes.available === undefined) {
            state.budgets[index].available += assignedDifference;
            state.totalAvailable += assignedDifference;
          }
        }
        
        // If available was explicitly changed
        if (action.payload.changes.available !== undefined) {
          const availableDifference = action.payload.changes.available - state.budgets[index].available;
          state.totalAvailable += availableDifference;
        }
      }
    },
    assignToBudgetSuccess(state, action) {
      const { categoryId, amount, previousAssigned } = action.payload;
      const budgetIndex = state.budgets.findIndex(
        budget => budget.category_id === categoryId && budget.month === state.currentMonth
      );
      
      if (budgetIndex !== -1) {
        // Update existing budget
        const difference = amount - previousAssigned;
        state.budgets[budgetIndex].assigned = amount;
        state.budgets[budgetIndex].available += difference;
        state.totalAssigned += difference;
        state.totalAvailable += difference;
      } else if (amount > 0) {
        // Add new budget entry
        state.budgets.push({
          id: `${categoryId}_${state.currentMonth}`,
          category_id: categoryId,
          month: state.currentMonth,
          assigned: amount,
          available: amount,
        });
        state.totalAssigned += amount;
        state.totalAvailable += amount;
      }
    },
    updateBudgetAvailableSuccess(state, action) {
      const { categoryId, availableDifference } = action.payload;
      const budgetIndex = state.budgets.findIndex(
        budget => budget.category_id === categoryId && budget.month === state.currentMonth
      );
      
      if (budgetIndex !== -1) {
        state.budgets[budgetIndex].available += availableDifference;
        state.totalAvailable += availableDifference;
      }
    },
    rolloverBudgetsSuccess(state, action) {
      // Add new month's budgets with carried over available amounts
      const newBudgets = action.payload;
      state.budgets = [...state.budgets, ...newBudgets];
      
      // Recalculate totals if current month
      if (newBudgets.length > 0 && newBudgets[0].month === state.currentMonth) {
        state.totalAssigned = newBudgets.reduce(
          (sum, budget) => sum + budget.assigned, 
          0
        );
        state.totalAvailable = newBudgets.reduce(
          (sum, budget) => sum + budget.available, 
          0
        );
      }
    },
  },
});

// Action creators
export const {
  fetchBudgetsStart,
  fetchBudgetsSuccess,
  fetchBudgetsFailure,
  setCurrentMonth,
  addBudgetSuccess,
  updateBudgetSuccess,
  assignToBudgetSuccess,
  updateBudgetAvailableSuccess,
  rolloverBudgetsSuccess,
} = budgetSlice.actions;

// Thunk to assign to budget and update ready to assign
export const assignToBudgetAndUpdateReadyToAssign = (categoryId, amount, previousAssigned = 0) => {
  return (dispatch) => {
    const difference = amount - previousAssigned;
    
    if (difference > 0) {
      // Assigning more, so decrease readyToAssign
      dispatch(decreaseReadyToAssign(difference));
    } else if (difference < 0) {
      // Assigning less, so increase readyToAssign
      dispatch(increaseReadyToAssign(Math.abs(difference)));
    }
    
    // Update the budget itself
    dispatch(assignToBudgetSuccess({
      categoryId,
      amount,
      previousAssigned
    }));
  };
};

// Thunk to sync totals between accounts and budgets
export const syncAccountsWithBudgets = () => {
  return (dispatch, getState) => {
    const state = getState();
    const { totalAssigned } = state.budget;
    
    // Update account's readyToAssign based on budget assigned
    dispatch(syncWithBudgetAssigned(totalAssigned));
  };
};

export default budgetSlice.reducer;