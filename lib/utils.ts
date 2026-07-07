import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function statusColor(status: 'active' | 'trial' | 'past_due' | 'canceled') {
  switch (status) {
    case 'active':
      return 'bg-status-green/10 text-status-green';
    case 'trial':
      return 'bg-brand-500/10 text-brand-600';
    case 'past_due':
      return 'bg-status-yellow/10 text-status-yellow';
    case 'canceled':
      return 'bg-status-red/10 text-status-red';
  }
}

export function complianceStatus(expiryDate: string, reminderDays: number): 'green' | 'yellow' | 'red' {
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'red';
  if (days <= 7) return 'red';
  if (days <= reminderDays) return 'yellow';
  return 'green';
}
