import { DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#2E7D32',     // Green 800
    accent: '#1976D2',      // Blue 700
    background: '#F5F5F5',  // Grey 100
    surface: '#FFFFFF',     // White
    text: '#212121',        // Grey 900
    disabled: '#9E9E9E',    // Grey 500
    placeholder: '#757575', // Grey 600
    backdrop: 'rgba(0, 0, 0, 0.5)',
    notification: '#F44336', // Red 500
    
    // Custom app-specific colors
    success: '#43A047',     // Green 600
    warning: '#FFA000',     // Amber 700
    error: '#D32F2F',       // Red 700
    info: '#1976D2',        // Blue 700
    
    // Budget related colors
    budgetAssigned: '#2E7D32',
    budgetActivity: '#C62828',
    budgetAvailable: '#1565C0',
    
    // Category colors
    categoryColors: [
      '#F44336', // Red
      '#E91E63', // Pink  
      '#9C27B0', // Purple
      '#673AB7', // Deep Purple
      '#3F51B5', // Indigo
      '#2196F3', // Blue
      '#03A9F4', // Light Blue
      '#00BCD4', // Cyan
      '#009688', // Teal
      '#4CAF50', // Green
      '#8BC34A', // Light Green
      '#CDDC39', // Lime
      '#FFEB3B', // Yellow
      '#FFC107', // Amber
      '#FF9800', // Orange
      '#FF5722', // Deep Orange
      '#795548', // Brown
      '#607D8B', // Blue Grey
    ]
  },
  fonts: {
    ...DefaultTheme.fonts,
    regular: {
      fontFamily: 'sans-serif',
      fontWeight: 'normal',
    },
    medium: {
      fontFamily: 'sans-serif-medium',
      fontWeight: '500',
    },
    light: {
      fontFamily: 'sans-serif-light',
      fontWeight: '300',
    },
    thin: {
      fontFamily: 'sans-serif-thin',
      fontWeight: '100',
    },
  },
  roundness: 8,
  animation: {
    scale: 1.0,
  },
};