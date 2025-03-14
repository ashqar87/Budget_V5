import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, SegmentedButtons, Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { addAccountSuccess } from '../../store/slices/accountsSlice';
import { useDatabase } from '../../context/DatabaseContext';
import { addTransactionSuccess } from '../../store/slices/transactionsSlice';

const AddAccountScreen = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const database = useDatabase();
  
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState('checking');
  const [balance, setBalance] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter an account name');
      return;
    }
    
    const initialBalance = parseFloat(balance) || 0;
    if (isNaN(initialBalance)) {
      Alert.alert('Error', 'Please enter a valid balance');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      await database.action(async () => {
        const accountsCollection = database.collections.get('accounts');
        const transactionsCollection = database.collections.get('transactions');
        
        // Create account with proper dates
        const now = new Date();
        const nowTimestamp = now.getTime(); // Convert to timestamp for consistency
        
        const account = await accountsCollection.create(account => {
          account.name = name.trim();
          account.accountType = accountType;
          account.initialBalance = initialBalance;
          account.currentBalance = initialBalance;
          account.createdAt = now;
          account.updatedAt = now;
        });
        
        // Create initial transaction with proper timestamp - not Date object
        await transactionsCollection.create(transaction => {
          transaction.amount = initialBalance;
          transaction.payee = 'Initial Balance';
          transaction.notes = 'Account opening balance';
          transaction.type = 'income';
          transaction.account_id = account.id;
          // Store date as a timestamp or ISO string, not a Date object
          transaction.date = nowTimestamp; 
          transaction.createdAt = now;
          transaction.updatedAt = now;
        });
        
        // Convert any Date objects to ISO strings for Redux
        const serializedAccount = {
          ...account,
          createdAt: account.createdAt.toISOString(),
          updatedAt: account.updatedAt.toISOString()
        };
        
        // Dispatch with serialized dates
        dispatch(addAccountSuccess(serializedAccount));
        
        // Navigate back
        navigation.goBack();
      });
    } catch (error) {
      console.error('Error creating account:', error);
      Alert.alert('Error', 'Failed to create account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <TextInput
          label="Account Name"
          value={name}
          onChangeText={setName}
          style={styles.input}
          mode="outlined"
        />
        
        <Text style={styles.label}>Account Type</Text>
        <SegmentedButtons
          value={accountType}
          onValueChange={setAccountType}
          buttons={[
            { value: 'checking', label: 'Checking' },
            { value: 'savings', label: 'Savings' },
            { value: 'credit', label: 'Credit' },
          ]}
          style={styles.segmentedButtons}
        />
        
        <TextInput
          label="Initial Balance"
          value={balance}
          onChangeText={setBalance}
          keyboardType="decimal-pad"
          style={styles.input}
          mode="outlined"
          left={<TextInput.Affix text="$" />}
        />
        
        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.button}
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          Create Account
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
  content: {
    padding: 16,
  },
  input: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  button: {
    marginTop: 16,
  },
});

export default AddAccountScreen;