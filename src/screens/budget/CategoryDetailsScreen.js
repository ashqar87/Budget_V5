import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Card, Title, Paragraph, Button, Dialog, Portal, TextInput, Divider, IconButton, ActivityIndicator, useTheme, Surface } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { format } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDatabase } from '../../context/DatabaseContext';
import { Q } from '@nozbe/watermelondb';
import { updateCategorySuccess, deleteCategorySuccess } from '../../store/slices/categoriesSlice';
import { assignToBudgetSuccess } from '../../store/slices/budgetSlice';
import TransactionsList from '../../components/transactions/TransactionsList';

const CategoryDetailsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const database = useDatabase();
  const theme = useTheme();
  const { categoryId } = route.params;
  
  const [category, setCategory] = useState(null);
  const [budget, setBudget] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedColor, setEditedColor] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [currentMonthFormatted, setCurrentMonthFormatted] = useState('');
  
  useEffect(() => {
    const loadCategoryData = async () => {
      try {
        setIsLoading(true);
        
        // Get current month in YYYY-MM format
        const now = new Date();
        const currentMonth = format(now, 'yyyy-MM');
        setCurrentMonthFormatted(format(now, 'MMMM yyyy'));
        
        // Get category
        const categoriesCollection = database.collections.get('categories');
        const categoryRecord = await categoriesCollection.find(categoryId);
        
        setCategory({
          id: categoryRecord.id,
          name: categoryRecord.name,
          icon: categoryRecord.icon || 'folder-outline',
          color: categoryRecord.color || '#4CAF50',
          createdAt: categoryRecord.createdAt,
        });
        
        setEditedName(categoryRecord.name);
        setEditedColor(categoryRecord.color || '#4CAF50');
        
        // Get budget for this category and current month
        const budgetsCollection = database.collections.get('category_budgets');
        const budgetsForCategory = await budgetsCollection
          .query(
            Q.where('category_id', categoryId),
            Q.where('month', currentMonth)
          )
          .fetch();
        
        if (budgetsForCategory.length > 0) {
          const budgetRecord = budgetsForCategory[0];
          setBudget({
            id: budgetRecord.id,
            month: budgetRecord.month,
            assigned: budgetRecord.assigned,
            available: budgetRecord.available,
          });
          setBudgetAmount(budgetRecord.assigned.toString());
        }
        
        // Get recent transactions for this category
        const transactionsCollection = database.collections.get('transactions');
        const categoryTransactions = await transactionsCollection
          .query(
            Q.where('category_id', categoryId),
            Q.sortBy('date', Q.desc),
            Q.take(10)
          )
          .fetch();
        
        // Format transactions for display
        const formattedTransactions = await Promise.all(
          categoryTransactions.map(async transaction => {
            const account = await transaction.account.fetch();
            
            return {
              id: transaction.id,
              amount: transaction.amount,
              payee: transaction.payee,
              notes: transaction.notes,
              date: transaction.date,
              type: transaction.type,
              account: {
                id: account.id,
                name: account.name,
              },
            };
          })
        );
        
        setTransactions(formattedTransactions);
      } catch (error) {
        console.error('Error loading category details:', error);
        Alert.alert('Error', 'Failed to load category details');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCategoryData();
  }, [database, categoryId]);
  
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  const handleCancelEdit = () => {
    setEditedName(category.name);
    setEditedColor(category.color);
    setIsEditing(false);
  };
  
  const handleSave = async () => {
    if (!editedName.trim()) {
      Alert.alert('Invalid Name', 'Category name cannot be empty.');
      return;
    }
    
    try {
      await database.action(async () => {
        const categoriesCollection = database.collections.get('categories');
        const categoryRecord = await categoriesCollection.find(categoryId);
        
        await categoryRecord.update(category => {
          category.name = editedName.trim();
          category.color = editedColor;
        });
        
        // Update Redux store
        dispatch(updateCategorySuccess({
          id: categoryRecord.id,
          name: categoryRecord.name,
          icon: categoryRecord.icon,
          color: categoryRecord.color,
        }));
        
        // Update local state
        setCategory({
          ...category,
          name: editedName.trim(),
          color: editedColor,
        });
        
        setIsEditing(false);
      });
    } catch (error) {
      console.error('Error updating category:', error);
      Alert.alert('Error', 'Failed to update category. Please try again.');
    }
  };
  
  const handleDelete = async () => {
    try {
      await database.action(async () => {
        // Check if category has transactions
        const transactionsCollection = database.collections.get('transactions');
        const transactionCount = await transactionsCollection
          .query(Q.where('category_id', categoryId))
          .fetchCount();
        
        if (transactionCount > 0) {
          Alert.alert(
            'Cannot Delete Category',
            'This category has transactions associated with it. Please reassign these transactions first.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        // Delete category budgets
        const budgetsCollection = database.collections.get('category_budgets');
        const budgetsToDelete = await budgetsCollection
          .query(Q.where('category_id', categoryId))
          .fetch();
          
        for (const budget of budgetsToDelete) {
          await budget.markAsDeleted();
        }
        
        // Delete category
        const categoriesCollection = database.collections.get('categories');
        const categoryRecord = await categoriesCollection.find(categoryId);
        await categoryRecord.markAsDeleted();
        
        dispatch(deleteCategorySuccess(categoryId));
        
        // Navigate back to budget screen
        navigation.goBack();
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      Alert.alert('Error', 'Failed to delete category. Please try again.');
    }
  };
  
  const handleUpdateBudget = async () => {
    const amount = parseFloat(budgetAmount);
    if (isNaN(amount) || amount < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid budget amount.');
      return;
    }
    
    const previousAssigned = budget ? budget.assigned : 0;
    
    try {
      await database.action(async () => {
        const budgetsCollection = database.collections.get('category_budgets');
        const categoriesCollection = database.collections.get('categories');
        
        // Get current month in YYYY-MM format
        const currentMonth = format(new Date(), 'yyyy-MM');
        
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
          
          setBudget({
            id: budget.id,
            month: budget.month,
            assigned: amount,
            available: budget.available + difference,
          });
        } else {
          // Create new budget entry
          const newBudget = await budgetsCollection.create(budgetRecord => {
            budgetRecord.month = currentMonth;
            budgetRecord.assigned = amount;
            budgetRecord.available = amount;
            budgetRecord.category.set(category);
            budgetRecord.createdAt = new Date();
            budgetRecord.updatedAt = new Date();
          });
          
          setBudget({
            id: newBudget.id,
            month: newBudget.month,
            assigned: amount,
            available: amount,
          });
        }
        
        // Update Redux state
        dispatch(assignToBudgetSuccess({
          categoryId,
          amount,
          previousAssigned
        }));
      });
      
      setShowBudgetDialog(false);
    } catch (error) {
      console.error('Error updating budget:', error);
      Alert.alert('Error', 'Failed to update budget. Please try again.');
    }
  };
  
  const handleViewAllTransactions = () => {
    navigation.navigate('Transactions', { categoryId });
  };
  
  const handleAddTransaction = () => {
    navigation.navigate('AddTransaction', { categoryId });
  };
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.categoryHeader}>
            <View style={styles.categoryTitle}>
              <View 
                style={[
                  styles.categoryIcon, 
                  { backgroundColor: category.color }
                ]}
              >
                <MaterialCommunityIcons
                  name={category.icon}
                  size={24}
                  color="#FFFFFF"
                />
              </View>
              
              <Title style={styles.titleText}>{category.name}</Title>
            </View>
            
            <Button
              icon="pencil"
              mode="text"
              compact
              onPress={handleEdit}
            >
              Edit
            </Button>
          </View>
          
          <Divider style={styles.divider} />
          
          <Surface style={styles.budgetContainer}>
            <View style={styles.budgetHeader}>
              <Text style={styles.budgetLabel}>Budget for {currentMonthFormatted}</Text>
              <Button
                icon="pencil"
                mode="text"
                compact
                onPress={() => setShowBudgetDialog(true)}
              >
                Edit
              </Button>
            </View>
            
            <View style={styles.budgetDetails}>
              <View style={styles.budgetColumn}>
                <Text style={styles.budgetColumnLabel}>Assigned</Text>
                <Text style={styles.budgetColumnValue}>
                  ${budget ? budget.assigned.toFixed(2) : '0.00'}
                </Text>
              </View>
              
              <View style={styles.budgetColumn}>
                <Text style={styles.budgetColumnLabel}>Available</Text>
                <Text 
                  style={[
                    styles.budgetColumnValue,
                    { 
                      color: budget && budget.available < 0 
                        ? theme.colors.error 
                        : budget && budget.available > 0
                          ? theme.colors.success
                          : theme.colors.text 
                    }
                  ]}
                >
                  ${budget ? budget.available.toFixed(2) : '0.00'}
                </Text>
              </View>
            </View>
          </Surface>
          
          <View style={styles.actionsContainer}>
            <Button
              icon="cash-plus"
              mode="contained"
              style={styles.actionButton}
              onPress={handleAddTransaction}
            >
              Add Transaction
            </Button>
          </View>
        </Card.Content>
      </Card>
      
      <View style={styles.transactionSection}>
        <Title>Recent Transactions</Title>
        <TransactionsList 
          transactions={transactions}
          limit={5}
          showViewAll={transactions.length > 0}
          onViewAll={handleViewAllTransactions}
          emptyMessage="No transactions in this category yet"
        />
      </View>
      
      <View style={styles.dangerZone}>
        <Text style={styles.dangerTitle}>Danger Zone</Text>
        <Button
          icon="delete"
          mode="outlined"
          style={styles.deleteButton}
          textColor="#D32F2F"
          onPress={() => setShowDeleteDialog(true)}
        >
          Delete Category
        </Button>
      </View>
      
      {/* Edit Category Dialog */}
      <Portal>
        <Dialog visible={isEditing} onDismiss={handleCancelEdit}>
          <Dialog.Title>Edit Category</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Category Name"
              value={editedName}
              onChangeText={setEditedName}
              style={styles.dialogInput}
            />
            
            <Text style={styles.colorLabel}>Select Color:</Text>
            <View style={styles.colorOptions}>
              {['#4CAF50', '#2196F3', '#FFC107', '#F44336', '#9C27B0', '#FF5722', '#607D8B'].map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    editedColor === color && styles.selectedColor
                  ]}
                  onPress={() => setEditedColor(color)}
                />
              ))}
            </View>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={handleCancelEdit}>Cancel</Button>
            <Button onPress={handleSave}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog visible={showDeleteDialog} onDismiss={() => setShowDeleteDialog(false)}>
          <Dialog.Title>Delete Category</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to delete this category? This action cannot be undone.
            </Paragraph>
            <Paragraph style={styles.warningText}>
              Note: Categories with transactions cannot be deleted. You must reassign
              or delete those transactions first.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button onPress={handleDelete} textColor="#D32F2F">Delete</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Budget Edit Dialog */}
      <Portal>
        <Dialog visible={showBudgetDialog} onDismiss={() => setShowBudgetDialog(false)}>
          <Dialog.Title>Edit Budget</Dialog.Title>
          <Dialog.Content>
            <Paragraph style={styles.dialogMessage}>
              Set budget amount for {category.name} for {currentMonthFormatted}
            </Paragraph>
            <TextInput
              label="Budget Amount"
              value={budgetAmount}
              onChangeText={setBudgetAmount}
              keyboardType="decimal-pad"
              style={styles.dialogInput}
              left={<TextInput.Affix text="$" />}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowBudgetDialog(false)}>Cancel</Button>
            <Button onPress={handleUpdateBudget}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
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
  card: {
    margin: 16,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleText: {
    fontSize: 20,
  },
  divider: {
    marginVertical: 16,
  },
  budgetContainer: {
    padding: 16,
    borderRadius: 8,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  budgetLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  budgetDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  budgetColumn: {
    alignItems: 'center',
    minWidth: 100,
  },
  budgetColumnLabel: {
    fontSize: 14,
    color: '#757575',
  },
  budgetColumnValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  actionsContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  actionButton: {
    width: '100%',
  },
  transactionSection: {
    margin: 16,
  },
  dangerZone: {
    margin: 16,
    marginTop: 32,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    borderRadius: 8,
    backgroundColor: '#FFEBEE',
  },
  dangerTitle: {
    color: '#D32F2F',
    marginBottom: 12,
  },
  deleteButton: {
    borderColor: '#D32F2F',
  },
  dialogInput: {
    marginBottom: 12,
  },
  colorLabel: {
    marginTop: 8,
    marginBottom: 8,
  },
  colorOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    marginBottom: 8,
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
  warningText: {
    color: '#F44336',
    marginTop: 8,
    fontStyle: 'italic',
  },
  dialogMessage: {
    marginBottom: 16,
  },
});

export default CategoryDetailsScreen;