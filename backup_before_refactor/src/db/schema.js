import { Model } from '@nozbe/watermelondb';
import { field, date, children, relation } from '@nozbe/watermelondb/decorators';

// Schema definitions
export const accountSchema = {
  name: 'accounts',
  columns: [
    { name: 'name', type: 'string' },
    { name: 'type', type: 'string' },
    { name: 'initial_balance', type: 'number' },
    { name: 'current_balance', type: 'number' },
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ]
};

export const categorySchema = {
  name: 'categories',
  columns: [
    { name: 'name', type: 'string' },
    { name: 'icon', type: 'string', isOptional: true },
    { name: 'color', type: 'string', isOptional: true },
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ]
};

export const categoryBudgetSchema = {
  name: 'category_budgets',
  columns: [
    { name: 'category_id', type: 'string', isIndexed: true },
    { name: 'month', type: 'string', isIndexed: true },
    { name: 'assigned', type: 'number' },
    { name: 'available', type: 'number' },
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ]
};

export const transactionSchema = {
  name: 'transactions',
  columns: [
    { name: 'account_id', type: 'string', isIndexed: true },
    { name: 'category_id', type: 'string', isIndexed: true, isOptional: true },
    { name: 'amount', type: 'number' },
    { name: 'date', type: 'number' },
    { name: 'payee', type: 'string' },
    { name: 'notes', type: 'string', isOptional: true },
    { name: 'type', type: 'string' }, // 'income', 'expense', 'transfer'
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ]
};

// Model classes
export class Account extends Model {
  static table = 'accounts';
  
  @field('name') name;
  @field('type') type;
  @field('initial_balance') initialBalance;
  @field('current_balance') currentBalance;
  @date('created_at') createdAt;
  @date('updated_at') updatedAt;
  
  @children('transactions') transactions;
}

export class Category extends Model {
  static table = 'categories';
  
  @field('name') name;
  @field('icon') icon;
  @field('color') color;
  @date('created_at') createdAt;
  @date('updated_at') updatedAt;
  
  @children('category_budgets') budgets;
}

export class CategoryBudget extends Model {
  static table = 'category_budgets';
  
  @field('month') month;
  @field('assigned') assigned;
  @field('available') available;
  @date('created_at') createdAt;
  @date('updated_at') updatedAt;
  
  @relation('categories', 'category_id') category;
}

export class Transaction extends Model {
  static table = 'transactions';
  
  @field('amount') amount;
  @field('payee') payee;
  @field('notes') notes;
  @field('type') type;
  @date('date') date;
  @date('created_at') createdAt;
  @date('updated_at') updatedAt;
  
  @relation('accounts', 'account_id') account;
  @relation('categories', 'category_id') category;
}