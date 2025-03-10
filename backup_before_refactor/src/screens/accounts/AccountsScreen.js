import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { FAB, Text, Headline, Surface, useTheme, ActivityIndicator } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAccountsStart, fetchAccountsSuccess, fetchAccountsFailure } from '../../store/slices/accountsSlice';
import { useDatabase } from '../../context/DatabaseContext';
import AccountCard from '../../components/accounts/AccountCard';
import EmptyState from '../../components/common/EmptyState';

const AccountsScreen = () => {
  const navigation = useNavigation();
  const theme = useTheme();
  const database = useDatabase();
  const dispatch = useDispatch();
  
  const { accounts, totalBalance, status } = useSelector(state => state.accounts);
  const isLoading = status === 'loading';
  
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        dispatch(fetchAccountsStart());
        
        const accountsCollection = database.collections.get('accounts');
        const accountsData = await accountsCollection.query().fetch();
        
        const formattedAccounts = accountsData.map(account => ({
          id: account.id,
          name: account.name,
          currentBalance: account.currentBalance,
          initialBalance: account.initialBalance,
          accountType: account.accountType,
          createdAt: account.createdAt,
        }));
        
        dispatch(fetchAccountsSuccess(formattedAccounts));
      } catch (error) {
        console.error('Error fetching accounts:', error);
        dispatch(fetchAccountsFailure(error.message));
      }
    };
    
    loadAccounts();
    
    // Subscribe to account changes
    const subscription = database.collections
      .get('accounts')
      .query()
      .observe()
      .subscribe(loadAccounts);
      
    return () => subscription.unsubscribe();
  }, [database, dispatch]);
  
  // Navigate to add account screen
  const handleAddAccount = () => {
    navigation.navigate('AddAccount');
  };
  
  // Navigate to account details
  const handleAccountPress = (account) => {
    navigation.navigate('AccountDetails', { accountId: account.id });
  };
  
  // Render empty state when no accounts
  if (!isLoading && accounts.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="wallet-outline"
          title="No Accounts"
          message="Add your first account to get started with budgeting."
          buttonLabel="Add Account"
          onButtonPress={handleAddAccount}
        />
        <FAB
          style={[styles.fab, { backgroundColor: theme.colors.primary }]}
          icon="plus"
          onPress={handleAddAccount}
        />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <Surface style={styles.totalBalanceContainer}>
        <Text style={styles.totalBalanceLabel}>Total Balance</Text>
        <Headline style={styles.totalBalanceAmount}>
          ${totalBalance.toFixed(2)}
        </Headline>
      </Surface>
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={accounts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <AccountCard 
              account={item}
              onPress={() => handleAccountPress(item)}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
      
      <FAB
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        icon="plus"
        onPress={handleAddAccount}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  totalBalanceContainer: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  totalBalanceLabel: {
    fontSize: 16,
    color: '#757575',
    marginBottom: 4,
  },
  totalBalanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

export default AccountsScreen;