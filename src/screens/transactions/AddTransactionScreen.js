import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { TextInput, Button, Text, Headline, SegmentedButtons, Dialog, Portal, List, RadioButton, useTheme, IconButton } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { addTransactionSuccess } from '../../store/slices/transactionsSlice';
import { updateAccountSuccess } from '../../store/slices/accountsSlice';
import { updateBudgetAvailableSuccess } from '../../store/slices/budgetSlice';
import { useDatabase } from '../../context/DatabaseContext';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Q } from '../../db/query';
// Fix: Import the correct function from budgetUtils
import { updateBudgetFromTransaction, getCategoryBudget, getOrCreateBudget } from '../../utils/budgetUtils';
import { updateBudgetSuccess } from '../../store/slices/budgetSlice';

const AddTransactionScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const theme = useTheme();
  const database = useDatabase();

  // Get preselected account if provided
  const { accountId } = route.params || {};
  
  // Global state
  const accounts = useSelector(state => state.accounts.accounts);
  const categories = useSelector(state => state.categories.categories);
  
  // Form state
  const [amount, setAmount] = useState('');
  const [payee, setPayee] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(new Date());
  const [transactionType, setTransactionType] = useState('expense');
  
  // Selection state
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTransferAccount, setSelectedTransferAccount] = useState(null);
  
  // Dialog visibility state
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Get initial account if provided via route params
  useEffect(() => {
    if (accountId) {
      const account = accounts.find(acc => acc.id === accountId);
      if (account) {
        setSelectedAccount(account);
      }
    }
  }, [accountId, accounts]);

  // Add debugging for accounts
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      console.log(`Available accounts: ${accounts.length}`);
      console.log('Account IDs:', accounts.map(a => a.id).join(', '));
      
      // Automatically select the first account if one isn't already selected
      if (!selectedAccount && (!accountId || !accounts.find(a => a.id === accountId))) {
        setSelectedAccount(accounts[0]);
      }
    } else {
      console.warn('No accounts available in AddTransactionScreen');
    }
  }, [accounts, accountId, selectedAccount]);

  const handleAmountChange = (text) => {
    // Allow only numbers and decimal point
    const filteredText = text.replace(/[^0-9.]/g, '');
    setAmount(filteredText);
  };

  const handleTypeChange = (type) => {
    setTransactionType(type);
    // Clear category when switching to income or transfer
    if (type !== 'expense') {
      setSelectedCategory(null);
    }
    // Clear transfer account when switching away from transfer
    if (type !== 'transfer') {
      setSelectedTransferAccount(null);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(false);
    setDate(currentDate);
  };

  const validateForm = () => {
    const parsedAmount = parseFloat(amount);
    
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than zero.');
      return false;
    }
    
    if (!payee.trim()) {
      Alert.alert('Missing Payee', 'Please enter a payee name.');
      return false;
    }
    
    if (!selectedAccount) {
      Alert.alert('Account Required', 'Please select an account for this transaction.');
      return false;
    }
    
    if (transactionType === 'expense' && !selectedCategory) {
      Alert.alert('Category Required', 'Please select a category for this expense.');
      return false;
    }
    
    if (transactionType === 'transfer' && !selectedTransferAccount) {
      Alert.alert('Transfer Account Required', 'Please select a destination account for the transfer.');
      return false;
    }
    
    if (transactionType === 'transfer' && selectedAccount.id === selectedTransferAccount.id) {
      Alert.alert('Invalid Transfer', 'Source and destination accounts must be different.');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    const parsedAmount = parseFloat(amount);
    
    try {
      await database.action(async () => {
        const accountsCollection = database.collections.get('accounts');
        const transactionsCollection = database.collections.get('transactions');
        
        // First, get the source account
        const accountRecord = await accountsCollection.find(selectedAccount.id);
        if (!accountRecord) {
          throw new Error('Source account not found');
        }
        
        // Calculate new balances
        let newSourceBalance = accountRecord.currentBalance;
        
        if (transactionType === 'expense') {
          newSourceBalance -= parsedAmount;
        } else if (transactionType === 'income') {
          newSourceBalance += parsedAmount;
        } else if (transactionType === 'transfer') {
          newSourceBalance -= parsedAmount;
        }
        
        // Store transaction time
        const transactionTime = date.getTime();
        const now = new Date();
        
        // Create transaction
        const transaction = await transactionsCollection.create(tx => {
          tx.amount = parsedAmount;
          tx.payee = payee.trim();
          tx.notes = notes.trim();
          tx.type = transactionType;
          tx.account_id = selectedAccount.id;
          tx.date = transactionTime; // Store as timestamp
          tx.createdAt = now;
          tx.updatedAt = now;
          
          // Only set category for expense transactions
          tx.category_id = transactionType === 'expense' && selectedCategory ? selectedCategory.id : null;
          
          // Only set transfer account for transfer transactions  
          tx.transfer_account_id = transactionType === 'transfer' && selectedTransferAccount 
            ? selectedTransferAccount.id 
            : null;
        });
        
        // Update source account
        await accountsCollection.update(accountRecord.id, account => {
          account.currentBalance = newSourceBalance;
          account.updatedAt = now;
        });
        
        // First dispatch account update to prevent race conditions
        dispatch(updateAccountSuccess({
          id: selectedAccount.id,
          changes: {
            currentBalance: newSourceBalance,
            updatedAt: now.toISOString(),
            isTransfer: transactionType === 'transfer'
          }
        }));
        
        // Handle transfer to destination account if applicable
        if (transactionType === 'transfer' && selectedTransferAccount) {
          const transferAccount = await accountsCollection.find(selectedTransferAccount.id);
          if (transferAccount) {
            const transferNewBalance = transferAccount.currentBalance + parsedAmount;
            
            await accountsCollection.update(transferAccount.id, account => {
              account.currentBalance = transferNewBalance;
              account.updatedAt = now;
            });
            
            dispatch(updateAccountSuccess({
              id: transferAccount.id,
              changes: {
                currentBalance: transferNewBalance,
                updatedAt: now.toISOString(),
                isTransfer: true // Mark as transfer to prevent affecting readyToAssign
              }
            }));
          }
        }
        
        // Update budget if expense - USE THE UTILITY FUNCTION INSTEAD OF DIRECT UPDATES
        if (transactionType === 'expense' && selectedCategory) {
          try {
            // Use the updateBudgetFromTransaction utility function
            const updatedBudget = await updateBudgetFromTransaction({
              id: transaction.id,
              amount: parsedAmount,
              date: transactionTime,
              type: transactionType,
              category_id: selectedCategory.id
            });
            
            if (updatedBudget) {
              console.log(`Budget updated successfully: category ${selectedCategory.id}, new available = ${updatedBudget.available}`);
              
              // Update Redux immediately
              dispatch(updateBudgetSuccess({
                id: updatedBudget.id,
                changes: {
                  available: updatedBudget.available,
                  updatedAt: updatedBudget.updatedAt instanceof Date ? 
                    updatedBudget.updatedAt.toISOString() : updatedBudget.updatedAt
                }
              }));
            }
          } catch (budgetError) {
            console.error('Error updating category budget:', budgetError);
          }
        }
        
        // Dispatch transaction creation (convert dates to ISO strings for Redux)
        dispatch(addTransactionSuccess({
          id: transaction.id,
          amount: parsedAmount,
          payee: transaction.payee,
          notes: transaction.notes,
          date: transactionTime,
          type: transactionType,
          account_id: selectedAccount.id,
          category_id: transactionType === 'expense' && selectedCategory ? selectedCategory.id : null,
          transfer_account_id: transactionType === 'transfer' && selectedTransferAccount ? selectedTransferAccount.id : null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          // Include complete objects for UI display
          account: {
            id: selectedAccount.id,
            name: selectedAccount.name
          },
          // Make sure category data is included properly for display
          category: selectedCategory && transactionType === 'expense' ? {
            id: selectedCategory.id,
            name: selectedCategory.name,
            color: selectedCategory.color || '#757575',
            icon: selectedCategory.icon || 'folder'
          } : null,
          transferAccount: selectedTransferAccount && transactionType === 'transfer' ? {
            id: selectedTransferAccount.id,
            name: selectedTransferAccount.name
          } : null,
        }));
        
        // Navigate back after ALL updates are complete
        setTimeout(() => navigation.goBack(), 100);
      });
    } catch (error) {
      console.error('Error creating transaction:', error);
      Alert.alert('Error', 'Failed to create transaction: ' + error.message);
    }
  };

  const renderAccountSelection = () => (
    <TouchableOpacity 
      onPress={() => {
        if (accounts.length === 0) {
          // Handle no accounts case
          Alert.alert('No Accounts', 'Please create an account first.');
          // Use proper nested navigation syntax instead of direct 'AddAccount'
          navigation.navigate('Accounts', { screen: 'AddAccount' });
        } else {
          setShowAccountDialog(true);
        }
      }}
      style={styles.pickerButton}
    >
      <View>
        <Text style={styles.label}>From Account</Text>
        <List.Item
          title={selectedAccount ? selectedAccount.name : 'Select Account'}
          description={selectedAccount ? `Balance: $${selectedAccount.currentBalance.toFixed(2)}` : 'Tap to select'}
          left={props => <List.Icon {...props} icon="bank" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
        />
      </View>
    </TouchableOpacity>
  );
  
  const renderTransferAccountSelection = () => (
    <TouchableOpacity onPress={() => setShowTransferDialog(true)}>
      <View style={styles.pickerButton}>
        <Text style={styles.label}>To Account</Text>
        <List.Item
          title={selectedTransferAccount ? selectedTransferAccount.name : 'Select Destination Account'}
          description={selectedTransferAccount ? `Balance: $${selectedTransferAccount.currentBalance.toFixed(2)}` : 'Tap to select'}
          left={props => <List.Icon {...props} icon="bank-transfer" />}
          right={props => <List.Icon {...props} icon="chevron-right" />}
        />
      </View>
    </TouchableOpacity>
  );
  
  const renderCategorySelection = () => (
    transactionType === 'expense' && (
      <TouchableOpacity onPress={() => setShowCategoryDialog(true)}>
        <View style={styles.pickerButton}>
          <Text style={styles.label}>Category</Text>
          <List.Item
            title={selectedCategory ? selectedCategory.name : 'Select Category'}
            left={props => <List.Icon {...props} icon="folder" />}
            right={props => <List.Icon {...props} icon="chevron-right" />}
          />
        </View>
      </TouchableOpacity>
    )
  );
  
  const renderDatePicker = () => (
    <View>
      <Text style={styles.label}>Date</Text>
      <TouchableOpacity onPress={() => setShowDatePicker(true)}>
        <List.Item
          title={format(date, 'MMMM d, yyyy')}
          left={props => <List.Icon {...props} icon="calendar" />}
          right={props => <IconButton icon="pencil" size={20} />}
        />
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Headline style={styles.headline}>Add Transaction</Headline>
      
      {/* Transaction Type */}
      <Text style={styles.label}>Transaction Type</Text>
      <SegmentedButtons
        value={transactionType}
        onValueChange={handleTypeChange}
        buttons={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
          { value: 'transfer', label: 'Transfer' },
        ]}
        style={styles.segmentedButtons}
      />
      
      {/* Amount */}
      <TextInput
        label="Amount"
        value={amount}
        onChangeText={handleAmountChange}
        keyboardType="decimal-pad"
        style={styles.input}
        mode="outlined"
        left={<TextInput.Affix text="$" />}
      />
      
      {/* Payee */}
      <TextInput
        label="Payee"
        value={payee}
        onChangeText={setPayee}
        style={styles.input}
        mode="outlined"
      />
      
      {/* Account Selection */}
      {renderAccountSelection()}
      
      {/* Transfer Account (for transfer type) */}
      {transactionType === 'transfer' && renderTransferAccountSelection()}
      
      {/* Category Selection (for expense type) */}
      {renderCategorySelection()}
      
      {/* Date Selection */}
      {renderDatePicker()}
      
      {/* Notes */}
      <TextInput
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        style={styles.input}
        mode="outlined"
        multiline
        numberOfLines={3}
      />
      
      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={[styles.button, styles.cancelButton]}
        >
          Cancel
        </Button>
        
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.button}
        >
          Save
        </Button>
      </View>
      
      {/* Account Selection Dialog - Improved */}
      <Portal>
        <Dialog visible={showAccountDialog} onDismiss={() => setShowAccountDialog(false)}>
          <Dialog.Title>Select Account</Dialog.Title>
          <Dialog.Content>
            {accounts.length > 0 ? (
              <RadioButton.Group
                onValueChange={(value) => {
                  console.log("Selected account ID:", value);
                  const account = accounts.find(acc => acc.id === value);
                  if (account) {
                    setSelectedAccount(account);
                    setShowAccountDialog(false);
                  } else {
                    console.error("Couldn't find account with ID:", value);
                  }
                }}
                value={selectedAccount ? selectedAccount.id : ''}
              >
                {accounts.map(account => (
                  <RadioButton.Item
                    key={account.id}
                    label={`${account.name} ($${account.currentBalance.toFixed(2)})`}
                    value={account.id}
                  />
                ))}
              </RadioButton.Group>
            ) : (
              <Text>No accounts available. Please create an account first.</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAccountDialog(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Transfer Account Selection Dialog */}
      <Portal>
        <Dialog visible={showTransferDialog} onDismiss={() => setShowTransferDialog(false)}>
          <Dialog.Title>Select Destination</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              onValueChange={(value) => {
                const account = accounts.find(acc => acc.id === value);
                setSelectedTransferAccount(account);
                setShowTransferDialog(false);
              }}
              value={selectedTransferAccount ? selectedTransferAccount.id : ''}
            >
              {accounts
                .filter(account => selectedAccount ? account.id !== selectedAccount.id : true)
                .map(account => (
                  <RadioButton.Item
                    key={account.id}
                    label={`${account.name} ($${account.currentBalance.toFixed(2)})`}
                    value={account.id}
                  />
                ))
              }
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowTransferDialog(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Category Selection Dialog */}
      <Portal>
        <Dialog visible={showCategoryDialog} onDismiss={() => setShowCategoryDialog(false)}>
          <Dialog.Title>Select Category</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              onValueChange={(value) => {
                const category = categories.find(cat => cat.id === value);
                setSelectedCategory(category);
                setShowCategoryDialog(false);
              }}
              value={selectedCategory ? selectedCategory.id : ''}
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
            <Button onPress={() => setShowCategoryDialog(false)}>Cancel</Button>
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
  content: {
    padding: 16,
  },
  headline: {
    marginBottom: 20,
    fontSize: 24,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    marginBottom: 16,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  pickerButton: {
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
  cancelButton: {
    borderColor: '#ccc',
  },
});

export default AddTransactionScreen;