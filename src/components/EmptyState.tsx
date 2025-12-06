/**
 * Empty State Component
 * Displays helpful empty states with icons and call-to-action
 */

import React from 'react';
import { Button } from './ui/button';
import {
  FileText,
  FolderOpen,
  Search,
  Upload,
  CheckCircle,
  AlertCircle,
  Inbox,
  LucideIcon,
} from 'lucide-react';

type EmptyStateVariant =
  | 'no-validations'
  | 'no-results'
  | 'no-documents'
  | 'search-empty'
  | 'processing'
  | 'error'
  | 'custom';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const variantConfig: Record<
  Exclude<EmptyStateVariant, 'custom'>,
  { icon: LucideIcon; title: string; description: string }
> = {
  'no-validations': {
    icon: Inbox,
    title: 'No validations yet',
    description:
      'Get started by selecting a unit and uploading your assessment documents for validation.',
  },
  'no-results': {
    icon: Search,
    title: 'No results found',
    description:
      'Try adjusting your search or filter criteria to find what you\'re looking for.',
  },
  'no-documents': {
    icon: FolderOpen,
    title: 'No documents uploaded',
    description:
      'Upload your assessment documents to begin the validation process.',
  },
  'search-empty': {
    icon: Search,
    title: 'No matching results',
    description:
      'We couldn\'t find any items matching your search. Try different keywords or clear your filters.',
  },
  processing: {
    icon: FileText,
    title: 'Processing in progress',
    description:
      'Your validation is being processed. This may take a few minutes depending on the document size.',
  },
  error: {
    icon: AlertCircle,
    title: 'Something went wrong',
    description:
      'We encountered an error loading this content. Please try again or contact support if the issue persists.',
  },
};

export function EmptyState({
  variant = 'no-results',
  title,
  description,
  icon: CustomIcon,
  action,
  secondaryAction,
  className = '',
}: EmptyStateProps) {
  const config = variant === 'custom' ? null : variantConfig[variant];
  const Icon = CustomIcon || config?.icon || Inbox;
  const displayTitle = title || config?.title || 'No items found';
  const displayDescription = description || config?.description || '';

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}
    >
      <div className="mb-4 p-4 bg-slate-100 rounded-full">
        <Icon className="h-8 w-8 text-slate-400" />
      </div>

      <h3 className="text-lg font-semibold text-slate-900 mb-2">{displayTitle}</h3>

      <p className="text-sm text-slate-500 max-w-md mb-6">{displayDescription}</p>

      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <Button onClick={action.onClick} className="gap-2">
              {variant === 'no-documents' && <Upload className="h-4 w-4" />}
              {variant === 'no-validations' && <CheckCircle className="h-4 w-4" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact empty state for inline use
 */
export function EmptyStateInline({
  message = 'No items to display',
  className = '',
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-center py-8 text-slate-500 ${className}`}>
      <Inbox className="h-5 w-5 mr-2 text-slate-400" />
      <span className="text-sm">{message}</span>
    </div>
  );
}
