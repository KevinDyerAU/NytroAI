/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Validation Payment Success Page
 * Shown after successful Stripe checkout for the $99 validation service.
 */
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import nytroLogo from '../assets/nytro-logo.svg';
import { CheckCircle, Mail, Clock, ArrowLeft } from 'lucide-react';

export const ValidationSuccessPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const leadId = searchParams.get('lead_id');
  const [leadEmail, setLeadEmail] = useState<string>('');

  useEffect(() => {
    window.scrollTo({ top: 0 });
    
    // Update lead status and fetch email
    const updateLead = async () => {
      if (leadId) {
        const { data } = await supabase
          .from('validation_leads')
          .update({ status: 'paid', stripe_payment_status: 'paid', amount_paid: 99.00 })
          .eq('id', parseInt(leadId))
          .select('email')
          .single();
        
        if (data?.email) {
          setLeadEmail(data.email);
        }
      }
    };
    updateLead();
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
            Payment Successful
          </h1>
          <p className="text-xl text-slate-300">
            Thank you for choosing Nytro for your independent validation.
          </p>
        </div>

        <div className="bg-slate-800/50 rounded-2xl p-8 space-y-6 text-left mb-8">
          <h2 className="text-lg font-semibold text-white text-center">What happens next</h2>
          
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <p className="font-medium text-white">Confirmation email sent</p>
                <p className="text-sm text-slate-400">
                  A confirmation has been sent to{' '}
                  {leadEmail ? (
                    <span className="text-teal-400">{leadEmail}</span>
                  ) : (
                    'your email address'
                  )}
                  .
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-white">Validation in progress</p>
                <p className="text-sm text-slate-400">
                  Our team will review your resource and deliver your completed validation report
                  within 2–3 business days.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <a
            href="/validation"
            className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Submit another validation
          </a>
          <p className="text-sm text-slate-500">
            Questions? Contact us at{' '}
            <a href="mailto:support@nytro.com.au" className="text-teal-400 hover:text-teal-300">
              support@nytro.com.au
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ValidationSuccessPage;
