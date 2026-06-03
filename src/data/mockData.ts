import type { HistoryItem, MeterRecord, NotificationItem, RecentRecipient } from '../types';

export const metersSeed: MeterRecord[] = [
  {
    id: 'home',
    label: 'Home',
    providerCode: 'AEDC',
    providerName: 'Abuja Electricity',
    meterNumber: '11111111111',
    customerName: 'Myke Daniels',
    address: '12 Gado Nasko Close, Kubwa, Abuja',
    meterType: 'prepaid',
    kwhReserve: 142.4,
  },
  {
    id: 'office',
    label: 'Office',
    providerCode: 'EKEDC',
    providerName: 'Eko Electricity',
    meterNumber: '33333333333',
    customerName: 'Myke Daniels',
    address: '7 Opebi Road, Ikeja, Lagos',
    meterType: 'prepaid',
    kwhReserve: 96.8,
  },
  {
    id: 'school',
    label: 'School',
    providerCode: 'PHED',
    providerName: 'Port Harcourt Electricity',
    meterNumber: '44444444444',
    customerName: 'Myke Daniels',
    address: '9 Ada George Road, Port Harcourt',
    meterType: 'postpaid',
    kwhReserve: 64.2,
  },
];

export const notificationsSeed: NotificationItem[] = [
  {
    title: 'Weather outage alert',
    message: 'Due to heavy rainfall, supply will be interrupted for 30 minutes.',
    time: 'Now',
    critical: true,
  },
  {
    title: 'Meter synchronized',
    message: 'Your Home meter synced successfully with the disco server.',
    time: '12 mins ago',
  },
  {
    title: 'Token ready',
    message: 'A new electricity token is ready for DIU transfer.',
    time: '1 hr ago',
  },
];

export const historySeed: HistoryItem[] = [
  {
    title: 'Wallet funded',
    subtitle: 'Zenerlink MFB transfer',
    amount: '+NGN 10,000',
    accent: '#0DF020',
  },
  {
    title: 'Electricity purchase',
    subtitle: 'AEDC prepaid meter',
    amount: '-NGN 5,000',
    accent: '#C8823A',
  },
];

export const recipientsSeed: RecentRecipient[] = [
  {
    name: 'Mom',
    meterNumber: '22222222222',
    lastNote: 'Monthly support',
    lastAmount: 20,
    lastShared: '2 days ago',
  },
  {
    name: 'Bro',
    meterNumber: '55555555555',
    lastNote: 'Weekend top-up',
    lastAmount: 15,
    lastShared: '5 days ago',
  },
];
