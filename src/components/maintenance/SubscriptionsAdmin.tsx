import React from 'react';
import { 
  CreditCard, 
  Server, 
  Database, 
  Cloud, 
  Globe, 
  Brain,
  TrendingUp,
  DollarSign,
  Calendar,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';

interface Subscription {
  id: string;
  name: string;
  provider: string;
  description: string;
  services: string[];
  plan: string;
  estimatedCostAud: string;
  currency: 'AUD' | 'USD';
  billingCycle: 'monthly' | 'annual' | 'usage-based';
  status: 'active' | 'trial' | 'pending';
  portalUrl: string;
  icon: React.ReactNode;
  gradient: string;
  usageNotes?: string;
}

export function SubscriptionsAdmin() {
  const subscriptions: Subscription[] = [
    {
      id: 'render',
      name: 'Render.com',
      provider: 'Render',
      description: 'Cloud infrastructure hosting for n8n workflow automation and Nytro App backend services',
      services: ['n8n Hosting', 'Nytro App Hosting (Professional Plan)'],
      plan: 'Professional + Usage',
      estimatedCostAud: '~$100',
      currency: 'AUD',
      billingCycle: 'monthly',
      status: 'active',
      portalUrl: 'https://dashboard.render.com/',
      icon: <Server className="w-8 h-8" />,
      gradient: 'from-violet-500 to-purple-600',
      usageNotes: 'Cost varies based on compute consumption'
    },
    {
      id: 'supabase',
      name: 'Supabase',
      provider: 'Supabase',
      description: 'PostgreSQL database hosting with realtime subscriptions, authentication, and edge functions',
      services: ['Database (PostgreSQL)', 'Authentication', 'Edge Functions', 'Storage'],
      plan: 'Pro Plan + Usage',
      estimatedCostAud: '~$50',
      currency: 'AUD',
      billingCycle: 'monthly',
      status: 'active',
      portalUrl: 'https://app.supabase.com/',
      icon: <Database className="w-8 h-8" />,
      gradient: 'from-emerald-500 to-teal-600',
      usageNotes: 'Cost varies based on database size and API calls'
    },
    {
      id: 'google-cloud',
      name: 'Google Cloud & Gemini',
      provider: 'Google',
      description: 'Google Cloud Platform services and Gemini AI API for intelligent document validation',
      services: ['Google Cloud Platform', 'Gemini AI API'],
      plan: 'Pay-as-you-go',
      estimatedCostAud: '<$10',
      currency: 'AUD',
      billingCycle: 'usage-based',
      status: 'active',
      portalUrl: 'https://console.cloud.google.com/',
      icon: <Brain className="w-8 h-8" />,
      gradient: 'from-blue-500 to-cyan-500',
      usageNotes: 'Currently minimal usage, may increase as AI features expand'
    },
    {
      id: 'netlify',
      name: 'Netlify',
      provider: 'Netlify',
      description: 'Website hosting with advanced DNS management and SEO optimization for app.Nytro.com.au',
      services: ['Website Hosting', 'Advanced DNS', 'SEO Pro'],
      plan: 'Pro Plan',
      estimatedCostAud: '~$28',
      currency: 'USD',
      billingCycle: 'monthly',
      status: 'active',
      portalUrl: 'https://app.netlify.com/',
      icon: <Globe className="w-8 h-8" />,
      gradient: 'from-teal-400 to-emerald-500',
      usageNotes: '$20 USD (~$28 AUD)'
    }
  ];

  // Calculate totals
  const totalEstimatedAud = subscriptions.reduce((total, sub) => {
    const costStr = sub.estimatedCostAud.replace(/[^0-9.]/g, '');
    const cost = parseFloat(costStr) || 0;
    // Convert USD to AUD roughly (1.4 rate)
    return total + (sub.currency === 'USD' ? cost * 1.4 : cost);
  }, 0);

  const getStatusBadge = (status: Subscription['status']) => {
    const styles = {
      active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      trial: 'bg-amber-100 text-amber-700 border-amber-200',
      pending: 'bg-slate-100 text-slate-700 border-slate-200'
    };
    return (
      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getBillingBadge = (cycle: Subscription['billingCycle']) => {
    const labels = {
      monthly: 'Monthly',
      annual: 'Annual',
      'usage-based': 'Usage Based'
    };
    return (
      <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-600">
        {labels[cycle]}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25">
              <CreditCard className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-poppins font-bold text-[#1e293b]">
              Subscriptions & Costs
            </h1>
          </div>
          <p className="text-[#64748b] text-lg ml-14">
            Monitor and manage paid service subscriptions for NytroAI platform
          </p>
        </div>

        {/* Summary Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* Total Monthly Cost */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 p-6 text-white shadow-xl shadow-purple-500/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 opacity-80" />
                <span className="text-sm font-medium opacity-80">Estimated Monthly Total</span>
              </div>
              <div className="text-4xl font-bold mb-1">
                ~${Math.round(totalEstimatedAud)} <span className="text-lg font-normal opacity-80">AUD</span>
              </div>
              <p className="text-sm opacity-70">Combined platform infrastructure costs</p>
            </div>
          </div>

          {/* Active Services */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-xl shadow-emerald-500/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Cloud className="w-5 h-5 opacity-80" />
                <span className="text-sm font-medium opacity-80">Active Services</span>
              </div>
              <div className="text-4xl font-bold mb-1">
                {subscriptions.filter(s => s.status === 'active').length}
              </div>
              <p className="text-sm opacity-70">Cloud providers & platforms</p>
            </div>
          </div>

          {/* Growth Indicator */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 p-6 text-white shadow-xl shadow-blue-500/20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 opacity-80" />
                <span className="text-sm font-medium opacity-80">Cost Trend</span>
              </div>
              <div className="text-4xl font-bold mb-1 flex items-center gap-2">
                Stable
              </div>
              <p className="text-sm opacity-70">Usage-based costs may vary</p>
            </div>
          </div>
        </div>

        {/* Usage-Based Cost Note */}
        <div className="mb-8 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Usage-Based Billing Notice</p>
            <p className="text-sm text-amber-700">
              Several services (Render, Supabase, Google Cloud) have usage-based components. Actual costs may vary 
              based on API calls, compute time, storage, and data transfer. Monitor usage dashboards regularly.
            </p>
          </div>
        </div>

        {/* Subscription Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {subscriptions.map((subscription) => (
            <Card 
              key={subscription.id}
              className="bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
            >
              {/* Gradient Header Bar */}
              <div className={`h-2 bg-gradient-to-r ${subscription.gradient}`} />
              
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${subscription.gradient} text-white shadow-lg`}>
                      {subscription.icon}
                    </div>
                    <div>
                      <CardTitle className="text-xl font-poppins font-bold text-[#1e293b]">
                        {subscription.name}
                      </CardTitle>
                      <CardDescription className="text-sm text-[#64748b] mt-1">
                        {subscription.provider}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(subscription.status)}
                    {getBillingBadge(subscription.billingCycle)}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <p className="text-sm text-[#475569] mb-4">{subscription.description}</p>
                
                {/* Services List */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">Services Included</p>
                  <div className="flex flex-wrap gap-2">
                    {subscription.services.map((service, idx) => (
                      <span 
                        key={idx}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 border border-slate-200"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Cost & Plan Info */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div>
                    <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">Plan</p>
                    <p className="text-sm font-semibold text-[#1e293b]">{subscription.plan}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">Est. Monthly</p>
                    <p className="text-2xl font-bold text-[#1e293b]">
                      {subscription.estimatedCostAud}
                      <span className="text-sm font-normal text-[#64748b] ml-1">{subscription.currency}</span>
                    </p>
                  </div>
                </div>

                {/* Usage Notes */}
                {subscription.usageNotes && (
                  <p className="mt-3 text-xs text-[#94a3b8] italic">
                    ℹ️ {subscription.usageNotes}
                  </p>
                )}

                {/* Portal Link */}
                <a
                  href={subscription.portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r ${subscription.gradient} text-white font-semibold text-sm hover:opacity-90 transition-opacity shadow-md`}
                >
                  Open {subscription.provider} Dashboard
                  <ExternalLink className="w-4 h-4" />
                </a>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-10 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-slate-100">
              <Calendar className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1e293b] mb-1">Billing Cycle Notes</h3>
              <p className="text-sm text-[#64748b]">
                Most services bill at the start of each month. Usage-based charges are typically calculated and billed 
                at the end of each billing period. Keep track of usage dashboards to avoid unexpected charges. 
                Consider setting up billing alerts on each platform.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
