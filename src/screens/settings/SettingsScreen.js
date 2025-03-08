import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { List, Divider, Switch, Button, Dialog, Portal, Text, useTheme } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { logout } from '../../store/slices/authSlice';
import { useDatabase } from '../../context/DatabaseContext';
import { format } from 'date-fns';

const SettingsScreen = () => {
  const navigation = useNavigation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const database = useDatabase();
  
  const { user } = useSelector(state => state.auth);
  
  const [darkThemeEnabled, setDarkThemeEnabled] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [isConfirmLogoutVisible, setIsConfirmLogoutVisible] = useState(false);
  const [isConfirmDeleteVisible, setIsConfirmDeleteVisible] = useState(false);
  const [isAboutVisible, setIsAboutVisible] = useState(false);
  
  const handleLogout = () => {
    dispatch(logout());
    setIsConfirmLogoutVisible(false);
  };
  
  const handleDeleteAccount = async () => {
    try {
      // In a real app, you would delete the user's account and data
      Alert.alert(
        'Account Deleted',
        'Your account and all data have been deleted.',
        [{ text: 'OK', onPress: () => dispatch(logout()) }]
      );
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', 'Failed to delete account. Please try again.');
    } finally {
      setIsConfirmDeleteVisible(false);
    }
  };
  
  const handleExportData = async () => {
    Alert.alert(
      'Export Data',
      'Your data will be exported as a CSV file. This feature is not yet implemented.',
      [{ text: 'OK' }]
    );
  };
  
  const renderAccountSection = () => (
    <>
      <List.Section>
        <List.Subheader>Account</List.Subheader>
        <List.Item
          title={user?.displayName || 'User'}
          description={user?.email || 'user@example.com'}
          left={props => <List.Icon {...props} icon="account" />}
          onPress={() => {}} // Navigate to profile edit screen
        />
        <Divider />
        <List.Item
          title="Change Password"
          left={props => <List.Icon {...props} icon="lock" />}
          onPress={() => {}} // Navigate to change password screen
        />
        <Divider />
        <List.Item
          title="Logout"
          left={props => <List.Icon {...props} icon="logout" color="#F44336" />}
          onPress={() => setIsConfirmLogoutVisible(true)}
        />
      </List.Section>
      <Divider style={styles.sectionDivider} />
    </>
  );
  
  const renderPreferencesSection = () => (
    <>
      <List.Section>
        <List.Subheader>Preferences</List.Subheader>
        <List.Item
          title="Dark Theme"
          left={props => <List.Icon {...props} icon="theme-light-dark" />}
          right={() => (
            <Switch
              value={darkThemeEnabled}
              onValueChange={setDarkThemeEnabled}
              color={theme.colors.primary}
            />
          )}
        />
        <Divider />
        <List.Item
          title="Notifications"
          description="Get reminders for budgeting and bills"
          left={props => <List.Icon {...props} icon="bell" />}
          right={() => (
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              color={theme.colors.primary}
            />
          )}
        />
        <Divider />
        <List.Item
          title="Biometric Authentication"
          description="Use fingerprint or face ID to log in"
          left={props => <List.Icon {...props} icon="fingerprint" />}
          right={() => (
            <Switch
              value={biometricsEnabled}
              onValueChange={setBiometricsEnabled}
              color={theme.colors.primary}
            />
          )}
        />
      </List.Section>
      <Divider style={styles.sectionDivider} />
    </>
  );
  
  const renderDataSection = () => (
    <>
      <List.Section>
        <List.Subheader>Data Management</List.Subheader>
        <List.Item
          title="Export Data"
          description="Export your transactions as CSV"
          left={props => <List.Icon {...props} icon="export" />}
          onPress={handleExportData}
        />
        <Divider />
        <List.Item
          title="Categories"
          description="Manage your transaction categories"
          left={props => <List.Icon {...props} icon="folder" />}
          onPress={() => {}} // Navigate to categories management screen
        />
        <Divider />
        <List.Item
          title="Delete Account"
          description="Permanently delete your account and data"
          left={props => <List.Icon {...props} icon="delete" color="#F44336" />}
          onPress={() => setIsConfirmDeleteVisible(true)}
        />
      </List.Section>
      <Divider style={styles.sectionDivider} />
    </>
  );
  
  const renderAboutSection = () => (
    <List.Section>
      <List.Subheader>About</List.Subheader>
      <List.Item
        title="About Budget Wise"
        left={props => <List.Icon {...props} icon="information" />}
        onPress={() => setIsAboutVisible(true)}
      />
      <Divider />
      <List.Item
        title="Help & Support"
        left={props => <List.Icon {...props} icon="help-circle" />}
        onPress={() => {}} // Navigate to help screen
      />
      <Divider />
      <List.Item
        title="Privacy Policy"
        left={props => <List.Icon {...props} icon="shield" />}
        onPress={() => {}} // Navigate to privacy policy
      />
      <Divider />
      <List.Item
        title="Terms of Service"
        left={props => <List.Icon {...props} icon="file-document" />}
        onPress={() => {}} // Navigate to terms of service
      />
    </List.Section>
  );
  
  const renderLogoutDialog = () => (
    <Portal>
      <Dialog visible={isConfirmLogoutVisible} onDismiss={() => setIsConfirmLogoutVisible(false)}>
        <Dialog.Title>Log Out</Dialog.Title>
        <Dialog.Content>
          <Text>Are you sure you want to log out?</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setIsConfirmLogoutVisible(false)}>Cancel</Button>
          <Button onPress={handleLogout} textColor="#F44336">Log Out</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
  
  const renderDeleteAccountDialog = () => (
    <Portal>
      <Dialog visible={isConfirmDeleteVisible} onDismiss={() => setIsConfirmDeleteVisible(false)}>
        <Dialog.Title>Delete Account</Dialog.Title>
        <Dialog.Content>
          <Text>
            Are you sure you want to delete your account? This action cannot be undone
            and all your data will be permanently deleted.
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setIsConfirmDeleteVisible(false)}>Cancel</Button>
          <Button onPress={handleDeleteAccount} textColor="#F44336">Delete</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
  
  const renderAboutDialog = () => (
    <Portal>
      <Dialog visible={isAboutVisible} onDismiss={() => setIsAboutVisible(false)}>
        <Dialog.Title>About Budget Wise</Dialog.Title>
        <Dialog.Content>
          <Text style={styles.aboutText}>
            Budget Wise v1.0.0
          </Text>
          <Text style={styles.aboutText}>
            A personal finance app to help you track spending, create budgets, 
            and achieve your financial goals.
          </Text>
          <Text style={styles.aboutText}>
            © {new Date().getFullYear()} Budget Wise Team
          </Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={() => setIsAboutVisible(false)}>Close</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {renderAccountSection()}
      {renderPreferencesSection()}
      {renderDataSection()}
      {renderAboutSection()}
      
      {renderLogoutDialog()}
      {renderDeleteAccountDialog()}
      {renderAboutDialog()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    paddingBottom: 24,
  },
  sectionDivider: {
    height: 12,
    backgroundColor: '#eeeeee',
  },
  aboutText: {
    marginBottom: 12,
  },
});

export default SettingsScreen;