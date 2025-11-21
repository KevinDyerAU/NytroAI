// Shared types for Supabase Edge Functions

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  description: string;
}

export interface CheckoutSessionRequest {
  packageId: string;
  rtoCode: string;
  credits: number;
  price: number;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: any;
  };
}

export interface PaymentMetadata {
  rtoCode: string;
  packageId: string;
  credits: number;
  rtoId?: string;
}

export const CREDIT_PACKAGES: Record<string, CreditPackage> = {
  starter: {
    id: 'starter',
    name: 'Starter Pack',
    credits: 100,
    price: 9.99,
    description: 'Perfect for trying out AI features',
  },
  professional: {
    id: 'professional',
    name: 'Professional Pack',
    credits: 500,
    price: 39.99,
    description: 'Most popular for regular users',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise Pack',
    credits: 2000,
    price: 129.99,
    description: 'Best value for heavy users',
  },
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited Pack',
    credits: 10000,
    price: 499.99,
    description: 'Maximum credits for large organizations',
  },
};
