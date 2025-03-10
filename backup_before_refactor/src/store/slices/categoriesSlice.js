import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  categories: [],
  status: 'idle',
  error: null,
};

const categoriesSlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {
    fetchCategoriesStart(state) {
      state.status = 'loading';
    },
    fetchCategoriesSuccess(state, action) {
      state.status = 'succeeded';
      state.categories = action.payload;
    },
    fetchCategoriesFailure(state, action) {
      state.status = 'failed';
      state.error = action.payload;
    },
    addCategorySuccess(state, action) {
      state.categories.push(action.payload);
    },
    updateCategorySuccess(state, action) {
      const { id, changes } = action.payload;
      const index = state.categories.findIndex(category => category.id === id);
      if (index !== -1) {
        state.categories[index] = { ...state.categories[index], ...changes };
      }
    },
    deleteCategorySuccess(state, action) {
      state.categories = state.categories.filter(
        category => category.id !== action.payload
      );
    },
  },
});

export const {
  fetchCategoriesStart,
  fetchCategoriesSuccess,
  fetchCategoriesFailure,
  addCategorySuccess,
  updateCategorySuccess,
  deleteCategorySuccess,
} = categoriesSlice.actions;

export default categoriesSlice.reducer;