import type { PaymentTransaction, PayMethod, TradeStatus } from './types';
import { storage } from './storage';

export interface TransactionView {
  id: string;
  name: string;
  keyword: string;
  method: PayMethod | 'all';
  status: TradeStatus | 'all';
  tradeType: PaymentTransaction['trade_type'] | 'all';
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
  sortKey: keyof PaymentTransaction;
  sortDir: 'asc' | 'desc';
  columns: Record<string, boolean>;
  pageSize: number;
  createdAt: string;
}

const keyFor = (username: string) => `wt.transactionViews.${username}`;
const columnNames = ['tradeNo', 'merchant', 'amount', 'method', 'status', 'time', 'desc'];
const methods = ['all', 'qr', 'card', 'api', 'mini_program'];
const statuses = ['all', 'success', 'processing', 'failed', 'closed'];
const sortColumns = ['wechat_trade_no', 'merchant_name', 'amount_fen', 'pay_method', 'status', 'description', 'paid_at'];

export const readTransactionViews = (username: string): TransactionView[] => {
  try {
    const raw: unknown = JSON.parse(storage.get(keyFor(username)) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((v): v is TransactionView =>
      v && typeof v === 'object' && typeof v.id === 'string' && typeof v.name === 'string'
      && v.name.length <= 30 && typeof v.keyword === 'string' && methods.includes(v.method)
      && statuses.includes(v.status) && ['all', 'payment', 'refund'].includes(v.tradeType)
      && sortColumns.includes(v.sortKey) && ['asc', 'desc'].includes(v.sortDir) && v.columns !== null && typeof v.columns === 'object'
      && columnNames.every((column) => typeof v.columns[column] === 'boolean')
      && [20, 50, 100, 200].includes(v.pageSize)
      && ['dateFrom', 'dateTo', 'amountMin', 'amountMax'].every((field) => typeof v[field] === 'string')
      && typeof v.createdAt === 'string'
    ).slice(0, 6);
  } catch { return []; }
};

export const writeTransactionViews = (username: string, views: TransactionView[]): void => {
  storage.set(keyFor(username), JSON.stringify(views.slice(0, 6)));
};