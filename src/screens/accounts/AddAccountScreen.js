import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, Text, Headline, SegmentedButtons, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { addAccountSuccess } from '../../store/slices/accountsSlice';
import { useDatabase } from '../../context/DatabaseContext';

const AddAccountScreen = () => {
  const navigation = useNavigation();
  const theme = useTheme();
  const database = useDatabase();
  const dispatch = useDispatch();
  
  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('0.00');
  const [accountType, setAccountType] = useState('checking');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const handleSave = async () => {
    // Validate form
    if (!name.trim()) {
      setError('Account name is required');
      return;
    }
    
    // Parse initial balance as number
    const balanceNum = parseFloat(initialBalance) || 0;
    
    try {
      setIsSubmitting(true);
      setError('');
      
      // Create account in database
      await database.action(async () => {
        const accountsCollection = database.collections.get('accounts');
        const transactionsCollection = database.collections.get('transactions');
        
        // Create account
        const account = await accountsCollection.create(newAccount => {
          newAccount.name = name.trim();
          newAccount.initialBalance = balanceNum;
          newAccount.currentBalance = balanceNum;
          newAccount.accountType = accountType;
          newAccount.createdAt = new Date();
          newAccount.updatedAt = new Date();
        });
        
        // Create initial balance transaction if balance > 0
        if (balanceNum > 0) {
          await transactionsCollection.create(transaction => {
            transaction.amount = balanceNum;
            transaction.payee = 'Initial Balance';
            transaction.notes = 'Opening balance';
            transaction.type = 'income';
            transaction.account.set(account);
            transaction.date = new Date();
            transaction.createdAt = new Date();
            transaction.updatedAt = new Date();
          });
        }
        
        // Update Redux store
        dispatch(addAccountSuccess({
          id: account.id,
          name: account.name,
          currentBalance: account.currentBalance,
          initialBalance: account.initialBalance,
          accountType: account.accountType,
          createdAt: account.createdAt,
        }));
      });
      
      // Navigate back
      navigation.goBack();
    } catch (e) {
      console.error('Error creating account:', e);
      setError('Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Headline style={styles.headline}>Add New Account</Headline>
      
      <TextInput
        label="Account Name"
        value={name}
        onChangeText={setName}
        style={styles.input}
        mode="outlined"
      />
      
      <TextInput
        label="Initial Balance"
        value={initialBalance}
        onChangeText={setInitialBalance}
        keyboardType="decimal-pad"
        style={styles.input}
        mode="outlined"
        left={<TextInput.Affix text="$" />}
      />
      
      <Text style={styles.label}>Account Type</Text>
      <SegmentedButtons
        value={accountType}
        onValueChange={setAccountType}
        buttons={[
          { value: 'checking', label: 'Checking' },
          { value: 'savings', label: 'Savings' },
          { value: 'credit', label: 'Credit Card' },
          { value: 'cash', label: 'Cash' },
        ]}
        style={styles.segmentedButtons}
      />
      
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      <View style={styles.buttonContainer}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          style={styles.button}
        >
          Cancel
        </Button>
        <Button
          mode="contained"
          onPress={handleSave}
          loading={isSubmitting}
          disabled={isSubmitting}
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
        >
          Save Account
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 16,
  },
  headline: {
    marginBottom: 20,
    fontSize: 24,
    fontWeight: 'bold',
  },
  input: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  segmentedButtons: {
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
  errorText: {
    color: '#D32F2F',
    marginBottom: 16,
  },
});

export default AddAccountScreen;