/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Validation Payment Success Page
 * Shown after successful Stripe checkout for the $99 validation service.
 * Updates lead status to 'paid'. Admin users will manually download
 * validation reports and email them to customers.
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import nytroLogo from '../assets/nytro-logo.svg';
import { CheckCircle, Clock, ArrowLeft, AlertCircle } from 'lucide-react';

export const ValidationSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('lead_id');
  const [leadEmail, setLeadEmail] = useState<string>('');
  const [leadName, setLeadName] = useState<string>('');
  const [statusUpdated, setStatusUpdated] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    
    const processPaymentSuccess = async () => {
      if (!leadId) return;

      try {
        // First, read the lead to get promo/discount info
        const { data: leadInfo } = await supabase
          .from('validation_leads')
          .select('email, first_name, last_name, discount_amount, promo_code')
          .eq('id', parseInt(leadId))
          .single();

        // Calculate actual amount paid (99 minus discount)
        const discount = leadInfo?.discount_amount ? Number(leadInfo.discount_amount) : 0;
        const actualAmountPaid = Math.max(99 - discount, 1); // minimum $1

        // Update lead status to 'landed' — ready for admin review
        const { data, error: updateError } = await supabase
          .from('validation_leads')
          .update({ 
            status: 'landed', 
            stripe_payment_status: 'paid', 
            amount_paid: actualAmountPaid,
            updated_at: new Date().toISOString(),
          })
          .eq('id', parseInt(leadId))
          .select('email, first_name, last_name')
          .single();
        
        if (updateError) {
          console.error('[ValidationSuccess] Lead update error:', updateError);
        }

        if (data?.email) {
          setLeadEmail(data.email);
          setLeadName(data.first_name || '');
        }

        setStatusUpdated(true);
        console.log('[ValidationSuccess] Lead status updated to landed for lead:', leadId);

        // Trigger Brevo confirmation emails
        try {
          const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
          const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
          if (SUPABASE_URL && SUPABASE_ANON_KEY) {
            await fetch(`${SUPABASE_URL}/functions/v1/send-validation-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({
                lead_id: parseInt(leadId),
                email_type: 'both',
              }),
            });
            console.log('[ValidationSuccess] Brevo email triggered for lead:', leadId);
          }
        } catch (emailErr) {
          console.error('[ValidationSuccess] Email trigger error:', emailErr);
          // Don't fail the success page if email fails
        }
      } catch (error) {
        console.error('[ValidationSuccess] Error:', error);
        setStatusUpdated(true); // Still show success — payment was processed by Stripe
      }
    };

    processPaymentSuccess();
  }, [leadId]);

  return (
    <div className="min-h-screen bg-nytro-dark text-white font-body">
      {/* Navigation */}
      <nav className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            <a href="/" className="flex items-center" aria-label="Nytro Home">
              <img src={nytroLogo} alt="Nytro" className="h-8 md:h-10 w-auto" />
            </a>
          </div>
        </div>
      </nav>

      {/* Success Content */}
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="mb-8">
          <div className="w-20 h-20 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-teal-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-sans font-bold mb-4">
            Validation Request Received
          </h1>
          <p className="text-xl text-slate-300">
            Thank you{leadName ? `, ${leadName}` : ''}! Your payment has been processed and your validation request has been submitted.
          </p>
          {leadId && (
            <p className="text-sm text-slate-500 mt-2">
              Reference: #VAL-{String(leadId).padStart(5, '0')}
            </p>
          )}
        </div>

        <div className="bg-slate-800/50 rounded-2xl p-8 space-y-6 text-left mb-8">
          <h2 className="text-lg font-semibold text-white text-center">What happens next</h2>
          
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <p className="font-medium text-white">Payment confirmed</p>
                <p className="text-sm text-slate-400">
                  Your payment has been processed successfully.
                  {leadEmail && (
                    <>
                      {' '}A receipt will be sent to{' '}
                      <span className="text-teal-400">{leadEmail}</span> by Stripe.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-white">Your resource is being reviewed</p>
                <p className="text-sm text-slate-400">
                  Our team will review your submitted resource and deliver a completed 
                  validation report within <strong className="text-white">2–3 business days</strong>. 
                  The report will be sent to {leadEmail ? <span className="text-teal-400">{leadEmail}</span> : 'the email you provided'}.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Important clarification */}
        <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-8 text-left">
          <p className="text-sm text-slate-400 mb-1 uppercase tracking-wide font-medium">Please note</p>
          <p className="text-sm text-slate-300">
            This was a <strong className="text-white">one-off validation request</strong> — no account was created. 
            If you'd like to access Nytro's full platform with document management, AI-powered validation, 
            and ongoing assessment tools, you can create a free account below.
          </p>
        </div>

        {/* Warning if no lead ID */}
        {!leadId && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-8 flex items-start gap-3 text-left">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-300">
              We couldn't find a reference for this payment. If you completed a payment, 
              please contact us at{' '}
              <a href="mailto:support@nytro.com.au" className="text-teal-400 hover:text-teal-300 underline">
                support@nytro.com.au
              </a>{' '}
              with your payment confirmation and we'll sort it out.
            </p>
          </div>
        )}

        {/* CTAs */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <a
            href="/"
            className="flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 hover:border-teal-400/50 text-white px-6 py-3.5 rounded-xl text-sm font-semibold transition-all hover:bg-slate-800/80"
          >
            <ArrowLeft className="w-4 h-4" />
            Submit Another Validation
          </a>
          <a
            href="/register"
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-teal-400 to-teal-500 text-nytro-dark px-6 py-3.5 rounded-xl text-sm font-bold uppercase tracking-wide hover:from-teal-500 hover:to-teal-600 transition-all"
          >
            Create a Free Nytro Account
          </a>
        </div>

        <p className="text-sm text-slate-500">
          Questions? Contact us at{' '}
          <a href="mailto:support@nytro.com.au" className="text-teal-400 hover:text-teal-300">
            support@nytro.com.au
          </a>
        </p>
      </div>
    </div>
  );
};

export default ValidationSuccessPage;
