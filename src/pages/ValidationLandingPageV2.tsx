/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * $99 Independent Validation Landing Page — V2
 * Single-page application with smooth scroll navigation,
 * Stripe checkout, and Supabase lead capture. SEO-optimized.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocumentHead } from '../hooks/useDocumentHead';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import nytroLogo from '../assets/nytro-logo-dark.png';
import promoBanner from '../assets/promo-banner.png';
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
  ArrowRight,
  Eye,
  Lock,
  Users,
  FileSearch,
  AlertTriangle,
  Zap,
  Download,
  UserCheck,
  RotateCcw,
  HelpCircle,
  Shuffle,
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
    subscribeNewsletter: true,
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [promoCode, setPromoCode] = useState('');
  const [showPromoField, setShowPromoField] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const [comparisonMode, setComparisonMode] = useState<'manual' | 'nytro'>('manual');

  // Login dialog state
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { login, user, isAuthenticated } = useAuth();

  // ─── Scroll spy for active nav section ──────────────────────────────────
  useEffect(() => {
    const sections = ['hero', 'problem', 'clarity', 'compare', 'form-section', 'trust', 'limited-offer', 'faq'];
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

  const validateEmail = (email: string): string | null => {
    if (!email.trim()) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) return 'Please enter a valid email address';
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (name === 'email') setEmailError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
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
        navigate('/validate');
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
    const eErr = validateEmail(formData.email);
    if (eErr) { setEmailError(eErr); return; }
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Upload files to Supabase Storage if provided
      const uploadedUrls: string[] = [];
      const uploadedNames: string[] = [];
      if (selectedFiles.length > 0) {
        for (const file of selectedFiles) {
          const fileExt = (file.name.split('.').pop() || '').toLowerCase();
          const filePath = `validation-leads/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, file, {
              contentType: file.type || 'application/octet-stream',
            });

          if (uploadError) {
            console.error('File upload error:', file.name, uploadError);
            throw new Error(
              `Failed to upload "${file.name}". ${uploadError.message || 'Please try a different file format (PDF recommended) or contact support@nytro.com.au.'}`
            );
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
        
        let errorMessage = 'There was a problem creating your checkout session. Please try again or contact support@nytro.com.au.';
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) {
            errorMessage = errorJson.error;
          }
        } catch {
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
        <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b border-slate-800" style={{ backgroundColor: 'rgba(10, 15, 30, 0.97)' }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16 md:h-20">
              <a
                href="#hero"
                onClick={(e) => { e.preventDefault(); scrollToTop(); }}
                className="flex items-center"
                aria-label="Nytro Home"
              >
                <img src={nytroLogo} alt="Nytro" className="h-12 md:h-15 w-auto rounded-sm" style={{ backgroundColor: '#0A0F1E' }} />
              </a>
              <div className="hidden md:flex items-center gap-8">
                <a href="#problem" onClick={(e) => handleNavClick(e, 'problem')} className={navLinkClass('problem')}>
                  Why Nytro
                </a>
                <a href="#compare" onClick={(e) => handleNavClick(e, 'compare')} className={navLinkClass('compare')}>
                  Compare
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
                {isAuthenticated ? (
                  <a
                    href="/dashboard"
                    className="text-slate-300 hover:text-white transition-colors text-sm font-medium flex items-center gap-1.5"
                  >
                    Dashboard
                  </a>
                ) : (
                  <button
                    onClick={() => setShowLoginDialog(true)}
                    className="text-slate-300 hover:text-white transition-colors text-sm font-medium flex items-center gap-1.5"
                  >
                    <LogIn className="w-4 h-4" />
                    Login
                  </button>
                )}
                <button
                  onClick={scrollToForm}
                  className="bg-gradient-to-r from-teal-400 to-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:from-teal-500 hover:to-blue-600 transition-all shadow-lg shadow-teal-500/25"
                >
                  Get Started
                </button>
              </div>
              {/* Mobile */}
              <div className="md:hidden flex items-center gap-3">
                {isAuthenticated ? (
                  <a
                    href="/dashboard"
                    className="text-slate-300 hover:text-white p-2"
                    aria-label="Dashboard"
                  >
                    Dashboard
                  </a>
                ) : (
                  <button
                    onClick={() => setShowLoginDialog(true)}
                    className="text-slate-300 hover:text-white p-2"
                    aria-label="Login"
                  >
                    <LogIn className="w-5 h-5" />
                  </button>
                )}
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
                  Independent Validation
                </span>
                <h1 className="text-3xl md:text-4xl lg:text-[2.75rem] font-sans font-bold leading-tight">
                  Validation shouldn't take weeks, drain your team's time, or quietly build operational costs that hit hard right before an audit.
                </h1>
                <p className="text-lg md:text-xl text-slate-300 font-medium leading-relaxed">
                  Most RTOs are still validating resources manually across emails and shared drives. It's time-consuming, resource-heavy, and still leaves uncertainty.
                </p>
                <p className="text-slate-400 text-base leading-relaxed">
                  Nytro delivers clear, structured validation in one place, so you can see exactly where you stand without the back and forth. Your assessment resources are never stored, shared or exposed. What once took days of team time can now be reviewed in minutes.
                </p>
                <button
                  onClick={scrollToForm}
                  className="bg-gradient-to-r from-teal-400 to-teal-500 text-nytro-dark px-8 py-4 rounded-lg text-lg font-bold hover:from-teal-500 hover:to-teal-600 transition-all shadow-lg shadow-teal-500/30 uppercase tracking-wide"
                >
                  Check one assessment for $99
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
                    <iframe
                      src="https://drive.google.com/file/d/1cOpe6z98sI0zinH_9LEO5ytb-iniJzfc/preview"
                      className="w-full h-full absolute inset-0"
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                      title="Nytro explainer video"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 2. PROBLEM | SOLUTION SECTION ─────────────────────────────── */}
        <section id="problem" className="py-16 md:py-24 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-sans font-bold text-nytro-dark mb-4">
                Why validation takes so much time
              </h2>
              <p className="text-lg text-slate-600 max-w-3xl mx-auto">
                Validation shouldn't be a time burden. It only becomes slow when the process is unstructured.
              </p>
            </div>

            {/* Common time drains */}
            <div className="mb-16">
              <p className="font-semibold text-slate-500 text-xs uppercase tracking-widest mb-6 text-center">
                Common time drains include:
              </p>
              <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                {[
                  { icon: Users, text: 'Engaging a Subject Matter Expert or taking trainers out of the field' },
                  { icon: FileSearch, text: 'Pulling evidence from multiple locations' },
                  { icon: Shuffle, text: 'Comparing against training package requirements manually' },
                  { icon: RotateCcw, text: 'Reviewing different versions of the same resource' },
                  { icon: HelpCircle, text: 'Re-checking work to be confident nothing\'s been missed' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-xl px-5 py-4 border border-slate-100 hover:border-red-200 hover:bg-red-50/30 transition-all group">
                    <item.icon className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                    <span className="text-slate-700 text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
              <p className="text-center text-slate-500 mt-6 italic">
                And even after all that, there's still uncertainty.
              </p>
            </div>

            {/* Solution */}
            <div className="bg-gradient-to-br from-nytro-dark to-slate-900 rounded-2xl p-8 md:p-12 text-white">
              <div className="max-w-3xl mx-auto">
                <h3 className="text-2xl md:text-3xl font-sans font-bold mb-4">
                  Nytro removes the manual effort from validation.
                </h3>
                <div className="space-y-4 text-slate-300 text-base leading-relaxed">
                  <p>
                    <strong className="text-teal-400">Submit one assessment</strong> = Get a structured validation mapped against requirements.
                  </p>
                  <p>
                    See what's complete, what's missing, and what needs attention.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 3. WHAT CLARITY LOOKS LIKE ───────────────────────────────── */}
        <section id="clarity" className="py-16 md:py-24 bg-slate-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <h2 className="text-3xl md:text-4xl font-sans font-bold text-nytro-dark">
                  What clarity looks like
                </h2>
                <p className="text-lg text-slate-600 leading-relaxed">
                  What used to take days, now takes minutes to review, with confidence.
                </p>
                <button
                  onClick={() => {/* TODO: Link to sample PDF */}}
                  className="inline-flex items-center gap-2 bg-white border-2 border-teal-400 text-teal-600 px-6 py-3 rounded-lg text-sm font-bold uppercase tracking-wide hover:bg-teal-50 transition-all group"
                >
                  <Download className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                  Download a sample validation
                </button>
              </div>
              <div>
                <p className="font-semibold text-slate-500 text-xs uppercase tracking-widest mb-6">
                  Your review provides:
                </p>
                <ul className="space-y-4">
                  {[
                    'Smart, compliant questions mapped to training.gov.au',
                    'Clear mapping of evidence against requirements',
                    'Immediate visibility of gaps and inconsistencies',
                    'Structured output your team can actually use',
                    'A consistent validation approach across trainers and locations',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 group">
                      <CheckCircle className="w-5 h-5 text-teal-500 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-slate-800 font-semibold italic">
                  No more second-guessing or rechecking.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 4. MANUAL VS NYTRO TOGGLE COMPARISON ─────────────────────── */}
        <section id="compare" className="py-16 md:py-24 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-sans font-bold text-nytro-dark mb-4">
                See the difference
              </h2>
              {/* Toggle Switch */}
              <div className="inline-flex items-center bg-slate-100 rounded-full p-1 gap-1">
                <button
                  onClick={() => setComparisonMode('manual')}
                  className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                    comparisonMode === 'manual'
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Manual Validation
                </button>
                <button
                  onClick={() => setComparisonMode('nytro')}
                  className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                    comparisonMode === 'nytro'
                      ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/25'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Nytro
                </button>
              </div>
            </div>

            {/* Comparison Cards */}
            <div className="relative overflow-hidden">
              {/* Manual Validation View */}
              <div className={`transition-all duration-500 ease-in-out ${
                comparisonMode === 'manual' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full absolute inset-0'
              }`}>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { icon: Users, label: 'Engaging a Subject Matter Expert', color: 'text-red-400 bg-red-50 border-red-100' },
                    { icon: AlertTriangle, label: 'Taking a Trainer out of the field', color: 'text-red-400 bg-red-50 border-red-100' },
                    { icon: FileSearch, label: 'Reviewing multiple tools and documents', color: 'text-red-400 bg-red-50 border-red-100' },
                    { icon: RotateCcw, label: 'Re-checking and interpretation', color: 'text-red-400 bg-red-50 border-red-100' },
                    { icon: Clock, label: 'Hours per unit', color: 'text-red-400 bg-red-50 border-red-100' },
                    { icon: HelpCircle, label: 'No clear source of truth', color: 'text-red-400 bg-red-50 border-red-100' },
                  ].map((item, i) => (
                    <div key={i} className={`flex items-center gap-3 rounded-xl border px-5 py-4 ${item.color} hover:scale-[1.02] transition-transform`}>
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Nytro View */}
              <div className={`transition-all duration-500 ease-in-out ${
                comparisonMode === 'nytro' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full absolute inset-0'
              }`}>
                <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                  {[
                    { icon: Upload, label: 'One structured submission', color: 'text-teal-500 bg-teal-50 border-teal-100' },
                    { icon: FileCheck, label: 'Clear mapped output', color: 'text-teal-500 bg-teal-50 border-teal-100' },
                    { icon: Eye, label: 'Immediate visibility', color: 'text-teal-500 bg-teal-50 border-teal-100' },
                    { icon: CheckCircle, label: 'Confidence in what\'s complete', color: 'text-teal-500 bg-teal-50 border-teal-100' },
                  ].map((item, i) => (
                    <div key={i} className={`flex items-center gap-3 rounded-xl border px-5 py-4 ${item.color} hover:scale-[1.02] transition-transform`}>
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Visual Flow Comparison */}
            <div className="mt-16">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Manual Flow */}
                <div className="bg-red-50/50 border border-red-100 rounded-2xl p-6">
                  <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-5">Manual Process</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {['Drive', 'Email', 'Docs', 'SME', 'Trainers pulled', 'Cross-check', 'Re-check', 'Uncertainty'].map((step, i, arr) => (
                      <React.Fragment key={i}>
                        <span className="bg-white border border-red-200 text-red-600 text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap">
                          {step}
                        </span>
                        {i < arr.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-red-300 flex-shrink-0" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Nytro Flow */}
                <div className="bg-teal-50/50 border border-teal-100 rounded-2xl p-6">
                  <p className="text-xs font-bold text-teal-600 uppercase tracking-widest mb-5">Nytro Process</p>
                  <div className="flex items-center gap-3">
                    {['Submit', 'Process', 'Structured output'].map((step, i, arr) => (
                      <React.Fragment key={i}>
                        <span className="bg-white border border-teal-200 text-teal-700 text-sm font-semibold px-5 py-2 rounded-full whitespace-nowrap shadow-sm">
                          {step}
                        </span>
                        {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-teal-400 flex-shrink-0" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 5. FORM SECTION ──────────────────────────────────────────── */}
        <section id="form-section" className="py-16 md:py-24 bg-nytro-dark">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-sans font-bold text-white mb-4">
                Submit one unit and get clarity
              </h2>
              <p className="text-slate-400 text-lg">
                Without the manual process.
              </p>
            </div>

            <div ref={formRef} id="form" className="max-w-lg mx-auto">
              <div className="bg-slate-900/80 backdrop-blur rounded-2xl p-6 md:p-8 shadow-2xl border border-slate-700/50">
                {isAuthenticated && user?.email ? (
                  <div className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 rounded-lg px-3 py-2 mb-4">
                    <CheckCircle className="w-4 h-4 text-teal-400 flex-shrink-0" />
                    <p className="text-xs text-teal-300">
                      Logged in as <strong className="text-white">{user.email}</strong> — your submission will be linked to your account.
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mb-4">
                    Submit your details to request a one-off independent validation — no account required.
                  </p>
                )}
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
                        onBlur={() => setEmailError(validateEmail(formData.email))}
                        className={`w-full bg-slate-800 border rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent ${
                          emailError ? 'border-red-500 focus:ring-red-400' : 'border-slate-700 focus:ring-teal-400'
                        }`}
                        placeholder="email@company.com"
                      />
                      {emailError && (
                        <p className="text-xs text-red-400 mt-1">{emailError}</p>
                      )}
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
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.zip"
                      />
                      <label
                        htmlFor="fileUpload"
                        className="flex items-center gap-2 w-full bg-slate-800 border border-slate-700 border-dashed rounded-lg px-3 py-2.5 text-sm text-slate-400 cursor-pointer hover:border-teal-400 transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        {selectedFiles.length > 0
                          ? 'Add more files...'
                          : 'Choose files...'}
                      </label>
                    </div>
                    {selectedFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-1.5 text-xs">
                            <span className="text-slate-300 truncate mr-2">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                              className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                              aria-label={`Remove ${file.name}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
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
                      I'd like to receive news and updates from Nytro
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

                {/* Confidentiality notice under CTA */}
                <div className="mt-5 flex items-start gap-3 bg-slate-800/60 rounded-xl px-4 py-3 border border-slate-700/50">
                  <Lock className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-300 mb-1">Your submission is confidential</p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Your assessment is securely encrypted, never shared with third parties, and never used outside of your validation. Your IP remains yours. Always.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 6. TRUST / POSITIONING STRIP ────────────────────────────── */}
        <section id="trust" className="py-16 md:py-24 bg-white">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-sans font-bold text-nytro-dark mb-6">
                Why employers choose Nytro
              </h2>
              <p className="text-slate-600 text-lg leading-relaxed max-w-3xl mx-auto">
                Nytro is built specifically for the compliance realities of Australian RTOs. It removes the manual workload from validation, giving you clear, structured visibility quickly, strengthening consistency across trainers and locations, reducing delays, and allowing your team to focus on delivering quality training instead of reworking compliance.
              </p>
            </div>

            {/* IP Protection Card */}
            <div className="bg-gradient-to-br from-slate-900 to-nytro-dark rounded-2xl p-8 md:p-10 text-white max-w-3xl mx-auto">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-xl font-sans font-bold mb-2">Your IP stays yours</h3>
                  <p className="text-slate-300 leading-relaxed">
                    Your assessment resources are never shared, reused or exposed. All submissions are securely encrypted and temporarily stored in Australia, then deleted. They are used solely to generate your validation report.
                  </p>
                </div>
              </div>
              <p className="text-slate-400 text-sm mt-6 border-t border-slate-700 pt-6">
                This isn't generic consulting or subjective feedback. It's structured validation, without the manual workload, and without the risk.
              </p>
            </div>
          </div>
        </section>

        {/* ─── 7. LIMITED TIME OFFER — PROMO BANNER ─────────────────────── */}
        <section id="limited-offer" className="py-16 md:py-24 bg-slate-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/10">
              <img
                src={promoBanner}
                alt="See exactly where your assessment stands — $99 No subscription required — Assessment evidence automatically mapped in real time"
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
            <p className="text-center text-sm text-slate-500 italic mt-6">
              *When the promotion ends, standard pricing will apply.
            </p>
          </div>
        </section>

        {/* ─── 8. FAQ ──────────────────────────────────────────────────── */}
        <section id="faq" className="py-16 md:py-24 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-nytro-dark text-center mb-12">
              Frequently Asked Questions
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {faqData.map((faq, i) => (
                <div
                  key={i}
                  className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
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

        {/* ─── 9. FOOTER ───────────────────────────────────────────────── */}
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
                      href="#problem"
                      onClick={(e) => handleNavClick(e, 'problem')}
                      className="hover:text-teal-400 transition-colors"
                    >
                      Why Nytro
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

        {/* ─── Back to Top Button ──────────────────────────────────────── */}
        <button
          onClick={scrollToTop}
          className={`fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-teal-500 text-white shadow-lg hover:bg-teal-600 transition-all flex items-center justify-center ${
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
