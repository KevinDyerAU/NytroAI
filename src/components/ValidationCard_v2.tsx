import { useState } from 'react';
import { Card } from './ui/card';
import { StatusBadge } from './StatusBadge';
import { GlowButton } from './GlowButton';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { ChevronDown, ChevronUp, MessageSquare, Sparkles, Save, X, RefreshCw, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

interface ValidationResult {
  id: string;
  requirementNumber: string;
  type: string;
  requirementText: string;
  status: 'met' | 'not-met' | 'partial';
  reasoning: string;
  evidence: {
    mappedQuestions: string[];
    unmappedReasoning: string;
    documentReferences: (string | number)[];
  };
  aiEnhancement: {
    smartQuestion: string;
    benchmarkAnswer: string;
    recommendations: string[];
  };
}

interface ValidationCardProps {
  result: ValidationResult;
  onChatClick: (result: ValidationResult) => void;
  isReportSigned?: boolean;
  aiCreditsAvailable?: boolean;
  validationContext?: {
    rtoId?: string;
    unitCode?: string;
    unitTitle?: string;
    validationType?: string;
    validationId?: string;
  };
}

export function ValidationCard_v2({ 
  result, 
  onChatClick, 
  isReportSigned = false, 
  aiCreditsAvailable = true, 
  validationContext 
}: ValidationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState(result.aiEnhancement.smartQuestion);
  const [editedAnswer, setEditedAnswer] = useState(result.aiEnhancement.benchmarkAnswer);
  const [userContext, setUserContext] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  /**
   * Regenerate SMART question using the new dedicated edge function
   * This calls the standalone regenerate-smart-questions function
   */
  const handleRegenerateQuestion = async () => {
    if (!aiCreditsAvailable) {
      toast.error('No AI credits available');
      return;
    }

    setIsRegenerating(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/regenerate-smart-questions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            validationResultId: result.id,
            userContext: userContext || undefined,
            currentQuestion: editedQuestion,
            currentAnswer: editedAnswer,
            options: {
              difficultyLevel: 'intermediate',
              questionCount: 1,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate question');
      }

      const data = await response.json();
      
      if (data.success && data.question) {
        setEditedQuestion(data.question.question);
        setEditedAnswer(data.question.benchmark_answer || data.question.answer);
        toast.success('Question regenerated successfully!');
        setUserContext(''); // Clear context after successful regeneration
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error regenerating question:', error);
      toast.error(error.message || 'Failed to regenerate question');
    } finally {
      setIsRegenerating(false);
    }
  };

  /**
   * Save edited question and answer
   */
  const handleSave = () => {
    // Update the result object
    result.aiEnhancement.smartQuestion = editedQuestion;
    result.aiEnhancement.benchmarkAnswer = editedAnswer;
    setIsEditing(false);
    toast.success('Changes saved');
  };

  /**
   * Cancel editing and revert changes
   */
  const handleCancel = () => {
    setEditedQuestion(result.aiEnhancement.smartQuestion);
    setEditedAnswer(result.aiEnhancement.benchmarkAnswer);
    setUserContext('');
    setIsEditing(false);
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-mono text-gray-500">
              {result.requirementNumber}
            </span>
            <StatusBadge status={result.status} />
            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
              {result.type}
            </span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            {result.requirementText}
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-4 p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </button>
      </div>

      {/* Validation Reasoning */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-700">{result.reasoning}</p>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="space-y-4 border-t pt-4">
          {/* Evidence Section */}
          {(result.evidence.mappedQuestions.length > 0 || result.evidence.unmappedReasoning) && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Evidence</h4>
              {result.evidence.mappedQuestions.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-gray-500 mb-1">Mapped Questions:</p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                    {result.evidence.mappedQuestions.map((q, idx) => (
                      <li key={idx}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.evidence.unmappedReasoning && (
                <p className="text-sm text-gray-600">{result.evidence.unmappedReasoning}</p>
              )}
            </div>
          )}

          {/* SMART Question Section */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <h4 className="text-sm font-semibold text-gray-700">SMART Question</h4>
              </div>
              {!isReportSigned && (
                <div className="flex gap-2">
                  {!isEditing ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                      className="text-xs"
                    >
                      <Lightbulb className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                        className="text-xs"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        className="text-xs"
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Save
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3">
                {/* User Context Input */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Additional Context (Optional)
                  </label>
                  <Textarea
                    value={userContext}
                    onChange={(e) => setUserContext(e.target.value)}
                    placeholder="Provide additional context, feedback, or specific areas to focus on..."
                    rows={2}
                    className="text-sm"
                  />
                </div>

                {/* Regenerate Button */}
                {aiCreditsAvailable && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRegenerateQuestion}
                    disabled={isRegenerating}
                    className="w-full text-xs"
                  >
                    {isRegenerating ? (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                        Regenerating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Regenerate with AI
                      </>
                    )}
                  </Button>
                )}

                {/* Question Input */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Question
                  </label>
                  <Textarea
                    value={editedQuestion}
                    onChange={(e) => setEditedQuestion(e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                </div>

                {/* Answer Input */}
                <div>
                  <label className="text-xs font-medium text-gray-700 mb-1 block">
                    Benchmark Answer
                  </label>
                  <Textarea
                    value={editedAnswer}
                    onChange={(e) => setEditedAnswer(e.target.value)}
                    rows={4}
                    className="text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-gray-700">{result.aiEnhancement.smartQuestion}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Benchmark Answer:</p>
                  <p className="text-sm text-gray-600">{result.aiEnhancement.benchmarkAnswer}</p>
                </div>
              </div>
            )}
          </div>

          {/* Recommendations */}
          {result.aiEnhancement.recommendations.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Recommendations</h4>
              <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                {result.aiEnhancement.recommendations.map((rec, idx) => (
                  <li key={idx}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Chat Button */}
          <div className="border-t pt-4">
            <GlowButton
              onClick={() => onChatClick(result)}
              className="w-full"
              size="sm"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Discuss with AI
            </GlowButton>
          </div>
        </div>
      )}
    </Card>
  );
}
