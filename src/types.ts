export type MeterType = 'prepaid' | 'postpaid';
export type PowerStatus = 'lightOn' | 'lowCurrent' | 'noLight';
export type PaymentMethod = 'wallet' | 'bankTransfer' | 'card' | 'crypto';

export type MeterRecord = {
  id: string;
  label: string;
  providerCode: string;
  providerName: string;
  meterNumber: string;
  customerName: string;
  address: string;
  meterType: MeterType;
  kwhReserve: number;
};

export type NotificationItem = {
  title: string;
  message: string;
  time: string;
  critical?: boolean;
};

export type HistoryItem = {
  title: string;
  subtitle: string;
  amount: string;
  accent: string;
};

export type RecentRecipient = {
  name: string;
  meterNumber: string;
  lastNote: string;
  lastAmount: number;
  lastShared: string;
};

export type PendingToken = {
  meterNumber: string;
  kwhAmount: number;
  source: 'purchase' | 'share';
  note?: string;
};
