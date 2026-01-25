import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Check, Tag, X, Loader2, Mail, FileText } from 'lucide-react';
import { getStripe } from '../lib/stripe';
import { toast } from 'sonner';

interface AICreditsPageProps {
  onCreditsAdded?: () => void;
}

const UNIT_PRICE_AUD = 180;

export function AICreditsPage({ onCreditsAdded }: AICreditsPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoDiscount, setPromoDiscount] = useState<{ percent?: number; amount?: number } | null>(null);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) {
      setPromoError('Please enter a promo code');
      return;
    }

    setPromoValidating(true);
    setPromoError('');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/validate-promo-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({ promoCode: promoCode.trim().toUpperCase() }),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        setPromoError(data.error || 'Invalid promo code');
        setPromoApplied(false);
        setPromoDiscount(null);
      } else {
        setPromoApplied(true);
        setPromoDiscount(data.discount);
        toast.success(`Promo code applied! ${data.discount.percent ? `${data.discount.percent}% off` : `$${data.discount.amount} off`}`);
      }
    } catch (error) {
      console.error('Error validating promo code:', error);
      setPromoError('Failed to validate promo code');
    } finally {
      setPromoValidating(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoCode('');
    setPromoApplied(false);
    setPromoDiscount(null);
    setPromoError('');
  };

  const getDiscountedPrice = (originalPrice: number) => {
    if (!promoDiscount) return originalPrice;
    if (promoDiscount.percent) {
      return originalPrice * (1 - promoDiscount.percent / 100);
    }
    if (promoDiscount.amount) {
      return Math.max(0, originalPrice - promoDiscount.amount);
    }
    return originalPrice;
  };

  const totalPrice = UNIT_PRICE_AUD * quantity;
  const discountedTotal = getDiscountedPrice(totalPrice);

  const handlePurchase = async () => {
    setIsLoading(true);

    try {
      const currentUrl = window.location.origin;
      const successUrl = `${currentUrl}/settings?tab=purchase&success=true&quantity=${quantity}`;
      const cancelUrl = `${currentUrl}/settings?tab=purchase&canceled=true`;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        toast.error('Configuration missing. Please check environment variables.');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          productType: 'unit',
          quantity,
          unitPrice: UNIT_PRICE_AUD,
          successUrl,
          cancelUrl,
          promoCode: promoApplied ? promoCode.trim().toUpperCase() : undefined,
        }),
      });

      let responseData;
      try {
        responseData = await response.clone().json();
      } catch (cloneError) {
        responseData = await response.json();
      }

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to create checkout session');
      }

      const { sessionId, url } = responseData;

      const stripe = await getStripe();
      if (stripe && sessionId) {
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
          console.error('Stripe redirect error:', error);
          toast.error(error.message || 'Failed to redirect to checkout');
        }
      } else if (url) {
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
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const canceled = urlParams.get('canceled');
    const qty = urlParams.get('quantity');

    if (success === 'true') {
      toast.success(
        `Payment successful! Your ${qty || ''} unit${Number(qty) > 1 ? 's' : ''} will be activated shortly.`
      );
      onCreditsAdded?.();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (canceled === 'true') {
      toast.info('Payment was canceled. No charges were made.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#f8f9fb] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-poppins font-bold text-[#1e293b] mb-2">
            Purchase Units
          </h1>
          <p className="text-[#64748b]">
            Purchase individual units at $180 AUD each
          </p>
        </div>

        {/* Single Unit Purchase Card */}
        <Card className="border-2 border-[#8b5cf6] bg-gradient-to-br from-purple-50 to-white p-8 shadow-soft mb-8">
          <div className="flex items-start gap-6">
            <div className="bg-[#8b5cf6] rounded-xl p-4">
              <FileText className="w-8 h-8 text-white" />
            </div>

            <div className="flex-1">
              <h2 className="text-2xl font-poppins font-bold text-[#1e293b] mb-2">
                Unit Purchase
              </h2>
              <p className="text-[#64748b] mb-6">
                Each unit costs <span className="font-bold text-[#8b5cf6]">$180 AUD</span>. Select the number of units you need.
              </p>

              {/* Quantity Selector */}
              <div className="flex items-center gap-4 mb-6">
                <span className="text-[#1e293b] font-medium">Quantity:</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="w-10 h-10 p-0"
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center border-[#dbeafe]"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 p-0"
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Promo Code Section */}
              <div className="bg-white/50 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                  <Tag className="w-5 h-5 text-[#64748b]" />
                  <span className="text-sm font-medium text-[#1e293b]">Promo code:</span>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Enter code"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value.toUpperCase());
                          setPromoError('');
                        }}
                        disabled={promoApplied}
                        className={`w-40 uppercase ${promoApplied ? 'bg-green-50 border-green-300' : ''} ${promoError ? 'border-red-300' : ''}`}
                      />
                      {promoApplied && (
                        <button
                          onClick={handleRemovePromo}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {!promoApplied && (
                      <Button
                        onClick={handleApplyPromo}
                        disabled={promoValidating || !promoCode.trim()}
                        variant="outline"
                        size="sm"
                        className="border-[#8b5cf6] text-[#8b5cf6] hover:bg-[#8b5cf6] hover:text-white"
                      >
                        {promoValidating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Apply'
                        )}
                      </Button>
                    )}

                    {promoApplied && (
                      <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        {promoDiscount?.percent ? `${promoDiscount.percent}% off` : `$${promoDiscount?.amount} off`}
                      </span>
                    )}
                  </div>
                </div>

                {promoError && (
                  <p className="text-sm text-red-500 mt-2">{promoError}</p>
                )}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between mb-6 p-4 bg-[#f1f5f9] rounded-lg">
                <span className="text-lg font-medium text-[#1e293b]">Total:</span>
                <div className="text-right">
                  {promoApplied && promoDiscount && (
                    <div className="text-sm text-[#94a3b8] line-through">
                      ${totalPrice.toLocaleString()} AUD
                    </div>
                  )}
                  <div className="text-2xl font-bold text-[#8b5cf6]">
                    ${discountedTotal.toLocaleString()} AUD
                  </div>
                </div>
              </div>

              {/* Purchase Button */}
              <Button
                onClick={handlePurchase}
                disabled={isLoading}
                className="w-full bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-poppins font-semibold py-3 h-auto text-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Purchase Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* Subscription Section */}
        <Card className="border border-[#dbeafe] bg-white p-8 shadow-soft">
          <div className="text-center">
            <h3 className="text-xl font-poppins font-bold text-[#1e293b] mb-3">
              Need a Subscription?
            </h3>
            <p className="text-[#64748b] mb-6 max-w-lg mx-auto">
              Contact us for significant discounts on subscription plans. We offer flexible packages
              tailored to your organisation's needs with volume pricing and dedicated support.
            </p>
            <Button
              onClick={() => window.location.href = 'mailto:sales@nytro.ai?subject=Subscription Enquiry'}
              variant="outline"
              className="border-[#3b82f6] text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white"
            >
              <Mail className="w-4 h-4 mr-2" />
              Contact Us for Subscription Pricing
            </Button>
          </div>
        </Card>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-[#64748b]">
          <p>Secure payment powered by Stripe • All prices in AUD</p>
        </div>
      </div>
    </div>
  );
}
