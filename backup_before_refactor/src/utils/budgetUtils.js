import { database } from '../db/setup';
import { addBudgetSuccess, updateBudgetSuccess, fetchBudgetsSuccess } from '../store/slices/budgetSlice';
import { decreaseReadyToAssign, increaseReadyToAssign, updateReadyToAssign } from '../store/slices/accountsSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, subMonths, parseISO } from 'date-fns';

/**
 * Create or update a budget for a category in a specific month
 * @param {string} categoryId - The ID of the category
 * @param {string} month - Month in YYYY-MM format
 * @param {number} amount - Amount to assign to the budget
 * @param {function} dispatch - Redux dispatch function
 */
export const assignToBudget = async (categoryId, month, amount, dispatch) => {
  try {
    // Get or create the budget entry first (handles rollover automatically)
    const budget = await getOrCreateCategoryBudget(categoryId, month, dispatch);
    
    if (!budget) {
      throw new Error('Failed to get or create budget');
    }
    
    // Calculate difference for readyToAssign update
    const previousAmount = budget.assigned;
    const difference = amount - previousAmount;
    
    // Calculate the new available balance (preserving existing available plus the difference)
    const newAvailable = budget.available + difference;
    
    // Update database
    const budgetsCollection = database.collections.get('category_budgets');
    await budgetsCollection.update(budget.id, (budgetRecord) => {
      budgetRecord.assigned = amount;
      budgetRecord.available = newAvailable;
    });
    
    // Update Redux
    dispatch(updateBudgetSuccess({
      id: budget.id,
      changes: {
        assigned: amount,
        available: newAvailable
      }
    }));
    
    // Update readyToAssign based on the difference
    if (difference > 0) {
      dispatch(decreaseReadyToAssign(difference));
    } else if (difference < 0) {
      dispatch(increaseReadyToAssign(Math.abs(difference)));
    }
    
    return true;
  } catch (error) {
    console.error('Error assigning to budget:', error);
    return false;
  }
};

/**
 * Get all budgets for a specific month
 * @param {string} month - Month in YYYY-MM format
 */
export const getBudgetsForMonth = async (month) => {
  try {
    const budgetsCollection = database.collections.get('category_budgets');
    const allBudgets = await budgetsCollection.query().fetch();
    return allBudgets.filter(budget => budget.month === month);
  } catch (error) {
    console.error('Error fetching budgets for month:', error);
    return [];
  }
};

/**
 * Get budget for a specific category and month
 * @param {string} categoryId - The ID of the category
 * @param {string} month - Month in YYYY-MM format
 * @returns {Object|null} The budget object or null if not found
 */
export const getCategoryBudget = async (categoryId, month) => {
  try {
    const budgetsCollection = database.collections.get('category_budgets');
    const allBudgets = await budgetsCollection.query().fetch();
    return allBudgets.find(
      budget => budget.category_id === categoryId && budget.month === month
    ) || null;
  } catch (error) {
    console.error('Error fetching category budget:', error);
    return null;
  }
};

/**
 * Get or create budget for a specific category and month, handling rollovers automatically
 * @param {string} categoryId - The ID of the category
 * @param {string} month - Month in YYYY-MM format
 * @returns {Object|null} The budget object
 */
export const getOrCreateCategoryBudget = async (categoryId, month, dispatch) => {
  try {
    const budgetsCollection = database.collections.get('category_budgets');
    
    // First try to find existing budget for this category and month
    // Use direct query rather than getCategoryBudget to avoid race conditions
    const existingBudgets = await budgetsCollection.query().fetch();
    const existingBudget = existingBudgets.find(
      budget => budget.category_id === categoryId && budget.month === month
    );
    
    if (existingBudget) {
      // Budget already exists, return it
      return existingBudget;
    }
    
    // Budget doesn't exist, we need to create it with rolled over balance from previous month
    const previousMonth = format(subMonths(parseISO(`${month}-01`), 1), 'yyyy-MM');
    
    // Get previous month's budget directly to avoid race conditions
    const previousBudget = existingBudgets.find(
      budget => budget.category_id === categoryId && budget.month === previousMonth
    );
    
    // Start with zero, or carry over available amount from previous month
    const startingAvailable = previousBudget ? previousBudget.available : 0;
    
    // Log clear rollover information for debugging
    console.log(`Rolling over ${categoryId}: previous available = ${startingAvailable}`);
    
    // Create new budget with previous month's available balance
    const newBudget = await budgetsCollection.create({
      category_id: categoryId,
      month: month,
      assigned: 0, // Start with 0 assigned in new month
      available: startingAvailable // Carry over available amount
    });
    
    console.log(`Created new budget for category ${categoryId} in ${month} with available: ${startingAvailable}`);
    
    // Update Redux store
    if (dispatch) {
      dispatch(addBudgetSuccess(newBudget));
    }
    
    return newBudget;
  } catch (error) {
    console.error(`Error getting/creating budget for category ${categoryId} in ${month}:`, error);
    return null;
  }
};

/**
 * Auto-rollover function to handle all categories when viewing a new month
 * This runs automatically when changing months
 */
export const autoRolloverBudgets = async (month, dispatch) => {
  try {
    console.log(`Auto-checking budgets for ${month}...`);
    
    // Get all categories
    const categoriesCollection = database.collections.get('categories');
    const allCategories = await categoriesCollection.query().fetch();
    
    if (!allCategories || allCategories.length === 0) {
      console.log('No categories found to rollover');
      return false;
    }
    
    // Get previous month to check for rollover amounts
    const previousMonth = format(subMonths(parseISO(`${month}-01`), 1), 'yyyy-MM');
    
    // Get existing budgets for both the new month and previous month
    const budgetsCollection = database.collections.get('category_budgets');
    const existingBudgets = await budgetsCollection.query().fetch();
    const existingBudgetsForMonth = existingBudgets.filter(b => b.month === month);
    const previousMonthBudgets = existingBudgets.filter(b => b.month === previousMonth);
    
    const existingCategoryIds = existingBudgetsForMonth.map(b => b.category_id);
    
    console.log(`Found ${existingBudgetsForMonth.length} existing budgets for ${month}`);
    console.log(`Processing ${allCategories.length} total categories`);

    // Fix inconsistent budgets where available amount is not properly set
    await repairBrokenBudgets(existingBudgetsForMonth, budgetsCollection);

    // Deep copy of existing budgets to track what needs to be fixed
    const budgetsToFix = [...existingBudgetsForMonth];
    
    // Track the created budgets for updating Redux state
    const newBudgets = [];
    const updatedBudgets = [];
    
    // Step 1: For each category without a budget for this month, create one
    for (const category of allCategories) {
      // Skip if this category already has a budget for this month
      if (existingCategoryIds.includes(category.id)) {
        console.log(`Checking rollover for ${category.id} - already has budget for ${month}`);
        
        // Find the existing budget for current month and previous month
        const currentBudget = existingBudgetsForMonth.find(b => b.category_id === category.id);
        const prevBudget = previousMonthBudgets.find(b => b.category_id === category.id);
        
        // Only update if previous budget exists and current budget doesn't match expected
        if (currentBudget) {
          const expectedAvailable = prevBudget ? prevBudget.available : 0;
          
          // If current available is 0 but should have a rolled over value
          if (currentBudget.available === 0 && expectedAvailable !== 0) {
            console.log(`Fixing rollover for ${category.id}: updating available from ${currentBudget.available} to ${expectedAvailable}`);
            
            try {
              // Update the budget with the correct rollover amount
              await budgetsCollection.update(currentBudget.id, budget => {
                budget.available = expectedAvailable;
                // Force update timestamp
                budget.updatedAt = new Date();
              });
              
              console.log(`Database update completed for budget ${currentBudget.id}`);
              
              // Get the updated record to confirm changes
              const verifyBudget = await budgetsCollection.find(currentBudget.id);
              console.log(`Verified budget available amount: ${verifyBudget ? verifyBudget.available : 'Not found'}`);
              
              // Update our tracking array
              const budgetIndex = budgetsToFix.findIndex(b => b.id === currentBudget.id);
              if (budgetIndex >= 0) {
                budgetsToFix[budgetIndex] = {
                  ...budgetsToFix[budgetIndex],
                  available: expectedAvailable
                };
              }
              
              // Track the updated budget for Redux
              updatedBudgets.push({
                id: currentBudget.id,
                changes: { 
                  available: expectedAvailable,
                  updatedAt: new Date().toISOString()
                }
              });
            } catch (updateError) {
              console.error(`Failed to update budget ${currentBudget.id}:`, updateError);
            }
          }
        }
        
        continue;
      }
      
      try {
        console.log(`Processing rollover for category ${category.id} in ${month}`);
        
        // Get previous month's budget
        const previousBudget = previousMonthBudgets.find(
          budget => budget.category_id === category.id
        );
        
        // Start with zero, or carry over available amount from previous month
        const startingAvailable = previousBudget ? previousBudget.available : 0;
        
        // Create new budget entry
        const newBudget = await budgetsCollection.create({
          category_id: category.id,
          month: month,
          assigned: 0, // Start with 0 assigned in new month
          available: startingAvailable // Carry over available amount
        });
        
        newBudgets.push(newBudget);
        budgetsToFix.push(newBudget);
        console.log(`Created budget for ${category.id} with available: ${startingAvailable}`);
        
      } catch (innerError) {
        console.error(`Error processing category ${category.id}:`, innerError);
        // Continue with other categories
      }
    }
    
    // Update Redux state with all new and updated budgets
    if (newBudgets.length > 0 && dispatch) {
      newBudgets.forEach(budget => {
        dispatch(addBudgetSuccess(budget));
      });
    }
    
    if (updatedBudgets.length > 0 && dispatch) {
      updatedBudgets.forEach(update => {
        dispatch(updateBudgetSuccess(update));
      });
    }
    
    // Finally, dispatch all budgets to ensure UI is in sync
    if (dispatch) {
      dispatch(fetchBudgetsSuccess(budgetsToFix));
    }
    
    console.log(`Successfully rolled over ${newBudgets.length} budgets and fixed ${updatedBudgets.length} existing budgets for ${month}`);
    return true;
  } catch (error) {
    console.error('Error in auto rollover:', error);
    return false;
  }
};

/**
 * Repair broken budgets where available amount is not in sync with assigned amount
 * This addresses data corruption where assigned amounts exist but available amounts are 0
 * @param {Array} budgets - Array of budget objects to check and repair
 * @param {Object} budgetsCollection - Database collection for budgets
 */
export const repairBrokenBudgets = async (budgets, budgetsCollection) => {
  console.log('Checking for budgets that need repair...');
  
  const budgetsToRepair = budgets.filter(budget => 
    budget.assigned > 0 && budget.available === 0
  );
  
  if (budgetsToRepair.length === 0) {
    console.log('No budgets need repair');
    return;
  }
  
  console.log(`Found ${budgetsToRepair.length} budgets that need repair`);
  
  for (const budget of budgetsToRepair) {
    try {
      console.log(`Repairing budget for category ${budget.category_id}: setting available to match assigned (${budget.assigned})`);
      
      // Fix the budget by setting available to at least match assigned
      await budgetsCollection.update(budget.id, budgetToUpdate => {
        budgetToUpdate.available = budget.assigned;
        budgetToUpdate.updatedAt = new Date();
      });
      
      // Verify the update
      const verifiedBudget = await budgetsCollection.find(budget.id);
      console.log(`Verified repair: available now ${verifiedBudget.available}`);
      
    } catch (error) {
      console.error(`Error repairing budget ${budget.id}:`, error);
    }
  }
  
  console.log('Budget repair process completed');
};

/**
 * Reset and repair all budgets for a month
 * Recovery function to fix corrupted budget data
 * @param {string} month - Month in YYYY-MM format
 * @param {function} dispatch - Redux dispatch function
 */
export const resetAndRepairBudgetsForMonth = async (month, dispatch) => {
  try {
    console.log(`Repairing all budgets for ${month}...`);
    
    // Get all budgets for the month
    const budgetsCollection = database.collections.get('category_budgets');
    const existingBudgets = await budgetsCollection.query().fetch();
    const monthBudgets = existingBudgets.filter(b => b.month === month);
    
    // Track updates for Redux
    const updatedBudgets = [];
    
    // Fix each budget
    for (const budget of monthBudgets) {
      try {
        if (budget.available !== budget.assigned) {
          console.log(`Fixing budget ${budget.id}: setting available to match assigned (${budget.assigned})`);
          
          await budgetsCollection.update(budget.id, b => {
            b.available = budget.assigned;
            b.updatedAt = new Date();
          });
          
          // Track for Redux update
          updatedBudgets.push({
            id: budget.id,
            changes: {
              available: budget.assigned,
              updatedAt: new Date().toISOString()
            }
          });
        }
      } catch (error) {
        console.error(`Error fixing budget ${budget.id}:`, error);
      }
    }
    
    // Update Redux state
    if (updatedBudgets.length > 0 && dispatch) {
      updatedBudgets.forEach(update => {
        dispatch(updateBudgetSuccess(update));
      });
    }
    
    // Get the updated budgets to return to Redux
    const updatedMonthBudgets = await budgetsCollection.query().fetch();
    const fixedBudgets = updatedMonthBudgets.filter(b => b.month === month);
    
    if (dispatch) {
      dispatch(fetchBudgetsSuccess(fixedBudgets));
    }
    
    console.log(`Repaired ${updatedBudgets.length} budgets for ${month}`);
    return fixedBudgets;
    
  } catch (error) {
    console.error('Error in budget repair:', error);
    return [];
  }
};

/**
 * Calculate total assigned budget amounts across all categories for a month
 * @param {string} month - Month in YYYY-MM format
 * @returns {number} Total amount assigned to budgets for the month
 */
export const calculateTotalAssignedForMonth = async (month) => {
  try {
    const budgets = await getBudgetsForMonth(month);
    return budgets.reduce((total, budget) => total + budget.assigned, 0);
  } catch (error) {
    console.error('Error calculating total assigned:', error);
    return 0;
  }
};

/**
 * Sync the accounts readyToAssign value with budget data
 * @param {function} dispatch - Redux dispatch function
 * @returns {number|null} The calculated readyToAssign value or null on error
 */
export const syncReadyToAssignWithBudgets = async (dispatch) => {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const totalAssigned = await calculateTotalAssignedForMonth(currentMonth);
    
    // Get total account balance
    const accountsCollection = database.collections.get('accounts');
    const accounts = await accountsCollection.query().fetch();
    const totalBalance = accounts.reduce(
      (sum, account) => sum + account.currentBalance,
      0
    );
    
    // Calculate readyToAssign as totalBalance minus totalAssigned
    const readyToAssign = Math.max(0, totalBalance - totalAssigned);
    
    // Update Redux store
    dispatch(updateReadyToAssign(readyToAssign));
    
    return readyToAssign;
  } catch (error) {
    console.error('Error syncing ready to assign:', error);
    return null;
  }
};

/**
 * Create budgets for a new month based on previous month's available amounts
 * Fixed implementation for proper rollover
 * @param {string} previousMonth - Previous month in YYYY-MM format
 * @param {string} newMonth - New month to create budgets for in YYYY-MM format
 * @param {function} dispatch - Redux dispatch function
 * @returns {boolean} True if successful, false otherwise
 */
export const rolloverBudgetsToNewMonth = autoRolloverBudgets;

/**
 * Debug utility function to examine all budgets
 * Call this from BudgetScreen loadData function
 */
export const debugBudgets = async (month) => {
  try {
    console.log('========= BUDGET DEBUG =========');
    // Get categories
    const categoriesCollection = database.collections.get('categories');
    const categories = await categoriesCollection.query().fetch();
    
    // Get budgets for month
    const budgetsCollection = database.collections.get('category_budgets');
    const budgets = await budgetsCollection.query().fetch();
    const monthBudgets = budgets.filter(b => b.month === month);
    
    console.log(`Found ${categories.length} categories and ${monthBudgets.length} budgets for ${month}`);
    
    // For each category, find its budget
    for (const category of categories) {
      const budget = monthBudgets.find(b => b.category_id === category.id);
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