import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Button, Card, useTheme, Divider } from 'react-native-paper';
import { format } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import EmptyState from '../common/EmptyState';

const TransactionItem = ({ transaction, onPress }) => {
  const theme = useTheme();
  
  // Format date
  const formattedDate = format(new Date(transaction.date), 'MMM d, yyyy');
  
  // Determine icon and color based on transaction type
  let iconName = 'cash';
  let amountColor = theme.colors.text;
  let amountPrefix = '';
  
  if (transaction.type === 'income') {
    iconName = 'arrow-down';
    amountColor = theme.colors.success;
    amountPrefix = '+';
  } else if (transaction.type === 'expense') {
    iconName = 'arrow-up';
    amountColor = theme.colors.error;
    amountPrefix = '-';
  } else if (transaction.type === 'transfer') {
    iconName = 'bank-transfer';
    amountColor = theme.colors.primary;
  }
  
  return (
    <Card style={styles.transactionCard} onPress={onPress}>
      <Card.Content style={styles.transactionContent}>
        <MaterialCommunityIcons
          name={iconName}
          size={24}
          color={amountColor}
          style={styles.icon}
        />
        
        <View style={styles.detailsContainer}>
          <Text style={styles.payee}>{transaction.payee}</Text>
          
          {transaction.notes ? (
            <Text style={styles.notes} numberOfLines={1}>
              {transaction.notes}
            </Text>
          ) : null}
          
          <Text style={styles.date}>{formattedDate}</Text>
        </View>
        
        <Text style={[styles.amount, { color: amountColor }]}>
          {amountPrefix}${Math.abs(transaction.amount).toFixed(2)}
        </Text>
      </Card.Content>
    </Card>
  );
};

const TransactionsList = ({ 
  transactions, 
  limit,
  showViewAll = false,
  onViewAll,
  emptyMessage = "No transactions found",
  onTransactionPress
}) => {
  const navigation = useNavigation();
  const theme = useTheme();
  
  // Limit transactions if specified
  const displayTransactions = limit
    ? transactions.slice(0, limit)
    : transactions;
    
  if (transactions.length === 0) {
    return (
      <EmptyState 
        icon="receipt-outline" 
        title="No Transactions" 
        message={emptyMessage}
      />
    );
  }
  
  return (
    <View style={styles.container}>
      <FlatList
        data={displayTransactions}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TransactionItem 
            transaction={item} 
            onPress={() => onTransactionPress && onTransactionPress(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        scrollEnabled={false}
      />
      
      {showViewAll && limit && transactions.length > limit && (
        <Button 
          mode="text" 
          onPress={onViewAll}
          style={styles.viewAllButton}
        >
          View All ({transactions.length})
        </Button>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  transactionCard: {
    marginVertical: 4,
    elevation: 1,
  },
  transactionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  detailsContainer: {
    flex: 1,
  },
  payee: {
    fontSize: 16,
    fontWeight: '500',
  },
  notes: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
  date: {
    fontSize: 12,
    color: '#757575',
    marginTop: 4,
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#757575',
    fontSize: 16,
  },
  viewAllButton: {
    marginTop: 16,
  },
});

export default TransactionsList;