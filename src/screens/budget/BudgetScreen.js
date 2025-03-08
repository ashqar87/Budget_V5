import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Headline, Surface, IconButton, Menu, Divider, FAB, ActivityIndicator, useTheme, Modal, Portal, TextInput } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { format, addMonths, subMonths, startOfMonth } from 'date-fns';
import { fetchBudgetsStart, fetchBudgetsSuccess, fetchBudgetsFailure, setCurrentMonth, assignToBudgetSuccess } from '../../store/slices/budgetSlice';
import { updateReadyToAssign } from '../../store/slices/accountsSlice';
import { useDatabase } from '../../context/DatabaseContext';
import { Q } from '@nozbe/watermelondb';
import EmptyState from '../../components/common/EmptyState';
import CategoryBudgetItem from '../../components/budget/CategoryBudgetItem';
import { fetchCategoriesSuccess } from '../../store/slices/categoriesSlice';

const BudgetScreen = () => {
  const navigation = useNavigation();
  const theme = useTheme();
  const database = useDatabase();
  const dispatch = useDispatch();
  
  const { currentMonth, budgets, totalAssigned, totalAvailable, status } = useSelector(state => state.budget);
  const { totalBalance, readyToAssign } = useSelector(state => state.accounts);
  const { categories } = useSelector(state => state.categories);
  
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
  const [monthDate, setMonthDate] = useState(new Date());
  const [isAddCategoryModalVisible, setIsAddCategoryModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#4CAF50');
  const [isLoading, setIsLoading] = useState(true);
  
  // Format month display
  const formattedMonth = format(new Date(monthDate), 'MMMM yyyy');
  
  useEffect(() => {
    // Set current month based on monthDate
    const formattedDate = format(monthDate, 'yyyy-MM');
    dispatch(setCurrentMonth(formattedDate));
  }, [monthDate, dispatch]);
  
  useEffect(() => {
    const loadBudgetData = async () => {
      try {
        dispatch(fetchBudgetsStart());
        
        // Calculate ready to assign
        const accountsCollection = database.collections.get('accounts');
        const accounts = await accountsCollection.query().fetch();
        
        const totalAccountBalance = accounts.reduce(
          (sum, account) => sum + account.currentBalance, 
          0
        );
        
        // Fetch budget data for current month
        const budgetsCollection = database.collections.get('category_budgets');
        const categoriesCollection = database.collections.get('categories');
        
        const budgetsData = await budgetsCollection
          .query(Q.where('month', currentMonth))
          .fetch();
          
        const totalBudgetAssigned = budgetsData.reduce(
          (sum, budget) => sum + budget.assigned, 
          0
        );
        
        // Calculate ready to assign
        const availableToAssign = totalAccountBalance - totalBudgetAssigned;
        dispatch(updateReadyToAssign(availableToAssign));
        
        // Fetch categories
        const categoriesData = await categoriesCollection.query().fetch();
        const mappedCategories = categoriesData.map(category => ({
          id: category.id,
          name: category.name,
          icon: category.icon || 'folder-outline',
          color: category.color || theme.colors.primary,
        }));
        
        dispatch(fetchCategoriesSuccess(mappedCategories));
        
        // Map budget data with category information
        const budgetsWithCategories = await Promise.all(
          budgetsData.map(async budget => {
            const category = await budget.category.fetch();
            return {
              id: budget.id,
              month: budget.month,
              assigned: budget.assigned,
              available: budget.available,
              category: {
                id: category.id,
                name: category.name,
                icon: category.icon || 'folder-outline',
                color: category.color || theme.colors.primary,
              },
            };
          })
        );
        
        dispatch(fetchBudgetsSuccess(budgetsWithCategories));
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading budget data:', error);
        dispatch(fetchBudgetsFailure(error.message));
        setIsLoading(false);
      }
    };
    
    loadBudgetData();
  }, [database, dispatch, currentMonth, theme.colors.primary]);
  
  const handlePreviousMonth = () => {
    setMonthDate(prevDate => subMonths(prevDate, 1));
  };
  
  const handleNextMonth = () => {
    setMonthDate(prevDate => addMonths(prevDate, 1));
  };
  
  const handleToday = () => {
    setMonthDate(startOfMonth(new Date()));
  };
  
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      return;
    }
    
    try {
      await database.action(async () => {
        const categoriesCollection = database.collections.get('categories');
        
        const category = await categoriesCollection.create(newCategory => {
          newCategory.name = newCategoryName.trim();
          newCategory.icon = 'folder-outline';
          newCategory.color = newCategoryColor;
          newCategory.createdAt = new Date();
        });
        
        // Update categories in Redux
        const newCategoryObject = {
          id: category.id,
          name: category.name,
          icon: category.icon,
          color: category.color,
        };
        
        dispatch(fetchCategoriesSuccess([...categories, newCategoryObject]));
      });
      
      // Reset form and close modal
      setNewCategoryName('');
      setNewCategoryColor('#4CAF50');
      setIsAddCategoryModalVisible(false);
    } catch (error) {
      console.error('Error creating category:', error);
    }
  };
  
  const handleAssignToBudget = async (categoryId, amount, previousAssigned) => {
    if (isNaN(amount)) return;
    
    try {
      await database.action(async () => {
        const budgetsCollection = database.collections.get('category_budgets');
        const categoriesCollection = database.collections.get('categories');
        
        // Find if budget already exists for this category and month
        const existingBudgets = await budgetsCollection
          .query(
            Q.where('category_id', categoryId),
            Q.where('month', currentMonth)
          )
          .fetch();
        
        // Get category
        const category = await categoriesCollection.find(categoryId);
        
        if (existingBudgets.length > 0) {
          // Update existing budget
          const budget = existingBudgets[0];
          const difference = amount - budget.assigned;
          
          await budget.update(budgetRecord => {
            budgetRecord.assigned = amount;
            budgetRecord.available += difference;
            budgetRecord.updatedAt = new Date();
          });
        } else {
          // Create new budget entry
          await budgetsCollection.create(budgetRecord => {
            budgetRecord.month = currentMonth;
            budgetRecord.assigned = amount;
            budgetRecord.available = amount;
            budgetRecord.category.set(category);
            budgetRecord.createdAt = new Date();
            budgetRecord.updatedAt = new Date();
          });
        }
        
        // Update Redux state
        dispatch(assignToBudgetSuccess({
          categoryId,
          amount,
          previousAssigned: previousAssigned || 0
        }));
        
        // Update ready to assign
        const difference = amount - (previousAssigned || 0);
        dispatch(updateReadyToAssign(readyToAssign - difference));
      });
    } catch (error) {
      console.error('Error assigning to budget:', error);
    }
  };
  
  const renderMonthSelector = () => (
    <View style={styles.monthSelector}>
      <IconButton icon="chevron-left" size={28} onPress={handlePreviousMonth} />
      
      <TouchableOpacity 
        onPress={() => setIsMonthPickerVisible(true)}
        style={styles.monthDisplay}
      >
        <Text style={styles.monthText}>{formattedMonth}</Text>
        <IconButton icon="calendar" size={20} />
      </TouchableOpacity>
      
      <IconButton icon="chevron-right" size={28} onPress={handleNextMonth} />
    </View>
  );
  
  const renderSummary = () => (
    <Surface style={styles.summaryContainer}>
      <View style={styles.summaryItem}>
        <Text style={styles.summaryLabel}>Ready to Assign</Text>
        <Text 
          style={[
            styles.summaryAmount, 
            { color: readyToAssign < 0 ? theme.colors.error : theme.colors.success }
          ]}
        >
          ${readyToAssign.toFixed(2)}
        </Text>
      </View>
      
      <Divider style={styles.divider} />
      
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Assigned</Text>
          <Text style={styles.summaryAmount}>${totalAssigned.toFixed(2)}</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Available</Text>
          <Text 
            style={[
              styles.summaryAmount,
              { color: totalAvailable < 0 ? theme.colors.error : theme.colors.text }
            ]}
          >
            ${totalAvailable.toFixed(2)}
          </Text>
        </View>
      </View>
    </Surface>
  );
  
  const renderCategoryList = () => {
    // If no categories, show empty state
    if (categories.length === 0) {
      return (
        <EmptyState
          icon="folder-outline"
          title="No Categories"
          message="Create categories to start budgeting"
          buttonLabel="Create Category"
          onButtonPress={() => setIsAddCategoryModalVisible(true)}
        />
      );
    }
    
    return (
      <View style={styles.categoriesContainer}>
        <View style={styles.categoriesHeader}>
          <Headline style={styles.categoriesTitle}>Categories</Headline>
          <Button 
            mode="contained" 
            icon="plus"
            onPress={() => setIsAddCategoryModalVisible(true)}
          >
            Add Category
          </Button>
        </View>
        
        {categories.map(category => {
          // Find budget for this category
          const budget = budgets.find(b => b.category.id === category.id);
          const assigned = budget ? budget.assigned : 0;
          const available = budget ? budget.available : 0;
          
          return (
            <CategoryBudgetItem
              key={category.id}
              category={category}
              assigned={assigned}
              available={available}
              onAssign={(amount) => handleAssignToBudget(category.id, amount, assigned)}
              onPress={() => navigation.navigate('CategoryDetails', { categoryId: category.id })}
            />
          );
        })}
      </View>
    );
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {renderMonthSelector()}
      {renderSummary()}
      
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        {renderCategoryList()}
      </ScrollView>
      
      {/* Add Category Modal */}
      <Portal>
        <Modal
          visible={isAddCategoryModalVisible}
          onDismiss={() => setIsAddCategoryModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Headline style={styles.modalTitle}>Create Category</Headline>
          
          <TextInput
            label="Category Name"
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            style={styles.input}
            mode="outlined"
          />
          
          <View style={styles.colorContainer}>
            <Text style={styles.colorLabel}>Select Color:</Text>
            <View style={styles.colorOptions}>
              {['#4CAF50', '#2196F3', '#FFC107', '#F44336', '#9C27B0', '#FF5722', '#607D8B'].map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    newCategoryColor === color && styles.selectedColor
                  ]}
                  onPress={() => setNewCategoryColor(color)}
                />
              ))}
            </View>
          </View>
          
          <View style={styles.modalActions}>
            <Button onPress={() => setIsAddCategoryModalVisible(false)}>Cancel</Button>
            <Button 
              mode="contained"
              onPress={handleCreateCategory}
              disabled={!newCategoryName.trim()}
            >
              Create
            </Button>
          </View>
        </Modal>
      </Portal>
      
      {/* Month Picker Modal */}
      <Portal>
        <Modal
          visible={isMonthPickerVisible}
          onDismiss={() => setIsMonthPickerVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Headline style={styles.modalTitle}>Select Month</Headline>
          
          {/* We would typically use a date picker here, but for simplicity we'll 
              just use buttons for this example */}
          <Button 
            mode="contained" 
            onPress={() => {
              handleToday();
              setIsMonthPickerVisible(false);
            }}
            style={styles.monthButton}
          >
            Current Month
          </Button>
          
          <Button 
            mode="outlined" 
            onPress={() => {
              setMonthDate(prevDate => subMonths(prevDate, 1));
              setIsMonthPickerVisible(false);
            }}
            style={styles.monthButton}
          >
            Previous Month
          </Button>
          
          <Button 
            mode="outlined" 
            onPress={() => {
              setMonthDate(prevDate => addMonths(prevDate, 1));
              setIsMonthPickerVisible(false);
            }}
            style={styles.monthButton}
          >
            Next Month
          </Button>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#fff',
    elevation: 2,
  },
  monthDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  summaryContainer: {
    padding: 16,
    margin: 16,
    elevation: 2,
    borderRadius: 8,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#757575',
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  divider: {
    marginVertical: 16,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  categoriesContainer: {
    margin: 16,
  },
  categoriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoriesTitle: {
    fontSize: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  modalTitle: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  colorContainer: {
    marginBottom: 16,
  },
  colorLabel: {
    marginBottom: 8,
  },
  colorOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  colorOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  selectedColor: {
    borderWidth: 3,
    borderColor: '#000',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  monthButton: {
    marginVertical: 8,
  },
});

export default BudgetScreen;