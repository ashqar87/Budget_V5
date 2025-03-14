import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Card, Title, Paragraph, Button, Dialog, Portal, TextInput, Divider, ActivityIndicator, useTheme } from 'react-native-paper';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { format } from 'date-fns';
import { useDatabase } from '../../context/DatabaseContext';
import { Q } from '../../db/query'; // Import our Q mock implementation
import { updateAccountSuccess, deleteAccountSuccess } from '../../store/slices/accountsSlice';
import TransactionsList from '../../components/transactions/TransactionsList';

const AccountDetailsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const database = useDatabase();
  const theme = useTheme();
  const { accountId } = route.params;
  
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedBalance, setEditedBalance] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  // Helper function to load data
  const loadAccountData = async () => {
    try {
      setIsLoading(true);
      console.log('Loading account data for account:', accountId);
      
      // Get account
      const accountsCollection = database.collections.get('accounts');
      const accountRecord = await accountsCollection.find(accountId);
      
      if (!accountRecord) {
        throw new Error(`Account with ID ${accountId} not found`);
      }
      
      setAccount({
        id: accountRecord.id,
        name: accountRecord.name,
        initialBalance: accountRecord.initialBalance,
        currentBalance: accountRecord.currentBalance,
        accountType: accountRecord.accountType,
        createdAt: accountRecord.createdAt,
      });
      
      setEditedName(accountRecord.name);
      setEditedBalance(accountRecord.currentBalance.toString());
      
      // Get recent transactions for this account
      const transactionsCollection = database.collections.get('transactions');
      const recentTransactions = await transactionsCollection
        .query(
          Q.where('account_id', accountId),
          Q.sortBy('date', Q.desc()),
          Q.take(10)
        )
        .fetch();
      
      console.log(`Loaded ${recentTransactions.length} recent transactions`);
      
      // Fetch category information for each transaction
      const categoriesCollection = database.collections.get('categories');
      const categories = await categoriesCollection.query().fetch();
      
      // Attach category information to transactions
      const transactionsWithCategories = recentTransactions.map(transaction => {
        const category = categories.find(cat => cat.id === transaction.category_id);
        return {
          ...transaction,
          category: category || null
        };
      });
      
      setTransactions(transactionsWithCategories);
    } catch (error) {
      console.error('Error loading account data:', error);
      Alert.alert('Error', `Failed to load account: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadAccountData();
  }, [database, accountId]);
  
  // Reload data when screen is focused again
  useFocusEffect(
    useCallback(() => {
      console.log('Account details screen focused - reloading data');
      loadAccountData();
      return () => {
        // Cleanup function if needed
      };
    }, [accountId, database])
  );
  
  const handleEdit = () => {
    setIsEditing(true);
  };
  
  const handleCancelEdit = () => {
    setEditedName(account.name);
    setEditedBalance(account.currentBalance.toString());
    setIsEditing(false);
  };
  
  const handleSave = async () => {
    if (!editedName.trim()) {
      Alert.alert('Invalid Name', 'Account name cannot be empty.');
      return;
    }
    
    const newBalance = parseFloat(editedBalance);
    if (isNaN(newBalance)) {
      Alert.alert('Invalid Balance', 'Please enter a valid number for the balance.');
      return;
    }
    
    try {
      await database.action(async () => {
        const accountsCollection = database.collections.get('accounts');
        const accountRecord = await accountsCollection.find(accountId);
        const transactionsCollection = database.collections.get('transactions');
        
        // Calculate balance difference
        const balanceDifference = newBalance - accountRecord.currentBalance;
        
        // Create a current date once to use consistently
        const updateDate = new Date();
        
        // Fix: Use accountsCollection.update instead of accountRecord.update
        await accountsCollection.update(accountId, account => {
          account.name = editedName.trim();
          account.currentBalance = newBalance;
          account.updatedAt = updateDate;
        });
        
        // Create adjustment transaction if balance was changed
        if (balanceDifference !== 0) {
          await transactionsCollection.create(transaction => {
            transaction.amount = Math.abs(balanceDifference);
            transaction.payee = 'Balance Adjustment';
            transaction.notes = 'Manual balance adjustment';
            transaction.type = balanceDifference > 0 ? 'income' : 'expense';
            transaction.account_id = accountId;
            transaction.date = updateDate.getTime();
            transaction.createdAt = updateDate;
            transaction.updatedAt = updateDate;
          });
        }
        
        // Important: Convert the Date to ISO string before dispatching to Redux
        dispatch(updateAccountSuccess({
          id: accountRecord.id,
          changes: {
            name: editedName.trim(),
            currentBalance: newBalance,
            updatedAt: updateDate.toISOString() // Convert Date to string here
          }
        }));
        
        // Update local state
        setAccount({
          ...account,
          name: editedName.trim(),
          currentBalance: newBalance,
          updatedAt: updateDate.toISOString() // Also update local state with string
        });
        
        setIsEditing(false);
      });
    } catch (error) {
      console.error('Error updating account:', error);
      Alert.alert('Error', 'Failed to update account. Please try again.');
    }
  };
  
  const handleDelete = async () => {
    try {
      await database.action(async () => {
        // Check if account has transactions
        const transactionsCollection = database.collections.get('transactions');
        const transactionCount = await transactionsCollection
          .query(Q.where('account_id', accountId))
          .fetchCount();
        
        if (transactionCount > 0) {
          Alert.alert(
            'Cannot Delete Account',
            'This account has transactions associated with it. Please delete or move the transactions first.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        // Delete account if no transactions
        const accountsCollection = database.collections.get('accounts');
        await accountsCollection.delete(accountId); // Use delete instead of markAsDeleted
        dispatch(deleteAccountSuccess(accountId));
        
        // Navigate back to accounts list
        navigation.goBack();
      });
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    }
  };
  
  const handleViewAllTransactions = () => {
    navigation.navigate('Transactions', { accountId });
  };
  
  const handleAddTransaction = () => {
    navigation.navigate('AddTransaction', { accountId });
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
          <View style={styles.cardHeader}>
            <Title>{account.name}</Title>
            <Button
              icon="pencil"
              mode="text"
              compact
              onPress={handleEdit}
            >
              Edit
            </Button>
          </View>
          
          <View style={styles.balanceContainer}>
            <Text style={styles.balanceLabel}>Current Balance</Text>
            <Text style={styles.balanceAmount}>
              ${account.currentBalance.toFixed(2)}
            </Text>
          </View>
          
          <Divider style={styles.divider} />
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Account Type</Text>
            <Text style={styles.detailValue}>{account.accountType}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Initial Balance</Text>
            <Text style={styles.detailValue}>${account.initialBalance.toFixed(2)}</Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Created</Text>
            <Text style={styles.detailValue}>{format(new Date(account.createdAt), 'MMM d, yyyy')}</Text>
          </View>
        </Card.Content>
        
        <Card.Actions style={styles.actions}>
          <Button
            icon="plus"
            mode="contained"
            onPress={handleAddTransaction}
          >
            Add Transaction
          </Button>
        </Card.Actions>
      </Card>
      
      <View style={styles.transactionSection}>
        <Title>Recent Transactions</Title>
        <TransactionsList 
          transactions={transactions}
          limit={5}
          showViewAll={transactions.length > 0}
          onViewAll={handleViewAllTransactions}
          emptyMessage="No transactions yet"
          useScrollView={true} // Use direct rendering inside ScrollView
          navigation={navigation} // Pass navigation directly
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
          Delete Account
        </Button>
      </View>
      
      {/* Edit Account Dialog */}
      <Portal>
        <Dialog visible={isEditing} onDismiss={handleCancelEdit}>
          <Dialog.Title>Edit Account</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Account Name"
              value={editedName}
              onChangeText={setEditedName}
              style={styles.dialogInput}
            />
            <TextInput
              label="Current Balance"
              value={editedBalance}
              onChangeText={setEditedBalance}
              keyboardType="decimal-pad"
              style={styles.dialogInput}
              left={<TextInput.Affix text="$" />}
            />
            <Text style={styles.balanceNote}>
              Note: Changing the balance will create an adjustment transaction.
            </Text>
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
          <Dialog.Title>Delete Account</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to delete this account? This action cannot be undone.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button onPress={handleDelete} textColor="#D32F2F">Delete</Button>
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceContainer: {
    marginVertical: 12,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    color: '#757575',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 4,
  },
  divider: {
    marginVertical: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  detailLabel: {
    color: '#757575',
  },
  detailValue: {
    fontWeight: '500',
  },
  actions: {
    justifyContent: 'center',
    paddingTop: 8,
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
  balanceNote: {
    fontSize: 12,
    color: '#757575',
    fontStyle: 'italic',
  },
});

export default AccountDetailsScreen;