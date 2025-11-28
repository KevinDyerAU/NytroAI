/**
 * ResultsExplorerActions Component
 * 
 * Action buttons for Results Explorer using n8n webhooks:
 * - Generate Report
 * - Revalidate Requirement
 * - Regenerate Smart Questions
 */

import React, { useState } from 'react';
import { Button } from './ui/button';
import { FileDown, RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import { useResultsActions } from '../hooks/useResultsActions';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';

interface ResultsExplorerActionsProps {
  validationDetailId: number;
  onRefresh?: () => void;
}

export function ResultsExplorerActions({
  validationDetailId,
  onRefresh,
}: ResultsExplorerActionsProps) {
  const {
    generateAndDownloadReport,
    isGeneratingReport,
  } = useResultsActions(onRefresh);

  return (
    <div className="flex items-center gap-2">
      {/* Generate Report Button */}
      <Button
        onClick={() => generateAndDownloadReport(validationDetailId)}
        disabled={isGeneratingReport}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        {isGeneratingReport ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileDown className="w-4 h-4" />
        )}
        {isGeneratingReport ? 'Generating...' : 'Download Report'}
      </Button>
    </div>
  );
}

interface RequirementActionsProps {
  validationResultId: number;
  onRefresh?: () => void;
}

export function RequirementActions({
  validationResultId,
  onRefresh,
}: RequirementActionsProps) {
  const {
    revalidate,
    isRevalidating,
  } = useResultsActions(onRefresh);

  return (
    <div className="flex items-center gap-2">
      {/* Revalidate Button */}
      <Button
        onClick={() => revalidate(validationResultId)}
        disabled={isRevalidating}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        {isRevalidating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <RefreshCw className="w-4 h-4" />
        )}
        {isRevalidating ? 'Revalidating...' : 'Revalidate'}
      </Button>
    </div>
  );
}

interface RegenerateQuestionsProps {
  validationResultId: number;
  currentQuestions?: Array<{ id: number; question_text: string }>;
  onQuestionsRegenerated?: (newQuestions: any[]) => void;
  onRefresh?: () => void;
}

export function RegenerateQuestionsDialog({
  validationResultId,
  currentQuestions,
  onQuestionsRegenerated,
  onRefresh,
}: RegenerateQuestionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [userGuidance, setUserGuidance] = useState('');
  
  const {
    regenerateSmartQuestions,
    isRegeneratingQuestions,
  } = useResultsActions(onRefresh);

  const handleRegenerate = async () => {
    const newQuestions = await regenerateSmartQuestions(
      validationResultId,
      userGuidance
    );

    if (newQuestions && onQuestionsRegenerated) {
      onQuestionsRegenerated(newQuestions);
    }

    if (newQuestions) {
      setIsOpen(false);
      setUserGuidance('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Regenerate Questions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Regenerate Smart Questions</DialogTitle>
          <DialogDescription>
            Provide guidance to help AI generate better questions for this requirement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Questions Preview */}
          {currentQuestions && currentQuestions.length > 0 && (
            <div className="space-y-2">
              <Label>Current Questions ({currentQuestions.length})</Label>
              <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1">
                {currentQuestions.map((q, idx) => (
                  <p key={q.id} className="text-sm text-gray-700">
                    {idx + 1}. {q.question_text}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* User Guidance Input */}
          <div className="space-y-2">
            <Label htmlFor="guidance">
              Guidance for AI (Optional)
            </Label>
            <Input
              id="guidance"
              placeholder="E.g., Focus on practical application, include safety considerations..."
              value={userGuidance}
              onChange={(e) => setUserGuidance(e.target.value)}
              className="h-24"
              as="textarea"
            />
            <p className="text-xs text-gray-500">
              Provide specific instructions to help AI generate more targeted questions.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isRegeneratingQuestions}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRegenerate}
            disabled={isRegeneratingQuestions}
            className="flex items-center gap-2"
          >
            {isRegeneratingQuestions ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Regenerate
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
