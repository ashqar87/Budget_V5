import React, { useState } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView,
  KeyboardAvoidingView, 
  Platform,
  Dimensions
} from 'react-native';
import { TextInput, Button, Text, Title, Surface } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { loginSuccess } from '../../store/slices/authSlice';
import { SafeAreaView } from 'react-native-safe-area-context';

// Get device dimensions
const { width, height } = Dimensions.get('window');

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const dispatch = useDispatch();

  const handleRegistration = () => {
    // Form validation
    if (!name || !email || !password) {
      setError('All fields are required');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password should be at least 6 characters');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    // Simulate account creation with a delay
    setTimeout(() => {
      dispatch(loginSuccess({
        id: 'new-user-id',
        email: email,
        displayName: name,
      }));
      setLoading(false);
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.background}>
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
          >
            <Surface style={styles.formContainer}>
              <Title style={styles.title}>Create Account</Title>
              
              <TextInput
                label="Full Name"
                value={name}
                onChangeText={setName}
                style={styles.input}
                mode="outlined"
              />
              
              <TextInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
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
              
              <TextInput
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                style={styles.input}
                mode="outlined"
              />
              
              {error && <Text style={styles.errorText}>{error}</Text>}
              
              <Button 
                mode="contained" 
                onPress={handleRegistration}
                loading={loading}
                disabled={loading}
                style={styles.button}
              >
                Register
              </Button>
              
              <Button 
                mode="outlined" 
                onPress={() => navigation.navigate('Login')}
                style={styles.button}
              >
                Back to Login
              </Button>
            </Surface>
          </KeyboardAvoidingView>
        </ScrollView>
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
    backgroundColor: '#2E7D32', // Green background color instead of image
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: width > 500 ? 40 : 20, // More padding on larger screens
  },
  keyboardAvoid: {
    flex: 1,
  },
  formContainer: {
    padding: Math.min(width * 0.05, 20), // Responsive padding
    borderRadius: 10,
    elevation: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    maxWidth: 500, // Add max width
    alignSelf: 'center', // Center on larger screens
    width: '100%',
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
});

export default RegisterScreen;