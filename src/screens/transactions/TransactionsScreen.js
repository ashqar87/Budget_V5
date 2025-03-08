import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { FAB, Searchbar, Chip, Text, ActivityIndicator, Button, Dialog, Portal, useTheme } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import { format, subMonths } from 'date-fns';
import { useDatabase } from '../../context/DatabaseContext';
import { Q } from '@nozbe/watermelondb';
import { fetchTransactionsStart, fetchTransactionsSuccess, fetchTransactionsFailure, updateFilters, clearFilters } from '../../store/slices/transactionsSlice';
import TransactionsList from '../../components/transactions/TransactionsList';
import EmptyState from '../../components/common/EmptyState';

const TransactionsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const theme = useTheme();
  const database = useDatabase();
  const dispatch = useDispatch();
  
  // Get preselected account filter if coming from account details
  const { accountId } = route.params || {};
  
  const { transactions, status, filters } = useSelector(state => state.transactions);
  const { accounts } = useSelector(state => state.accounts);
  const { categories } = useSelector(state => state.categories);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterDialogVisible, setIsFilterDialogVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Local filter state
  const [selectedAccountId, setSelectedAccountId] = useState(accountId || null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [dateRange, setDateRange] = useState('all');
  
  useEffect(() => {
    // Set initial account filter if provided via route params
    if (accountId) {
      dispatch(updateFilters({ accountId }));
    }
  }, [accountId, dispatch]);
  
  useEffect(() => {
    const loadTransactions = async () => {
      try {
        dispatch(fetchTransactionsStart());
        
        // Start building the query
        const transactionsCollection = database.collections.get('transactions');
        let query = transactionsCollection.query(
          Q.sortBy('date', Q.desc)
        );
        
        // Apply filters
        if (filters.accountId) {
          query = query.extend(
            Q.where('account_id', filters.accountId)
          );
        }
        
        if (filters.categoryId) {
          query = query.extend(
            Q.where('category_id', filters.categoryId)
          );
        }
        
        if (filters.startDate) {
          query = query.extend(
            Q.where('date', Q.gte(filters.startDate.getTime()))
          );
        }
        
        if (filters.endDate) {
          query = query.extend(
            Q.where('date', Q.lte(filters.endDate.getTime()))
          );
        }
        
        // Fetch transactions
        const transactionsRecords = await query.fetch();
        
        // Format transactions with related data
        const formattedTransactions = await Promise.all(
          transactionsRecords.map(async transaction => {
            // Get account
            const account = await transaction.account.fetch();
            
            // Get category if exists
            let category = null;
            if (transaction.category.id) {
              category = await transaction.category.fetch();
            }
            
            // Get transfer account if transfer type
            let transferAccount = null;
            if (transaction.type === 'transfer' && transaction.transferAccount.id) {
              transferAccount = await transaction.transferAccount.fetch();
            }
            
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
              category: category ? {
                id: category.id,
                name: category.name,
                color: category.color,
              } : null,
              transferAccount: transferAccount ? {
                id: transferAccount.id,
                name: transferAccount.name,
              } : null,
            };
          })
        );
        
        // Apply search filter client side
        let filteredTransactions = formattedTransactions;
        if (filters.searchText) {
          const searchLower = filters.searchText.toLowerCase();
          filteredTransactions = formattedTransactions.filter(transaction => 
            transaction.payee.toLowerCase().includes(searchLower) ||
            (transaction.notes && transaction.notes.toLowerCase().includes(searchLower)) ||
            (transaction.category && transaction.category.name.toLowerCase().includes(searchLower))
          );
        }
        
        dispatch(fetchTransactionsSuccess(filteredTransactions));
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading transactions:', error);
        dispatch(fetchTransactionsFailure(error.message));
        setIsLoading(false);
      }
    };
    
    loadTransactions();
  }, [database, dispatch, filters]);
  
  const handleSearch = (query) => {
    setSearchQuery(query);
    dispatch(updateFilters({ searchText: query }));
  };
  
  const handleAddTransaction = () => {
    navigation.navigate('AddTransaction');
  };
  
  const handleTransactionPress = (transaction) => {
    // Navigate to transaction details or edit screen
    // For now, we'll navigate to AddTransaction with transaction data to edit
    navigation.navigate('AddTransaction', { transactionId: transaction.id });
  };
  
  const handleApplyFilters = () => {
    // Create date filters based on selected range
    let startDate = null;
    let endDate = null;
    
    const today = new Date();
    
    switch (dateRange) {
      case 'lastMonth':
        startDate = subMonths(today, 1);
        break;
      case 'last3Months':
        startDate = subMonths(today, 3);
        break;
      case 'last6Months':
        startDate = subMonths(today, 6);
        break;
      // 'all' case - no date filtering
    }
    
    dispatch(updateFilters({
      accountId: selectedAccountId,
      categoryId: selectedCategoryId,
      startDate,
      endDate,
    }));
    
    setIsFilterDialogVisible(false);
  };
  
  const handleClearFilters = () => {
    dispatch(clearFilters());
    setSelectedAccountId(null);
    setSelectedCategoryId(null);
    setDateRange('all');
    setSearchQuery('');
    setIsFilterDialogVisible(false);
  };
  
  const renderFilterChips = () => {
    const activeFilters = [];
    
    if (filters.accountId) {
      const account = accounts.find(acc => acc.id === filters.accountId);
      if (account) {
        activeFilters.push(
          <Chip 
            key="account" 
            icon="bank" 
            onClose={() => dispatch(updateFilters({ accountId: null }))}
            style={styles.chip}
          >
            {account.name}
          </Chip>
        );
      }
    }
    
    if (filters.categoryId) {
      const category = categories.find(cat => cat.id === filters.categoryId);
      if (category) {
        activeFilters.push(
          <Chip 
            key="category" 
            icon="folder" 
            onClose={() => dispatch(updateFilters({ categoryId: null }))}
            style={styles.chip}
          >
            {category.name}
          </Chip>
        );
      }
    }
    
    if (filters.startDate) {
      activeFilters.push(
        <Chip 
          key="date" 
          icon="calendar" 
          onClose={() => dispatch(updateFilters({ startDate: null, endDate: null }))}
          style={styles.chip}
        >
          {filters.startDate ? format(filters.startDate, 'MMM d, yyyy') : ''}
          {filters.endDate ? ` - ${format(filters.endDate, 'MMM d, yyyy')}` : ' - Now'}
        </Chip>
      );
    }
    
    if (activeFilters.length === 0) return null;
    
    return (
      <View style={styles.chipsContainer}>
        {activeFilters}
        <Button 
          compact 
          mode="text" 
          onPress={handleClearFilters}
        >
          Clear All
        </Button>
      </View>
    );
  };
  
  const renderFilterDialog = () => (
    <Portal>
      <Dialog
        visible={isFilterDialogVisible}
        onDismiss={() => setIsFilterDialogVisible(false)}
        style={styles.dialog}
      >
        <Dialog.Title>Filter Transactions</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.filterLabel}>Account</Text>
          <View style={styles.chipsContainer}>
            {accounts.map(account => (
              <Chip
                key={account.id}
                selected={selectedAccountId === account.id}
                onPress={() => setSelectedAccountId(
                  selectedAccountId === account.id ? null : account.id
                )}
                style={styles.filterChip}
              >
                {account.name}
              </Chip>
            ))}
          </View>
          
          <Text style={styles.filterLabel}>Category</Text>
          <View style={styles.chipsContainer}>
            {categories.map(category => (
              <Chip
                key={category.id}
                selected={selectedCategoryId === category.id}
                onPress={() => setSelectedCategoryId(
                  selectedCategoryId === category.id ? null : category.id
                )}
                style={styles.filterChip}
              >
                {category.name}
              </Chip>
            ))}
          </View>
          
          <Text style={styles.filterLabel}>Time Period</Text>
          <View style={styles.chipsContainer}>
            <Chip
              selected={dateRange === 'all'}
              onPress={() => setDateRange('all')}
              style={styles.filterChip}
            >
              All Time
            </Chip>
            <Chip
              selected={dateRange === 'lastMonth'}
              onPress={() => setDateRange('lastMonth')}
              style={styles.filterChip}
            >
              Last Month
            </Chip>
            <Chip
              selected={dateRange === 'last3Months'}
              onPress={() => setDateRange('last3Months')}
              style={styles.filterChip}
            >
              Last 3 Months
            </Chip>
            <Chip
              selected={dateRange === 'last6Months'}
              onPress={() => setDateRange('last6Months')}
              style={styles.filterChip}
            >
              Last 6 Months
            </Chip>
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setIsFilterDialogVisible(false)}>Cancel</Button>
          <Button onPress={handleClearFilters}>Clear</Button>
          <Button onPress={handleApplyFilters}>Apply</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search transactions"
          onChangeText={handleSearch}
          value={searchQuery}
          style={styles.searchbar}
        />
        <Button
          icon="filter-variant"
          mode="text"
          onPress={() => setIsFilterDialogVisible(true)}
        >
          Filter
        </Button>
      </View>
      
      {renderFilterChips()}
      
      {transactions.length === 0 ? (
        <EmptyState
          icon="cash"
          title="No Transactions"
          message={filters.accountId || filters.categoryId || filters.searchText ? 
            "No transactions match your filters" : 
            "Add your first transaction to get started"}
          buttonLabel="Add Transaction"
          onButtonPress={handleAddTransaction}
        />
      ) : (
        <TransactionsList
          transactions={transactions}
          onTransactionPress={handleTransactionPress}
          emptyMessage="No transactions found"
        />
      )}
      
      <FAB
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        icon="plus"
        onPress={handleAddTransaction}
      />
      
      {renderFilterDialog()}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#fff',
  },
  searchbar: {
    flex: 1,
    marginRight: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    alignItems: 'center',
  },
  chip: {
    margin: 4,
  },
  filterChip: {
    margin: 4,
  },
  dialog: {
    paddingBottom: 8,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

export default TransactionsScreen;