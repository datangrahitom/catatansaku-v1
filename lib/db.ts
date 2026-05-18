import Dexie, { type Table } from 'dexie';

export interface Expense {
  id?: number;
  amount: number;
  date: Date;
  categoryId: string;
  paymentMethodId: string;
  note: string;
}

export interface Budget {
  month: string;
  amount: number;
}

export interface Allocation {
  id?: number;
  month: string;
  name: string;
  amount: number;
}

export class CatatUangDB extends Dexie {
  expenses!: Table<Expense, number>;
  budgets!: Table<Budget, string>;
  allocations!: Table<Allocation, number>;

  constructor() {
    super('CatatUangDB');
    this.version(3).stores({
      expenses: '++id, date, categoryId, paymentMethodId',
      budgets: 'month',
      allocations: '++id, month',
    });
  }
}

export const db = new CatatUangDB();

export const CATEGORIES = [
  { id: 'food', name: 'Makanan', color: '#3b82f6' },
  { id: 'transport', name: 'Transport', color: '#10b981' },
  { id: 'shopping', name: 'Belanja', color: '#f59e0b' },
  { id: 'bills', name: 'Tagihan', color: '#ef4444' },
  { id: 'other', name: 'Lainnya', color: '#8b5cf6' },
];

export const PAYMENT_METHODS = [
  { id: 'transfer', name: 'Transfer Bank' },
  { id: 'qris', name: 'QRIS / E-Wallet' },
  { id: 'cash', name: 'Tunai (Cash)' },
];
