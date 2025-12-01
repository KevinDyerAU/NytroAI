# Marketing & Analytics Integration Guide

## 1. Current State

The landing page currently has **no analytics or marketing tools** integrated. This means we have no visibility into:

- Traffic sources
- User behavior
- Conversion rates
- Marketing campaign performance

---

## 2. Recommended Tools

### 2.1. Analytics

- **Google Analytics 4 (GA4):** Industry standard for web analytics.
- **Vercel Analytics:** Simple, privacy-focused analytics (if deploying on Vercel).
- **Plausible Analytics:** Lightweight, open-source, privacy-friendly alternative.

### 2.2. Marketing & CRM

- **HubSpot:** All-in-one marketing, sales, and service platform.
- **Mailchimp:** Email marketing and automation.
- **Intercom:** Customer messaging and live chat.

### 2.3. Heatmaps & Session Replays

- **Hotjar:** Understand user behavior with heatmaps, recordings, and feedback.
- **Clarity:** Free tool from Microsoft for heatmaps and session replays.

---

## 3. Implementation Plan

### 3.1. Google Analytics 4 (GA4)

**Step 1: Create a GA4 Property**

1. Go to https://analytics.google.com/
2. Create a new GA4 property for nytro.ai.
3. Get your Measurement ID (e.g., `G-XXXXXXXXXX`).

**Step 2: Add GA4 to Your Code**

Create a new component `src/components/analytics/GoogleAnalytics.tsx`:

```tsx
import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // Replace with your ID

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

export const GoogleAnalytics: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    // Initialize GA4
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.async = true;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', GA_MEASUREMENT_ID);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    // Track page views
    if (window.gtag) {
      window.gtag('config', GA_MEASUREMENT_ID, {
        page_path: location.pathname + location.search,
      });
    }
  }, [location]);

  return null;
};
```

**Step 3: Add to App**

In `src/index.tsx` (or your main app component), add the `GoogleAnalytics` component:

```tsx
import { GoogleAnalytics } from './components/analytics/GoogleAnalytics';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <GoogleAnalytics />
      <App />
    </Router>
  </React.StrictMode>
);
```

### 3.2. HubSpot Integration

**Step 1: Get HubSpot Tracking Code**

1. Go to your HubSpot account.
2. Navigate to **Settings** → **Tracking & Analytics** → **Tracking Code**.
3. Copy the tracking code script.

**Step 2: Add to `index.html`**

Add the HubSpot script to the `<head>` of `index.html`:

```html
<!-- Start of HubSpot Embed Code -->
<script type="text/javascript" id="hs-script-loader" async defer src="//js.hs-scripts.com/YOUR_HUBSPOT_ID.js"></script>
<!-- End of HubSpot Embed Code -->
```

**Step 3: Track Form Submissions**

For your contact form, you can use HubSpot forms or send data to HubSpot via their API.

---

## 4. Event Tracking Strategy

Track key user interactions to understand user journeys and conversion funnels.

### Recommended Events:

- **`sign_up`:** User creates an account.
- **`login`:** User logs in.
- **`watch_video`:** User clicks the "Watch Video" button.
- **`contact_form_submit`:** User submits the contact form.
- **`cta_click`:** User clicks a primary call-to-action button.

### How to Track Events

Create a helper function `src/lib/analytics.ts`:

```ts
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (window.gtag) {
    window.gtag('event', eventName, params);
  }
};
```

Then call it from your components:

```tsx
import { trackEvent } from '../lib/analytics';

const handleSignUp = () => {
  trackEvent('sign_up', { method: 'Landing Page CTA' });
  setSignUpDialogOpen(true);
};
```

---

## 5. Marketing & SEO Synergy

### 5.1. UTM Parameters

Use UTM parameters in your marketing campaigns to track their performance in Google Analytics:

- `utm_source`: Where the traffic is coming from (e.g., `google`, `linkedin`).
- `utm_medium`: The type of link (e.g., `cpc`, `email`).
- `utm_campaign`: The specific campaign (e.g., `q4-launch`).

**Example URL:**
`https://www.nytro.ai/?utm_source=linkedin&utm_medium=cpc&utm_campaign=q4-launch`

### 5.2. Landing Page A/B Testing

Use a tool like **Google Optimize** or **VWO** to A/B test different versions of your landing page:

- Test different headlines.
- Test different calls-to-action.
- Test different feature descriptions.

---

## 6. Verification

### 6.1. Google Analytics Real-Time View

After implementing GA4, open your website and check the **Real-Time** report in Google Analytics to see if your visit is being tracked.

### 6.2. Google Tag Assistant

Use the **Google Tag Assistant** Chrome extension to verify that your GA4 and other tags are firing correctly.

- https://chrome.google.com/webstore/detail/tag-assistant-legacy-by-g/kejbdjndbnbjgmefkgdddjlbokphdefk

### 6.3. HubSpot Tracking

Check your HubSpot contacts to see if new form submissions are being added.

---

## 7. Next Steps

1. ✅ Set up Google Analytics 4 property.
2. ✅ Implement `GoogleAnalytics.tsx` component.
3. ✅ Add HubSpot tracking code to `index.html`.
4. ✅ Implement event tracking for key actions.
5. ✅ Use UTM parameters in marketing campaigns.
6. ✅ Verify all tracking is working correctly.

---

**Author:** Manus AI  
**Date:** 2025-12-01
