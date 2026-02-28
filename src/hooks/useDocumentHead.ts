/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Lightweight hook to manage document head (title, meta tags, structured data).
 * Replaces react-helmet-async to avoid React 19 peer dependency conflicts.
 */
import { useEffect } from 'react';

interface MetaTag {
  name?: string;
  property?: string;
  content: string;
}

interface LinkTag {
  rel: string;
  href: string;
}

interface DocumentHeadOptions {
  title?: string;
  meta?: MetaTag[];
  links?: LinkTag[];
  structuredData?: Record<string, unknown>[];
}

/**
 * Sets document title, meta tags, link tags, and JSON-LD structured data.
 * Cleans up on unmount by restoring previous title and removing injected elements.
 */
export function useDocumentHead(options: DocumentHeadOptions) {
  useEffect(() => {
    const previousTitle = document.title;
    const injectedElements: HTMLElement[] = [];

    // Title
    if (options.title) {
      document.title = options.title;
    }

    // Meta tags
    if (options.meta) {
      for (const tag of options.meta) {
        const el = document.createElement('meta');
        if (tag.name) el.setAttribute('name', tag.name);
        if (tag.property) el.setAttribute('property', tag.property);
        el.setAttribute('content', tag.content);
        document.head.appendChild(el);
        injectedElements.push(el);
      }
    }

    // Link tags
    if (options.links) {
      for (const tag of options.links) {
        const el = document.createElement('link');
        el.setAttribute('rel', tag.rel);
        el.setAttribute('href', tag.href);
        document.head.appendChild(el);
        injectedElements.push(el);
      }
    }

    // Structured data (JSON-LD)
    if (options.structuredData) {
      for (const data of options.structuredData) {
        const el = document.createElement('script');
        el.setAttribute('type', 'application/ld+json');
        el.textContent = JSON.stringify(data);
        document.head.appendChild(el);
        injectedElements.push(el);
      }
    }

    // Cleanup on unmount
    return () => {
      document.title = previousTitle;
      for (const el of injectedElements) {
        if (el.parentNode) {
          el.parentNode.removeChild(el);
        }
      }
    };
  }, [options.title]);
}
