import { database } from '../db/setup';
import { format, subMonths, parseISO, addMonths } from 'date-fns';

/**
 * Core function: Calculate ready to assign amount
 * Ready to assign = Total account balance - Total assigned this month
 * @param {string} month - Current month in YYYY-MM format
 */
export const calculateReadyToAssign = async (month) => {
  try {
    // 1. Get total account balance
    const accountsCollection = database.collections.get('accounts');
    const accounts = await accountsCollection.query().fetch();
    const totalAccountBalance = accounts.reduce(
      (sum, account) => sum + account.currentBalance,
      0
    );
    
    // 2. Get total assigned for current month
    const budgetsCollection = database.collections.get('category_budgets');
    const budgets = await budgetsCollection.query().fetch();
    const currentMonthBudgets = budgets.filter(b => b.month === month);
    const totalAssigned = currentMonthBudgets.reduce(
      (sum, budget) => sum + budget.assigned,
      0
    );
    
    // 3. Ready to assign is the difference (minimum 0)
    return Math.max(0, totalAccountBalance - totalAssigned);
  } catch (error) {
    console.error('Error calculating ready to assign:', error);
    return 0;
  }
};

/**
 * Core function: Get or create budget for category in month
 * Handles automatic rollover from previous month
 */
export const getOrCreateBudget = async (categoryId, month) => {
  try {
    const budgetsCollection = database.collections.get('category_budgets');
    
    // Check if budget already exists
    const existingBudgets = await budgetsCollection.query().fetch();
    const existingBudget = existingBudgets.find(
      b => b.category_id === categoryId && b.month === month
    );
    
    if (existingBudget) {
      return existingBudget;
    }
    
    // Budget doesn't exist - determine starting available from previous month
    const previousMonth = format(subMonths(parseISO(`${month}-01`), 1), 'yyyy-MM');
    const previousBudget = existingBudgets.find(
      b => b.category_id === categoryId && b.month === previousMonth
    );
    
    // Get the previous available amount for rollover
    const startingAvailable = previousBudget ? previousBudget.available : 0;
    
    console.log(`Creating new budget for ${categoryId} in ${month} with rollover amount: ${startingAvailable}`);
    
    // Create new budget with rolled over available amount
    const newBudget = await budgetsCollection.create({
      category_id: categoryId,
      month: month,
      assigned: 0,
      available: startingAvailable, // Use previous month's available as starting point
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return newBudget;
  } catch (error) {
    console.error(`Error getting/creating budget:`, error);
    return null;
  }
};

/**
 * Core function: Assign money to a category
 * Updates budget and returns the amount to update readyToAssign by
 */
export const assignToBudget = async (categoryId, month, amount, dispatch = null) => {
  try {
    // Get or create the budget for this category and month
    const budget = await getOrCreateBudget(categoryId, month);
    
    if (!budget) {
      throw new Error('Failed to get or create budget');
    }
    
    // Calculate difference for readyToAssign update
    const previousAmount = budget.assigned;
    const difference = amount - previousAmount;
    
    console.log(`Assigning budget for ${categoryId} in ${month}: ${previousAmount} -> ${amount} (diff: ${difference})`);
    console.log(`Updating available: ${budget.available} -> ${budget.available + difference}`);
    
    // Calculate the new available balance (preserving existing available plus the difference)
    const newAvailable = budget.available + difference;
    
    // Important fix: Create a complete object for update rather than using function updater
    // This ensures the values are correctly set in AsyncStorage
    const budgetsCollection = database.collections.get('category_budgets');
    
    // First perform the update with exact values
    await budgetsCollection.update(budget.id, {
      assigned: parseFloat(amount),
      available: parseFloat(newAvailable),
      updatedAt: new Date()
    });
    
    // Verify the update was successful - important debugging step
    const updatedBudget = await budgetsCollection.find(budget.id);
    console.log(`Verification - Budget saved: assigned=${updatedBudget.assigned}, available=${updatedBudget.available}`);
    
    // Update Redux only after confirming database update succeeded
    if (dispatch && updatedBudget) {
      try {
        // Dispatch action with confirmed values from database, not calculated values
        dispatch({
          type: 'budget/updateBudgetSuccess',
          payload: {
            id: budget.id,
            changes: {
              assigned: updatedBudget.assigned,
              available: updatedBudget.available
            }
          }
        });
        
        // Update readyToAssign based on the actual difference
        const actualDifference = updatedBudget.assigned - previousAmount;
        if (actualDifference > 0) {
          dispatch({
            type: 'accounts/decreaseReadyToAssign',
            payload: actualDifference
          });
        } else if (actualDifference < 0) {
          dispatch({
            type: 'accounts/increaseReadyToAssign',
            payload: Math.abs(actualDifference)
          });
        }
      } catch (dispatchError) {
        console.error('Error dispatching Redux actions:', dispatchError);
      }
    }
    
    // Return verified values from database, not calculated values
    return {
      budgetId: budget.id,
      assigned: updatedBudget.assigned,
      available: updatedBudget.available,
      difference
    };
  } catch (error) {
    console.error('Error assigning to budget:', error);
    return false;
  }
};

/**
 * Core function: Record transaction impact on category budget
 * Called whenever a transaction is created or modified
 */
export const updateBudgetFromTransaction = async (transaction, oldTransaction = null) => {
  // Only affect budgets for expense transactions with a category
  if (transaction.type !== 'expense' || !transaction.category_id) {
    return null;
  }
  
  try {
    const transactionMonth = format(new Date(transaction.date), 'yyyy-MM');
    const transactionAmount = transaction.amount;
    
    // If updating a transaction, calculate the net change in amount
    let amountDifference = transactionAmount;
    if (oldTransaction && 
        oldTransaction.type === 'expense' && 
        oldTransaction.category_id === transaction.category_id) {
      amountDifference = transactionAmount - oldTransaction.amount;
    }
    
    // Get or create budget for this category/month
    const budget = await getOrCreateBudget(transaction.category_id, transactionMonth);
    if (!budget) {
      throw new Error('Failed to get or create budget for transaction');
    }
    
    // Update the available amount (negative because expenses reduce available)
    const newAvailable = budget.available - amountDifference;
    
    // Update database
    const budgetsCollection = database.collections.get('category_budgets');
    await budgetsCollection.update(budget.id, budgetRecord => {
      budgetRecord.available = newAvailable;
      budgetRecord.updatedAt = new Date();
    });
    
    return {
      budgetId: budget.id,
      available: newAvailable
    };
  } catch (error) {
    console.error('Error updating budget from transaction:', error);
    return null;
  }
};

/**
 * Ensure budgets exist for all categories in a month
 * This creates new budget entries with proper rollovers for any categories without one
 */
export const ensureAllCategoryBudgets = async (month) => {
  try {
    // Get all categories
    const categoriesCollection = database.collections.get('categories');
    const categories = await categoriesCollection.query().fetch();
    
    if (!categories || categories.length === 0) {
      return [];
    }
    
    console.log(`Ensuring budgets for ${month} for ${categories.length} categories`);
    
    // Get adjacent months to check for rollovers
    const currentDate = parseISO(`${month}-01`);
    const previousMonth = format(subMonths(currentDate, 1), 'yyyy-MM');
    const nextMonth = format(addMonths(currentDate, 1), 'yyyy-MM');
    
    // Get existing budgets for current, previous and next month
    const budgetsCollection = database.collections.get('category_budgets');
    const allBudgets = await budgetsCollection.query().fetch();
    const existingBudgetsForMonth = allBudgets.filter(b => b.month === month);
    const previousMonthBudgets = allBudgets.filter(b => b.month === previousMonth);
    const nextMonthBudgets = allBudgets.filter(b => b.month === nextMonth);
    
    // Track which categories already have budgets for this month
    const existingCategoryIds = existingBudgetsForMonth.map(b => b.category_id);
    
    // Create budgets for each category that doesn't have one
    const newBudgets = [];
    for (const category of categories) {
      // Skip if this category already has a budget for this month
      if (existingCategoryIds.includes(category.id)) {
        continue;
      }
      
      // For previous months:
      // - Check if we have data in next month that can help us determine what should be here
      // - This helps when navigating backward from a month with data to a month with no data
      let startingAvailable = 0;
      const isCurrentOrFutureMonth = new Date(`${month}-01`) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      
      if (isCurrentOrFutureMonth) {
        // Forward rollover - from previous month
        const previousBudget = previousMonthBudgets.find(b => b.category_id === category.id);
        startingAvailable = previousBudget ? previousBudget.available : 0;
        console.log(`Creating forward budget for ${category.id} in ${month} with rollover: ${startingAvailable}`);
      } else {
        // Backward fill - check the next month's budget to see what this month should have had
        const nextBudget = nextMonthBudgets.find(b => b.category_id === category.id);
        if (nextBudget) {
          // If next month has a carried-over amount, that came from this month
          const carriedOver = nextBudget.available - nextBudget.assigned;
          if (carriedOver > 0) {
            startingAvailable = carriedOver;
            console.log(`Backward filling budget for ${category.id} in ${month} with value: ${startingAvailable}`);
          }
        }
      }
      
      // Create new budget with proper rollover or backward fill
      const newBudget = await budgetsCollection.create({
        category_id: category.id,
        month: month,
        assigned: 0,
        available: startingAvailable,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      newBudgets.push(newBudget);
    }
    
    // Also check for any existing budgets that might need their available amount fixed
    for (const budget of existingBudgetsForMonth) {
      const previousBudget = previousMonthBudgets.find(b => b.category_id === budget.category_id);
      
      // If previous budget exists and available is not rolled over properly
      if (previousBudget && budget.assigned === 0 && budget.available === 0 && previousBudget.available > 0) {
        console.log(`Fixing rollover for ${budget.category_id}: updating available from 0 to ${previousBudget.available}`);
        
        await budgetsCollection.update(budget.id, budgetToUpdate => {
          budgetToUpdate.available = previousBudget.available;
          budgetToUpdate.updatedAt = new Date();
        });
      }
    }
    
    console.log(`Created ${newBudgets.length} new budgets for ${month}`);
    return newBudgets;
  } catch (error) {
    console.error('Error ensuring all category budgets:', error);
    return [];
  }
};

/**
 * Get all category budgets for a specific month
 * Ensures all categories have a budget entry for this month
 */
export const getBudgetsForMonth = async (month) => {
  try {
    console.log(`Getting budgets for ${month}`);
    
    // Ensure all categories have budgets for this month
    await ensureAllCategoryBudgets(month);
    
    // Now fetch all budgets for this month
    const budgetsCollection = database.collections.get('category_budgets');
    const allBudgets = await budgetsCollection.query().fetch();
    const monthBudgets = allBudgets.filter(budget => budget.month === month);
    
    console.log(`Found ${monthBudgets.length} budgets for ${month}`);
    return monthBudgets;
  } catch (error) {
    console.error('Error fetching budgets for month:', error);
    return [];
  }
};

/**
 * Debug utility function to examine all budgets
 */
export const debugBudgets = async (month) => {
  try {
    console.log('========= BUDGET DEBUG =========');
    // Get categories
    const categoriesCollection = database.collections.get('categories');
    const categories = await categoriesCollection.query().fetch();
    
    // Get budgets for month
    const budgets = await getBudgetsForMonth(month);
    
    console.log(`Found ${categories.length} categories and ${budgets.length} budgets for ${month}`);
    
    // For each category, find its budget
    for (const category of categories) {
      const budget = budgets.find(b => b.category_id === category.id);
      if (budget) {
        console.log(`Category: ${category.name} (${category.id})`);
        console.log(`  Assigned: ${budget.assigned}, Available: ${budget.available}`);
        console.log(`  Carried over: ${budget.available - budget.assigned}`);
      } else {
        console.log(`Category: ${category.name} (${category.id}) - NO BUDGET FOUND`);
      }
    }
    console.log('==============================');
  } catch (error) {
    console.error('Error in debugBudgets:', error);
  }
};

/**
 * Sync the readyToAssign value in Redux based on current data
 * @param {function} dispatch - Redux dispatch function
 */
export const syncReadyToAssignWithBudgets = async (dispatch) => {
  try {
    // Get current month
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    
    // Calculate ready to assign amount
    const readyToAssign = await calculateReadyToAssign(currentMonth);
    
    // Update the Redux store
    if (dispatch) {
      dispatch({ type: 'accounts/updateReadyToAssign', payload: readyToAssign });
    }
    
    return readyToAssign;
  } catch (error) {
    console.error('Error syncing ready to assign with budgets:', error);
    return 0;
  }
};