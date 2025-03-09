import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Dimensions
} from 'react-native';
import { TextInput, Button, Text, Title, Surface } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { loginStart, loginSuccess, loginFailure } from '../../store/slices/authSlice';
import { SafeAreaView } from 'react-native-safe-area-context';

// Get device dimensions
const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();
  const { status, error } = useSelector(state => state.auth);
  const isLoading = status === 'loading';

  const handleLogin = () => {
    // For demonstration in the prototype, simulate a successful login
    if (!email || !password) {
      dispatch(loginFailure('Please enter email and password'));
      return;
    }

    dispatch(loginStart());
    
    // Simulate API call delay
    setTimeout(() => {
      dispatch(loginSuccess({ 
        id: '1',
        email: email,
        displayName: 'Demo User' 
      }));
    }, 1000);
  };

  // For development purpose - bypass login
  const skipLogin = () => {
    dispatch(loginSuccess({ id: 'dev-user-id', email: 'dev@example.com', displayName: 'Dev User' }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.background}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <Surface style={styles.formContainer}>
            <Title style={styles.title}>Budget Wise</Title>
            
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              mode="outlined"
            />
            
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
              mode="outlined"
            />
            
            {error && <Text style={styles.errorText}>{error}</Text>}
            
            <Button 
              mode="contained" 
              onPress={handleLogin}
              loading={isLoading}
              disabled={isLoading}
              style={styles.button}
            >
              Log In
            </Button>
            
            <Button 
              mode="outlined"
              onPress={() => navigation.navigate('Register')}
              style={styles.button}
            >
              Create Account
            </Button>

            {__DEV__ && (
              <TouchableOpacity onPress={skipLogin} style={styles.devButton}>
                <Text style={styles.devButtonText}>Dev Mode: Skip Login</Text>
              </TouchableOpacity>
            )}
          </Surface>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2E7D32', // Green background color instead of an image
  },
  keyboardAvoid: {
    flex: 1,
    width: '90%',
    justifyContent: 'center',
    maxWidth: 500, // Add max width for tablets/larger phones
  },
  formContainer: {
    padding: Math.min(width * 0.05, 20), // Responsive padding
    borderRadius: 10,
    elevation: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  title: {
    fontSize: Math.min(width * 0.07, 28), // Responsive font size
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    marginBottom: 12,
  },
  button: {
    marginTop: 12,
  },
  errorText: {
    color: '#D32F2F',
    marginBottom: 12,
    textAlign: 'center',
  },
  devButton: {
    marginTop: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  devButtonText: {
    color: '#757575',
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;