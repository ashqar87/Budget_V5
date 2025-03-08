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
        const budgetsCollection = database.collections.get('category_budgets');
        
        // Get current month for budget updates
        const currentMonth = format(new Date(), 'yyyy-MM');
        
        // Get account record
        const accountRecord = await accountsCollection.find(selectedAccount.id);
        
        // Create transaction
        const transaction = await transactionsCollection.create(tx => {
          tx.amount = parsedAmount;
          tx.payee = payee.trim();
          tx.notes = notes.trim();
          tx.type = transactionType;
          tx.account.set(accountRecord);
          tx.date = date;
          tx.createdAt = new Date();
          tx.updatedAt = new Date();
          
          // Set category if expense
          if (transactionType === 'expense' && selectedCategory) {
            tx.category.id = selectedCategory.id;
          }
          
          // Set transfer account if transfer
          if (transactionType === 'transfer' && selectedTransferAccount) {
            tx.transferAccount.id = selectedTransferAccount.id;
          }
        });
        
        // Update account balance
        let newBalance = accountRecord.currentBalance;
        
        if (transactionType === 'expense') {
          newBalance -= parsedAmount;
        } else if (transactionType === 'income') {
          newBalance += parsedAmount;
        } else if (transactionType === 'transfer') {
          newBalance -= parsedAmount;
          
          // Update transfer account balance
          const transferAccount = await accountsCollection.find(selectedTransferAccount.id);
          await transferAccount.update(acc => {
            acc.currentBalance = acc.currentBalance + parsedAmount;
            acc.updatedAt = new Date();
          });
          
          // Dispatch update for transfer account
          dispatch(updateAccountSuccess({
            id: transferAccount.id,
            currentBalance: transferAccount.currentBalance,
            name: transferAccount.name,
            initialBalance: transferAccount.initialBalance,
            accountType: transferAccount.accountType,
          }));
        }
        
        // Update account
        await accountRecord.update(acc => {
          acc.currentBalance = newBalance;
          acc.updatedAt = new Date();
        });
        
        // Update budget available amount if expense
        if (transactionType === 'expense' && selectedCategory) {
          // Find budget for this category and month
          const budgets = await budgetsCollection
            .query(
              Q.where('category_id', selectedCategory.id),
              Q.where('month', currentMonth)
            )
            .fetch();
          
          if (budgets.length > 0) {
            const budget = budgets[0];
            await budget.update(b => {
              b.available = b.available - parsedAmount;
              b.updatedAt = new Date();
            });
            
            // Dispatch budget update
            dispatch(updateBudgetAvailableSuccess({
              categoryId: selectedCategory.id,
              availableDifference: -parsedAmount
            }));
          }
        }
        
        // Dispatch account update
        dispatch(updateAccountSuccess({
          id: accountRecord.id,
          currentBalance: accountRecord.currentBalance,
          name: accountRecord.name,
          initialBalance: accountRecord.initialBalance,
          accountType: accountRecord.accountType,
        }));
        
        // Dispatch transaction update
        dispatch(addTransactionSuccess({
          id: transaction.id,
          amount: transaction.amount,
          payee: transaction.payee,
          notes: transaction.notes,
          date: transaction.date,
          type: transaction.type,
          account: {
            id: accountRecord.id,
            name: accountRecord.name
          },
          category: selectedCategory ? {
            id: selectedCategory.id,
            name: selectedCategory.name
          } : null,
          transferAccount: selectedTransferAccount ? {
            id: selectedTransferAccount.id,
            name: selectedTransferAccount.name
          } : null,
        }));
      });
      
      // Navigate back
      navigation.goBack();
    } catch (error) {
      console.error('Error creating transaction:', error);
      Alert.alert('Error', 'Failed to create transaction. Please try again.');
    }
  };

  const renderAccountSelection = () => (
    <TouchableOpacity onPress={() => setShowAccountDialog(true)}>
      <View style={styles.pickerButton}>
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
      
      {/* Account Selection Dialog */}
      <Portal>
        <Dialog visible={showAccountDialog} onDismiss={() => setShowAccountDialog(false)}>
          <Dialog.Title>Select Account</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              onValueChange={(value) => {
                const account = accounts.find(acc => acc.id === value);
                setSelectedAccount(account);
                setShowAccountDialog(false);
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