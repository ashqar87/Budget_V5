import React from 'react';
import { View, StyleSheet, FlatList, Dimensions } from 'react-native';
import { List, Text, Divider, useTheme } from 'react-native-paper';
import { format } from 'date-fns';

const { width, height } = Dimensions.get('window');

const TransactionsList = ({ transactions, onTransactionPress }) => {
  const theme = useTheme();

  if (!transactions || transactions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No transactions found</Text>
      </View>
    );
  }

  const renderTransactionItem = ({ item }) => {
    const isExpense = item.type === 'expense';
    const isTransfer = item.type === 'transfer';
    const amountColor = isExpense ? theme.colors.error : theme.colors.success;
    const amountPrefix = isExpense ? '-' : '+';
    const categoryColor = item.category?.color || '#757575';
    
    return (
      <>
        <List.Item
          title={item.payee}
          description={`${item.category?.name || 'Uncategorized'} ${item.notes ? `• ${item.notes}` : ''}`}
          left={props => (
            <View {...props} style={styles.iconContainer}>
              <View style={[styles.categoryIcon, { backgroundColor: categoryColor }]}>
                <Text style={styles.iconText}>
                  {item.category?.icon?.charAt(0).toUpperCase() || (isTransfer ? 'T' : '?')}
                </Text>
              </View>
            </View>
          )}
          right={props => (
            <View {...props} style={styles.rightContent}>
              <Text style={[styles.amount, { color: amountColor }]}>
                {amountPrefix}${Math.abs(item.amount).toFixed(2)}
              </Text>
              <Text style={styles.date}>
                {format(typeof item.date === 'number' ? new Date(item.date) : new Date(), 'MMM d')}
              </Text>
            </View>
          )}
          onPress={() => onTransactionPress?.(item)}
          style={styles.listItem}
        />
        <Divider />
      </>
    );
  };

  return (
    <FlatList
      data={transactions}
      renderItem={renderTransactionItem}
      keyExtractor={item => `transaction-${item.id}`} // Add prefix to ensure uniqueness
      style={styles.list}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listItem: {
    paddingVertical: 8,
    paddingHorizontal: width < 350 ? 8 : 16, // Less padding on small screens
  },
  iconContainer: {
    justifyContent: 'center',
  },
  categoryIcon: {
    width: width < 350 ? 32 : 40, // Smaller icon on small screens
    height: width < 350 ? 32 : 40,
    borderRadius: width < 350 ? 16 : 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    color: 'white',
    fontWeight: 'bold',
  },
  rightContent: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  amount: {
    fontWeight: 'bold',
    fontSize: width < 350 ? 14 : 16, // Smaller font on small screens
  },
  date: {
    fontSize: 12,
    color: '#757575',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#757575',
  },
});

export default TransactionsList;