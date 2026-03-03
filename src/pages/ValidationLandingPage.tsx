/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * $99 Independent Validation Landing Page — SPA
 * Single-page application with smooth scroll navigation,
 * Stripe checkout, and Supabase lead capture. SEO-optimized.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import nytroLogo from '../assets/nytro-logo.svg';
import {
  CheckCircle,
  Upload,
  CreditCard,
  Mail,
  ChevronDown,
  ChevronUp,
  Play,
  Shield,
  Clock,
  FileCheck,
  ArrowUp,
  Loader2,
  LogIn,
  X,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface FormData {
  firstName: string;
  lastName: string;
  companyName: string;
  phoneNumber: string;
  email: string;
  subscribeNewsletter: boolean;
}

interface FAQItem {
  question: string;
  answer: string;
}

// ─── FAQ Data ────────────────────────────────────────────────────────────────
const faqData: FAQItem[] = [
  {
    question: 'How long does it take?',
    answer:
      'Most validations are completed within 2–3 business days, depending on the complexity of the resource and current demand. You will receive your completed validation report via email.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Absolutely. All files are stored securely on Australian servers with encryption at rest and in transit. Your data is never shared with third parties and is handled in accordance with Australian privacy legislation.',
  },
  {
    question: 'What if my unit isn\'t found?',
    answer:
      'If the unit of competency you need isn\'t currently in our system, our team will source and load it. This may add a small amount of time to the process, but we will keep you informed throughout.',
  },
  {
    question: 'Is this ongoing access to Nytro?',
    answer:
      'No. The $99 validation is a one-time, standalone service. You receive a completed validation report without needing to sign up for a subscription. However, if you\'d like ongoing access to the full Nytro platform, we\'d love to show you what it can do.',
  },
  {
    question: 'Is the system suitable for all RTOs?',
    answer:
      'Yes. Nytro is designed to support RTOs of all sizes across all industries. Whether you deliver one qualification or fifty, the validation process applies the same rigorous methodology.',
  },
  {
    question: 'Can the system integrate with our existing software?',
    answer:
      'The $99 validation service is a standalone offering. However, the full Nytro platform offers integration capabilities. Contact us to discuss your specific requirements.',
  },
  {
    question: 'What industries does Nytro specialise in?',
    answer:
      'Nytro supports all nationally recognised training packages across every industry sector. Our validation engine maps evidence against the specific requirements of each unit of competency, regardless of the industry.',
  },
  {
    question: 'How does Nytro save time for trainers and staff?',
    answer:
      'By automating the evidence-mapping process and providing structured validation reports, Nytro eliminates hours of manual cross-referencing. Trainers and compliance staff can focus on quality delivery instead of paperwork.',
  },
];

// ─── Supabase config for edge functions ────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// ─── Smooth scroll helper ──────────────────────────────────────────────────
function smoothScrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) {
    const navHeight = 80;
    const top = el.getBoundingClientRect().top + window.scrollY - navHeight;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────
export const ValidationLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    companyName: '',
    phoneNumber: '',
    email: '',
    subscribeNewsletter: false,
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [showPromoField, setShowPromoField] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');

  // Login dialog state
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { login } = useAuth();

  // ─── Scroll spy for active nav section ──────────────────────────────────
  useEffect(() => {
    const sections = ['hero', 'breakdown', 'why-nytro', 'limited-offer', 'process', 'faq'];
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);

      const navHeight = 100;
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= navHeight) {
            setActiveSection(sections[i]);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ─── SPA navigation handler ─────────────────────────────────────────────
  const handleNavClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    smoothScrollTo(sectionId);
  }, []);

  const scrollToForm = () => {
    if (formRef.current) {
      const navHeight = 80;
      const top = formRef.current.getBoundingClientRect().top + window.scrollY - navHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  // ─── Login handler ──────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const result = await login(loginEmail, loginPassword);
      if (result.success) {
        setShowLoginDialog(false);
        navigate('/dashboard');
      } else {
        setLoginError(result.error || 'Invalid email or password');
      }
    } catch {
      setLoginError('An error occurred. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // ─── Form submit handler ────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Upload files to Supabase Storage if provided
      const uploadedUrls: string[] = [];
      const uploadedNames: string[] = [];
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = file.name.split('.').pop();
          const filePath = `validation-leads/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, file);

          if (uploadError) {
            console.error('File upload error:', file.name, uploadError);
          } else {
            uploadedUrls.push(uploadData?.path || '');
            uploadedNames.push(file.name);
          }
        }
      }
      const fileUrl = uploadedUrls.join(', ');
      const fileName = uploadedNames.join(', ');

      // 2. Insert lead into Supabase
      const { data: { session } } = await supabase.auth.getSession();
      const { data: leadData, error: leadError } = await supabase
        .from('validation_leads')
        .insert({
          first_name: formData.firstName,
          last_name: formData.lastName,
          company_name: formData.companyName,
          phone_number: formData.phoneNumber,
          email: formData.email,
          file_url: fileUrl,
          file_name: fileName,
          subscribe_newsletter: formData.subscribeNewsletter,
          promo_code: promoCode.trim() || null,
          status: 'pending',
          user_id: session?.user?.id || null,
        })
        .select()
        .single();

      if (leadError) {
        throw new Error(leadError.message);
      }

      // 3. Create Stripe checkout session
      if (!SUPABASE_URL) {
        throw new Error('Payment service is not configured. Please contact support@nytro.com.au.');
      }

      let response: Response;
      try {
        response = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            productType: 'unit',
            quantity: 1,
            unitPrice: 99,
            successUrl: `${window.location.origin}/validation/success?lead_id=${leadData.id}`,
            cancelUrl: `${window.location.origin}/?cancelled=true`,
            promoCode: promoCode.trim() || undefined,
            userId: '',
            rtoId: '',
          }),
        });
      } catch (fetchError) {
        console.error('Stripe checkout fetch error:', fetchError);
        throw new Error(
          'Unable to connect to the payment service. Your details have been saved — please try again in a moment or contact support@nytro.com.au.'
        );
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('Stripe checkout response error:', response.status, errorText);
        
        // Try to parse the error for a meaningful message
        let errorMessage = 'There was a problem creating your checkout session. Please try again or contact support@nytro.com.au.';
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) {
            errorMessage = errorJson.error;
          }
        } catch {
          // Use the raw text if it's short enough
          if (errorText.length < 200 && errorText.length > 0) {
            errorMessage = errorText;
          }
        }
        
        if (response.status === 500) {
          throw new Error(
            'The payment service is temporarily unavailable. Your details have been saved — please try again shortly or contact support@nytro.com.au.'
          );
        }
        throw new Error(errorMessage);
      }

      let checkoutData;
      try {
        checkoutData = await response.json();
      } catch {
        throw new Error('Received an unexpected response from the payment service. Please try again.');
      }

      if (checkoutData.error) {
        throw new Error(checkoutData.error);
      }

      // 4. Update lead with Stripe session ID
      if (checkoutData.sessionId) {
        await supabase
          .from('validation_leads')
          .update({ 
            stripe_session_id: checkoutData.sessionId,
            discount_amount: checkoutData.discountAmount || null,
          })
          .eq('id', leadData.id);
      }

      // 5. Redirect to Stripe Checkout
      if (checkoutData.url) {
        window.location.href = checkoutData.url;
      } else if (checkoutData.sessionId) {
        window.location.href = `https://checkout.stripe.com/c/pay/${checkoutData.sessionId}`;
      }
    } catch (error) {
      console.error('Submission error:', error);
      const errorMessage = error instanceof Error ? error.message : '';
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        setSubmitError('Network error — please check your internet connection and try again.');
      } else if (errorMessage.includes('duplicate key') || errorMessage.includes('unique')) {
        setSubmitError(
          'It looks like you have already submitted a validation request with this email. Please contact support@nytro.com.au if you need assistance.'
        );
      } else if (errorMessage) {
        setSubmitError(errorMessage);
      } else {
        setSubmitError('Something went wrong. Please try again or contact support@nytro.com.au for assistance.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── SEO Structured Data ───────────────────────────────────────────────────
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'Nytro Independent Resource Validation',
    description:
      'Independent validation of RTO training resources against unit of competency requirements. From $99 per submission.',
    provider: {
      '@type': 'Organization',
      name: 'Nytro Pty Ltd',
      url: 'https://nytro.com.au',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '2/14 Edgewater Court',
        addressLocality: 'Robina',
        addressRegion: 'QLD',
        postalCode: '4226',
        addressCountry: 'AU',
      },
    },
    offers: {
      '@type': 'Offer',
      price: '99.00',
      priceCurrency: 'AUD',
      availability: 'https://schema.org/LimitedAvailability',
      validFrom: '2026-01-01',
    },
    areaServed: {
      '@type': 'Country',
      name: 'Australia',
    },
    serviceType: 'RTO Compliance Validation',
  };

  const faqStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqData.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  useDocumentHead({
    title: '$99 Independent Validation | Nytro — RTO Resource Compliance',
    meta: [
      { name: 'description', content: 'Get independent validation of your RTO training resources from $99. Nytro maps assessment evidence against training package requirements in real time. Australian data storage. Fast turnaround.' },
      { name: 'keywords', content: 'RTO validation, independent validation, training resource compliance, assessment tool validation, RTO audit preparation, Australian RTO, Nytro, compliance visibility, unit of competency' },
      { property: 'og:title', content: '$99 Independent Validation | Nytro' },
      { property: 'og:description', content: 'Independent resource validation for Australian RTOs from $99. Clear visibility before audit pressure builds.' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: 'https://nytro.com.au/' },
      { property: 'og:site_name', content: 'Nytro' },
      { property: 'og:locale', content: 'en_AU' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: '$99 Independent Validation | Nytro' },
      { name: 'twitter:description', content: 'Independent resource validation for Australian RTOs from $99.' },
      { name: 'robots', content: 'index, follow' },
      { name: 'geo.region', content: 'AU-QLD' },
      { name: 'geo.placename', content: 'Robina' },
    ],
    links: [
      { rel: 'canonical', href: 'https://nytro.com.au/' },
    ],
    structuredData: [structuredData, faqStructuredData],
  });

  // Nav link helper with active state
  const navLinkClass = (section: string) =>
    `transition-colors text-sm font-medium cursor-pointer ${
      activeSection === section
        ? 'text-teal-400'
        : 'text-slate-300 hover:text-white'
    }`;

  return (
    <>
      <div className="min-h-screen bg-white text-slate-900 font-body selection:bg-teal-200 selection:text-teal-900">
        {/* ─── Fixed Navigation ──────────────────────────────────────────── */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-nytro-dark/95 backdrop-blur-md border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 md:h-20">
              <a
                href="#hero"
                onClick={(e) => { e.preventDefault(); scrollToTop(); }}
                className="flex items-center"
                aria-label="Nytro Home"
              >
                <img src={nytroLogo} alt="Nytro" className="h-8 md:h-10 w-auto" />
              </a>
              <div className="hidden md:flex items-center gap-8">
                <a href="#process" onClick={(e) => handleNavClick(e, 'process')} className={navLinkClass('process')}>
                  How it works
                </a>
                <a href="#breakdown" onClick={(e) => handleNavClick(e, 'breakdown')} className={navLinkClass('breakdown')}>
                  Solutions
                </a>
                <a href="#limited-offer" onClick={(e) => handleNavClick(e, 'limited-offer')} className={navLinkClass('limited-offer')}>
                  Pricing
                </a>
                <a href="#faq" onClick={(e) => handleNavClick(e, 'faq')} className={navLinkClass('faq')}>
                  FAQ
                </a>
                <a href="#footer" onClick={(e) => handleNavClick(e, 'footer')} className={navLinkClass('footer')}>
                  Contact
                </a>
                <button
                  onClick={() => setShowLoginDialog(true)}
                  className="text-slate-300 hover:text-white transition-colors text-sm font-medium flex items-center gap-1.5"
                >
                  <LogIn className="w-4 h-4" />
                  Login
                </button>
                <button
                  onClick={scrollToForm}
                  className="bg-gradient-to-r from-teal-400 to-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:from-teal-500 hover:to-blue-600 transition-all shadow-lg shadow-teal-500/25"
                >
                  Get Started
                </button>
              </div>
              {/* Mobile */}
              <div className="md:hidden flex items-center gap-3">
                <button
                  onClick={() => setShowLoginDialog(true)}
                  className="text-slate-300 hover:text-white p-2"
                  aria-label="Login"
                >
                  <LogIn className="w-5 h-5" />
                </button>
                <button
                  onClick={scrollToForm}
                  className="bg-gradient-to-r from-teal-400 to-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* ─── 1. HERO SECTION ─────────────────────────────────────────── */}
        <section id="hero" className="pt-24 md:pt-32 pb-16 md:pb-24 bg-nytro-dark text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Left: Copy + CTA */}
              <div className="space-y-6">
                <span className="inline-block text-teal-400 text-xs font-semibold tracking-widest uppercase border-b-2 border-teal-400 pb-1">
                  Validation Assessment Tool
                </span>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-sans font-bold leading-tight">
                  <span className="text-gradient">$99</span> Independent validation
                </h1>
                <p className="text-xl md:text-2xl text-slate-300 font-medium leading-relaxed">
                  Most resources look compliant. What's missing is clear visibility.
                </p>
                <div className="text-slate-400 space-y-4 text-base leading-relaxed">
                  <p>
                    Validation shouldn't depend on searching emails, shared drives or memory. Yet
                    many teams operate this way.
                  </p>
                  <p>
                    Nytro maps assessment evidence against training package requirements in real
                    time, delivering validation you can rely on early.
                  </p>
                  <p>
                    For a <strong className="text-white">limited time</strong>, Nytro is offering
                    independent resource validation from{' '}
                    <strong className="text-teal-400">$99</strong> per submission.
                  </p>
                </div>
                <button
                  onClick={scrollToForm}
                  className="bg-gradient-to-r from-teal-400 to-teal-500 text-nytro-dark px-8 py-4 rounded-lg text-lg font-bold hover:from-teal-500 hover:to-teal-600 transition-all shadow-lg shadow-teal-500/30 uppercase tracking-wide"
                >
                  Start Validation
                </button>
              </div>

              {/* Right: Video */}
              <div className="relative">
                <div
                  className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50 cursor-pointer group aspect-video bg-slate-800"
                  onClick={() => setVideoPlaying(!videoPlaying)}
                  role="button"
                  aria-label="Play explainer video"
                >
                  {!videoPlaying ? (
                    <>
                      <img
                        src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80"
                        alt="Professional reviewing compliance documents"
                        className="w-full h-full object-cover"
                        loading="eager"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                        <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                          <Play className="w-8 h-8 text-nytro-dark ml-1" fill="currentColor" />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-400">
                      <p className="text-center px-8">
                        Video player placeholder — embed your explainer video URL here
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 2. PROBLEM + SOLUTION + FORM SECTION ───────────────────── */}
        <section id="breakdown" className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-5 gap-12 items-start">
              {/* Left: Problem + Solution text (3 cols) */}
              <div className="lg:col-span-3 space-y-12">
                {/* Problem */}
                <div className="space-y-6">
                  <h2 className="text-3xl md:text-4xl font-sans font-bold text-nytro-dark">
                    Where validation breaks down
                  </h2>
                  <div className="text-slate-600 space-y-4">
                    <p className="text-lg">
                      RTOs don't fall short because they intend to.
                      <br />
                      They struggle when risks aren't visible early.
                    </p>
                    <p className="font-medium text-slate-500 text-sm uppercase tracking-wide">
                      Common pressure points include:
                    </p>
                    <ul className="space-y-3">
                      {[
                        'Evidence that exists but isn\'t clearly mapped to unit requirements',
                        'Assessment tools that leave room for interpretation',
                        'Instructions that don\'t consistently demonstrate competency',
                        'Resources that drift away from the training package over time',
                        'Multiple versions of the same tool with no clear source of truth',
                      ].map((item, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-slate-700 font-medium pt-2">
                      Rectifications cost time, focus and confidence.
                      <br />
                      Independent validation gives you clear visibility before pressure builds.
                    </p>
                  </div>
                </div>

                {/* Solution */}
                <div className="space-y-6">
                  <h3 className="text-2xl md:text-3xl font-sans font-bold text-nytro-dark">
                    What clarity looks like
                  </h3>
                  <p className="text-slate-600 text-lg">
                    An independent validation designed to make alignment visible, not assumed.
                  </p>
                  <p className="font-medium text-slate-500 text-sm uppercase tracking-wide">
                    Your review provides:
                  </p>
                  <ul className="space-y-3 text-slate-600">
                    {[
                      'Evidence mapped clearly against unit requirements',
                      'Identification of gaps before they become findings',
                      'Practical guidance to strengthen assessment defensibility',
                      'A structured validation summary you can retain for audit and continuous improvement',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-slate-700 font-medium italic">
                    Clarity replaces interpretation. Validation becomes defensible.
                  </p>
                </div>
              </div>

              {/* Right: Form Card (2 cols) — sticky */}
              <div ref={formRef} id="form" className="lg:col-span-2 lg:sticky lg:top-28">
                <div className="bg-nytro-dark rounded-2xl p-6 md:p-8 shadow-2xl shadow-slate-900/20">
                  <h3 className="text-xl font-sans font-bold text-white mb-1">
                    Validate Your Resource
                  </h3>
                  <p className="text-xs text-slate-400 mb-6">
                    Submit your details to request a one-off independent validation — no account required.
                  </p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="firstName" className="block text-xs text-slate-400 mb-1">
                          First Name *
                        </label>
                        <input
                          id="firstName"
                          name="firstName"
                          type="text"
                          required
                          value={formData.firstName}
                          onChange={handleInputChange}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                          placeholder="First name"
                        />
                      </div>
                      <div>
                        <label htmlFor="lastName" className="block text-xs text-slate-400 mb-1">
                          Last Name *
                        </label>
                        <input
                          id="lastName"
                          name="lastName"
                          type="text"
                          required
                          value={formData.lastName}
                          onChange={handleInputChange}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                          placeholder="Last name"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="companyName" className="block text-xs text-slate-400 mb-1">
                        Company Name
                      </label>
                      <input
                        id="companyName"
                        name="companyName"
                        type="text"
                        value={formData.companyName}
                        onChange={handleInputChange}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                        placeholder="Company name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="phoneNumber" className="block text-xs text-slate-400 mb-1">
                          Phone Number
                        </label>
                        <input
                          id="phoneNumber"
                          name="phoneNumber"
                          type="tel"
                          value={formData.phoneNumber}
                          onChange={handleInputChange}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                          placeholder="+61"
                        />
                      </div>
                      <div>
                        <label htmlFor="email" className="block text-xs text-slate-400 mb-1">
                          Email *
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          required
                          value={formData.email}
                          onChange={handleInputChange}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                          placeholder="email@company.com"
                        />
                      </div>
                    </div>
                    {/* File Upload */}
                    <div>
                      <label htmlFor="fileUpload" className="block text-xs text-slate-400 mb-1">
                        Upload Resource (optional)
                      </label>
                      <div className="relative">
                        <input
                          id="fileUpload"
                          type="file"
                          multiple
                          onChange={handleFileChange}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        />
                        <label
                          htmlFor="fileUpload"
                          className="flex items-center gap-2 w-full bg-slate-800 border border-slate-700 border-dashed rounded-lg px-3 py-2.5 text-sm text-slate-400 cursor-pointer hover:border-teal-400 transition-colors"
                        >
                          <Upload className="w-4 h-4" />
                          {selectedFiles.length > 0
                            ? selectedFiles.length === 1
                              ? selectedFiles[0].name
                              : `${selectedFiles.length} files selected`
                            : 'Choose files...'}
                        </label>
                      </div>
                    </div>
                    {/* Promo Code */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setShowPromoField(!showPromoField)}
                        className="text-xs text-teal-400 hover:text-teal-300 transition-colors"
                      >
                        {showPromoField ? '— Hide discount code' : '+ Have a discount code?'}
                      </button>
                      {showPromoField && (
                        <div className="mt-2">
                          <input
                            id="promoCode"
                            type="text"
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent uppercase tracking-wider"
                            placeholder="Enter code"
                          />
                        </div>
                      )}
                    </div>
                    {/* Newsletter checkbox */}
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="subscribeNewsletter"
                        checked={formData.subscribeNewsletter}
                        onChange={handleInputChange}
                        className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-teal-400 focus:ring-teal-400 focus:ring-offset-0"
                      />
                      <span className="text-xs text-slate-400">
                        Sign up to news and updates
                      </span>
                    </label>

                    {submitError && (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                        {submitError}
                      </div>
                    )}

                    {submitSuccess && (
                      <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-3 text-teal-400 text-sm">
                        Submission received! Redirecting to payment...
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-gradient-to-r from-teal-400 to-teal-500 text-nytro-dark px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-wide hover:from-teal-500 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-500/20"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        'Start Validation — $99'
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 3. TRUST / POSITIONING STRIP ────────────────────────────── */}
        <section id="why-nytro" className="py-16 md:py-20 bg-gradient-to-r from-nytro-dark via-slate-900 to-nytro-dark">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-white mb-6">
              Why employers choose Nytro
            </h2>
            <p className="text-slate-300 text-lg leading-relaxed mb-8">
              Nytro is built specifically for the compliance realities of Australian RTOs, with
              secure <strong className="text-white">Australian data storage</strong>, structured
              file handling and an{' '}
              <strong className="text-white">independent validation methodology</strong> designed
              around audit readiness. This isn't generic consulting or subjective feedback. It's
              structured compliance visibility that gives you clarity quickly, strengthens
              consistency across trainers and locations, reduces delays, and ensures your team
              spends more time delivering quality training and less time reacting to compliance
              issues.
            </p>
            <button
              onClick={scrollToForm}
              className="inline-block bg-transparent border-2 border-teal-400 text-teal-400 px-8 py-3 rounded-lg text-sm font-bold uppercase tracking-wide hover:bg-teal-400 hover:text-nytro-dark transition-all"
            >
              Get Started
            </button>
          </div>
        </section>

        {/* ─── 4. OFFER EXPLANATION ────────────────────────────────────── */}
        <section id="limited-offer" className="py-16 md:py-24 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Left: Image */}
              <div className="relative rounded-2xl overflow-hidden shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&q=80"
                  alt="Professional reviewing training resources at desk"
                  className="w-full h-80 md:h-96 object-cover"
                  loading="lazy"
                />
              </div>
              {/* Right: Text */}
              <div className="space-y-6">
                <h2 className="text-3xl md:text-4xl font-sans font-bold text-nytro-dark">
                  Limited-Time Offer
                </h2>
                <p className="text-lg text-slate-600">
                  Independent validation from <strong className="text-nytro-dark">$99 per resource</strong>.
                </p>
                <div>
                  <p className="font-medium text-slate-700 mb-3">Ideal for:</p>
                  <ul className="space-y-3 text-slate-600">
                    {[
                      'Testing a new qualification',
                      'Checking a high-risk unit',
                      'Gaining a second opinion before audit',
                      'Verifying updates before rollout',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="text-sm text-slate-500 italic">
                  *When the promotion ends, standard pricing will apply.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 5. PROCESS SECTION ──────────────────────────────────────── */}
        <section id="process" className="py-16 md:py-24 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-nytro-dark mb-16">
              What Happens Next
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                {
                  icon: FileCheck,
                  label: 'Select validation type',
                  color: 'from-teal-400 to-teal-500',
                },
                {
                  icon: Upload,
                  label: 'Upload your resource',
                  color: 'from-blue-400 to-blue-500',
                },
                {
                  icon: CreditCard,
                  label: 'Submit and pay',
                  color: 'from-indigo-400 to-indigo-500',
                },
                {
                  icon: Mail,
                  label: 'Receive your completed validation report',
                  color: 'from-purple-400 to-purple-500',
                },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center gap-4">
                  <div
                    className={`w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}
                  >
                    <step.icon className="w-8 h-8 md:w-10 md:h-10 text-white" />
                  </div>
                  <p className="text-sm md:text-base font-medium text-slate-700 leading-snug">
                    {step.label}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-12 text-2xl md:text-3xl font-sans font-bold text-slate-400">
              Simple. Secure. Fast.
            </p>
          </div>
        </section>

        {/* ─── 6. FAQ ──────────────────────────────────────────────────── */}
        <section id="faq" className="py-16 md:py-24 bg-slate-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-nytro-dark text-center mb-12">
              Frequently Asked Questions
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {faqData.map((faq, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <button
                    onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                    aria-expanded={openFAQ === i}
                    aria-controls={`faq-answer-${i}`}
                  >
                    <span className="text-sm font-medium text-slate-700 pr-4">{faq.question}</span>
                    {openFAQ === i ? (
                      <ChevronUp className="w-4 h-4 text-teal-500 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                  </button>
                  <div
                    id={`faq-answer-${i}`}
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      openFAQ === i ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-5 pb-4 text-sm text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
                      {faq.answer}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 7. FOOTER ───────────────────────────────────────────────── */}
        <footer id="footer" className="bg-nytro-dark text-slate-400 py-12 md:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-3 gap-12">
              {/* Brand */}
              <div className="space-y-4">
                <img src={nytroLogo} alt="Nytro" className="h-8 w-auto" />
                <p className="text-sm italic text-slate-500">
                  Precision that powers performance
                </p>
              </div>
              {/* Useful Links */}
              <div>
                <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wide">
                  Useful Links
                </h4>
                <ul className="space-y-2 text-sm">
                  <li>
                    <a
                      href="#process"
                      onClick={(e) => handleNavClick(e, 'process')}
                      className="hover:text-teal-400 transition-colors"
                    >
                      How It Works
                    </a>
                  </li>
                  <li>
                    <a
                      href="#limited-offer"
                      onClick={(e) => handleNavClick(e, 'limited-offer')}
                      className="hover:text-teal-400 transition-colors"
                    >
                      Pricing
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://nytro.com.au"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-teal-400 transition-colors"
                    >
                      Book a Demo
                    </a>
                  </li>
                  <li>
                    <button
                      onClick={() => setShowLoginDialog(true)}
                      className="hover:text-teal-400 transition-colors"
                    >
                      Login
                    </button>
                  </li>
                </ul>
              </div>
              {/* Contact */}
              <div>
                <h4 className="text-white font-semibold text-sm mb-4 uppercase tracking-wide">
                  Contact Us
                </h4>
                <address className="not-italic text-sm space-y-1">
                  <p className="text-white font-medium">Nytro Pty Ltd</p>
                  <p>2/14 Edgewater Court</p>
                  <p>Robina, QLD 4226</p>
                  <p className="pt-2">
                    <a
                      href="mailto:support@nytro.com.au"
                      className="text-teal-400 hover:text-teal-300 transition-colors"
                    >
                      support@nytro.com.au
                    </a>
                  </p>
                </address>
              </div>
            </div>
            <div className="mt-12 pt-8 border-t border-slate-800 text-center text-xs text-slate-600">
              <p>&copy; {new Date().getFullYear()} Nytro Pty Ltd. All rights reserved.</p>
            </div>
          </div>
        </footer>

        {/* ─── Back to Top Button (gold) ──────────────────────────────── */}
        <button
          onClick={scrollToTop}
          className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-amber-500 text-white shadow-lg hover:bg-amber-600 transition-all flex items-center justify-center ${
            showBackToTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          }`}
          aria-label="Back to top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      </div>

      {/* ─── Login Dialog ──────────────────────────────────────────────── */}
      {showLoginDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowLoginDialog(false)}
          />
          <div className="relative bg-nytro-dark rounded-2xl p-8 w-full max-w-md mx-4 shadow-2xl border border-slate-700">
            <button
              onClick={() => setShowLoginDialog(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              aria-label="Close login"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="text-center mb-6">
              <img src={nytroLogo} alt="Nytro" className="h-8 w-auto mx-auto mb-4" />
              <h2 className="text-xl font-sans font-bold text-white">Welcome back</h2>
              <p className="text-sm text-slate-400 mt-1">Sign in to your Nytro account</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="loginEmail" className="block text-xs text-slate-400 mb-1">
                  Email
                </label>
                <input
                  id="loginEmail"
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  placeholder="email@company.com"
                />
              </div>
              <div>
                <label htmlFor="loginPassword" className="block text-xs text-slate-400 mb-1">
                  Password
                </label>
                <input
                  id="loginPassword"
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                  placeholder="Password"
                />
              </div>
              {loginError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                  {loginError}
                </div>
              )}
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-gradient-to-r from-teal-400 to-teal-500 text-nytro-dark px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-wide hover:from-teal-500 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
              <div className="text-center space-y-3">
                <a
                  href="/forgot-password"
                  className="text-xs text-teal-400 hover:text-teal-300 transition-colors block"
                >
                  Forgot your password?
                </a>
                <div className="border-t border-slate-700 pt-3">
                  <p className="text-sm text-slate-400">
                    Don't have an account?{' '}
                    <a
                      href="/register"
                      className="text-teal-400 hover:text-teal-300 font-semibold transition-colors"
                    >
                      Sign up
                    </a>
                  </p>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ValidationLandingPage;
