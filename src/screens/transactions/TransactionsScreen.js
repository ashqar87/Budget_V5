import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, FlatList, Dimensions } from 'react-native';
import { FAB, Searchbar, Chip, Text, ActivityIndicator, Button, Dialog, Portal, useTheme } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import { format, subMonths } from 'date-fns';
import { useDatabase } from '../../context/DatabaseContext';
import { Q } from '../../db/query';
import { fetchTransactionsStart, fetchTransactionsSuccess, fetchTransactionsFailure, updateFilters, clearFilters } from '../../store/slices/transactionsSlice';
import TransactionsList from '../../components/transactions/TransactionsList';
import EmptyState from '../../components/common/EmptyState';

// Get device dimensions
const { width, height } = Dimensions.get('window');

const TransactionsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const theme = useTheme();
  const database = useDatabase();
  const dispatch = useDispatch();
  
  // Get preselected account filter if coming from account details
  const accountId = route.params?.accountId;
  
  // Use ref to track if initial load has completed
  const initialLoadComplete = useRef(false);
  const isFirstRender = useRef(true);
  
  const { transactions, status, filters = {} } = useSelector(state => state.transactions);
  const { accounts } = useSelector(state => state.accounts);
  const { categories } = useSelector(state => state.categories);
  
  // Store the current filters in a ref to prevent unnecessary re-renders
  const filtersRef = useRef(filters);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterDialogVisible, setIsFilterDialogVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Local filter state
  const [selectedAccountId, setSelectedAccountId] = useState(accountId || null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [dateRange, setDateRange] = useState('all');
  
  // Set initial account filter only ONCE when component mounts
  useEffect(() => {
    if (isFirstRender.current && accountId && !filters.accountId) {
      dispatch(updateFilters({ accountId }));
      isFirstRender.current = false;
    }
  }, [accountId, dispatch, filters]);
  
  // Load transactions whenever filters change
  useEffect(() => {
    // Update the ref with current filters
    filtersRef.current = filters;
    
    const loadTransactions = async () => {
      // Skip if we're already loading
      if (status === 'loading') return;
      
      try {
        dispatch(fetchTransactionsStart());
        setIsLoading(true);
        
        // Short timeout to prevent excessive AsyncStorage calls
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Start building the query
        const transactionsCollection = database.collections.get('transactions');
        
        // Build query conditions
        const queryConditions = [];
        
        // Add account filter
        if (filters.accountId) {
          queryConditions.push(Q.where('account_id', filters.accountId));
        }
        
        // Add category filter
        if (filters.categoryId) {
          queryConditions.push(Q.where('category_id', filters.categoryId));
        }
        
        // Add date range filter
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
            case 'last3Months':
              startDate = subMonths(now, 3);
              break;
            case 'lastYear':
              startDate = subMonths(now, 12);
              break;
            default:
              startDate = null;
          }
          
          if (startDate) {
            queryConditions.push(Q.where('date', Q.gte(startDate.getTime())));
          }
        }
        
        // Sort by date descending
        queryConditions.push(Q.sortBy('date', Q.desc()));
        
        // Execute the query
        const transactionsData = await transactionsCollection.query(...queryConditions).fetch();
        
        if (transactionsData && transactionsData.length > 0) {
          // Get unique category and account IDs to minimize data fetching
          const uniqueCategoryIds = [...new Set(transactionsData
            .filter(t => t.category_id)
            .map(t => t.category_id))];
            
          const uniqueAccountIds = [...new Set(transactionsData
            .filter(t => t.account_id)
            .map(t => t.account_id))];
          
          // Get all categories and accounts (use cache)
          const categoriesCollection = database.collections.get('categories');
          const accountsCollection = database.collections.get('accounts');
          
          const [categoriesData, accountsData] = await Promise.all([
            categoriesCollection.query().fetch(),
            accountsCollection.query().fetch()
          ]);
          
          // Create lookup maps for faster access
          const categoriesMap = {};
          categoriesData.forEach(category => {
            categoriesMap[category.id] = category;
          });
          
          const accountsMap = {};
          accountsData.forEach(account => {
            accountsMap[account.id] = account;
          });
          
          // Enrich transactions with category and account data
          const enrichedTransactions = transactionsData.map(transaction => {
            // Find the related category and account objects
            const category = transaction.category_id ? categoriesMap[transaction.category_id] : null;
            const account = transaction.account_id ? accountsMap[transaction.account_id] : null;
            
            return {
              ...transaction,
              category,
              account
            };
          });
          
          // Ensure dates are properly serialized
          const serializedTransactions = enrichedTransactions.map(transaction => {
            // Clone to avoid mutating the original
            const serialized = {...transaction};
            
            // Ensure dates are serialized consistently
            if (serialized.createdAt instanceof Date) {
              serialized.createdAt = serialized.createdAt.toISOString();
            }
            if (serialized.updatedAt instanceof Date) {
              serialized.updatedAt = serialized.updatedAt.toISOString();
            }
            
            return serialized;
          });
          
          // Ensure we're using the latest filters when dispatching
          const currentFilters = filtersRef.current;
          
          // Only dispatch if this is still the current filter set
          if (JSON.stringify(currentFilters) === JSON.stringify(filters)) {
            dispatch(fetchTransactionsSuccess(serializedTransactions));
            initialLoadComplete.current = true;
          }
        } else {
          dispatch(fetchTransactionsSuccess([]));
          initialLoadComplete.current = true;
        }
      } catch (error) {
        console.error('Error loading transactions:', error);
        dispatch(fetchTransactionsFailure(error.toString()));
      } finally {
        setIsLoading(false);
      }
    };
    
    loadTransactions();
  }, [dispatch, filters, database, status]);

  // Rest of the component (handleSearch, handleFilterPress, etc. remains the same)
  // ...

  return (
    <View style={styles.container}>
      {/* Header with search and filters */}
      <View style={styles.header}>
        <Searchbar
          placeholder="Search transactions"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
        />
        
        <View style={styles.filterChips}>
          <Chip
            icon="filter-variant"
            onPress={() => setIsFilterDialogVisible(true)}
            style={styles.filterChip}
            mode={Object.keys(filters).length > 0 ? 'flat' : 'outlined'}
          >
            Filters
          </Chip>
        </View>
      </View>
      
      {/* Content area with loading indicator, empty state or transactions list */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon="cash"
          title="No Transactions"
          message="Add your first transaction to start tracking your spending"
          buttonLabel="Add Transaction"
          onButtonPress={() => navigation.navigate('AddTransaction', { accountId: selectedAccountId })}
        />
      ) : (
        <TransactionsList
          transactions={transactions}
          onTransactionPress={(transaction) => {
            console.log('Transaction pressed:', transaction.id);
          }}
        />
      )}
      
      {/* FAB for adding new transactions */}
      <FAB
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        icon="plus"
        onPress={() => navigation.navigate('AddTransaction', { accountId: selectedAccountId })}
      />
      
      {/* Filter dialog */}
      <Portal>
        <Dialog
          visible={isFilterDialogVisible}
          onDismiss={() => setIsFilterDialogVisible(false)}
          style={[styles.dialog, {maxHeight: height * 0.7}]}
        >
          <Dialog.Title>Filter Transactions</Dialog.Title>
          <Dialog.ScrollArea>
            <View style={{paddingVertical: 10}}>
              <Text style={styles.filterLabel}>Account</Text>
              <View style={styles.accountFilters}>
                {accounts.map(account => (
                  <Chip
                    key={account.id}
                    selected={selectedAccountId === account.id}
                    onPress={() => setSelectedAccountId(
                      selectedAccountId === account.id ? null : account.id
                    )}
                    style={styles.filterOptionChip}
                  >
                    {account.name}
                  </Chip>
                ))}
              </View>
              
              <Text style={styles.filterLabel}>Category</Text>
              <View style={styles.categoryFilters}>
                {categories.map(category => (
                  <Chip
                    key={category.id}
                    selected={selectedCategoryId === category.id}
                    onPress={() => setSelectedCategoryId(
                      selectedCategoryId === category.id ? null : category.id
                    )}
                    style={styles.filterOptionChip}
                  >
                    {category.name}
                  </Chip>
                ))}
              </View>
              
              <Text style={styles.filterLabel}>Date Range</Text>
              <View style={styles.dateFilters}>
                {[
                  { label: 'All Time', value: 'all' },
                  { label: 'This Month', value: 'thisMonth' },
                  { label: 'Last 30 Days', value: 'last30Days' },
                  { label: 'Last 3 Months', value: 'last3Months' },
                  { label: 'Last Year', value: 'lastYear' },
                ].map(item => (
                  <Chip
                    key={item.value}
                    selected={dateRange === item.value}
                    onPress={() => setDateRange(item.value)}
                    style={styles.filterOptionChip}
                  >
                    {item.label}
                  </Chip>
                ))}
              </View>
            </View>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => {
              setSelectedAccountId(null);
              setSelectedCategoryId(null);
              setDateRange('all');
              dispatch(clearFilters());
              setIsFilterDialogVisible(false);
            }}>
              Clear
            </Button>
            <Button onPress={() => {
              dispatch(updateFilters({
                accountId: selectedAccountId,
                categoryId: selectedCategoryId,
                dateRange
              }));
              setIsFilterDialogVisible(false);
            }}>
              Apply
            </Button>
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
  header: {
    padding: 16,
    backgroundColor: 'white',
    elevation: 2,
  },
  searchBar: {
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    maxHeight: '80%',
  },
  filterLabel: {
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  accountFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  categoryFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dateFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterOptionChip: {
    margin: 4,
    height: Math.min(width * 0.08, 36),
  },
});

export default TransactionsScreen;