import { Badge } from '../ui/badge';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '../ui/utils';

interface ValidationItemProps {
  number: string;
  requirement: string;
  status: string;
  mappedContent?: string | null;
  unmappedContent?: string | null;
  recommendations?: string | null;
  reasoning?: string | null;
  docReferences?: string | null;
  benchmarkAnswer?: string | null;
}

export function ValidationItem({
  number,
  requirement,
  status,
  mappedContent,
  unmappedContent,
  recommendations,
  reasoning,
  docReferences,
  benchmarkAnswer,
}: ValidationItemProps) {
  const isCompliant = status?.toLowerCase() === 'compliant' || status?.toLowerCase() === 'success';
  const isFailed = status?.toLowerCase() === 'failed' || status?.toLowerCase() === 'non-compliant';

  return (
    <div
      className={cn(
        'p-4 rounded-lg border-l-4 space-y-3',
        isCompliant ? 'border-l-green-500 bg-green-50' : isFailed ? 'border-l-red-500 bg-red-50' : 'border-l-yellow-500 bg-yellow-50'
      )}
    >
      {/* Header with Number and Status */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Badge
            variant={isCompliant ? 'default' : isFailed ? 'destructive' : 'outline'}
            className="flex-shrink-0 mt-0.5"
          >
            {number}
          </Badge>
          <div className="flex-1">
            <p className="font-medium text-[#1e293b] text-sm">{requirement}</p>
          </div>
        </div>
        <div className="flex-shrink-0">
          {isCompliant ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : isFailed ? (
            <XCircle className="h-5 w-5 text-red-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-600" />
          )}
        </div>
      </div>

      {/* Benchmark Answer */}
      {benchmarkAnswer && (
        <div>
          <p className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-1">
            Benchmark Answer
          </p>
          <p className="text-sm text-[#1e293b] leading-relaxed">{benchmarkAnswer}</p>
        </div>
      )}

      {/* Mapped Content */}
      {mappedContent && (
        <div>
          <p className="text-xs font-medium text-[#3b82f6] uppercase tracking-wider mb-1">
            ✓ Mapped Content
          </p>
          <p className="text-sm text-[#1e293b] leading-relaxed">{mappedContent}</p>
        </div>
      )}

      {/* Unmapped Content */}
      {unmappedContent && (
        <div>
          <p className="text-xs font-medium text-red-600 uppercase tracking-wider mb-1">
            ✗ Unmapped Content
          </p>
          <p className="text-sm text-[#1e293b] leading-relaxed">{unmappedContent}</p>
        </div>
      )}

      {/* Recommendations */}
      {recommendations && (
        <div className="p-3 bg-white border border-yellow-200 rounded">
          <p className="text-xs font-medium text-yellow-800 uppercase tracking-wider mb-1">
            💡 Recommendations
          </p>
          <p className="text-sm text-yellow-900 leading-relaxed">{recommendations}</p>
        </div>
      )}

      {/* Reasoning */}
      {reasoning && (
        <div>
          <p className="text-xs font-medium text-[#64748b] uppercase tracking-wider mb-1">
            Reasoning
          </p>
          <p className="text-sm text-[#1e293b] leading-relaxed">{reasoning}</p>
        </div>
      )}

      {/* Document References */}
      {docReferences && (
        <div>
          <p className="text-xs font-medium text-[#3b82f6] uppercase tracking-wider mb-1">
            Document References
          </p>
          <p className="text-sm text-[#1e293b] font-mono bg-[#f8f9fb] p-2 rounded">
            {docReferences}
          </p>
        </div>
      )}
    </div>
  );
}
