/**
 * Analytics Helper Functions
 * 
 * This module provides helper functions for tracking events in Google Analytics.
 * 
 * Usage:
 * import { trackEvent, trackPageView, trackConversion } from '@/lib/analytics';
 * 
 * trackEvent('sign_up', { method: 'Landing Page CTA' });
 */

/**
 * Track a custom event in Google Analytics
 * 
 * @param eventName - The name of the event (e.g., 'sign_up', 'login', 'purchase')
 * @param params - Optional parameters to include with the event
 */
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
    console.log('[GA4] Event tracked:', eventName, params);
  } else if (import.meta.env.DEV) {
    console.log('[GA4] Event (dev mode):', eventName, params);
  }
};

/**
 * Track a page view manually
 * 
 * @param pagePath - The path of the page (e.g., '/dashboard')
 * @param pageTitle - The title of the page
 */
export const trackPageView = (pagePath: string, pageTitle?: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'page_view', {
      page_path: pagePath,
      page_title: pageTitle || document.title,
      page_location: window.location.href
    });
    console.log('[GA4] Page view tracked:', pagePath);
  }
};

/**
 * Track a conversion event
 * 
 * @param conversionName - The name of the conversion (e.g., 'sign_up', 'purchase')
 * @param value - Optional monetary value of the conversion
 * @param currency - Currency code (default: 'AUD')
 */
export const trackConversion = (
  conversionName: string, 
  value?: number, 
  currency: string = 'AUD'
) => {
  const params: Record<string, any> = {};
  
  if (value !== undefined) {
    params.value = value;
    params.currency = currency;
  }
  
  trackEvent(conversionName, params);
};

/**
 * Track a form submission
 * 
 * @param formName - The name of the form (e.g., 'contact_form', 'sign_up_form')
 * @param formLocation - Where the form is located (e.g., 'landing_page', 'dashboard')
 */
export const trackFormSubmit = (formName: string, formLocation?: string) => {
  trackEvent('form_submit', {
    form_name: formName,
    form_location: formLocation
  });
};

/**
 * Track a button click
 * 
 * @param buttonName - The name of the button (e.g., 'cta_sign_up', 'watch_video')
 * @param buttonLocation - Where the button is located (e.g., 'hero', 'footer')
 */
export const trackButtonClick = (buttonName: string, buttonLocation?: string) => {
  trackEvent('button_click', {
    button_name: buttonName,
    button_location: buttonLocation
  });
};

/**
 * Track a video interaction
 * 
 * @param action - The action taken (e.g., 'play', 'pause', 'complete')
 * @param videoTitle - The title of the video
 */
export const trackVideoInteraction = (action: string, videoTitle?: string) => {
  trackEvent('video_interaction', {
    action,
    video_title: videoTitle
  });
};

/**
 * Track a file download
 * 
 * @param fileName - The name of the file downloaded
 * @param fileType - The type of file (e.g., 'pdf', 'docx')
 */
export const trackFileDownload = (fileName: string, fileType?: string) => {
  trackEvent('file_download', {
    file_name: fileName,
    file_type: fileType
  });
};

/**
 * Track a search query
 * 
 * @param searchTerm - The search term entered by the user
 * @param searchLocation - Where the search was performed (e.g., 'header', 'dashboard')
 */
export const trackSearch = (searchTerm: string, searchLocation?: string) => {
  trackEvent('search', {
    search_term: searchTerm,
    search_location: searchLocation
  });
};

/**
 * Track user engagement time
 * 
 * @param engagementTime - Time in seconds
 * @param pagePath - The page where engagement occurred
 */
export const trackEngagement = (engagementTime: number, pagePath?: string) => {
  trackEvent('user_engagement', {
    engagement_time_msec: engagementTime * 1000,
    page_path: pagePath || window.location.pathname
  });
};

// Declare gtag on window for TypeScript
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}
