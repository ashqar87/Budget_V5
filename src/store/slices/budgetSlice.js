import { createSlice } from '@reduxjs/toolkit';
import { format } from 'date-fns';

const initialState = {
  budgets: [],
  currentMonth: format(new Date(), 'yyyy-MM'),
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
    assignToBudgetSuccess(state, action) {
      const { categoryId, amount, previousAssigned } = action.payload;
      const budgetIndex = state.budgets.findIndex(
        budget => budget.category.id === categoryId && budget.month === state.currentMonth
      );
      
      if (budgetIndex !== -1) {
        // Update existing budget
        const difference = amount - previousAssigned;
        state.budgets[budgetIndex].assigned = amount;
        state.budgets[budgetIndex].available += difference;
        state.totalAssigned += difference;
        state.totalAvailable += difference;
      } else {
        // Add new budget entry
        state.budgets.push({
          id: `${categoryId}_${state.currentMonth}`,
          category: { id: categoryId },
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
        budget => budget.category.id === categoryId && budget.month === state.currentMonth
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

export const {
  fetchBudgetsStart,
  fetchBudgetsSuccess,
  fetchBudgetsFailure,
  setCurrentMonth,
  assignToBudgetSuccess,
  updateBudgetAvailableSuccess,
  rolloverBudgetsSuccess,
} = budgetSlice.actions;

export default budgetSlice.reducer;