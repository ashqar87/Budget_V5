import React, { useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector, useDispatch } from 'react-redux';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { Platform } from 'react-native';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

// Main Screens
import BudgetScreen from '../screens/budget/BudgetScreen';
import AccountsScreen from '../screens/accounts/AccountsScreen';
import TransactionsScreen from '../screens/transactions/TransactionsScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

// Details Screens
import AccountDetailsScreen from '../screens/accounts/AccountDetailsScreen';
import AddAccountScreen from '../screens/accounts/AddAccountScreen';
import CategoryDetailsScreen from '../screens/budget/CategoryDetailsScreen';
import AddTransactionScreen from '../screens/transactions/AddTransactionScreen';

// Import the update function
import { syncReadyToAssignWithBudgets } from '../utils/budgetUtils';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const AccountStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="AccountsList" 
        component={AccountsScreen} 
        options={{ title: 'Accounts' }}
      />
      <Stack.Screen 
        name="AccountDetails" 
        component={AccountDetailsScreen} 
        options={({ route }) => ({ title: route.params?.accountName || 'Account Details' })}
      />
      <Stack.Screen 
        name="AddAccount" 
        component={AddAccountScreen} 
        options={{ title: 'Add Account' }}
      />
    </Stack.Navigator>
  );
};

const BudgetStack = () => {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  
  // Add a focus listener to recalculate readyToAssign when tab is focused
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Sync readyToAssign with the current state of budgets
      syncReadyToAssignWithBudgets(dispatch);
    });
    
    return unsubscribe;
  }, [navigation, dispatch]);
  
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="BudgetMain" 
        component={BudgetScreen} 
        options={{ title: 'Budget' }}
      />
      <Stack.Screen 
        name="CategoryDetails" 
        component={CategoryDetailsScreen} 
        options={({ route }) => ({ title: route.params?.categoryName || 'Category Details' })}
      />
    </Stack.Navigator>
  );
};

const TransactionsStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="TransactionsList" 
        component={TransactionsScreen} 
        options={{ title: 'Transactions' }}
      />
      <Stack.Screen 
        name="AddTransaction" 
        component={AddTransactionScreen} 
        options={{ title: 'Add Transaction' }}
      />
    </Stack.Navigator>
  );
};

const SettingsStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="SettingsMain" 
        component={SettingsScreen} 
        options={{ title: 'Settings' }}
      />
    </Stack.Navigator>
  );
};

const MainTabNavigator = () => {
  const theme = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.disabled,
        headerShown: false,
        tabBarStyle: (route.params?.tabBarStyle) || {
          height: Platform.OS === 'ios' ? 88 : 60, // Higher height for iOS (includes safe area)
          paddingTop: Platform.OS === 'ios' ? 8 : 0,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: Platform.OS === 'android' ? 4 : 0,
        },
        tabBarIconStyle: {
          marginTop: Platform.OS === 'android' ? 4 : 0,
        },
      })}
    >
      <Tab.Screen 
        name="Budget" 
        component={BudgetStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chart-pie" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Accounts" 
        component={AccountStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="bank" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Transactions" 
        component={TransactionsStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="swap-horizontal" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsStack}
        options={{
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cog" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const AuthNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
};

const AppNavigator = () => {
  const { isAuthenticated } = useSelector(state => state.auth);
  
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="Main" component={MainTabNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};

export default AppNavigator;