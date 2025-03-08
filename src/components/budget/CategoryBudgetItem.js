import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Surface, Text, IconButton, TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const CategoryBudgetItem = ({ category, assigned, available, onAssign, onPress }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [assignedAmount, setAssignedAmount] = useState(assigned.toString());
  
  const handleSave = () => {
    const amount = parseFloat(assignedAmount);
    if (!isNaN(amount)) {
      onAssign(amount);
    } else {
      // Reset to previous value if invalid input
      setAssignedAmount(assigned.toString());
    }
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setAssignedAmount(assigned.toString());
    setIsEditing(false);
  };
  
  // Get color for available amount (red if negative)
  const getAvailableColor = () => {
    return available < 0 ? '#D32F2F' : available > 0 ? '#2E7D32' : '#757575';
  };
  
  return (
    <Surface style={styles.container}>
      <TouchableOpacity
        style={styles.categoryContainer}
        onPress={onPress}
        disabled={isEditing}
      >
        <View style={styles.categoryHeader}>
          <View style={styles.categoryInfo}>
            <View 
              style={[
                styles.categoryIcon, 
                { backgroundColor: category.color || '#4CAF50' }
              ]}
            >
              <MaterialCommunityIcons
                name={category.icon || 'folder-outline'}
                size={18}
                color="#FFFFFF"
              />
            </View>
            <Text style={styles.categoryName}>{category.name}</Text>
          </View>
          
          {!isEditing && (
            <IconButton
              icon="pencil"
              size={18}
              onPress={() => setIsEditing(true)}
            />
          )}
        </View>
        
        <View style={styles.budgetInfo}>
          {isEditing ? (
            <View style={styles.editContainer}>
              <TextInput
                label="Assigned"
                value={assignedAmount}
                onChangeText={setAssignedAmount}
                keyboardType="decimal-pad"
                dense
                mode="outlined"
                style={styles.editInput}
                left={<TextInput.Affix text="$" />}
                autoFocus
              />
              <View style={styles.editActions}>
                <Button 
                  compact 
                  mode="outlined" 
                  onPress={handleCancel}
                  style={styles.editButton}
                >
                  Cancel
                </Button>
                <Button 
                  compact 
                  mode="contained" 
                  onPress={handleSave}
                  style={styles.editButton}
                >
                  Save
                </Button>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.amountContainer}>
                <Text style={styles.amountLabel}>Assigned</Text>
                <Text style={styles.amount}>${assigned.toFixed(2)}</Text>
              </View>
              
              <View style={styles.amountContainer}>
                <Text style={styles.amountLabel}>Available</Text>
                <Text
                  style={[
                    styles.amount,
                    { color: getAvailableColor() }
                  ]}
                >
                  ${available.toFixed(2)}
                </Text>
              </View>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    borderRadius: 8,
    elevation: 1,
  },
  categoryContainer: {
    padding: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
  },
  budgetInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  amountContainer: {
    alignItems: 'center',
    minWidth: 80,
  },
  amountLabel: {
    fontSize: 12,
    color: '#757575',
  },
  amount: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 2,
  },
  editContainer: {
    flex: 1,
  },
  editInput: {
    height: 40,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  editButton: {
    marginLeft: 8,
  },
});

export default CategoryBudgetItem;