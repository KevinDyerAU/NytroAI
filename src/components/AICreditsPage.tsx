import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Check, Tag, X, Loader2, Mail, FileText, Shield, Zap, ChevronRight, CreditCard } from 'lucide-react';
import { getStripe } from '../lib/stripe';
import { toast } from 'sonner';

interface AICreditsPageProps {
  onCreditsAdded?: () => void;
}

const UNIT_PRICE_AUD = 180;

const FEATURES = [
  'AI-powered document validation',
  'Automated requirement extraction',
  'Evidence mapping & gap analysis',
  'Smart question generation',
  'Compliance validation reports',
];

const VOLUME_TIERS = [
  { min: 5, label: '5+ units', discount: '5% off', badge: 'bg-blue-100 text-blue-700' },
  { min: 10, label: '10+ units', discount: '10% off', badge: 'bg-emerald-100 text-emerald-700' },
  { min: 20, label: '20+ units', discount: 'Contact us', badge: 'bg-slate-100 text-slate-700' },
];

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
  const hasSavings = promoApplied && promoDiscount && discountedTotal < totalPrice;

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
    <div className="min-h-screen w-full bg-[#f8f9fb] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">

        {/* Hero Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-blue-100 to-emerald-100 rounded-full mb-4">
            <Zap className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-700">Validation Credits</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-poppins font-bold text-[#1e293b] mb-3">
            Purchase Validation Units
          </h1>
          <p className="text-[#64748b] text-lg max-w-2xl mx-auto">
            Each unit provides a complete AI-powered validation cycle for one unit of competency.
          </p>
        </div>

        {/* Main Content — 2 columns */}
        <div className="grid lg:grid-cols-5 gap-8 mb-10">

          {/* Left — Purchase Card (3 cols) */}
          <div className="lg:col-span-3">
            <Card className="border border-blue-200 bg-white shadow-lg shadow-blue-100/50 overflow-hidden">
              {/* Gradient top bar */}
              <div className="h-1.5 bg-gradient-to-r from-blue-500 via-blue-400 to-emerald-400" />

              <div className="p-6 md:p-8">
                {/* Card header */}
                <div className="flex items-start gap-4 mb-8">
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-3.5 shadow-lg shadow-blue-200">
                    <FileText className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-poppins font-bold text-[#1e293b]">
                      Unit Purchase
                    </h2>
                    <p className="text-sm text-[#64748b] mt-1">
                      Each unit costs <span className="font-bold text-blue-600">$180 AUD</span>. Select the number of units you need.
                    </p>
                  </div>
                </div>

                {/* Quantity Selector */}
                <div className="mb-6">
                  <label className="text-sm font-semibold text-[#1e293b] block mb-2">Select Quantity</label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="w-11 h-11 p-0 border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-lg font-medium rounded-xl transition-all"
                    >
                      −
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center text-lg font-bold border-slate-200 focus:border-blue-400 rounded-xl h-11"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-11 h-11 p-0 border-slate-200 hover:border-blue-400 hover:bg-blue-50 text-lg font-medium rounded-xl transition-all"
                    >
                      +
                    </Button>
                    {/* Quick select */}
                    <div className="hidden sm:flex items-center gap-2 ml-3 pl-3 border-l border-slate-200">
                      {[1, 5, 10].map((q) => (
                        <button
                          key={q}
                          onClick={() => setQuantity(q)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            quantity === q
                              ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100 my-6" />

                {/* Promo Code */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-semibold text-[#1e293b]">Promo Code</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-[200px]">
                      <Input
                        type="text"
                        placeholder="ENTER CODE"
                        value={promoCode}
                        onChange={(e) => {
                          setPromoCode(e.target.value.toUpperCase());
                          setPromoError('');
                        }}
                        disabled={promoApplied}
                        className={`uppercase text-sm font-medium tracking-wide rounded-xl ${
                          promoApplied ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : ''
                        } ${promoError ? 'border-red-300' : 'border-slate-200'}`}
                      />
                      {promoApplied && (
                        <button
                          onClick={handleRemovePromo}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors"
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
                        className="border-blue-300 text-blue-600 hover:bg-blue-500 hover:text-white hover:border-blue-500 rounded-xl transition-all h-10 px-5"
                      >
                        {promoValidating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Apply'
                        )}
                      </Button>
                    )}

                    {promoApplied && (
                      <span className="text-sm text-emerald-600 font-semibold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg">
                        <Check className="w-4 h-4" />
                        {promoDiscount?.percent ? `${promoDiscount.percent}% off` : `$${promoDiscount?.amount} off`}
                      </span>
                    )}
                  </div>
                  {promoError && (
                    <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
                      <X className="w-3 h-3" />
                      {promoError}
                    </p>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100 my-6" />

                {/* Order Summary */}
                <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-2xl p-5 mb-6">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Order Summary</h3>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Validation Unit × {quantity}</span>
                      <span className="text-slate-800 font-medium">${totalPrice.toLocaleString()} AUD</span>
                    </div>
                    {hasSavings && (
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-600 font-medium">Promo discount</span>
                        <span className="text-emerald-600 font-semibold">
                          -${(totalPrice - discountedTotal).toLocaleString()} AUD
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <div className="flex justify-between items-baseline">
                      <span className="text-base font-semibold text-[#1e293b]">Total</span>
                      <div className="text-right">
                        {hasSavings && (
                          <div className="text-sm text-slate-400 line-through mb-0.5">
                            ${totalPrice.toLocaleString()} AUD
                          </div>
                        )}
                        <span className="text-2xl font-bold text-blue-600">
                          ${discountedTotal.toLocaleString()} AUD
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Purchase Button */}
                <Button
                  onClick={handlePurchase}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-poppins font-semibold py-3.5 h-auto text-base rounded-xl shadow-lg shadow-blue-200 transition-all hover:shadow-xl hover:shadow-blue-300 active:scale-[0.99]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5 mr-2" />
                      Purchase Now — ${discountedTotal.toLocaleString()} AUD
                    </>
                  )}
                </Button>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Secure checkout
                  </span>
                  <span>•</span>
                  <span>Powered by Stripe</span>
                  <span>•</span>
                  <span>All prices in AUD</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right — Features & Info (2 cols) */}
          <div className="lg:col-span-2 space-y-6">

            {/* What's Included */}
            <Card className="border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/50 p-6 shadow-lg shadow-emerald-100/30 overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-500" />
              
              <div className="flex items-center gap-2 mb-5">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg p-2 shadow-md shadow-emerald-200">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-poppins font-bold text-[#1e293b]">What's Included</h3>
              </div>

              <ul className="space-y-3">
                {FEATURES.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-emerald-600" />
                    </div>
                    <span className="text-sm text-slate-600">{feature}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Volume Discounts */}
            <Card className="border border-blue-100 bg-white p-6 shadow-sm">
              <h3 className="font-poppins font-bold text-[#1e293b] mb-4 flex items-center gap-2">
                <Tag className="w-4 h-4 text-blue-500" />
                Volume Pricing
              </h3>
              <div className="space-y-2">
                {VOLUME_TIERS.map((tier, i) => (
                  <button
                    key={i}
                    onClick={() => tier.min <= 10 && setQuantity(tier.min)}
                    className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-blue-50 transition-all group cursor-pointer"
                  >
                    <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700 transition-colors">
                      {tier.label}
                    </span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tier.badge}`}>
                      {tier.discount}
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            {/* Subscription CTA */}
            <Card className="border border-slate-200 bg-gradient-to-br from-slate-800 to-slate-900 p-6 shadow-lg text-white overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-emerald-600/10" />
              <div className="relative">
                <h3 className="font-poppins font-bold text-white mb-2">
                  Need a Subscription?
                </h3>
                <p className="text-sm text-slate-300 mb-5 leading-relaxed">
                  Contact us for flexible subscription plans with volume discounts and dedicated support.
                </p>
                <Button
                  onClick={() => window.location.href = 'mailto:sales@nytro.ai?subject=Subscription Enquiry'}
                  variant="outline"
                  className="border-white/20 text-white bg-white/10 hover:bg-white hover:text-slate-900 transition-all rounded-xl text-sm font-semibold h-10"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Contact Sales
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
}
