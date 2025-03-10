import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, Title, ActivityIndicator, useTheme } from 'react-native-paper';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useDatabase } from '../../context/DatabaseContext';
import { Q } from '../../db/query';
import TransactionsList from '../../components/transactions/TransactionsList';

const CategoryDetailsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const theme = useTheme();
  const database = useDatabase();
  
  const { categoryId } = route.params || {};
  
  const [category, setCategory] = useState(null);
  const [budgets, setBudgets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const loadCategoryData = async () => {
      if (!categoryId) {
        setError('No category ID provided');
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        
        // Fetch category details
        const categoriesCollection = database.collections.get('categories');
        const categoryData = await categoriesCollection.find(categoryId);
        
        if (!categoryData) {
          throw new Error(`Category with ID ${categoryId} not found`);
        }
        
        setCategory(categoryData);
        
        // Set screen title
        navigation.setOptions({ title: categoryData.name });
        
        // Fetch category budget
        const budgetsCollection = database.collections.get('category_budgets');
        const categoryBudgets = await budgetsCollection.query(
          Q.where('category_id', categoryId)
        ).fetch();
        
        setBudgets(categoryBudgets);
        
        // Fetch category transactions
        const transactionsCollection = database.collections.get('transactions');
        const categoryTransactions = await transactionsCollection.query(
          Q.where('category_id', categoryId),
          Q.sortBy('date', Q.desc()),
          Q.take(20)
        ).fetch();
        
        // Fetch account information for transactions
        const accountsCollection = database.collections.get('accounts');
        const accounts = await accountsCollection.query().fetch();
        
        // Add account info to transactions
        const enhancedTransactions = categoryTransactions.map(transaction => {
          const account = accounts.find(a => a.id === transaction.account_id);
          return {
            ...transaction,
            account,
            // Add the category to each transaction for TransactionsList
            category: categoryData
          };
        });
        
        setTransactions(enhancedTransactions);
      } catch (err) {
        console.error('Error loading category data:', err);
        setError(err.message || 'Failed to load category data');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadCategoryData();
  }, [categoryId, database, navigation]);
  
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  
  if (!category) {
    return (
      <View style={styles.errorContainer}>
        <Text>Category not found</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <Card style={styles.summaryCard}>
        <Card.Content>
          <Title style={[styles.categoryName, { color: category.color }]}>
            {category.name}
          </Title>
          
          <View style={styles.budgetSummary}>
            {budgets.length > 0 ? (
              budgets.map(budget => (
                <View key={budget.id} style={styles.budgetItem}>
                  <Text style={styles.monthLabel}>{budget.month}</Text>
                  <View style={styles.budgetValues}>
                    <Text style={styles.budgetLabel}>Assigned:</Text>
                    <Text style={styles.budgetAmount}>${budget.assigned}</Text>
                  </View>
                  <View style={styles.budgetValues}>
                    <Text style={styles.budgetLabel}>Available:</Text>
                    <Text style={styles.budgetAmount}>${budget.available}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.noBudgetText}>No budget assigned for this category</Text>
            )}
          </View>
        </Card.Content>
      </Card>
      
      <View style={styles.transactionsContainer}>
        <Title style={styles.sectionTitle}>Recent Transactions</Title>
        {transactions.length > 0 ? (
          <TransactionsList 
            transactions={transactions}
            onTransactionPress={(transaction) => {
              // Navigate to transaction details if needed
              console.log('Transaction pressed', transaction.id);
            }}
          />
        ) : (
          <Text style={styles.noTransactionsText}>
            No transactions for this category
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
  },
  summaryCard: {
    margin: 16,
    elevation: 2,
  },
  categoryName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  budgetSummary: {
    marginTop: 8,
  },
  budgetItem: {
    marginBottom: 12,
    padding: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  budgetValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  budgetLabel: {
    fontSize: 14,
    color: '#757575',
  },
  budgetAmount: {
    fontSize: 14,
    fontWeight: '500',
  },
  noBudgetText: {
    fontStyle: 'italic',
    color: '#757575',
  },
  transactionsContainer: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 20,
    marginBottom: 12,
  },
  noTransactionsText: {
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#757575',
    padding: 20,
  },
});

export default CategoryDetailsScreen;