import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, Animated, Keyboard } from 'react-native';
import { Surface, Text, IconButton, Button, Divider, Chip } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
// Keep consistent height but ensure it's not too tall on small devices
const MODAL_HEIGHT = Math.min(height * 0.35, 280);

const BudgetAllocationModal = ({
  visible,
  category,
  currentAmount,
  onChangeAmount,
  onClose,
  onSave,
  onAutoAssign,
  onEditCategory,
}) => {
  // Animation values
  const slideAnim = useRef(new Animated.Value(MODAL_HEIGHT)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  
  // State
  const [amount, setAmount] = useState(currentAmount || '0');
  const [activeTab, setActiveTab] = useState('assign'); // 'assign', 'auto', 'edit'
  
  // Auto assign amounts
  const [autoAssignAmounts, setAutoAssignAmounts] = useState({
    previous: '0.00',
    spent: '0.00',
    average: '0.00'
  });
  
  // Update local amount when props change
  useEffect(() => {
    setAmount(currentAmount || '0');
  }, [currentAmount]);
  
  // Control modal animation
  useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
      
      // Animate both slide up and opacity
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
      
      // Reset to assign tab when opening
      setActiveTab('assign');
      
      // Fetch auto-assign amounts when modal is opened
      fetchAutoAssignAmounts();
    } else {
      // Animate both slide down and fade out
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: MODAL_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(modalOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible, slideAnim, modalOpacity]);

  // Fetch the auto-assign amounts
  const fetchAutoAssignAmounts = async () => {
    // Simulate fetching amounts
    // In a real scenario, you would call your existing auto-assign functions
    setTimeout(() => {
      setAutoAssignAmounts({
        previous: '25.00', // Example amount
        spent: '18.75',    // Example amount
        average: '22.50'   // Example amount
      });
    }, 300);
  };

  const handleNumPress = (num) => {
    // If amount is 0, replace it
    if (amount === '0') {
      setAmount(num);
      onChangeAmount(num);
      return;
    }
    
    // Otherwise append the number
    const newAmount = amount + num;
    setAmount(newAmount);
    onChangeAmount(newAmount);
  };
  
  const handleDecimalPress = () => {
    if (amount.includes('.')) return;
    const newAmount = amount + '.';
    setAmount(newAmount);
    onChangeAmount(newAmount);
  };
  
  const handleBackspace = () => {
    if (amount.length <= 1) {
      setAmount('0');
      onChangeAmount('0');
      return;
    }
    
    const newAmount = amount.slice(0, -1);
    setAmount(newAmount);
    onChangeAmount(newAmount);
  };
  
  const handleSave = () => {
    onSave(amount);
  };
  
  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity 
        style={[styles.iconTab, activeTab === 'assign' && styles.activeIconTab]} 
        onPress={() => setActiveTab('assign')}
      >
        <MaterialCommunityIcons 
          name="calculator" 
          size={24} 
          color={activeTab === 'assign' ? '#2196F3' : '#757575'} 
        />
        <Text style={[styles.iconTabText, activeTab === 'assign' && styles.activeTabText]}>
          Assign
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.iconTab, activeTab === 'auto' && styles.activeIconTab]} 
        onPress={() => setActiveTab('auto')}
      >
        <MaterialCommunityIcons 
          name="lightning-bolt" 
          size={24} 
          color={activeTab === 'auto' ? '#2196F3' : '#757575'} 
        />
        <Text style={[styles.iconTabText, activeTab === 'auto' && styles.activeTabText]}>
          Auto
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.iconTab, activeTab === 'edit' && styles.activeIconTab]} 
        onPress={() => setActiveTab('edit')}
      >
        <MaterialCommunityIcons 
          name="pencil" 
          size={24} 
          color={activeTab === 'edit' ? '#2196F3' : '#757575'} 
        />
        <Text style={[styles.iconTabText, activeTab === 'edit' && styles.activeTabText]}>
          Edit
        </Text>
      </TouchableOpacity>
    </View>
  );
  
  const renderNumPad = () => (
    <View style={styles.numPadContainer}>
      <View style={styles.numRow}>
        <TouchableOpacity style={styles.numButton} onPress={() => handleNumPress('1')}>
          <Text style={styles.numText}>1</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.numButton} onPress={() => handleNumPress('2')}>
          <Text style={styles.numText}>2</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.numButton} onPress={() => handleNumPress('3')}>
          <Text style={styles.numText}>3</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.numRow}>
        <TouchableOpacity style={styles.numButton} onPress={() => handleNumPress('4')}>
          <Text style={styles.numText}>4</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.numButton} onPress={() => handleNumPress('5')}>
          <Text style={styles.numText}>5</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.numButton} onPress={() => handleNumPress('6')}>
          <Text style={styles.numText}>6</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.numRow}>
        <TouchableOpacity style={styles.numButton} onPress={() => handleNumPress('7')}>
          <Text style={styles.numText}>7</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.numButton} onPress={() => handleNumPress('8')}>
          <Text style={styles.numText}>8</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.numButton} onPress={() => handleNumPress('9')}>
          <Text style={styles.numText}>9</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.numRow}>
        <TouchableOpacity style={styles.numButton} onPress={handleDecimalPress}>
          <Text style={styles.numText}>.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.numButton} onPress={() => handleNumPress('0')}>
          <Text style={styles.numText}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.numButton} onPress={handleBackspace}>
          <MaterialCommunityIcons name="backspace-outline" size={26} color="#333" />
        </TouchableOpacity>
      </View>
    </View>
  );
  
  const renderAutoOptions = () => (
    <View style={styles.autoOptionsContainer}>
      <TouchableOpacity 
        style={styles.autoOptionButton}
        onPress={() => {
          onChangeAmount(autoAssignAmounts.previous);
          onAutoAssign('previous');
        }}
      >
        <Text style={styles.autoOptionLabel}>Same as Last Month</Text>
        <Text style={styles.autoOptionAmount}>${autoAssignAmounts.previous}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.autoOptionButton}
        onPress={() => {
          onChangeAmount(autoAssignAmounts.spent);
          onAutoAssign('spent');
        }}
      >
        <Text style={styles.autoOptionLabel}>Same as Spent Last Month</Text>
        <Text style={styles.autoOptionAmount}>${autoAssignAmounts.spent}</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.autoOptionButton}
        onPress={() => {
          onChangeAmount(autoAssignAmounts.average);
          onAutoAssign('average');
        }}
      >
        <Text style={styles.autoOptionLabel}>Average Spent</Text>
        <Text style={styles.autoOptionAmount}>${autoAssignAmounts.average}</Text>
      </TouchableOpacity>
    </View>
  );
  
  const renderEditOptions = () => (
    <View style={styles.editOptionsContainer}>
      <TouchableOpacity 
        style={styles.editOption}
        onPress={() => {
          onEditCategory();
          onClose();
        }}
      >
        <MaterialCommunityIcons name="pencil" size={24} color="#2196F3" />
        <Text style={styles.editOptionText}>Rename Category</Text>
      </TouchableOpacity>
      
      <Divider style={styles.divider} />
      
      <TouchableOpacity 
        style={styles.editOption}
        onPress={() => {
          // Handle delete through edit category
          onEditCategory();
          onClose();
        }}
      >
        <MaterialCommunityIcons name="delete" size={24} color="#F44336" />
        <Text style={[styles.editOptionText, { color: '#F44336' }]}>Delete Category</Text>
      </TouchableOpacity>
    </View>
  );

  if (!visible) return null;

  return (
    <Animated.View style={[
      styles.modalContainer,
      { 
        opacity: modalOpacity,
        transform: [{ translateY: slideAnim }]
      }
    ]}>
      {/* Show only the amount, not the category name */}
      <View style={styles.amountHeader}>
        <Text style={styles.amountDisplay}>
          ${currentAmount}
        </Text>
      </View>
      
      {/* Tabs with icons */}
      {renderTabs()}
      
      {/* Content based on active tab */}
      <View style={styles.contentContainer}>
        {activeTab === 'assign' && renderNumPad()}
        {activeTab === 'auto' && renderAutoOptions()}
        {activeTab === 'edit' && renderEditOptions()}
      </View>
      
      {/* Bottom action buttons */}
      <View style={styles.bottomActions}>
        <TouchableOpacity 
          onPress={onClose} 
          style={styles.closeButton}
        >
          <MaterialCommunityIcons name="close" size={26} color="#757575" />
        </TouchableOpacity>
        
        <Button 
          mode="contained" 
          onPress={handleSave}
          disabled={activeTab === 'edit'}
          style={styles.doneButton}
          labelStyle={styles.doneButtonLabel}
        >
          Done
        </Button>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    width: '100%',
    height: MODAL_HEIGHT,
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.22,
    shadowRadius: 2.62,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  // Replace categoryHeader with simpler amountHeader
  amountHeader: {
    flexDirection: 'row',
    justifyContent: 'center', // Center the amount
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  
  // Remove categoryName styling
  
  amountDisplay: {
    fontSize: 24, // Make it larger
    fontWeight: 'bold',
    color: '#2196F3',
  },
  // New tabContainer styling for icon-based tabs
  tabContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 6,
  },
  iconTab: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 20,
  },
  activeIconTab: {
    backgroundColor: '#e3f2fd',
  },
  iconTabText: {
    fontSize: 12,
    marginTop: 2,
    color: '#757575',
  },
  activeTabText: {
    color: '#2196F3',
    fontWeight: '500',
  },
  // Content container
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  // Fix numpad styling
  numPadContainer: {
    flex: 1,
    justifyContent: 'space-evenly', // Better spacing
    paddingVertical: 4,
  },
  
  numRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginVertical: 2,
  },
  
  numButton: {
    width: (width - 64) / 3, // Calculate width based on available space
    height: 50,  // Fixed height
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    backgroundColor: '#f5f5f5',
  },
  numText: {
    fontSize: width < 350 ? 18 : 24, // Scale font for very small screens
    fontWeight: '500',
    color: '#333',
  },
  // Auto options
  autoOptionsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  autoOptionButton: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  autoOptionLabel: {
    fontSize: 16,
  },
  autoOptionAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  // Edit options
  editOptionsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  editOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginVertical: 4,
  },
  editOptionText: {
    fontSize: 16,
    marginLeft: 16,
  },
  divider: {
    marginVertical: 8,
  },
  // Bottom action buttons
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  closeButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 50, // Fixed width
    height: 50, // Fixed height to match doneButton height
  },
  doneButton: {
    minWidth: 120,
    borderRadius: 25,
    paddingVertical: 6,
  },
  doneButtonLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default BudgetAllocationModal;
