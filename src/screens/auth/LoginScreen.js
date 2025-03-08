import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform
} from 'react-native';
import { TextInput, Button, Text, Title, Surface } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { loginStart, loginSuccess, loginFailure } from '../../store/slices/authSlice';

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
    <View style={styles.container}>
      <View style={styles.background}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
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
    </View>
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
  },
  formContainer: {
    padding: 20,
    borderRadius: 10,
    elevation: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  title: {
    fontSize: 28,
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