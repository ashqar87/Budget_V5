import React from 'react';
import { StyleSheet } from 'react-native';
import { Card, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const AccountCard = ({ account, onPress }) => {
  const theme = useTheme();
  
  // Determine icon based on account type
  const getAccountTypeIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'checking':
        return 'bank';
      case 'savings':
        return 'piggy-bank';
      case 'credit':
        return 'credit-card';
      case 'cash':
        return 'cash';
      case 'investment':
        return 'chart-line';
      default:
        return 'wallet';
    }
  };
  
  return (
    <Card style={styles.card} onPress={onPress}>
      <Card.Content style={styles.content}>
        <MaterialCommunityIcons 
          name={getAccountTypeIcon(account.accountType)} 
          size={24} 
          color={theme.colors.primary} 
          style={styles.icon} 
        />
        <Text style={styles.accountName}>{account.name}</Text>
        <Text style={styles.accountBalance}>
          ${account.currentBalance.toFixed(2)}
        </Text>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    elevation: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  accountName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  accountBalance: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default AccountCard;