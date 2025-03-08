import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const AccountCard = ({ account, onPress }) => {
  const theme = useTheme();
  
  // Get icon based on account type
  const getAccountIcon = (accountType) => {
    switch (accountType) {
      case 'checking':
        return 'bank';
      case 'savings':
        return 'piggy-bank';
      case 'credit':
        return 'credit-card';
      case 'cash':
        return 'cash';
      default:
        return 'wallet';
    }
  };

  // Format amount with color based on balance
  const getBalanceColor = (balance) => {
    if (balance < 0) {
      return theme.colors.error;
    } else if (balance === 0) {
      return theme.colors.disabled;
    } else {
      return theme.colors.success;
    }
  };

  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content style={styles.content}>
        <MaterialCommunityIcons
          name={getAccountIcon(account.accountType)}
          size={28}
          color={theme.colors.primary}
          style={styles.icon}
        />
        
        <Text style={styles.accountName}>{account.name}</Text>
        
        <Text
          style={[
            styles.balance,
            { color: getBalanceColor(account.currentBalance) }
          ]}
        >
          ${account.currentBalance.toFixed(2)}
        </Text>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderRadius: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 16,
  },
  accountName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  balance: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default AccountCard;