import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, Alert, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Text, Button, Card, Title, TextInput, IconButton, Dialog, Portal, RadioButton, FAB, useTheme, ActivityIndicator } from 'react-native-paper';
import { useSelector, useDispatch } from 'react-redux';
import { fetchBudgetsStart, fetchBudgetsSuccess, fetchBudgetsFailure, setCurrentMonth } from '../../store/slices/budgetSlice';
import { fetchCategoriesStart, fetchCategoriesSuccess, updateCategorySuccess, deleteCategorySuccess, addCategorySuccess } from '../../store/slices/categoriesSlice';
import { updateReadyToAssign } from '../../store/slices/accountsSlice';
import { format, addMonths, subMonths, parseISO, isAfter } from 'date-fns';
import { database } from '../../db/setup';
import { Q } from '../../db/query';
import { 
  assignToBudget, 
  getBudgetsForMonth, 
  syncReadyToAssignWithBudgets, 
  rolloverBudgetsToNewMonth,
  autoRolloverBudgets,
  debugBudgets,
  resetAndRepairBudgetsForMonth  // Add this import
} from '../../utils/budgetUtils';
import BudgetAllocationModal from '../../components/budget/BudgetAllocationModal';
import { useFocusEffect } from '@react-navigation/native';

// Constants
const CATEGORY_COLORS = [
  '#4CAF50', '#2196F3', '#FFC107', '#9C27B0', '#F44336', 
  '#FF9800', '#795548', '#607D8B'
];

const CATEGORY_ICONS = [
  'food', 'home', 'car', 'movie', 'medical-bag', 
  'shopping', 'school', 'cash', 'gift', 'travel'
];

const MAX_CATEGORY_NAME_LENGTH = 20;
const MODAL_HEIGHT = Dimensions.get('window').height * 0.35;

const BudgetScreen = ({ navigation }) => {
  const dispatch = useDispatch();
  const theme = useTheme(); // Add this line to get the theme
  const currentMonth = useSelector(state => state.budget.currentMonth);
  const budgets = useSelector(state => state.budget.budgets);
  const categories = useSelector(state => state.categories.categories);
  const readyToAssign = useSelector(state => state.accounts.readyToAssign);
  const [budgetValues, setBudgetValues] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [monthMenuVisible, setMonthMenuVisible] = useState(false);
  const [performingRollover, setPerformingRollover] = useState(false);
  
  // Category editing state
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editedCategoryName, setEditedCategoryName] = useState('');
  const [editedCategoryColor, setEditedCategoryColor] = useState('');
  const [editedCategoryIcon, setEditedCategoryIcon] = useState('');

  // Budget allocation modal state
  const [allocationModalVisible, setAllocationModalVisible] = useState(false);
  const [selectedCategoryForAllocation, setSelectedCategoryForAllocation] = useState(null);
  const [currentAllocationAmount, setCurrentAllocationAmount] = useState('');
  const [originalAmount, setOriginalAmount] = useState('');
  
  // Blinking cursor animation
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  
  // Reference to the FlatList for scrolling
  const budgetListRef = useRef(null);
  
  // Hide bottom tab bar when modal is visible
  useEffect(() => {
    if (navigation && allocationModalVisible) {
      // Hide tab bar when modal is visible
      navigation.getParent()?.setOptions({
        tabBarStyle: { display: 'none' }
      });
    } else if (navigation) {
      // Show tab bar when modal is hidden
      navigation.getParent()?.setOptions({
        tabBarStyle: { display: 'flex' }
      });
    }
    
    return () => {
      // Restore tab bar when component unmounts
      navigation.getParent()?.setOptions({
        tabBarStyle: undefined
      });
    };
  }, [allocationModalVisible, navigation]);
  
  // Start blinking cursor animation when allocation modal is visible
  useEffect(() => {
    let animation;
    if (allocationModalVisible) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(cursorOpacity, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(cursorOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    }
    
    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [allocationModalVisible, cursorOpacity]);

  // Load data when month changes - optimized for performance
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setPerformingRollover(true); // Set this to true from the beginning
      
      try {
        // Load categories first for faster UI rendering
        dispatch(fetchCategoriesStart());
        const categoriesCollection = database.collections.get('categories');
        const categoriesData = await categoriesCollection.query().fetch();
        dispatch(fetchCategoriesSuccess(categoriesData));
        
        console.log(`Loaded ${categoriesData.length} categories for ${currentMonth}`);
        
        // First repair any broken budgets from data corruption
        await resetAndRepairBudgetsForMonth(currentMonth, dispatch);
        
        // Always force a rollover check to ensure all categories have budgets
        console.log(`Starting rollover check for ${currentMonth}...`);
        await autoRolloverBudgets(currentMonth, dispatch);
        
        // Add a small delay to ensure all database operations are finished
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Now load all budgets for the current month
        const monthBudgets = await getBudgetsForMonth(currentMonth);
        console.log(`Loaded ${monthBudgets.length} budgets for ${currentMonth}`);
        
        dispatch(fetchBudgetsSuccess(monthBudgets));
        
        // Call the imported debugBudgets function
        await debugBudgets(currentMonth);
        
        // Initialize budget input values
        const initialValues = {};
        monthBudgets.forEach(budget => {
          initialValues[budget.category_id] = budget.assigned.toString();
        });
        setBudgetValues(initialValues);
        
        // Check for missing budgets and log them
        const missingCategories = categoriesData.filter(cat => 
          !monthBudgets.some(budget => budget.category_id === cat.id)
        );
        
        if (missingCategories.length > 0) {
          console.warn(`Missing budgets for ${missingCategories.length} categories:`, 
            missingCategories.map(c => c.name).join(', '));
        }
        
        // Update ready to assign
        await syncReadyToAssignWithBudgets(dispatch);
        
      } catch (error) {
        console.error('Error loading budget data:', error);
        dispatch(fetchBudgetsFailure(error.toString()));
      } finally {
        setIsLoading(false);
        setPerformingRollover(false); // Always ensure this is cleared
      }
    };
    
    loadData();
  }, [currentMonth, dispatch]);

  const handleBudgetChange = (categoryId, value) => {
    setBudgetValues({
      ...budgetValues,
      [categoryId]: value
    });
  };

  const handleAssignBudget = async (categoryId) => {
    const amount = parseFloat(budgetValues[categoryId] || '0');
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid budget amount');
      return;
    }

    // Get previous assigned amount for this category
    const existingBudget = budgets.find(
      b => b.category_id === categoryId && b.month === currentMonth
    );
    const previousAmount = existingBudget ? existingBudget.assigned : 0;
    
    // Calculate difference to update readyToAssign
    const difference = amount - previousAmount;
    
    // Check if there's enough to assign
    if (difference > 0 && readyToAssign < difference) {
      Alert.alert(
        'Insufficient Funds', 
        `You only have $${readyToAssign.toFixed(2)} available to assign.`
      );
      return;
    }
    
    const success = await assignToBudget(categoryId, currentMonth, amount, dispatch);
    if (success) {
      Alert.alert('Success', 'Budget updated successfully');
    } else {
      Alert.alert('Error', 'Failed to update budget');
    }
  };
  
  // Handle opening the edit category dialog
  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setEditedCategoryName(category.name);
    setEditedCategoryColor(category.color || CATEGORY_COLORS[0]);
    setEditedCategoryIcon(category.icon || CATEGORY_ICONS[0]);
    setEditDialogVisible(true);
  };
  
  // Handle saving category changes
  const handleSaveCategory = async () => {
    if (!editedCategoryName.trim()) {
      Alert.alert('Invalid Name', 'Category name cannot be empty');
      return;
    }
    
    try {
      const categoriesCollection = database.collections.get('categories');
      const updatedCategory = await categoriesCollection.update(editingCategory.id, category => {
        category.name = editedCategoryName.trim();
        category.color = editedCategoryColor;
        category.icon = editedCategoryIcon;
        category.updatedAt = new Date();
      });
      
      // Update Redux store
      dispatch(updateCategorySuccess({
        id: updatedCategory.id,
        changes: {
          name: updatedCategory.name,
          color: updatedCategory.color,
          icon: updatedCategory.icon,
          updatedAt: updatedCategory.updatedAt
        }
      }));
      
      setEditDialogVisible(false);
      Alert.alert('Success', 'Category updated successfully');
    } catch (error) {
      console.error('Error updating category:', error);
      Alert.alert('Error', 'Failed to update category');
    }
  };

  const handleMonthChange = (direction) => {
    let newMonth;
    const currentDate = parseISO(`${currentMonth}-01`);
    
    if (direction === 'prev') {
      newMonth = format(subMonths(currentDate, 1), 'yyyy-MM');
    } else if (direction === 'next') {
      newMonth = format(addMonths(currentDate, 1), 'yyyy-MM');
    }
    
    if (newMonth) {
      // Clear any existing rollover state
      setPerformingRollover(false);
      
      // Navigate to the new month
      dispatch(setCurrentMonth(newMonth));
    }
  };

  const handleDeleteCategory = async () => {
    if (!editingCategory) return;
    
    try {
      // Check if the category has any budgets
      const budgetsCollection = database.collections.get('category_budgets');
      const categoryBudgets = await budgetsCollection.query(
        Q.where('category_id', editingCategory.id)
      ).fetch();
      
      if (categoryBudgets.length > 0) {
        Alert.alert(
          'Cannot Delete Category',
          'This category has budgets assigned to it. Please delete those first.'
        );
        return;
      }
      
      // Check if the category has any transactions
      const transactionsCollection = database.collections.get('transactions');
      const categoryTransactions = await transactionsCollection.query(
        Q.where('category_id', editingCategory.id)
      ).fetch();
      
      if (categoryTransactions.length > 0) {
        Alert.alert(
          'Cannot Delete Category',
          'This category has transactions assigned to it. Please reassign those first.'
        );
        return;
      }
      
      // If no budgets or transactions, proceed with deletion
      const categoriesCollection = database.collections.get('categories');
      await categoriesCollection.delete(editingCategory.id);
      
      // Update Redux store
      dispatch(deleteCategorySuccess(editingCategory.id));
      
      setEditDialogVisible(false);
      setEditingCategory(null); // Clear the editing category to prevent infinite loop
      Alert.alert('Success', 'Category deleted successfully');
    } catch (error) {
      console.error('Error deleting category:', error);
      Alert.alert('Error', 'Failed to delete category');
    }
  };

  // Handle opening the allocation modal
  const handleOpenAllocation = (category) => {
    const budget = budgets.find(b => b.category_id === category.id);
    const currentAmount = budget ? budget.assigned.toString() : '0';
    
    setSelectedCategoryForAllocation(category);
    setCurrentAllocationAmount(currentAmount);
    setOriginalAmount(currentAmount); // Store original amount for cancellation
    setAllocationModalVisible(true);
    
    // Scroll to make sure the selected item is visible
    if (budgetListRef.current) {
      const index = categories.findIndex(c => c.id === category.id);
      if (index !== -1) {
        // Use a smaller viewOffset to position the item higher in the visible area
        budgetListRef.current.scrollToIndex({ 
          index,
          animated: true,
          viewOffset: 80 // Reduced from 120 for better positioning
        });
      }
    }
  };
  
  // Handle saving allocation
  const handleSaveAllocation = async (amount) => {
    if (!selectedCategoryForAllocation) return;
    
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid budget amount');
      return;
    }

    const existingBudget = budgets.find(
      b => b.category_id === selectedCategoryForAllocation.id && b.month === currentMonth
    );
    const previousAmount = existingBudget ? existingBudget.assigned : 0;
    
    // Calculate difference to update readyToAssign
    const difference = parsedAmount - previousAmount;
    
    // Check if there's enough to assign
    if (difference > 0 && readyToAssign < difference) {
      Alert.alert(
        'Insufficient Funds', 
        `You only have $${readyToAssign.toFixed(2)} available to assign.`
      );
      return false;
    }
    
    const success = await assignToBudget(
      selectedCategoryForAllocation.id, 
      currentMonth, 
      parsedAmount, 
      dispatch
    );
    
    if (success) {
      // Update the budgetValues state to reflect the new amount
      setBudgetValues({
        ...budgetValues,
        [selectedCategoryForAllocation.id]: parsedAmount.toString()
      });
      
      // Close modal after saving
      setAllocationModalVisible(false);
      return true;
    } else {
      Alert.alert('Error', 'Failed to update budget');
      return false;
    }
  };
  
  // Handle switching to another category while modal is open
  const handleSwitchCategory = async (category) => {
    // First save changes to the current category
    if (selectedCategoryForAllocation) {
      const currentAmount = currentAllocationAmount;
      const success = await handleSaveAllocation(currentAmount);
      if (!success) return; // Don't switch if saving fails
    }
    
    // Then open the new category
    handleOpenAllocation(category);
  };
  
  // Handle auto-assign based on different methods
  const handleAutoAssign = async (method) => {
    if (!selectedCategoryForAllocation) return;
    
    try {
      let amountToAssign = 0;
      const categoryId = selectedCategoryForAllocation.id;
      
      // Get transactions collection
      const transactionsCollection = database.collections.get('transactions');
      
      switch(method) {
        case 'previous': {
          // Assign same as previous month
          const previousMonth = format(
            subMonths(parseISO(`${currentMonth}-01`), 1),
            'yyyy-MM'
          );
          
          const prevBudgets = await getBudgetsForMonth(previousMonth);
          const prevBudget = prevBudgets.find(b => b.category_id === categoryId);
          
          if (prevBudget) {
            amountToAssign = prevBudget.assigned;
          }
          break;
        }
          
        case 'spent': {
          // Assign same as spent previous month
          const previousMonth = format(
            subMonths(parseISO(`${currentMonth}-01`), 1),
            'yyyy-MM'
          );
          
          const prevMonthStart = new Date(`${previousMonth}-01T00:00:00Z`);
          const prevMonthEnd = new Date(
            addMonths(prevMonthStart, 1).getTime() - 1
          );
          
          const transactions = await transactionsCollection.query(
            Q.where('category_id', categoryId),
            Q.where('type', 'expense'),
            Q.where('date', Q.gte(prevMonthStart.getTime())),
            Q.where('date', Q.lte(prevMonthEnd.getTime()))
          ).fetch();
          
          amountToAssign = transactions.reduce(
            (sum, tx) => sum + tx.amount, 
            0
          );
          break;
        }
          
        case 'average': {
          // Assign average of all time
          const transactions = await transactionsCollection.query(
            Q.where('category_id', categoryId),
            Q.where('type', 'expense')
          ).fetch();
          
          if (transactions.length > 0) {
            const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
            
            // Get number of unique months
            const monthsSet = new Set();
            transactions.forEach(tx => {
              const date = new Date(tx.date);
              const month = `${date.getFullYear()}-${date.getMonth() + 1}`;
              monthsSet.add(month);
            });
            
            const numMonths = Math.max(1, monthsSet.size);
            amountToAssign = total / numMonths;
          }
          break;
        }
      }
      
      // Round to 2 decimal places
      amountToAssign = Math.round(amountToAssign * 100) / 100;
      
      // Set in the modal and save if confirmed
      setCurrentAllocationAmount(amountToAssign.toString());
      
      Alert.alert(
        'Auto-assign Budget',
        `Assign $${amountToAssign.toFixed(2)} to ${selectedCategoryForAllocation.name}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Confirm',
            onPress: () => handleSaveAllocation(amountToAssign.toString()),
          },
        ]
      );
      
    } catch (error) {
      console.error('Error in auto-assign:', error);
      Alert.alert('Error', 'Failed to auto-assign budget amount');
    }
  };

  // Truncate a string to max length and add ellipsis if needed
  const truncateString = (str, maxLength) => {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
  };

  const renderCategoryItem = ({ item, index }) => {
    const budget = budgets.find(b => b.category_id === item.id);
    const assigned = budget ? budget.assigned : 0;
    const available = budget ? budget.available : 0;
    
    // Check if this category is currently selected for allocation
    const isSelected = selectedCategoryForAllocation && 
                     selectedCategoryForAllocation.id === item.id && 
                     allocationModalVisible;
    
    const displayAmount = isSelected ? 
      currentAllocationAmount : 
      assigned.toFixed(2);
  
    // Truncate category name to keep UI clean
    const displayName = truncateString(item.name, MAX_CATEGORY_NAME_LENGTH);
    
    // Calculate carried over amount (the difference between available and assigned)
    const carriedOver = available - assigned;
  
    return (
      <TouchableOpacity
        onPress={(event) => {
          // If modal is already open, switch categories
          if (allocationModalVisible) {
            handleSwitchCategory(item);
          } else {
            // Otherwise open modal with this category
            handleOpenAllocation(item);
          }
        }}
      >
        <Card 
          style={[
            styles.categoryCard,
            isSelected && styles.selectedCategoryCard
          ]}
        >
          <Card.Content style={styles.cardContent}>
            <View style={styles.categoryRow}>
              <View style={styles.categoryNameContainer}>
                <Text style={styles.categoryName} numberOfLines={1}>
                  {displayName}
                </Text>
                
                {/* Simplified logic for balance breakdown */}
                <Text style={styles.balanceBreakdown}>
                  {assigned > 0 ? `${assigned.toFixed(2)} assigned` : ''}
                  {carriedOver !== 0 ? 
                    `${assigned > 0 ? ' ' : ''}${carriedOver > 0 ? '+' : ''}${carriedOver.toFixed(2)} carried over` : ''}
                </Text>
              </View>
              
              <View style={styles.amountContainer}>
                <Text style={[
                  styles.amountText,
                  isSelected && styles.selectedAmountText
                ]}>
                  ${displayAmount}
                </Text>
                {isSelected && (
                  <Animated.View 
                    style={[styles.cursor, { opacity: cursorOpacity }]} 
                  />
                )}
              </View>
              
              <Text style={[
                styles.amountText,
                available < 0 ? styles.negative : available > 0 ? styles.positive : {}
              ]}>
                ${available.toFixed(2)}
              </Text>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  // Add state for the Add Category dialog
  const [addCategoryDialogVisible, setAddCategoryDialogVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [newCategoryIcon, setNewCategoryIcon] = useState(CATEGORY_ICONS[0]);

  // Update the handleAddCategory function to use a simpler approach
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      Alert.alert('Invalid Name', 'Category name cannot be empty');
      return;
    }
    
    try {
      console.log('Creating new category...');
      const categoriesCollection = database.collections.get('categories');
      
      // Create the category using a simple object rather than a function
      const newCategory = await categoriesCollection.create({
        name: newCategoryName.trim(),
        color: newCategoryColor,
        icon: newCategoryIcon
      });
      
      console.log('Category created:', newCategory);
      
      // Update Redux store
      dispatch(addCategorySuccess(newCategory));
      
      setAddCategoryDialogVisible(false);
      setNewCategoryName('');
      Alert.alert('Success', 'Category created successfully');
    } catch (error) {
      console.error('Error creating category:', error.message, error.stack || '(no stack)');
      Alert.alert('Error', `Failed to create category. Please try again.`);
    }
  };

  // Add state for month selection modal
  const [monthSelectionModalVisible, setMonthSelectionModalVisible] = useState(false);
  const [tempYear, setTempYear] = useState(new Date().getFullYear());
  
  // Format the month in shorter format
  const formattedMonth = format(new Date(currentMonth + '-01'), 'MMM yy');
  
  // Get the current year from the currentMonth string
  const currentYear = currentMonth.substring(0, 4);
  
  // Get all months as array for the modal
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(tempYear, i, 1);
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMM'),
      month: i
    };
  });
  
  // Handle selecting a month in the modal
  const handleSelectMonth = (selectedMonth) => {
    dispatch(setCurrentMonth(selectedMonth));
    hideMonthSelectionModal();
  };

  // Add ref to measure month button position
  const monthButtonRef = useRef(null);
  const [monthModalPosition, setMonthModalPosition] = useState({ top: 0, left: 0 });
  
  // Track modal animation
  const monthModalAnimVal = useRef(new Animated.Value(0)).current;
  
  // Function to show the month selection modal with improved responsiveness
  const showMonthSelectionModal = () => {
    setTimeout(() => {
      if (monthButtonRef.current) {
        monthButtonRef.current.measureInWindow((x, y, width, height) => {
          // Get screen dimensions for responsive calculations
          const screenWidth = Dimensions.get('window').width;
          const screenHeight = Dimensions.get('window').height;
          
          // Make the modal width responsive to screen size
          const modalWidth = Math.min(240, screenWidth * 0.65);
          
          // Calculate position that ensures the modal stays on screen
          const buttonCenterX = x + (width / 2);
          
          // Ensure the modal doesn't go off the left or right edges
          const modalLeft = Math.max(
            16, // Minimum left margin
            Math.min(
              buttonCenterX - (modalWidth / 2), // Center under button
              screenWidth - modalWidth - 16 // Maximum right position
            )
          );
          
          // Check if the modal would go off the bottom of the screen
          const wouldOverflowBottom = (y + height + 260) > screenHeight; // 260 is approx modal height
          
          // Position modal above or below button depending on space
          const modalTop = wouldOverflowBottom 
            ? y - 260 - 8 // Position above with gap
            : y + height - 1; // Position below with overlap for connected appearance
          
          setMonthModalPosition({
            top: modalTop,
            left: modalLeft,
            width: modalWidth,
            buttonCenterX: buttonCenterX,
            // Store if modal is above or below for triangle positioning
            isAbove: wouldOverflowBottom
          });
          
          // Set year to current year from the date
          setTempYear(parseInt(currentMonth.substring(0, 4)));
          
          // Show and animate the modal with appropriate direction
          setMonthSelectionModalVisible(true);
          Animated.timing(monthModalAnimVal, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        });
      }
    }, 50);
  };

  // Function to hide the month selection modal
  const hideMonthSelectionModal = () => {
    Animated.timing(monthModalAnimVal, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setMonthSelectionModalVisible(false);
    });
  };

  return (
    <View style={styles.container}>
      {/* Content container */}
      <View style={[
        styles.contentContainer, 
        allocationModalVisible && { paddingBottom: MODAL_HEIGHT }
      ]}>
        {/* Updated Month Header */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <View style={styles.monthSelector}>
              <IconButton 
                icon="chevron-left" 
                size={20} 
                onPress={() => handleMonthChange('prev')}
                style={styles.monthArrow}
              />
              
              <View style={styles.monthButtonContainer}>
                <TouchableOpacity 
                  ref={monthButtonRef}
                  onPress={showMonthSelectionModal}
                  style={styles.monthButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.monthTitle}>{formattedMonth}</Text>
                </TouchableOpacity>
              </View>
              
              <IconButton 
                icon="chevron-right" 
                size={20} 
                onPress={() => handleMonthChange('next')}
                style={styles.monthArrow}
              />
              
              {/* Add Category button */}
              <IconButton
                icon="plus"
                size={24}
                style={styles.addButton}
                onPress={() => {
                  setNewCategoryName('');
                  setNewCategoryColor(CATEGORY_COLORS[0]);
                  setNewCategoryIcon(CATEGORY_ICONS[0]);
                  setAddCategoryDialogVisible(true);
                }}
              />
            </View>
            
            <View style={styles.readyToAssignContainer}>
              <Text style={styles.readyToAssignLabel}>Ready to Assign</Text>
              <Text style={styles.readyToAssignAmount}>
                ${readyToAssign.toFixed(2)}
                {performingRollover && " (updating...)"}
              </Text>
              {performingRollover && (
                <ActivityIndicator size="small" style={{marginTop: 4}} />
              )}
            </View>
          </Card.Content>
        </Card>
        
        {/* Rest of the content remains the same */}
        {/* Column headers */}
        <View style={styles.columnHeaders}>
          <Text style={styles.categoryHeaderText}>Category</Text>
          <Text style={styles.amountHeaderText}>Assigned</Text>
          <Text style={styles.amountHeaderText}>Available</Text>
        </View>
        
        {/* Categories List */}
        <FlatList
          ref={budgetListRef}
          data={categories}
          renderItem={renderCategoryItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          scrollEnabled={true} // Always enable scrolling
        />
      </View>
      
      {/* Budget Allocation Modal at the bottom */}
      {allocationModalVisible && (
        <View style={styles.modalWrapper}>
          <BudgetAllocationModal
            visible={allocationModalVisible}
            category={selectedCategoryForAllocation}
            currentAmount={currentAllocationAmount}
            onChangeAmount={setCurrentAllocationAmount}
            onClose={() => {
              // Reset to original amount on close
              if (selectedCategoryForAllocation) {
                const budget = budgets.find(b => b.category_id === selectedCategoryForAllocation.id);
                if (budget) {
                  setCurrentAllocationAmount(budget.assigned.toString());
                }
              }
              setAllocationModalVisible(false);
            }}
            onSave={handleSaveAllocation}
            onAutoAssign={handleAutoAssign}
            onEditCategory={() => {
              if (selectedCategoryForAllocation) {
                setAllocationModalVisible(false);
                setEditingCategory(selectedCategoryForAllocation);
                setEditedCategoryName(selectedCategoryForAllocation.name);
                setEditedCategoryColor(selectedCategoryForAllocation.color || CATEGORY_COLORS[0]);
                setEditedCategoryIcon(selectedCategoryForAllocation.icon || CATEGORY_ICONS[0]);
                setEditDialogVisible(true);
              }
            }}
          />
        </View>
      )}
      
      {/* Remove the FAB for adding new category since we've moved it to the header */}
      
      {/* Custom Month Selection Modal with improved positioning */}
      {monthSelectionModalVisible && (
        <>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={hideMonthSelectionModal}
          />
          <Animated.View 
            style={[
              styles.monthSelectionModal,
              {
                top: monthModalPosition.top,
                left: monthModalPosition.left,
                width: monthModalPosition.width,
                opacity: monthModalAnimVal,
                transform: [{
                  scaleY: monthModalAnimVal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1]
                  })
                }],
              }
            ]}
          >
            {/* Render triangle above or below modal depending on position */}
            {monthModalPosition.isAbove ? (
              <View 
                style={[
                  styles.modalTriangleBottom, 
                  { 
                    left: monthModalPosition.buttonCenterX 
                      ? monthModalPosition.buttonCenterX - monthModalPosition.left - 8 
                      : '50%'
                  }
                ]}
              />
            ) : (
              <View 
                style={[
                  styles.modalTriangle,
                  { 
                    left: monthModalPosition.buttonCenterX 
                      ? monthModalPosition.buttonCenterX - monthModalPosition.left - 8 
                      : '50%'
                  }
                ]}
              />
            )}
            
            <View style={styles.yearSelector}>
              <IconButton  
                icon="chevron-left" 
                onPress={() => setTempYear(tempYear - 1)} 
                size={20}
                style={styles.yearSelectorIcon}
              />
              <Text style={styles.yearText}>{tempYear}</Text>
              <IconButton  
                icon="chevron-right" 
                onPress={() => setTempYear(tempYear + 1)} 
                size={20}
                style={styles.yearSelectorIcon}
              />
            </View>
            
            <View style={styles.monthGrid}>
              {months.map((month) => {
                const isSelected = month.value === currentMonth;
                return (
                  <TouchableOpacity 
                    key={month.value}
                    style={[
                      styles.monthItem, 
                      isSelected && styles.selectedMonthItem
                    ]}
                    onPress={() => handleSelectMonth(month.value)}
                  >
                    <Text style={[
                      styles.monthItemText,
                      isSelected && styles.selectedMonthItemText
                    ]}>
                      {month.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </>
      )}

      {/* Add Category Dialog */}
      <Portal>
        <Dialog visible={addCategoryDialogVisible} onDismiss={() => setAddCategoryDialogVisible(false)}>
          <Dialog.Title>Add New Category</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Category Name"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              style={styles.dialogInput}
            />
            
            <Text style={styles.colorLabel}>Select Color</Text>
            <View style={styles.colorOptions}>
              {CATEGORY_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    newCategoryColor === color && styles.selectedColorOption
                  ]}
                  onPress={() => setNewCategoryColor(color)}
                />
              ))}
            </View>
            
            <Text style={styles.colorLabel}>Select Icon</Text>
            <RadioButton.Group 
              onValueChange={value => setNewCategoryIcon(value)} 
              value={newCategoryIcon}
            >
              <View style={styles.iconOptions}>
                {CATEGORY_ICONS.map(icon => (
                  <View key={icon} style={styles.iconOption}>
                    <RadioButton value={icon} />
                    <Text>{icon}</Text>
                  </View>
                ))}
              </View>
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAddCategoryDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleAddCategory}>Create</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Category Edit Dialog */}
      <Portal>
        <Dialog visible={editDialogVisible} onDismiss={() => setEditDialogVisible(false)}>
          <Dialog.Title>Edit Category</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Category Name"
              value={editedCategoryName}
              onChangeText={setEditedCategoryName}
              style={styles.dialogInput}
            />
            
            <Text style={styles.colorLabel}>Select Color</Text>
            <View style={styles.colorOptions}>
              {CATEGORY_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    editedCategoryColor === color && styles.selectedColorOption
                  ]}
                  onPress={() => setEditedCategoryColor(color)}
                />
              ))}
            </View>
            
            <Text style={styles.colorLabel}>Select Icon</Text>
            <RadioButton.Group 
              onValueChange={value => setEditedCategoryIcon(value)} 
              value={editedCategoryIcon}
            >
              <View style={styles.iconOptions}>
                {CATEGORY_ICONS.map(icon => (
                  <View key={icon} style={styles.iconOption}>
                    <RadioButton value={icon} />
                    <Text>{icon}</Text>
                  </View>
                ))}
              </View>
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button textColor="red" onPress={handleDeleteCategory}>Delete</Button>
            <Button onPress={() => setEditDialogVisible(false)}>Cancel</Button>
            <Button onPress={handleSaveCategory}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    flex: 1,
    // Don't use overflow:hidden as we want to see the content
  },
  summaryCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',  // For absolute positioning of the add button
  },
  monthArrow: {
    margin: 0,
    padding: 0,
    width: 36,
    height: 36,
  },
  monthButtonContainer: {
    zIndex: 2, // Ensure this is above other elements
    elevation: 2, // For Android
    // No margins that could throw off measurements
  },
  monthButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    zIndex: 2,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
  },
  addButton: {
    position: 'absolute',
    right: -8,
    top: 0,
  },
  readyToAssignContainer: {
    marginTop: 20, // Increase top margin for better separation
    alignItems: 'center',
    paddingTop: 8,
  },
  columnHeaders: {
    flexDirection: 'row',
    paddingHorizontal: 32,
    paddingVertical: 8,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
    borderRadius: 4,
  },
  categoryHeaderText: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 14,
    color: '#757575',
  },
  amountHeaderText: {
    width: 80,
    textAlign: 'right',
    fontWeight: 'bold',
    fontSize: 14,
    color: '#757575',
  },
  listContainer: {
    paddingVertical: 8,
    paddingBottom: 16, // Add more padding at the bottom
  },
  categoryCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    elevation: 2,
  },
  cardContent: {
    padding: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryName: {
    flex: 1,
    fontSize: 16,
    marginRight: 8,
  },
  amountContainer: {
    width: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  amountText: {
    width: 80,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  selectedAmountText: {
    color: '#2196F3',
  },
  cursor: {
    width: 2,
    height: 20,
    backgroundColor: '#2196F3',
    marginLeft: 1,
  },
  positive: {
    color: '#4CAF50',
  },
  negative: {
    color: '#F44336',
  },
  selectedCategoryCard: {
    borderWidth: 2,
    borderColor: '#2196F3',
    backgroundColor: 'rgba(33, 150, 243, 0.05)',
  },
  modalWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: MODAL_HEIGHT,
    backgroundColor: 'transparent',
    // Remove margins that might create extra space
    margin: 0,
    padding: 0,
    // Add shadow to better separate from content
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dialogInput: {
    marginBottom: 16,
  },
  colorLabel: {
    marginTop: 8,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  colorOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    margin: 4,
  },
  selectedColorOption: {
    borderWidth: 3,
    borderColor: '#000',
  },
  iconOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  iconOption: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 8,
  },
  contentWithModalVisible: {
    height: Dimensions.get('window').height - MODAL_HEIGHT, // Reduce height to make room for the modal
    overflow: 'hidden',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  monthSelectionModal: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 12,
  },
  // Triangle pointing up from the bottom of the modal (for when modal is above the button)
  modalTriangleBottom: {
    position: 'absolute',
    bottom: -8,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'white',
    zIndex: 13,
  },
  // Original triangle pointing down from the top (for when modal is below the button)
  modalTriangle: {
    position: 'absolute',
    top: -8,
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'white',
    zIndex: 13,
  },
  // Fixed year selector layout
  yearSelector: {
    flexDirection: 'row', 
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  yearSelectorIcon: {
    margin: 0,
    padding: 0,
  },
  yearText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 8,
    textAlign: 'center',
  },
  // Fixed month grid layout
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%', // Ensure it takes full width
    alignItems: 'flex-start', // Align items at the start of the container
  },
  monthItem: {
    width: '32%', // Slightly smaller to ensure 3 fit per row with spacing
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 6,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  selectedMonthItem: {
    backgroundColor: '#2196F3',
  },
  monthItemText: {
    fontSize: 14,
    textAlign: 'center', // Ensure text is centered
  },
  selectedMonthItemText: {
    color: 'white',
    fontWeight: 'bold',
  },
  categoryNameContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  balanceBreakdown: {
    fontSize: 10,
    color: '#757575',
    marginTop: 2,
  },
});

export default BudgetScreen;