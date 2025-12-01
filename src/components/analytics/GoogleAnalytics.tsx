/**
 * Google Analytics 4 (GA4) Integration Component
 * 
 * This component initializes Google Analytics and tracks page views automatically.
 * 
 * Usage:
 * 1. Replace GA_MEASUREMENT_ID with your actual GA4 Measurement ID
 * 2. Add this component to your main App component
 * 3. Use the trackEvent function from analytics.ts to track custom events
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Replace with your actual GA4 Measurement ID
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-XXXXXXXXXX';

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

export const GoogleAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    // Only initialize in production
    if (import.meta.env.DEV) {
      console.log('[GA4] Skipping initialization in development mode');
      return;
    }

    // Initialize GA4
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.async = true;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { 
      window.dataLayer.push(arguments); 
    };
    
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID, {
      send_page_view: false // We'll handle page views manually
    });

    console.log('[GA4] Initialized with ID:', GA_MEASUREMENT_ID);

    return () => {
      // Cleanup
      if (script.parentNode) {
        document.head.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    // Track page views on route changes
    if (window.gtag) {
      const pagePath = location.pathname + location.search;
      
      window.gtag('event', 'page_view', {
        page_path: pagePath,
        page_title: document.title,
        page_location: window.location.href
      });

      console.log('[GA4] Page view tracked:', pagePath);
    }
  }, [location]);

  return null;
};
