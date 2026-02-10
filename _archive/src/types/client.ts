// Client-related type definitions

export interface Client {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
  updatedAt: string;
}

export interface ClientAccount {
  id: string;
  clientId: string;
  accountName: string;
  accountType: 'email' | 'social' | 'advertising';
  status: 'active' | 'inactive' | 'suspended';
  credentials: Record<string, any>;
}

export interface ClientBilling {
  clientId: string;
  plan: 'basic' | 'premium' | 'enterprise';
  amount: number;
  currency: string;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: string;
  status: 'active' | 'past_due' | 'cancelled';
}
