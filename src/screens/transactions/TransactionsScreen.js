import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Text as RNText, 
  Alert,
  ActivityIndicator,
  SafeAreaView,
  ScrollView 
} from 'react-native';
import { Searchbar, FAB, Chip, Portal, Dialog, Button, useTheme } from 'react-native-paper';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { format, subMonths } from 'date-fns';
import { useDatabase } from '../../context/DatabaseContext';
import { Q } from '../../db/query';
import { 
  fetchTransactionsStart, 
  fetchTransactionsSuccess, 
  fetchTransactionsFailure, 
  updateFilters, 
  clearFilters 
} from '../../store/slices/transactionsSlice';
import EmptyState from '../../components/common/EmptyState';

// Simplify the transaction item to just the essentials
const TransactionItem = React.memo(({ item, onPress }) => {
  const theme = useTheme();
  const isExpense = item.type === 'expense';
  const amountColor = isExpense ? '#D32F2F' : '#388E3C';
  const amountPrefix = isExpense ? '-' : '+';
  
  return (
    <TouchableOpacity
      style={styles.transactionCard}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.transactionRow}>
        <View style={styles.transactionContent}>
          <RNText style={styles.payeeText}>{item.payee}</RNText>
          <RNText style={styles.categoryText}>
            {item.category?.name || 'Uncategorized'}
          </RNText>
        </View>
        
        <View style={styles.amountContainer}>
          <RNText style={[styles.amountText, { color: amountColor }]}>
            {amountPrefix}${Math.abs(item.amount).toFixed(2)}
          </RNText>
          <RNText style={styles.dateText}>
            {format(new Date(item.date), 'MMM d')}
          </RNText>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const TransactionsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const theme = useTheme();
  const database = useDatabase();
  const dispatch = useDispatch();
  
  // Account ID from route params
  const accountId = route.params?.accountId;
  
  // Use a reference to prevent unnecessary rerenders
  const accountIdRef = React.useRef(accountId);
  
  // Access Redux state safely
  const transactions = useSelector(state => state.transactions?.transactions || []);
  const status = useSelector(state => state.transactions?.status || 'idle');
  const filters = useSelector(state => state.transactions?.filters || {});
  const accounts = useSelector(state => state.accounts?.accounts || []);
  const categories = useSelector(state => state.categories?.categories || []);
  
  // Local state
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDialogVisible, setFilterDialogVisible] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(accountId || null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [dateRange, setDateRange] = useState('all');
  
  // Only fetch once when component mounts
  useEffect(() => {
    if (accountIdRef.current && !filters.accountId) {
      dispatch(updateFilters({ accountId: accountIdRef.current }));
    }
  }, [dispatch, filters]);
  
  // Focus effect to reload data only when filters change
  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [filters]) // Only reload when filters change
  );
  
  const loadTransactions = async () => {
    // Skip if already loading
    if (status === 'loading') return;
    
    try {
      setIsLoading(true);
      dispatch(fetchTransactionsStart());
      
      const queryConditions = [];
      
      if (filters.accountId) {
        queryConditions.push(Q.where('account_id', filters.accountId));
      }
      
      if (filters.categoryId) {
        queryConditions.push(Q.where('category_id', filters.categoryId));
      }
      
      if (filters.dateRange && filters.dateRange !== 'all') {
        const now = new Date();
        let startDate;
        
        switch (filters.dateRange) {
          case 'thisMonth': 
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'last30Days':
            startDate = subMonths(now, 1);
            break;
          default:
            startDate = null;
        }
        
        if (startDate) {
          queryConditions.push(Q.where('date', Q.gte(startDate.getTime())));
        }
      }
      
      queryConditions.push(Q.sortBy('date', Q.desc()));
      
      const transactionsCollection = database.collections.get('transactions');
      const transactionsData = await transactionsCollection.query(...queryConditions).fetch();
      
      // Process transactions minimally
      const processedTransactions = await processTransactions(transactionsData);
      
      dispatch(fetchTransactionsSuccess(processedTransactions));
    } catch (error) {
      console.error('Error loading transactions:', error);
      dispatch(fetchTransactionsFailure(error.message));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Process transactions with minimal data for better performance
  const processTransactions = async (transactionsData) => {
    if (!transactionsData.length) return [];
    
    try {
      // Get categories (we'll need them for display)
      const categoriesCollection = database.collections.get('categories');
      const categoriesData = await categoriesCollection.query().fetch();
      
      // Create category lookup map
      const categoryMap = {};
      categoriesData.forEach(cat => {
        categoryMap[cat.id] = { 
          id: cat.id, 
          name: cat.name, 
          color: cat.color 
        };
      });
      
      // Process transactions with minimal data
      return transactionsData.map(tx => ({
        id: tx.id,
        amount: tx.amount,
        payee: tx.payee,
        date: tx.date,
        type: tx.type,
        category: tx.category_id ? categoryMap[tx.category_id] : null,
        account_id: tx.account_id
      }));
    } catch (error) {
      console.error('Error processing transactions:', error);
      return transactionsData;
    }
  };
  
  // Direct, simplified navigation
  const handleTransactionPress = (transaction) => {
    navigation.navigate('TransactionDetail', {
      transactionId: transaction.id
    });
  };
  
  // Initialize filter state
  useEffect(() => {
    setSelectedAccountId(filters.accountId || null);
    setSelectedCategoryId(filters.categoryId || null);
    setDateRange(filters.dateRange || 'all');
  }, [filters]);
  
  // Apply filters
  const applyFilters = () => {
    dispatch(updateFilters({
      accountId: selectedAccountId,
      categoryId: selectedCategoryId,
      dateRange
    }));
    setFilterDialogVisible(false);
  };
  
  // Clear all filters
  const clearAllFilters = () => {
    setSelectedAccountId(null);
    setSelectedCategoryId(null);
    setDateRange('all');
    dispatch(clearFilters());
    setFilterDialogVisible(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Searchbar
            placeholder="Search transactions"
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchBar}
          />
          
          <View style={styles.filterRow}>
            <Chip
              icon="filter-variant"
              onPress={() => setFilterDialogVisible(true)}
              mode={Object.keys(filters).length > 0 ? 'flat' : 'outlined'}
              style={styles.filterButton}
            >
              Filters {Object.keys(filters).length > 0 ? `(${Object.keys(filters).length})` : ''}
            </Chip>
          </View>
        </View>
        
        {/* Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : transactions.length === 0 ? (
          <EmptyState
            icon="cash-multiple"
            title="No Transactions"
            message="Add your first transaction to start tracking your spending"
            buttonLabel="Add Transaction"
            onButtonPress={() => navigation.navigate('AddTransaction', { accountId: selectedAccountId })}
          />
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TransactionItem 
                item={item} 
                onPress={handleTransactionPress} 
              />
            )}
            contentContainerStyle={styles.listContent}
          />
        )}
        
        {/* FAB */}
        <FAB
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          icon="plus"
          onPress={() => navigation.navigate('AddTransaction', { accountId: selectedAccountId })}
        />
        
        {/* Filter dialog */}
        <Portal>
          <Dialog
            visible={filterDialogVisible}
            onDismiss={() => setFilterDialogVisible(false)}
            style={styles.filterDialog}
          >
            <Dialog.Title>Filter Transactions</Dialog.Title>
            <Dialog.Content>
              {/* Basic dialog content without ScrollView */}
              <View style={styles.dialogContent}>
                {/* Account filter */}
                <RNText style={styles.filterHeading}>Account</RNText>
                <View style={styles.chipContainer}>
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
                
                {/* Date Range */}
                <RNText style={styles.filterHeading}>Date</RNText>
                <View style={styles.chipContainer}>
                  <Chip
                    selected={dateRange === 'all'}
                    onPress={() => setDateRange('all')}
                    style={styles.filterChip}
                  >
                    All Time
                  </Chip>
                  <Chip
                    selected={dateRange === 'thisMonth'}
                    onPress={() => setDateRange('thisMonth')}
                    style={styles.filterChip}
                  >
                    This Month
                  </Chip>
                  <Chip
                    selected={dateRange === 'last30Days'}
                    onPress={() => setDateRange('last30Days')}
                    style={styles.filterChip}
                  >
                    Last 30 Days
                  </Chip>
                </View>
              </View>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={clearAllFilters}>Clear All</Button>
              <Button onPress={applyFilters}>Apply</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    elevation: 2,
  },
  searchBar: {
    elevation: 0,
    backgroundColor: '#f5f5f5',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingBottom: 8,
  },
  filterButton: {
    marginRight: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  filterDialog: {
    maxHeight: '70%',
  },
  dialogContent: {
    paddingVertical: 8,
  },
  filterHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  transactionCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 8,
    elevation: 2,
    padding: 16,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionContent: {
    flex: 1,
    paddingRight: 8,
  },
  payeeText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  categoryText: {
    fontSize: 14,
    color: '#757575',
  },
  amountContainer: {
    alignItems: 'flex-end',
    minWidth: 85,
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 13,
    color: '#757575',
    marginTop: 4,
  },
});

export default TransactionsScreen;