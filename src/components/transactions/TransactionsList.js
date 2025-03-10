import React from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const TransactionsList = ({ 
  transactions, 
  onTransactionPress, 
  limit, 
  useScrollView = false,
  navigation: propNavigation 
}) => {
  const theme = useTheme();
  const navigation = useNavigation();

  // Use navigation from props if available, otherwise use hook
  const nav = propNavigation || navigation;

  if (!transactions || transactions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No transactions found</Text>
      </View>
    );
  }

  // Super direct transaction handler
  const handleTransactionPress = (transaction) => {
    console.log(`SUPER DIRECT TAP: ${transaction.id}`);
    
    // First try the callback
    if (typeof onTransactionPress === 'function') {
      onTransactionPress(transaction);
      return;
    }
    
    // If no callback, direct navigation with explicit screen name
    nav.navigate('TransactionDetail', { 
      transactionId: transaction.id,
      transaction: transaction
    });
  };

  // Limited transactions if specified
  const displayTransactions = limit ? transactions.slice(0, limit) : transactions;

  // Single transaction item renderer - used in both modes
  const renderTransactionItem = (item, index) => {
    const isExpense = item.type === 'expense';
    const isTransfer = item.type === 'transfer';
    const amountColor = isExpense ? theme.colors.error : theme.colors.success;
    const amountPrefix = isExpense ? '-' : '+';
    const categoryColor = item.category?.color || '#757575';

    return (
      <TouchableOpacity 
        key={`transaction-${item.id}-${index}`}
        onPress={() => handleTransactionPress(item)} 
        activeOpacity={0.6}
        style={styles.transactionItem}
      >
        <View style={styles.itemRow}>
          {/* Category Icon */}
          <View style={[styles.categoryIcon, { backgroundColor: categoryColor }]}>
            <Text style={styles.iconText}>
              {item.category?.icon?.charAt(0).toUpperCase() || (isTransfer ? 'T' : '?')}
            </Text>
          </View>
          
          {/* Transaction Details */}
          <View style={styles.detailsContainer}>
            <Text style={styles.payeeText}>{item.payee}</Text>
            <Text style={styles.categoryText}>
              {item.category?.name || 'Uncategorized'} 
              {item.notes ? ` • ${item.notes}` : ''}
            </Text>
          </View>
          
          {/* Amount */}
          <View style={styles.amountContainer}>
            <Text style={[styles.amountText, { color: amountColor }]}>
              {amountPrefix}${Math.abs(item.amount).toFixed(2)}
            </Text>
            <Text style={styles.dateText}>
              {format(new Date(item.date), 'MMM d')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // IMPORTANT: Use different rendering based on useScrollView prop
  if (useScrollView) {
    // Direct rendering for when inside a ScrollView - NO FlatList
    return (
      <View style={styles.container}>
        {displayTransactions.map((item, index) => renderTransactionItem(item, index))}
        
        {/* "View All" button if needed */}
        {limit && transactions.length > limit && (
          <TouchableOpacity 
            onPress={() => nav.navigate('Transactions')}
            style={styles.viewAllButton}
          >
            <Text style={styles.viewAllText}>View All Transactions</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
  
  // When not in a ScrollView, use FlatList
  return (
    <View style={styles.container}>
      <FlatList
        data={displayTransactions}
        keyExtractor={(item, index) => `transaction-${item.id}-${index}`}
        renderItem={({ item, index }) => renderTransactionItem(item, index)}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    paddingVertical: 8,
  },
  transactionItem: {
    backgroundColor: 'white',
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    padding: 16,
  },
  itemRow: {
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
  iconText: {
    color: 'white',
    fontWeight: 'bold',
  },
  detailsContainer: {
    flex: 1,
    paddingRight: 8,
  },
  payeeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  categoryText: {
    fontSize: 14,
    color: '#757575',
    marginTop: 2,
  },
  amountContainer: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  dateText: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
  },
  viewAllButton: {
    padding: 16,
    alignItems: 'center',
  },
  viewAllText: {
    color: '#2196F3',
    fontWeight: '500',
  },
});

export default TransactionsList;