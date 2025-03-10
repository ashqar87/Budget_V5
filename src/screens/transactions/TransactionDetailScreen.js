import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Card, Title, Text, Button, Divider, Portal, Dialog, ActivityIndicator, useTheme, TextInput, SegmentedButtons, List, RadioButton } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { deleteTransactionSuccess, updateTransactionSuccess } from '../../store/slices/transactionsSlice';
import { updateAccountSuccess } from '../../store/slices/accountsSlice';
import { updateBudgetSuccess } from '../../store/slices/budgetSlice';
import { format } from 'date-fns';
import { useDatabase } from '../../context/DatabaseContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

// Helper function to safely parse dates
const safelyParseDate = (dateValue) => {
  if (!dateValue) return new Date();
  
  try {
    // If it's already a Date object
    if (dateValue instanceof Date) return dateValue;
    
    // If it's a number (timestamp)
    if (typeof dateValue === 'number') {
      const date = new Date(dateValue);
      // Check if valid date
      return isNaN(date.getTime()) ? new Date() : date;
    }
    
    // If it's a string (ISO format)
    if (typeof dateValue === 'string') {
      const date = new Date(dateValue);
      return isNaN(date.getTime()) ? new Date() : date;
    }
    
    // Default fallback
    return new Date();
  } catch (e) {
    console.error('Error parsing date:', e, dateValue);
    return new Date();
  }
};

// Helper function to safely format dates
const safelyFormatDate = (date, formatString) => {
  try {
    const parsedDate = safelyParseDate(date);
    return format(parsedDate, formatString);
  } catch (e) {
    console.error('Error formatting date:', e);
    return 'Unknown date';
  }
};

const TransactionDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const database = useDatabase();
  const theme = useTheme();
  
  // Get params from route
  const { transactionId } = route.params || {};
  const initialTransactionData = route.params?.transaction;
  
  // Local state
  const [transaction, setTransaction] = useState(initialTransactionData || null);
  const [isLoading, setIsLoading] = useState(!initialTransactionData);
  const [isLoadingError, setIsLoadingError] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDialogVisible, setConfirmDialogVisible] = useState(false);
  
  // Add debugging for navigation params
  console.log('Transaction detail params:', route.params);
  
  // Get data from Redux
  const transactions = useSelector(state => state.transactions?.transactions || []);
  const accounts = useSelector(state => state.accounts?.accounts || []);
  const categories = useSelector(state => state.categories?.categories || []);
  
  // Other states for editing
  const [isEditing, setIsEditing] = useState(false);
  const [editedAmount, setEditedAmount] = useState('');
  const [editedPayee, setEditedPayee] = useState('');
  const [editedNotes, setEditedNotes] = useState('');
  const [editedDate, setEditedDate] = useState(new Date());
  const [editedType, setEditedType] = useState('');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [accountDialogVisible, setAccountDialogVisible] = useState(false);
  const [categoryDialogVisible, setCategoryDialogVisible] = useState(false);

  // Load transaction data if only ID is provided
  useEffect(() => {
    const loadTransaction = async () => {
      // Skip if we already have the transaction data or no ID
      if (transaction || !transactionId) {
        return;
      }
      
      try {
        setIsLoading(true);
        console.log(`Loading transaction ${transactionId} from database`);
        
        // First check if transaction exists in Redux store
        const transactionFromRedux = transactions.find(t => t.id === transactionId);
        if (transactionFromRedux) {
          console.log('Found transaction in Redux store');
          setTransaction(transactionFromRedux);
          setIsLoading(false);
          return;
        }
        
        // Otherwise load from database
        const transactionsCollection = database.collections.get('transactions');
        const transactionData = await transactionsCollection.find(transactionId);
        
        if (!transactionData) {
          throw new Error(`Transaction with ID ${transactionId} not found`);
        }
        
        // Load related category and account
        const categoriesCollection = database.collections.get('categories');
        const accountsCollection = database.collections.get('accounts');
        
        // Load category if transaction has a category_id
        let category = null;
        if (transactionData.category_id) {
          const categoryData = await categoriesCollection.find(transactionData.category_id);
          if (categoryData) {
            category = categoryData;
          }
        }
        
        // Load account
        let account = null;
        if (transactionData.account_id) {
          const accountData = await accountsCollection.find(transactionData.account_id);
          if (accountData) {
            account = accountData;
          }
        }
        
        // Set the transaction with loaded related data
        setTransaction({
          ...transactionData,
          category,
          account
        });
        
      } catch (error) {
        console.error('Error loading transaction:', error);
        setIsLoadingError(true);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTransaction();
  }, [transactionId, database, transaction, transactions]);
  
  // Initialize edit form when transaction loads
  useEffect(() => {
    if (transaction && isEditing) {
      setEditedAmount(transaction.amount.toString());
      setEditedPayee(transaction.payee || '');
      setEditedNotes(transaction.notes || '');
      // Safe date parsing for editing
      setEditedDate(safelyParseDate(transaction.date));
      setEditedType(transaction.type || 'expense');
      
      // Find and set the selected account
      const transactionAccount = accounts.find(acc => acc.id === transaction.account_id);
      setSelectedAccount(transactionAccount || null);
      
      // Find and set the selected category if it's an expense
      if (transaction.type === 'expense' && transaction.category_id) {
        const transactionCategory = categories.find(cat => cat.id === transaction.category_id);
        setSelectedCategory(transactionCategory || null);
      } else {
        setSelectedCategory(null);
      }
    }
  }, [transaction, isEditing, accounts, categories]);
  
  // Handle date change in the picker
  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || editedDate;
    setShowDatePicker(false);
    setEditedDate(currentDate);
  };

  // Handle saving edits
  const handleSaveEdit = async () => {
    try {
      const parsedAmount = parseFloat(editedAmount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        Alert.alert('Error', 'Please enter a valid amount');
        return;
      }
      
      if (!editedPayee.trim()) {
        Alert.alert('Error', 'Please enter a payee name');
        return;
      }
      
      if (!selectedAccount) {
        Alert.alert('Error', 'Please select an account');
        return;
      }
      
      if (editedType === 'expense' && !selectedCategory) {
        Alert.alert('Error', 'Please select a category for this expense');
        return;
      }
      
      setIsLoading(true);
      
      await database.action(async () => {
        // 1. Get collections
        const transactionsCollection = database.collections.get('transactions');
        const accountsCollection = database.collections.get('accounts');
        
        // 2. Get current transaction and account
        const currentTransaction = await transactionsCollection.find(transaction.id);
        const currentAccount = await accountsCollection.find(transaction.account_id);
        
        if (!currentTransaction || !currentAccount) {
          throw new Error('Transaction or account not found');
        }
        
        // 3. Calculate account balance changes
        let newAccountBalance = currentAccount.currentBalance;
        
        // First reverse the effect of the old transaction
        if (currentTransaction.type === 'expense') {
          newAccountBalance += currentTransaction.amount; // Add back expense
        } else if (currentTransaction.type === 'income') {
          newAccountBalance -= currentTransaction.amount; // Deduct income
        }
        
        // Then apply the new transaction
        if (editedType === 'expense') {
          newAccountBalance -= parsedAmount; // Deduct new expense
        } else if (editedType === 'income') {
          newAccountBalance += parsedAmount; // Add new income
        }
        
        // 4. Update the transaction
        await transactionsCollection.update(transaction.id, tx => {
          tx.amount = parsedAmount;
          tx.payee = editedPayee.trim();
          tx.notes = editedNotes.trim();
          tx.type = editedType;
          tx.date = editedDate.getTime(); // Store as timestamp
          tx.updatedAt = new Date();
          
          // Only set category for expense transactions
          tx.category_id = editedType === 'expense' && selectedCategory ? selectedCategory.id : null;
          
          // Handle account changes if needed
          if (selectedAccount.id !== currentAccount.id) {
            tx.account_id = selectedAccount.id;
          }
        });
        
        // 5. Update account balance
        await accountsCollection.update(currentAccount.id, account => {
          account.currentBalance = newAccountBalance;
          account.updatedAt = new Date();
        });
        
        // 6. Update Redux state
        // For the transaction
        dispatch(updateTransactionSuccess({
          id: transaction.id,
          changes: {
            amount: parsedAmount,
            payee: editedPayee.trim(),
            notes: editedNotes.trim(),
            type: editedType,
            date: editedDate.getTime(),
            updatedAt: new Date().toISOString(),
            category_id: editedType === 'expense' && selectedCategory ? selectedCategory.id : null,
            account_id: selectedAccount.id,
            // Include related objects for UI
            category: editedType === 'expense' && selectedCategory ? selectedCategory : null,
            account: selectedAccount
          }
        }));
        
        // For the account
        dispatch(updateAccountSuccess({
          id: currentAccount.id,
          changes: {
            currentBalance: newAccountBalance,
            updatedAt: new Date().toISOString()
          }
        }));
        
        // 7. Update local state
        setTransaction({
          ...transaction,
          amount: parsedAmount,
          payee: editedPayee.trim(),
          notes: editedNotes.trim(),
          type: editedType,
          date: editedDate.getTime(),
          updatedAt: new Date().toISOString(),
          category_id: editedType === 'expense' && selectedCategory ? selectedCategory.id : null,
          account_id: selectedAccount.id,
          category: editedType === 'expense' && selectedCategory ? selectedCategory : null,
          account: selectedAccount
        });
        
        // Exit edit mode
        setIsEditing(false);
        
        Alert.alert('Success', 'Transaction updated successfully');
      });
    } catch (error) {
      console.error('Error updating transaction:', error);
      Alert.alert('Error', `Failed to update transaction: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Render edit form
  const renderEditForm = () => (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Title style={styles.editHeader}>Edit Transaction</Title>
          
          {/* Transaction Type */}
          <Text style={styles.inputLabel}>Transaction Type</Text>
          <SegmentedButtons
            value={editedType}
            onValueChange={setEditedType}
            buttons={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' }
            ]}
            style={styles.segmentedButton}
          />
          
          {/* Amount */}
          <TextInput
            label="Amount"
            value={editedAmount}
            onChangeText={setEditedAmount}
            keyboardType="decimal-pad"
            style={styles.input}
            mode="outlined"
            left={<TextInput.Affix text="$" />}
          />
          
          {/* Payee */}
          <TextInput
            label="Payee"
            value={editedPayee}
            onChangeText={setEditedPayee}
            style={styles.input}
            mode="outlined"
          />
          
          {/* Account Selection */}
          <Text style={styles.inputLabel}>Account</Text>
          <TouchableOpacity onPress={() => setAccountDialogVisible(true)}>
            <View style={styles.pickerButton}>
              <List.Item
                title={selectedAccount ? selectedAccount.name : 'Select Account'}
                description={selectedAccount ? `Balance: $${selectedAccount.currentBalance.toFixed(2)}` : 'Tap to select'}
                left={props => <List.Icon {...props} icon="bank" />}
                right={props => <List.Icon {...props} icon="chevron-right" />}
              />
            </View>
          </TouchableOpacity>
          
          {/* Category Selection (for expense only) */}
          {editedType === 'expense' && (
            <>
              <Text style={styles.inputLabel}>Category</Text>
              <TouchableOpacity onPress={() => setCategoryDialogVisible(true)}>
                <View style={styles.pickerButton}>
                  <List.Item
                    title={selectedCategory ? selectedCategory.name : 'Select Category'}
                    left={props => <List.Icon {...props} icon="folder" />}
                    right={props => <List.Icon {...props} icon="chevron-right" />}
                  />
                </View>
              </TouchableOpacity>
            </>
          )}
          
          {/* Date Selection */}
          <Text style={styles.inputLabel}>Date</Text>
          <TouchableOpacity onPress={() => setShowDatePicker(true)}>
            <List.Item
              title={format(editedDate, 'MMMM d, yyyy')}
              left={props => <List.Icon {...props} icon="calendar" />}
            />
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={editedDate}
              mode="date"
              display="default"
              onChange={handleDateChange}
            />
          )}
          
          {/* Notes */}
          <TextInput
            label="Notes (optional)"
            value={editedNotes}
            onChangeText={setEditedNotes}
            style={styles.input}
            mode="outlined"
            multiline
          />
        </Card.Content>
      </Card>
      
      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <Button 
          mode="outlined" 
          onPress={() => setIsEditing(false)}
          style={styles.actionButton}
        >
          Cancel
        </Button>
        
        <Button 
          mode="contained" 
          onPress={handleSaveEdit}
          style={styles.actionButton}
          loading={isLoading}
          disabled={isLoading}
        >
          Save Changes
        </Button>
      </View>
      
      {/* Account Selection Dialog */}
      <Portal>
        <Dialog visible={accountDialogVisible} onDismiss={() => setAccountDialogVisible(false)}>
          <Dialog.Title>Select Account</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              onValueChange={(value) => {
                const account = accounts.find(acc => acc.id === value);
                if (account) {
                  setSelectedAccount(account);
                  setAccountDialogVisible(false);
                }
              }}
              value={selectedAccount?.id || ''}
            >
              {accounts.map(account => (
                <RadioButton.Item
                  key={account.id}
                  label={`${account.name} ($${account.currentBalance.toFixed(2)})`}
                  value={account.id}
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setAccountDialogVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Category Selection Dialog */}
      <Portal>
        <Dialog visible={categoryDialogVisible} onDismiss={() => setCategoryDialogVisible(false)}>
          <Dialog.Title>Select Category</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              onValueChange={(value) => {
                const category = categories.find(cat => cat.id === value);
                if (category) {
                  setSelectedCategory(category);
                  setCategoryDialogVisible(false);
                }
              }}
              value={selectedCategory?.id || ''}
            >
              {categories.map(category => (
                <RadioButton.Item
                  key={category.id}
                  label={category.name}
                  value={category.id}
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCategoryDialogVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
  
  // If in edit mode, show edit form
  if (isEditing) {
    return renderEditForm();
  }
  
  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={{marginTop: 16}}>Loading transaction details...</Text>
      </View>
    );
  }
  
  // Show error state
  if (isLoadingError || !transaction) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.colors.error} />
          <Text style={styles.errorText}>Transaction not found or failed to load</Text>
          <Button 
            mode="contained" 
            onPress={() => navigation.goBack()}
            style={{marginTop: 20}}
          >
            Go Back
          </Button>
        </View>
      </View>
    );
  }
  
  const getTransactionTypeIcon = () => {
    switch (transaction.type) {
      case 'expense':
        return 'arrow-up';
      case 'income':
        return 'arrow-down';
      case 'transfer':
        return 'bank-transfer';
      default:
        return 'swap-horizontal';
    }
  };
  
  const getTransactionColor = () => {
    switch (transaction.type) {
      case 'expense':
        return theme.colors.error;
      case 'income':
        return theme.colors.success;
      default:
        return theme.colors.primary;
    }
  };
  
  const handleDelete = async () => {
    setIsDeleting(true);
    
    try {
      await database.action(async () => {
        // 1. Fetch fresh data for the transaction
        const transactionsCollection = database.collections.get('transactions');
        const transactionRecord = await transactionsCollection.find(transaction.id);
        
        if (!transactionRecord) {
          throw new Error('Transaction not found');
        }
        
        // 2. Get the related account to update its balance
        const accountsCollection = database.collections.get('accounts');
        const accountRecord = await accountsCollection.find(transaction.account_id);
        
        if (!accountRecord) {
          throw new Error('Account not found');
        }
        
        let newAccountBalance = accountRecord.currentBalance;
        
        // 3. Adjust account balance (reverse the transaction's effect)
        if (transactionRecord.type === 'expense') {
          // Add the expense amount back to the account
          newAccountBalance += transactionRecord.amount;
        } else if (transactionRecord.type === 'income') {
          // Deduct the income amount from the account
          newAccountBalance -= transactionRecord.amount;
        } else if (transactionRecord.type === 'transfer') {
          // For transfers, adjust both accounts
          newAccountBalance += transactionRecord.amount; // Add back to source account
          
          // Find and adjust destination account if it exists
          if (transactionRecord.transfer_account_id) {
            const transferAccount = await accountsCollection.find(transactionRecord.transfer_account_id);
            if (transferAccount) {
              // Subtract the amount from the transfer destination account
              await accountsCollection.update(transferAccount.id, account => {
                account.currentBalance -= transactionRecord.amount;
                account.updatedAt = new Date();
              });
              
              // Update Redux state for transfer account
              dispatch(updateAccountSuccess({
                id: transferAccount.id,
                changes: {
                  currentBalance: transferAccount.currentBalance - transactionRecord.amount,
                  updatedAt: new Date().toISOString()
                }
              }));
            }
          }
        }
        
        // 4. Update the account balance
        await accountsCollection.update(accountRecord.id, account => {
          account.currentBalance = newAccountBalance;
          account.updatedAt = new Date();
        });
        
        // 5. If it's an expense with a category, update the category budget
        if (transactionRecord.type === 'expense' && transactionRecord.category_id) {
          // Get the transaction month for finding the right budget
          const transactionMonth = format(new Date(transactionRecord.date), 'yyyy-MM');
          
          // Find the budget for this category and month
          const budgetsCollection = database.collections.get('category_budgets');
          const budgets = await budgetsCollection.query().fetch();
          
          const budget = budgets.find(b => 
            b.category_id === transactionRecord.category_id && 
            b.month === transactionMonth
          );
          
          if (budget) {
            // Increase available amount (since we're refunding the expense)
            const newAvailable = budget.available + transactionRecord.amount;
            
            await budgetsCollection.update(budget.id, b => {
              b.available = newAvailable;
              b.updatedAt = new Date();
            });
            
            // Update Redux for budget
            dispatch(updateBudgetSuccess({
              id: budget.id,
              changes: {
                available: newAvailable,
                updatedAt: new Date().toISOString()
              }
            }));
          }
        }
        
        // 6. Delete the transaction
        await transactionsCollection.delete(transactionRecord.id);
        
        // 7. Update Redux state for the account
        dispatch(updateAccountSuccess({
          id: accountRecord.id,
          changes: {
            currentBalance: newAccountBalance,
            updatedAt: new Date().toISOString()
          }
        }));
        
        // 8. Update Redux state for the transaction (remove it)
        dispatch(deleteTransactionSuccess(transactionRecord.id));
        
        // 9. Always navigate back to previous screen - don't use specific screen name
        setTimeout(() => navigation.goBack(), 100);
      });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      Alert.alert('Error', 'Failed to delete transaction: ' + error.message);
    } finally {
      setIsDeleting(false);
      setConfirmDialogVisible(false);
    }
  };
  
  // Make delete button more prominent
  return (
    <ScrollView style={styles.container}>
      {/* Transaction Summary Card */}
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.headerRow}>
            <View style={[styles.typeIndicator, { backgroundColor: getTransactionColor() }]}>
              <MaterialCommunityIcons name={getTransactionTypeIcon()} color="white" size={24} />
            </View>
            
            <View style={styles.headerContent}>
              <Title>{transaction.payee}</Title>
              <Text style={styles.date}>
                {safelyFormatDate(transaction.date, 'MMMM d, yyyy')}
              </Text>
            </View>
          </View>
          
          <View style={styles.amountContainer}>
            <Text style={[styles.amount, { color: getTransactionColor() }]}>
              {transaction.type === 'expense' ? '-' : transaction.type === 'income' ? '+' : ''}
              ${Math.abs(transaction.amount).toFixed(2)}
            </Text>
          </View>
          
          <Divider style={styles.divider} />
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue}>{transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account</Text>
            <Text style={styles.detailValue}>{transaction.account?.name || 'Unknown'}</Text>
          </View>
          
          {transaction.type === 'transfer' && transaction.transferAccount && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>To Account</Text>
              <Text style={styles.detailValue}>{transaction.transferAccount.name}</Text>
            </View>
          )}
          
          {transaction.type === 'expense' && transaction.category && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Category</Text>
              <Text style={styles.detailValue}>{transaction.category.name}</Text>
            </View>
          )}
          
          {transaction.notes && (
            <View style={styles.notesContainer}>
              <Text style={styles.detailLabel}>Notes</Text>
              <Text style={styles.notesText}>{transaction.notes}</Text>
            </View>
          )}
          
          <Divider style={styles.divider} />
          
          <View style={styles.timestampContainer}>
            <Text style={styles.timestamp}>Created: {safelyFormatDate(transaction.createdAt, 'MMM d, yyyy')}</Text>
            <Text style={styles.timestamp}>Last updated: {safelyFormatDate(transaction.updatedAt, 'MMM d, yyyy')}</Text>
          </View>
        </Card.Content>
      </Card>
      
      {/* Action Buttons - Include Edit button */}
      <View style={styles.actionsContainer}>
        <Button 
          mode="outlined" 
          onPress={() => navigation.goBack()}
          style={styles.actionButton}
        >
          Back
        </Button>
        
        <Button 
          mode="contained" 
          onPress={() => setIsEditing(true)}
          style={styles.actionButton}
          buttonColor={theme.colors.primary}
        >
          Edit
        </Button>
        
        <Button 
          mode="contained" 
          onPress={() => setConfirmDialogVisible(true)}
          style={styles.actionButton}
          buttonColor={theme.colors.error}
        >
          Delete
        </Button>
      </View>
      
      {/* Confirmation Dialog */}
      <Portal>
        <Dialog visible={confirmDialogVisible} onDismiss={() => setConfirmDialogVisible(false)}>
          <Dialog.Title>Delete Transaction</Dialog.Title>
          <Dialog.Content>
            <Text>Are you sure you want to delete this transaction? This action cannot be undone.</Text>
            <Text style={styles.dialogDetails}>
              {`${transaction.payee} - $${transaction.amount.toFixed(2)}`}
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirmDialogVisible(false)}>Cancel</Button>
            <Button 
              onPress={handleDelete} 
              loading={isDeleting} 
              disabled={isDeleting}
              textColor={theme.colors.error}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
};

// Add new styles for edit mode
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  typeIndicator: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  date: {
    color: '#757575',
  },
  amountContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  amount: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  divider: {
    marginVertical: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  detailLabel: {
    color: '#757575',
    fontWeight: '500',
  },
  detailValue: {
    fontWeight: '500',
  },
  notesContainer: {
    marginTop: 16,
  },
  notesText: {
    marginTop: 8,
    fontSize: 16,
    fontStyle: 'italic',
  },
  timestampContainer: {
    marginTop: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#9e9e9e',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 8,
    paddingVertical: 8
  },
  dialogDetails: {
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  editHeader: {
    marginBottom: 16,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    marginBottom: 12,
  },
  segmentedButton: {
    marginVertical: 12,
  },
  pickerButton: {
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
  },
});

export default TransactionDetailScreen;
