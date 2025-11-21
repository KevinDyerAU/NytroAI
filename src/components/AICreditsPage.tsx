import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Cpu, Check, Zap, Sparkles } from 'lucide-react';
import { getRTOById, getAICredits } from '../types/rto';
import { getStripe } from '../lib/stripe';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface AICreditsPageProps {
  selectedRTOId: string;
  onCreditsAdded?: () => void;
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  popular?: boolean;
  description: string;
}

const creditPackages: CreditPackage[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    credits: 100,
    price: 9.99,
    description: 'Perfect for trying out AI features',
  },
  {
    id: 'professional',
    name: 'Professional Pack',
    credits: 500,
    price: 39.99,
    popular: true,
    description: 'Most popular for regular users',
  },
  {
    id: 'enterprise',
    name: 'Enterprise Pack',
    credits: 2000,
    price: 129.99,
    description: 'Best value for heavy users',
  },
  {
    id: 'unlimited',
    name: 'Unlimited Pack',
    credits: 10000,
    price: 499.99,
    description: 'Maximum credits for large organizations',
  },
];

export function AICreditsPage({ selectedRTOId, onCreditsAdded }: AICreditsPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [currentCredits, setCurrentCredits] = useState({ current: 0, total: 0 });
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  const currentRTO = getRTOById(selectedRTOId);

  useEffect(() => {
    loadCredits();
  }, [selectedRTOId]);

  const loadCredits = async () => {
    if (!currentRTO?.code) return;
    
    try {
      const credits = await getAICredits(currentRTO.code);
      setCurrentCredits(credits);
    } catch (error) {
      console.error('Error loading AI credits:', error);
    }
  };

  const handlePurchase = async (pkg: CreditPackage) => {
    if (!currentRTO?.code) {
      toast.error('Please select an RTO first');
      return;
    }

    setIsLoading(true);
    setSelectedPackage(pkg.id);

    try {
      // Get current URL for success/cancel redirects
      const currentUrl = window.location.origin;
      const successUrl = `${currentUrl}/settings?tab=purchase&success=true&package=${pkg.id}`;
      const cancelUrl = `${currentUrl}/settings?tab=purchase&canceled=true`;

      // Call Supabase Edge Function to create Stripe Checkout session
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        toast.error('Supabase configuration missing. Please check environment variables.');
        setIsLoading(false);
        setSelectedPackage(null);
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          packageId: pkg.id,
          rtoCode: currentRTO.code,
          credits: pkg.credits,
          price: pkg.price,
          successUrl,
          cancelUrl,
        }),
      });

      let responseData;
      try {
        // Clone the response to safely read the body without stream conflicts
        try {
          responseData = await response.clone().json();
        } catch (cloneError) {
          // Fallback: if cloning fails, try reading directly
          console.warn('Clone json() failed, attempting direct read:', cloneError);
          responseData = await response.json();
        }
      } catch (jsonError) {
        console.error('Failed to parse checkout response:', jsonError);
        throw new Error(`Failed to parse checkout response: ${jsonError.message}`);
      }

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to create checkout session');
      }

      const { sessionId, url } = responseData;

      // Redirect to Stripe Checkout
      const stripe = await getStripe();
      if (stripe && sessionId) {
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
          console.error('Stripe redirect error:', error);
          toast.error(error.message || 'Failed to redirect to checkout');
        }
      } else if (url) {
        // Fallback: direct redirect to checkout URL
        window.location.href = url;
      } else {
        throw new Error('No checkout session URL received');
      }

    } catch (error) {
      console.error('Error processing purchase:', error);
      toast.error(
        error instanceof Error 
          ? error.message 
          : 'Failed to process purchase. Please try again.'
      );
      setIsLoading(false);
      setSelectedPackage(null);
    }
  };

  // Check for success/cancel query parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const packageId = urlParams.get('package');

    if (success === 'true') {
      const pkg = creditPackages.find(p => p.id === packageId);
      toast.success(
        `Payment successful! ${pkg ? pkg.credits.toLocaleString() : ''} AI credits will be added to your account shortly.`
      );
      onCreditsAdded?.();
      loadCredits();
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (canceled === 'true') {
      toast.info('Payment was canceled. No charges were made.');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#f8f9fb] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-poppins font-bold text-[#1e293b] mb-2">
            Purchase AI Credits
          </h1>
          <p className="text-[#64748b]">
            Boost your AI capabilities with additional credits for smart questions and validations
          </p>
        </div>

        {/* Current Balance */}
        <Card className="border border-[#dbeafe] bg-gradient-to-br from-purple-50 to-blue-50 p-6 shadow-soft mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white rounded-full p-3 shadow-md">
                <Cpu className="w-8 h-8 text-[#8b5cf6]" />
              </div>
              <div>
                <h2 className="text-lg font-poppins font-semibold text-[#1e293b]">
                  Current AI Credits
                </h2>
                <p className="text-sm text-[#64748b]">
                  {currentRTO?.name || 'No RTO selected'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-[#8b5cf6]">
                {currentCredits.current.toLocaleString()}
              </div>
              <div className="text-sm text-[#64748b]">
                of {currentCredits.total.toLocaleString()} total
              </div>
            </div>
          </div>
        </Card>

        {/* Credit Packages */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {creditPackages.map((pkg) => (
            <Card
              key={pkg.id}
              className={`border-2 ${
                pkg.popular
                  ? 'border-[#8b5cf6] bg-gradient-to-br from-purple-50 to-white'
                  : 'border-[#dbeafe] bg-white'
              } p-6 shadow-soft relative hover:shadow-lg transition-shadow`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <div className="bg-[#8b5cf6] text-white px-4 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Most Popular
                  </div>
                </div>
              )}

              <div className="text-center mb-6 mt-2">
                <h3 className="text-xl font-poppins font-bold text-[#1e293b] mb-2">
                  {pkg.name}
                </h3>
                <p className="text-sm text-[#64748b] mb-4">{pkg.description}</p>
                
                <div className="mb-4">
                  <div className="text-4xl font-bold text-[#1e293b]">
                    ${pkg.price}
                  </div>
                  <div className="text-sm text-[#64748b]">AUD</div>
                </div>

                <div className="bg-[#f1f5f9] rounded-lg p-3 mb-4">
                  <div className="flex items-center justify-center gap-2">
                    <Zap className="w-5 h-5 text-[#8b5cf6]" />
                    <span className="text-2xl font-bold text-[#1e293b]">
                      {pkg.credits.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-xs text-[#64748b] mt-1">AI Credits</div>
                </div>

                <div className="text-xs text-[#64748b] mb-4">
                  ${(pkg.price / pkg.credits).toFixed(3)} per credit
                </div>
              </div>

              <Button
                onClick={() => handlePurchase(pkg)}
                disabled={isLoading || !currentRTO}
                className={`w-full ${
                  pkg.popular
                    ? 'bg-[#8b5cf6] hover:bg-[#7c3aed]'
                    : 'bg-[#60a5fa] hover:bg-[#3b82f6]'
                } text-white font-poppins font-semibold shadow-md`}
              >
                {isLoading && selectedPackage === pkg.id ? (
                  'Processing...'
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Purchase Now
                  </>
                )}
              </Button>
            </Card>
          ))}
        </div>

        {/* Features & Benefits */}
        <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft">
          <h3 className="text-lg font-poppins font-semibold text-[#1e293b] mb-6">
            What You Can Do With AI Credits
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="bg-[#dcfce7] rounded-full p-2">
                  <Check className="w-5 h-5 text-[#16a34a]" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-[#1e293b] mb-1">
                  Generate Smart Questions
                </h4>
                <p className="text-sm text-[#64748b]">
                  Automatically create intelligent assessment questions based on unit requirements
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="bg-[#dcfce7] rounded-full p-2">
                  <Check className="w-5 h-5 text-[#16a34a]" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-[#1e293b] mb-1">
                  Redo Validations
                </h4>
                <p className="text-sm text-[#64748b]">
                  Re-run validation processes with improved AI analysis
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="bg-[#dcfce7] rounded-full p-2">
                  <Check className="w-5 h-5 text-[#16a34a]" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-[#1e293b] mb-1">
                  AI-Powered Chat
                </h4>
                <p className="text-sm text-[#64748b]">
                  Get intelligent responses about your documents and assessments
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="bg-[#dcfce7] rounded-full p-2">
                  <Check className="w-5 h-5 text-[#16a34a]" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-[#1e293b] mb-1">
                  Document Analysis
                </h4>
                <p className="text-sm text-[#64748b]">
                  Deep analysis of uploaded documents with AI insights
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="bg-[#dcfce7] rounded-full p-2">
                  <Check className="w-5 h-5 text-[#16a34a]" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-[#1e293b] mb-1">
                  Compliance Checking
                </h4>
                <p className="text-sm text-[#64748b]">
                  Automated compliance verification against standards
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="bg-[#dcfce7] rounded-full p-2">
                  <Check className="w-5 h-5 text-[#16a34a]" />
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-[#1e293b] mb-1">
                  Priority Processing
                </h4>
                <p className="text-sm text-[#64748b]">
                  Faster processing times for all AI-powered features
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Payment Info */}
        <div className="mt-8 text-center text-sm text-[#64748b]">
          <p>
            Secure payment processing powered by Stripe. All transactions are encrypted and secure.
          </p>
          <p className="mt-2">
            Credits never expire and can be used across all features.
          </p>
        </div>
      </div>
    </div>
  );
}
