import { useColorScheme } from 'react-native';
import type { OfferStatus } from '../interfaces/chat-message.interface';

const light = {
  bg: '#f4f5f7',
  surface: '#ffffff',
  text: '#1d1f24',
  muted: '#6b7280',
  border: '#e3e5e8',
  primary: '#2563eb',
  primaryText: '#ffffff',
  danger: '#b91c1c',
  ownBubble: '#dbeafe',
  otherBubble: '#ffffff',
  status: {
    pending: { fg: '#b45309', bg: '#fef3c7' },
    accepted: { fg: '#047857', bg: '#d1fae5' },
    rejected: { fg: '#b91c1c', bg: '#fee2e2' },
    cancelled: { fg: '#4b5563', bg: '#e5e7eb' },
  } as Record<OfferStatus, { fg: string; bg: string }>,
};

const dark: typeof light = {
  bg: '#111318',
  surface: '#1b1e25',
  text: '#e8eaee',
  muted: '#9aa1ad',
  border: '#2c303a',
  primary: '#3b82f6',
  primaryText: '#ffffff',
  danger: '#f87171',
  ownBubble: '#1e3a5f',
  otherBubble: '#1b1e25',
  status: {
    pending: { fg: '#fbbf24', bg: '#3a2c0b' },
    accepted: { fg: '#34d399', bg: '#0b3326' },
    rejected: { fg: '#f87171', bg: '#3b1515' },
    cancelled: { fg: '#cbd5e1', bg: '#2c303a' },
  },
};

export type Colors = typeof light;

export const useColors = (): Colors =>
  useColorScheme() === 'dark' ? dark : light;
