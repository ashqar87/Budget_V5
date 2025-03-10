import { database } from '../db/setup';
import { format, parse, addMonths, isBefore, isSameMonth, parseISO, subMonths } from 'date-fns';
import { Q } from '../db/query'; // Make sure Q is imported at the top level

// Constants
const MONTH_FORMAT = 'yyyy-MM';

// Budget cache to minimize recalculations
const budgetCache = {
  // Store budget data by month and category
  data: {},
  // Track the range of months that have been fully calculated
  range: {
    start: null,
    end: null
  },
  // Check if a month is within our cached range
  isMonthInRange: function(month) {
    return this.range.start && 
           this.range.end && 
           month >= this.range.start && 
           month <= this.range.end;
  },
  // Get budget data for a specific month and category
  getBudgetData: function(categoryId, month) {
    return this.data[`${categoryId}-${month}`];
  },
  // Set budget data for a specific month and category
  setBudgetData: function(categoryId, month, data) {
    this.data[`${categoryId}-${month}`] = data;
    
    // Update range if needed
    if (!this.range.start || month < this.range.start) {
      this.range.start = month;
    }
    if (!this.range.end || month > this.range.end) {
      this.range.end = month;
    }
  },
  // Invalidate cache for a category from a specific month forward
  invalidateForward: function(categoryId, fromMonth) {
    // Delete all cached data for this category from this month forward
    Object.keys(this.data).forEach(key => {
      if (key.startsWith(`${categoryId}-`)) {
        const month = key.split('-').slice(1).join('-');
        if (month >= fromMonth) {
          delete this.data[key];
        }
      }
    });
    
    // Adjust the end range if needed
    if (this.range.end && fromMonth <= this.range.end) {
      // Find the new last month in cache
      const months = Object.keys(this.data)
        .map(key => key.split('-').slice(1).join('-'))
        .filter(month => !!month);
      
      if (months.length > 0) {
        this.range.end = months.reduce((latest, month) => 
          month > latest ? month : latest, '0000-00');
      } else {
        this.range.end = null;
      }
    }
  },
  // Clear entire cache
  clear: function() {
    this.data = {};
    this.range.start = null;
    this.range.end = null;
  }
};

/**
 * Get the current month in YYYY-MM format
 */
export const getCurrentMonth = () => {
  return format(new Date(), MONTH_FORMAT);
};

/**
 * Validates if a month is accessible - must be current month or earlier,
 * or up to one month ahead of the latest month with budget assignments
 * @param {string} targetMonth - Month to check in YYYY-MM format
 * @returns {Promise<boolean>} - Whether the month is accessible
 */
export const isMonthAccessible = async (targetMonth) => {
  try {
    const currentMonth = getCurrentMonth();
    const targetDate = parseISO(`${targetMonth}-01`);
    const currentDate = parseISO(`${currentMonth}-01`);
    
    // Always allow current or past months
    if (isBefore(targetDate, currentDate) || isSameMonth(targetDate, currentDate)) {
      return true;
    }
    
    // Get all budgets to find the latest month with assignments
    const budgetsCollection = database.collections.get('category_budgets');
    const budgets = await budgetsCollection.query().fetch();
    
    // Find the latest month with any assigned budget
    let latestAssignedMonth = currentMonth;
    budgets.forEach(budget => {
      if (budget.assigned > 0 && budget.month > latestAssignedMonth) {
        latestAssignedMonth = budget.month;
      }
    });
    
    // Allow access to one month ahead of the latest assigned month
    const latestAssignedDate = parseISO(`${latestAssignedMonth}-01`);
    const allowedFutureDate = addMonths(latestAssignedDate, 1);
    const allowedFutureMonth = format(allowedFutureDate, MONTH_FORMAT);
    
    // If target month is within allowed range (up to one month ahead of latest assigned)
    return targetMonth <= allowedFutureMonth;
  } catch (error) {
    console.error('Error checking month accessibility:', error);
    return false;
  }
};

/**
 * Get all accessible months from earliest data until the most recent accessible month
 * @returns {Promise<Array<{value: string, label: string}>>} - Array of month objects
 */
export const getAccessibleMonths = async () => {
  try {
    // Get earliest month with data
    const budgetsCollection = database.collections.get('category_budgets');
    const budgets = await budgetsCollection.query().fetch();
    
    if (!budgets.length) {
      // If no budgets exist yet, just return current month
      const currentMonth = getCurrentMonth();
      return [
        { value: currentMonth, label: format(parseISO(`${currentMonth}-01`), 'MMM yyyy') }
      ];
    }
    
    // Find earliest month
    let earliestMonth = budgets.reduce((earliest, budget) => {
      return budget.month < earliest ? budget.month : earliest;
    }, getCurrentMonth());
    
    // Get current and next month
    const currentMonth = getCurrentMonth();
    const nextMonth = format(addMonths(parseISO(`${currentMonth}-01`), 1), MONTH_FORMAT);
    
    // Determine if next month is accessible
    const canAccessNextMonth = await isMonthAccessible(nextMonth);
    const latestMonth = canAccessNextMonth ? nextMonth : currentMonth;
    
    // Generate all months from earliest to latest accessible
    const months = [];
    let month = earliestMonth;
    let date = parseISO(`${month}-01`);
    
    while (month <= latestMonth) {
      months.push({
        value: month,
        label: format(date, 'MMM yyyy')
      });
      
      date = addMonths(date, 1);
      month = format(date, MONTH_FORMAT);
    }
    
    return months;
  } catch (error) {
    console.error('Error getting accessible months:', error);
    const currentMonth = getCurrentMonth();
    return [
      { value: currentMonth, label: format(parseISO(`${currentMonth}-01`), 'MMM yyyy') }
    ];
  }
};

/**
 * Calculate ready to assign amount
 * @param {string} month - Current month in YYYY-MM format
 */
export const calculateReadyToAssign = async (month) => {
  try {
    // Get total account balance
    const accountsCollection = database.collections.get('accounts');
    const accounts = await accountsCollection.query().fetch();
    const totalAccountBalance = accounts.reduce(
      (sum, account) => sum + account.currentBalance,
      0
    );
    
    // Get total assigned for current month and earlier
    const budgetsCollection = database.collections.get('category_budgets');
    const budgets = await budgetsCollection.query().fetch();

    const totalAssigned = budgets.reduce(
      (sum, budget) => budget.month <= month ? sum + budget.assigned : sum,
      0
    );
    
    // Ready to assign is the difference (minimum 0)
    return Math.max(0, totalAccountBalance - totalAssigned);
  } catch (error) {
    console.error('Error calculating ready to assign:', error);
    return 0;
  }
};

/**
 * Get category budget for a specific month, explicit month-to-month balance tracking
 * @param {string} categoryId - Category ID
 * @param {string} month - Month in YYYY-MM format
 * @returns {Promise<Object>} - Budget object or null
 */
export const getCategoryBudget = async (categoryId, month) => {
  try {
    console.log(`Getting budget for ${categoryId} in ${month}`);
    
    // Check if we have this budget cached
    const cachedBudgetData = budgetCache.getBudgetData(categoryId, month);
    if (cachedBudgetData) {
      console.log(`Using cached budget data for ${categoryId} in ${month}: assigned=${cachedBudgetData.assigned}, available=${cachedBudgetData.available}`);
      
      // Find existing budget in database
      const budgetsCollection = database.collections.get('category_budgets');
      const budgets = await budgetsCollection.query().fetch();
      const existingBudget = budgets.find(
        b => b.category_id === categoryId && b.month === month
      );
      
      if (existingBudget) {
        return existingBudget;
      }
    }
    
    // Find existing budget for this category and month
    const budgetsCollection = database.collections.get('category_budgets');
    const budgets = await budgetsCollection.query().fetch();
    const existingBudget = budgets.find(
      b => b.category_id === categoryId && b.month === month
    );
    
    if (existingBudget) {
      console.log(`Found existing budget for ${categoryId} in ${month}`);
      
      // Update cache with both assigned and available values
      budgetCache.setBudgetData(categoryId, month, {
        assigned: existingBudget.assigned,
        available: existingBudget.available
      });
      
      return existingBudget;
    }
    
    // Budget doesn't exist - need to create one
    // First, determine the previous month
    const date = parseISO(`${month}-01`);
    const previousMonth = format(addMonths(date, -1), MONTH_FORMAT);
    
    // Check if previous month is outside our cached range
    let previousBudget = null;
    let startingBalance = 0;
    
    if (!budgetCache.isMonthInRange(previousMonth)) {
      console.log(`Previous month ${previousMonth} is outside cache range - need to build chain`);
      
      // Check if previous month has a budget in database
      previousBudget = budgets.find(
        b => b.category_id === categoryId && b.month === previousMonth
      );
      
      // Create it via recursion if needed
      if (!previousBudget) {
        console.log(`CRITICAL: Previous month ${previousMonth} budget missing, creating chain`);
        previousBudget = await getCategoryBudget(categoryId, previousMonth);
        console.log(`Created chain budget with available: ${previousBudget?.available || 0} for ${previousMonth}`);
      }
      
      startingBalance = previousBudget ? previousBudget.available : 0;
    } else {
      // Get the starting balance from cache
      const previousData = budgetCache.getBudgetData(categoryId, previousMonth);
      startingBalance = previousData ? previousData.available : 0;
      console.log(`Using cached balance ${startingBalance} from ${previousMonth} for ${month}`);
    }
    
    // Create the new budget with the determined starting balance
    const newBudget = await budgetsCollection.create({
      category_id: categoryId,
      month: month,
      assigned: 0,
      available: startingBalance,
      startingBalance: startingBalance,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Update cache with the new budget's data
    budgetCache.setBudgetData(categoryId, month, {
      assigned: 0,
      available: startingBalance
    });
    
    console.log(`Created new budget for ${categoryId} in ${month} with startingBalance: ${startingBalance}`);
    return newBudget;
  } catch (error) {
    console.error(`Error getting budget for ${categoryId} in ${month}:`, error);
    return null;
  }
};

/**
 * Get category budget for a specific month, explicit month-to-month balance tracking
 * IMPORTANT: Renamed from getCategoryBudget (used by some components) to getOrCreateBudget (used by others)
 */
export const getOrCreateBudget = async (categoryId, month) => {
  // Also export with the old name for backward compatibility
  return getCategoryBudget(categoryId, month);
};

/**
 * Assign money to a category budget
 * @param {string} categoryId - Category ID
 * @param {string} month - Month in YYYY-MM format
 * @param {number} amount - Amount to assign
 * @param {function} dispatch - Redux dispatch function
 * @returns {Promise<Object|false>} - Updated budget or false if failed
 */
export const assignToBudget = async (categoryId, month, amount, dispatch = null) => {
  try {
    // Ensure month is accessible
    if (!(await isMonthAccessible(month))) {
      throw new Error(`Cannot assign to month ${month} as it's not accessible yet`);
    }
    
    // Get or create the budget
    const budget = await getCategoryBudget(categoryId, month);
    if (!budget) {
      throw new Error('Failed to get or create budget');
    }
    
    // Calculate difference for readyToAssign
    const previousAssigned = budget.assigned;
    const difference = amount - previousAssigned;
    
    // Calculate the new available balance
    const newAvailable = (budget.startingBalance || 0) + amount;
    
    // Update the budget
    const budgetsCollection = database.collections.get('category_budgets');
    await budgetsCollection.update(budget.id, {
      assigned: parseFloat(amount),
      available: parseFloat(newAvailable),
      updatedAt: new Date()
    });
    
    // IMPORTANT: Update cache with new values then invalidate future months
    budgetCache.setBudgetData(categoryId, month, {
      assigned: parseFloat(amount),
      available: parseFloat(newAvailable)
    });
    budgetCache.invalidateForward(categoryId, format(addMonths(parseISO(`${month}-01`), 1), MONTH_FORMAT));
    
    // Reload to verify update
    const updatedBudget = await budgetsCollection.find(budget.id);
    
    // Update Redux if dispatch was provided
    if (dispatch && updatedBudget) {
      // First update the budget in Redux
      dispatch({
        type: 'budget/updateBudgetSuccess',
        payload: {
          id: budget.id,
          changes: {
            assigned: updatedBudget.assigned,
            available: updatedBudget.available,
            updatedAt: updatedBudget.updatedAt instanceof Date ? 
                        updatedBudget.updatedAt.toISOString() : 
                        updatedBudget.updatedAt
          }
        }
      });
      
      // Then update readyToAssign
      if (difference > 0) {
        dispatch({
          type: 'accounts/decreaseReadyToAssign',
          payload: difference
        });
      } else if (difference < 0) {
        dispatch({
          type: 'accounts/increaseReadyToAssign',
          payload: Math.abs(difference)
        });
      }
    }
    
    // Return the updated budget
    return updatedBudget;
  } catch (error) {
    console.error('Error assigning to budget:', error);
    return false;
  }
};

/**
 * Update budget from a transaction
 * @param {Object} transaction - Transaction object
 * @param {Object} oldTransaction - Previous transaction object (if updating)
 * @returns {Promise<Object|null>} - Updated budget or null
 */
export const updateBudgetFromTransaction = async (transaction, oldTransaction = null) => {
  // Skip if not an expense or no category
  if (transaction.type !== 'expense' || !transaction.category_id) {
    console.log('Skipping budget update: not an expense or no category');
    return null;
  }
  
  try {
    // FIXED: Ensure we convert the transaction date to a proper Date object
    // before formatting, regardless of whether it's a timestamp or ISO string
    const transactionDate = new Date(transaction.date);
    const transactionMonth = format(transactionDate, MONTH_FORMAT);
    
    console.log(`Processing transaction in ${transactionMonth} for category ${transaction.category_id} (Date: ${transactionDate.toISOString()}, Amount: ${transaction.amount})`);
    
    let amountDifference = transaction.amount;
    
    // If updating transaction and the date changed, we need to handle both old and new month
    if (oldTransaction && oldTransaction.type === 'expense' && oldTransaction.category_id === transaction.category_id) {
      const oldTransactionDate = new Date(oldTransaction.date);
      const oldTransactionMonth = format(oldTransactionDate, MONTH_FORMAT);
      amountDifference = transaction.amount - oldTransaction.amount;
      
      // Check if transaction was moved between months
      if (oldTransactionMonth !== transactionMonth) {
        console.log(`Transaction moved from ${oldTransactionMonth} to ${transactionMonth}`);
        
        // Get old month budget and add back the old amount
        const oldBudget = await getCategoryBudget(transaction.category_id, oldTransactionMonth);
        if (oldBudget) {
          const newOldAvailable = oldBudget.available + oldTransaction.amount;
          const budgetsCollection = database.collections.get('category_budgets');
          await budgetsCollection.update(oldBudget.id, {
            available: newOldAvailable,
            updatedAt: new Date()
          });
          
          // Update cache for old month
          if (budgetCache.getBudgetData) {
            const oldMonthCacheData = budgetCache.getBudgetData(transaction.category_id, oldTransactionMonth);
            if (oldMonthCacheData) {
              budgetCache.setBudgetData(transaction.category_id, oldTransactionMonth, {
                ...oldMonthCacheData,
                available: newOldAvailable
              });
              console.log(`Updated old month cache for ${transaction.category_id} in ${oldTransactionMonth}: available=${newOldAvailable}`);
            }
          }
          
          // For the new month, we'll handle the full amount, not just the difference
          amountDifference = transaction.amount;
        }
      }
    }
    
    // Get the budget for the transaction month
    const budget = await getCategoryBudget(transaction.category_id, transactionMonth);
    
    if (!budget) {
      console.error(`Failed to get budget for transaction: category ${transaction.category_id}, month ${transactionMonth}`);
      throw new Error('Failed to get budget for transaction');
    }
    
    // IMPORTANT FIX: Adjust available amount by SUBTRACTING expense
    console.log(`Before update: budget available = ${budget.available}, transaction amount = ${amountDifference}`);
    const newAvailable = budget.available - amountDifference;
    console.log(`Updating budget available from ${budget.available} to ${newAvailable}`);
    
    // Update the budget
    const budgetsCollection = database.collections.get('category_budgets');
    await budgetsCollection.update(budget.id, {
      available: newAvailable,
      updatedAt: new Date()
    });
    
    // CRITICAL: Update cache for this month with new available balance but keep assigned amount
    if (budgetCache.getBudgetData) {
      const currentCacheData = budgetCache.getBudgetData(transaction.category_id, transactionMonth);
      budgetCache.setBudgetData(transaction.category_id, transactionMonth, {
        assigned: currentCacheData ? currentCacheData.assigned : budget.assigned,
        available: newAvailable
      });
      console.log(`Cache updated for ${transaction.category_id} in ${transactionMonth}: available=${newAvailable}`);
    }
    
    // AGGRESSIVELY update future months recursively
    await updateFutureMonths(transaction.category_id, transactionMonth, newAvailable);
    
    // Reload to confirm update
    const updatedBudget = await budgetsCollection.find(budget.id);
    console.log(`Budget updated: available now ${updatedBudget.available} for ${transaction.category_id} in ${transactionMonth}`);
    return updatedBudget;
  } catch (error) {
    console.error('Error updating budget from transaction:', error);
    return null;
  }
};

// Helper function to recursively update future months
const updateFutureMonths = async (categoryId, fromMonth, newStartingBalance) => {
  const date = parseISO(`${fromMonth}-01`);
  const nextMonth = format(addMonths(date, 1), MONTH_FORMAT);
  
  console.log(`Checking for future month impact: ${fromMonth} -> ${nextMonth} with new balance ${newStartingBalance}`);
  
  try {
    // Check if a budget exists for next month
    const budgetsCollection = database.collections.get('category_budgets');
    const nextBudgets = await budgetsCollection.query(
      Q.where('category_id', categoryId),
      Q.where('month', nextMonth)
    ).fetch();
    
    if (nextBudgets.length > 0) {
      const budget = nextBudgets[0];
      console.log(`Found future budget for ${nextMonth}: ${JSON.stringify(budget)}`);
      
      // Calculate new available as: assigned + new starting balance
      const newNextAvailable = budget.assigned + newStartingBalance;
      
      console.log(`Updating future month ${nextMonth}: old available=${budget.available}, new available=${newNextAvailable}`);
      
      // Update database
      await budgetsCollection.update(budget.id, {
        startingBalance: newStartingBalance,
        available: newNextAvailable,
        updatedAt: new Date()
      });
      
      // Update cache for this next month
      if (budgetCache.getBudgetData) {
        budgetCache.setBudgetData(categoryId, nextMonth, {
          assigned: budget.assigned,
          available: newNextAvailable
        });
        console.log(`Future cache updated for ${categoryId} in ${nextMonth}: available=${newNextAvailable}`);
      }
      
      // Recursively update the following month
      return await updateFutureMonths(categoryId, nextMonth, newNextAvailable);
    } else {
      console.log(`No future budget found for ${nextMonth}. Chain update complete.`);
      return;
    }
  } catch (error) {
    console.error(`Error updating future month ${nextMonth}:`, error);
  }
};

/**
 * Get all budgets for a specific month
 * @param {string} month - Month in YYYY-MM format
 * @returns {Promise<Array>} - Array of budget objects
 */
export const getBudgetsForMonth = async (month) => {
  try {
    console.log(`Getting budgets for ${month}`);
    
    // Ensure all categories have budgets for this month
    await ensureCategoryBudgets(month);
    
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
 * Ensure all categories have budgets for a specific month
 * @param {string} month - Month in YYYY-MM format
 * @returns {Promise<Array>} - Array of newly created budgets
 */
export const ensureCategoryBudgets = async (month) => {
  try {
    // Get all categories
    const categoriesCollection = database.collections.get('categories');
    const categories = await categoriesCollection.query().fetch();
    
    if (!categories || categories.length === 0) {
      return [];
    }
    
    console.log(`Ensuring budgets for ${month} for ${categories.length} categories`);
    
    // Get existing budgets
    const budgetsCollection = database.collections.get('category_budgets');
    const budgets = await budgetsCollection.query().fetch();
    const existingBudgetsForMonth = budgets.filter(b => b.month === month);
    
    // Track which categories already have budgets
    const existingCategoryIds = existingBudgetsForMonth.map(b => b.category_id);
    
    // Create budgets for categories that don't have one for this month
    const newBudgets = [];
    for (const category of categories) {
      if (!existingCategoryIds.includes(category.id)) {
        const budget = await getCategoryBudget(category.id, month);
        if (budget) {
          newBudgets.push(budget);
        }
      }
    }
    
    return newBudgets;
  } catch (error) {
    console.error('Error ensuring category budgets:', error);
    return [];
  }
};

// Also export with the old name for compatibility
export const ensureAllCategoryBudgets = ensureCategoryBudgets;

/**
 * Sync the readyToAssign value in Redux
 * @param {function} dispatch - Redux dispatch function
 * @returns {Promise<number>} - Ready to assign amount
 */
export const syncReadyToAssignWithBudgets = async (dispatch) => {
  try {
    const currentMonth = getCurrentMonth();
    const readyToAssign = await calculateReadyToAssign(currentMonth);
    
    if (dispatch) {
      dispatch({
        type: 'accounts/updateReadyToAssign',
        payload: readyToAssign
      });
    }
    
    return readyToAssign;
  } catch (error) {
    console.error('Error syncing ready to assign:', error);
    return 0;
  }
};

/**
 * Debug function to print budget information
 * @param {string} month - Month in YYYY-MM format
 */
export const debugBudgets = async (month) => {
  try {
    console.log('========= BUDGET DEBUG =========');
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
        console.log(`  Assigned: ${budget.assigned}`);
        console.log(`  Starting Balance: ${budget.startingBalance || 0}`);
        console.log(`  Available: ${budget.available}`);
        console.log(`  Activity: ${budget.available - budget.assigned - (budget.startingBalance || 0)}`);
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
 * Force update budget chains to ensure all months flow properly
 * @param {string} startMonth - Start month in YYYY-MM format
 * @param {string} endMonth - End month in YYYY-MM format (optional)
 */
export const repairBudgetChain = async (startMonth, endMonth) => {
  try {
    console.log(`Repairing budget chain from ${startMonth} to ${endMonth}`);
    
    // Get all categories
    const categoriesCollection = database.collections.get('categories');
    const categories = await categoriesCollection.query().fetch();
    
    // Get all budgets - get ALL budgets, not just the ones in our range
    const budgetsCollection = database.collections.get('category_budgets');
    const budgets = await budgetsCollection.query().fetch();
    
    // Get all transactions for activity calculations
    const transactionsCollection = database.collections.get('transactions');
    const transactions = await transactionsCollection.query(
      Q.where('type', 'expense')
    ).fetch();
    
    // Create a map to calculate transaction activity by category and month
    const activityMap = {};
    transactions.forEach(tx => {
      if (!tx.category_id) return;
      
      // Handle date correctly whether it's timestamp or ISO string
      let txDate;
      if (typeof tx.date === 'number') {
        txDate = new Date(tx.date);
      } else if (typeof tx.date === 'string') {
        txDate = new Date(tx.date);
      } else {
        txDate = tx.date; // Already a Date object
      }
      
      const txMonth = format(txDate, MONTH_FORMAT);
      const key = `${tx.category_id}-${txMonth}`;
      
      if (!activityMap[key]) {
        activityMap[key] = 0;
      }
      
      // Add the transaction amount (negative since expenses reduce available)
      activityMap[key] -= parseFloat(tx.amount);
    });
    
    console.log(`Found ${transactions.length} expense transactions for budget repair`);
    console.log('Transaction activity by category and month:');
    Object.keys(activityMap).forEach(key => {
      console.log(`${key}: ${activityMap[key]}`);
    });
    
    // Process each category
    for (const category of categories) {
      console.log(`Repairing chain for category ${category.name} (${category.id})`);
      
      // For each category, find the budget for the month BEFORE startMonth
      // to properly get the carried balance from previous month
      const date = parseISO(`${startMonth}-01`);
      const previousMonth = format(subMonths(date, 1), MONTH_FORMAT);
      const previousMonthBudget = budgets.find(
        b => b.category_id === category.id && b.month === previousMonth
      );
      
      // Initialize the chain from the previous month's budget
      let previousBudget = previousMonthBudget ? {
        ...previousMonthBudget,
        // Use the correct available amount from previous month
        available: previousMonthBudget.available || 0
      } : null;
      
      let currentMonth = startMonth;
      
      while (currentMonth <= endMonth) {
        // Find existing budget for this category and month
        const existingBudget = budgets.find(
          b => b.category_id === category.id && b.month === currentMonth
        );
        
        if (existingBudget) {
          // Calculate starting balance
          let startingBalance = 0;
          if (previousBudget) {
            startingBalance = previousBudget.available || 0;
          }
          
          console.log(`Updating budget for ${category.id} in ${currentMonth}: starting=${startingBalance}`);
          
          // Calculate activity for this month and category
          const activityKey = `${category.id}-${currentMonth}`;
          const activity = activityMap[activityKey] || 0;
          console.log(`Activity for ${category.id} in ${currentMonth}: ${activity}`);
          
          // Calculate available = starting + assigned + activity
          const assigned = existingBudget.assigned || 0;
          const available = startingBalance + assigned + activity;
          console.log(`Calculating ${category.id} in ${currentMonth}: ${startingBalance} + ${assigned} + ${activity} = ${available}`);
          
          // Update the budget with correct values
          await budgetsCollection.update(existingBudget.id, {
            startingBalance,
            available,
            updatedAt: new Date()
          });
          
          // Update cache to prevent later inconsistencies
          if (budgetCache.setBudgetData) {
            budgetCache.setBudgetData(category.id, currentMonth, {
              assigned,
              available,
              startingBalance,
              activity
            });
          }
          
          // Remember this budget for the next month
          previousBudget = {
            ...existingBudget,
            startingBalance,
            available,
            activity
          };
        }
        
        // Move to next month
        const nextDate = parseISO(`${currentMonth}-01`);
        currentMonth = format(addMonths(nextDate, 1), MONTH_FORMAT);
      }
    }
    
    console.log('Budget chain repair completed');
  } catch (error) {
    console.error('Error repairing budget chain:', error);
  }
};

/**
 * Add function to pre-cache a range of months for smoother operation
 * @param {string} startMonth - Start month in YYYY-MM format
 * @param {string} endMonth - End month in YYYY-MM format
 */
export const precacheMonthRange = async (startMonth, endMonth) => {
  try {
    console.log(`Pre-caching budget data from ${startMonth} to ${endMonth}`);
    
    // Get all categories
    const categoriesCollection = database.collections.get('categories');
    const categories = await categoriesCollection.query().fetch();
    
    // Get all existing budgets
    const budgetsCollection = database.collections.get('category_budgets');
    const allBudgets = await budgetsCollection.query().fetch();
    
    // For each category, ensure we have budgets for the entire range
    for (const category of categories) {
      let currentMonth = startMonth;
      
      while (currentMonth <= endMonth) {
        // Find existing budget
        const budget = allBudgets.find(b => 
          b.category_id === category.id && b.month === currentMonth);
        
        if (budget) {
          // Store in cache
          budgetCache.setBudgetData(category.id, currentMonth, {
            assigned: budget.assigned,
            available: budget.available
          });
        } else {
          // Create the budget (which will also cache it)
          await getCategoryBudget(category.id, currentMonth);
        }
        
        // Move to next month
        currentMonth = format(
          addMonths(parseISO(`${currentMonth}-01`), 1), 
          MONTH_FORMAT
        );
      }
    }
    
    console.log(`Pre-caching complete for ${startMonth} to ${endMonth}`);
  } catch (error) {
    console.error('Error pre-caching month range:', error);
  }
};