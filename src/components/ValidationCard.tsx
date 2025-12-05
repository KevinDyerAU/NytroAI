import React, { useState } from 'react';
import { Card } from './ui/card';
import { StatusBadge } from './StatusBadge';
import { GlowButton } from './GlowButton';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { ChevronDown, ChevronUp, MessageSquare, FileText, Lightbulb, Sparkles, Save, X, RefreshCw, AlertTriangle, FileCheck } from 'lucide-react';
import { toast } from 'sonner';

interface ValidationResult {
  id: string;
  validation_detail_id?: number;
  requirement_number: string;
  requirement_type: string;
  requirement_text: string;
  status: 'met' | 'not-met' | 'partial';
  reasoning: string;
  mapped_content: string; // JSON string of mapped questions
  doc_references: string; // JSON string or text of document references
  smart_questions: string;
  benchmark_answer: string;
  citations: string; // JSON string of citations
  created_at?: string;
  updated_at?: string;
  
  // Helper properties for backward compatibility (can be computed from DB fields)
  requirementNumber?: string; // alias for requirement_number
  type?: string; // alias for requirement_type
  requirementText?: string; // alias for requirement_text
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

export function ValidationCard({ result, onChatClick, isReportSigned = false, aiCreditsAvailable = true, validationContext }: ValidationCardProps) {
  // Helper functions to parse JSON fields and provide backward compatibility
  const getRequirementNumber = () => result.requirement_number || result.requirementNumber || '';
  const getRequirementType = () => result.requirement_type || result.type || '';
  const getRequirementText = () => result.requirement_text || result.requirementText || '';
  
  const getMappedQuestions = (): string[] => {
    try {
      if (!result.mapped_content) return [];
      const parsed = JSON.parse(result.mapped_content);
      return Array.isArray(parsed) ? parsed : parsed.mappedQuestions || [];
    } catch {
      return [];
    }
  };
  
  const getDocReferences = (): (string | number)[] => {
    try {
      if (!result.doc_references) return [];
      const parsed = JSON.parse(result.doc_references);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // If not JSON, split by newlines or commas
      return result.doc_references ? result.doc_references.split(/[\n,]/).filter(Boolean) : [];
    }
  };
  
  const getCitations = (): any[] => {
    try {
      if (!result.citations) return [];
      const parsed = JSON.parse(result.citations);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('[ValidationCard] Error parsing citations:', e);
      return [];
    }
  };
  
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedQuestion, setEditedQuestion] = useState(result.smart_questions || '');
  const [editedAnswer, setEditedAnswer] = useState(result.benchmark_answer || '');
  const [aiContext, setAiContext] = useState('');
  const [generatedCitations, setGeneratedCitations] = useState<any[]>(getCitations());
  const [isGenerating, setIsGenerating] = useState(false);
  const [showRevalidateDialog, setShowRevalidateDialog] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isRevalidating, setIsRevalidating] = useState(false);

  /**
   * Generate improved SMART questions using AI with comprehensive context
   * Includes: current requirement, validation status, evidence, and user feedback
   */
  const handleGenerateWithAI = async () => {
    setIsGenerating(true);
    
    try {
      // Import regenerateQuestions from n8nApi
      const { regenerateQuestions } = await import('../lib/n8nApi');
      
      // Call n8n via edge function proxy (convert string id to number)
      const resultId: number = parseInt(result.id, 10);
      const response = await regenerateQuestions(resultId, aiContext);
      
      if (response.success && response.questions && response.questions.length > 0) {
        // Extract the first generated question (n8n returns array)
        const generated = response.questions[0];
        
        // Update the edited fields with the AI-generated content
        setEditedQuestion(generated.question_text || result.smart_questions);
        setEditedAnswer(generated.context || result.benchmark_answer);
        
        toast.success('Question generated with AI based on your feedback');
      } else {
        throw new Error(response.error || 'No questions generated');
      }
    } catch (error) {
      console.error('Error generating with AI:', error);
      toast.error('Failed to generate with AI. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    // In a real app, this would update the backend
    result.smart_questions = editedQuestion;
    result.benchmark_answer = editedAnswer;
    if (generatedCitations.length > 0) {
      result.citations = JSON.stringify(generatedCitations);
    }
    setIsEditing(false);
    setAiContext('');
  };

  const handleCancel = () => {
    setEditedQuestion(result.smart_questions);
    setEditedAnswer(result.benchmark_answer);
    setAiContext('');
    setGeneratedCitations(getCitations());
    setIsEditing(false);
  };

  const handleEditClick = () => {
    console.log('EDIT BUTTON CLICKED - Setting isEditing to true');
    setIsEditing(true);
  };

  const handleRevalidate = async () => {
    if (confirmText.toLowerCase() !== 'confirm') {
      toast.error('Please type "confirm" to proceed');
      return;
    }

    setIsRevalidating(true);
    setShowRevalidateDialog(false);
    setConfirmText('');

    toast.loading(`Revalidating ${getRequirementNumber()}...`, { id: 'revalidate' });
    
    try {
      // Import revalidateRequirement from n8nApi
      const { revalidateRequirement } = await import('../lib/n8nApi');
      
      // Call n8n via edge function proxy (convert string id to number)
      const resultId: number = parseInt(result.id, 10);
      const response = await revalidateRequirement(resultId);
      
      if (response.success) {
        toast.success(`${getRequirementNumber()} has been queued for revalidation`, { id: 'revalidate' });
      } else {
        throw new Error(response.error || 'Revalidation failed');
      }
    } catch (error) {
      console.error('Error revalidating:', error);
      toast.error('Failed to revalidate. Please try again.', { id: 'revalidate' });
    } finally {
      setIsRevalidating(false);
    }
  };

  return (
    <Card className="border border-[#dbeafe] bg-white hover:shadow-soft transition-all">
      {/* Collapsed View */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getRequirementType() && (
              <div className="font-poppins font-semibold text-[#3b82f6]">
                {getRequirementType()}
              </div>
            )}
            <div className="font-poppins text-[#3b82f6]">
              {getRequirementNumber()}
            </div>
            <StatusBadge status={result.status} />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onChatClick(result)}
              disabled={isReportSigned || !aiCreditsAvailable}
              className="p-2 hover:bg-[#f1f5f9] rounded-lg transition-colors text-[#64748b] hover:text-[#3b82f6] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[#64748b]"
              title={isReportSigned ? "Report is signed off - no updates allowed" : !aiCreditsAvailable ? "No AI credits available" : "Chat with AI about this requirement"}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2 hover:bg-[#f1f5f9] rounded-lg transition-colors text-[#64748b] hover:text-[#3b82f6]"
            >
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <p className={`text-sm text-[#1e293b] ${expanded ? '' : 'line-clamp-2'}`}>
          {getRequirementText()}
        </p>
      </div>

      {/* Expanded View */}
      {expanded && (
        <div className="border-t border-[#dbeafe] p-6 space-y-6 bg-[#f8f9fb] animate-fade-in">
          {/* Status & Reasoning */}
          <div>
            <h4 className="font-poppins text-[#1e293b] mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#3b82f6]" />
              Status & Reasoning
            </h4>
            <div className="bg-white border border-[#dbeafe] rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-[#64748b] mb-2">Reasoning:</p>
                <p className="text-sm leading-relaxed text-[#475569]">{result.reasoning}</p>
              </div>
              
              {result.mapped_content && (
                <div className="pt-3 border-t border-[#dbeafe]">
                  <p className="text-sm font-medium text-[#64748b] mb-2">Mapped Content:</p>
                  <p className="text-sm leading-relaxed text-[#475569] whitespace-pre-wrap">{result.mapped_content}</p>
                </div>
              )}
            </div>
          </div>

          {/* Evidence Section */}
          <div>
            <h4 className="font-poppins text-[#1e293b] mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#3b82f6]" />
              Evidence
            </h4>
            <div className="bg-white border border-[#dbeafe] rounded-lg p-4 space-y-3">
              {getCitations().length > 0 ? (
                <div>
                  <p className="text-sm text-[#64748b] mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Citations:
                  </p>
                  <div className="space-y-2">
                    {getCitations().map((citation: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-sm bg-[#dbeafe] border border-[#3b82f6] rounded-lg p-3">
                        <FileText className="w-4 h-4 text-[#3b82f6] mt-0.5 flex-shrink-0" />
                        {citation.type === 'file' && citation.displayName && (
                          <div className="text-[#1e293b]">
                            <span className="font-medium">{citation.displayName}</span>
                            {citation.pageNumbers && citation.pageNumbers.length > 0 && (
                              <span className="text-[#3b82f6] ml-2">
                                (Pages: {citation.pageNumbers.join(', ')})
                              </span>
                            )}
                          </div>
                        )}
                        {!citation.displayName && (
                          <div className="text-[#64748b]">
                            {JSON.stringify(citation)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#94a3b8] italic">No citations available</p>
              )}
            </div>
          </div>

          {/* AI Enhancement Section */}
          <div>
            <h4 className="font-poppins text-[#3b82f6] mb-2 flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              AI Enhancement
              {isEditing && (
                <span className="text-xs text-[#3b82f6] bg-[#dbeafe] px-2 py-1 rounded">
                  Editing Mode
                </span>
              )}
            </h4>
            <div className="bg-white border border-[#93c5fd] rounded-lg p-4 space-y-4">
              {isEditing ? (
                <>
                  {/* AI Context Input */}
                  <div className="bg-[#f0f9ff] border-2 border-dashed border-[#3b82f6] rounded-lg p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <Sparkles className="w-5 h-5 text-[#3b82f6] flex-shrink-0 mt-1" />
                      <div className="flex-1">
                        <p className="text-sm text-[#3b82f6] mb-1">AI Context (Optional)</p>
                        <p className="text-xs text-[#64748b] mb-3">
                          Provide additional context to generate better questions and answers using AI
                        </p>
                        <Textarea
                          value={aiContext}
                          onChange={(e) => setAiContext(e.target.value)}
                          placeholder="e.g., 'This is for a construction workplace with specific safety requirements...' or 'Focus on practical assessment tasks for hospitality...'"
                          className="min-h-[80px] bg-white border-[#3b82f6] focus:border-[#3b82f6]"
                        />
                      </div>
                    </div>
                    <GlowButton
                      variant="primary"
                      size="sm"
                      onClick={handleGenerateWithAI}
                      disabled={!aiContext.trim() || isGenerating || !aiCreditsAvailable}
                      title={!aiCreditsAvailable ? "No AI credits available" : ""}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      {isGenerating ? 'Generating...' : 'Generate with AI'}
                    </GlowButton>
                  </div>

                  {/* Editable Question */}
                  <div>
                    <p className="text-sm text-[#3b82f6] mb-2">SMART Question:</p>
                    <Textarea
                      value={editedQuestion}
                      onChange={(e) => setEditedQuestion(e.target.value)}
                      className="min-h-[100px] bg-[#dbeafe] border-[#93c5fd] focus:border-[#3b82f6]"
                    />
                  </div>

                  {/* Editable Answer */}
                  <div>
                    <p className="text-sm text-[#3b82f6] mb-2">Benchmark Answer:</p>
                    <Textarea
                      value={editedAnswer}
                      onChange={(e) => setEditedAnswer(e.target.value)}
                      className="min-h-[120px] bg-white border-[#dbeafe] focus:border-[#3b82f6]"
                    />
                  </div>

                  {/* Edit Action Buttons */}
                  <div className="flex gap-3 pt-3 border-t border-[#dbeafe]">
                    <GlowButton variant="primary" size="sm" onClick={handleSave}>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </GlowButton>
                    <GlowButton variant="secondary" size="sm" onClick={handleCancel}>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </GlowButton>
                  </div>
                </>
              ) : (
                <>
                  {/* Display Mode */}
                  <div>
                    <p className="text-sm text-[#3b82f6] mb-2">SMART Question:</p>
                    <p className="text-sm bg-[#dbeafe] p-3 rounded border border-[#93c5fd] text-[#1e293b] whitespace-pre-wrap">
                      {result.smart_questions?.trim() || <span className="text-[#94a3b8] italic">No SMART question available</span>}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-[#3b82f6] mb-2">Benchmark Answer:</p>
                    <p className="text-sm text-[#64748b] whitespace-pre-wrap">
                      {result.benchmark_answer?.trim() || <span className="text-[#94a3b8] italic">No benchmark answer available</span>}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action Bar - Only show if not in editing mode */}
          {!isEditing && (
            <div className="flex flex-col gap-3 pt-4 border-t border-[#dbeafe]">
              {/* Report Signed Warning */}
              {isReportSigned && (
                <div className="p-4 bg-[#f0f9ff] border border-[#3b82f6] rounded-lg">
                  <div className="flex items-start gap-3">
                    <FileCheck className="w-5 h-5 text-[#3b82f6] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-[#1e40af] font-medium mb-1">
                        Report Signed Off
                      </p>
                      <p className="text-xs text-[#1e40af]">
                        This validation report has been signed off and locked. AI features and updates are disabled to maintain report integrity.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* No AI Credits Warning */}
              {!aiCreditsAvailable && !isReportSigned && (
                <div className="p-4 bg-[#fef2f2] border border-[#ef4444] rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-[#ef4444] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-[#991b1b] font-medium mb-1">
                        No AI Credits Available
                      </p>
                      <p className="text-xs text-[#7f1d1d]">
                        Your organization has run out of AI credits. AI features are currently disabled. Please purchase additional AI credits.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-3">
                <GlowButton 
                  variant="primary" 
                  size="sm" 
                  onClick={() => onChatClick(result)} 
                  disabled={isReportSigned || !aiCreditsAvailable}
                  title={isReportSigned ? "Report is signed off - no updates allowed" : !aiCreditsAvailable ? "No AI credits available" : ""}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Chat with AI
                </GlowButton>
                <GlowButton 
                  variant="secondary" 
                  size="sm" 
                  onClick={handleEditClick} 
                  disabled={isReportSigned || !aiCreditsAvailable}
                  title={isReportSigned ? "Report is signed off - no updates allowed" : !aiCreditsAvailable ? "No AI credits available" : ""}
                >
                  Edit Question
                </GlowButton>
                <GlowButton 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => setShowRevalidateDialog(true)}
                  disabled={isRevalidating || isReportSigned || !aiCreditsAvailable}
                  title={isReportSigned ? "Report is signed off - no updates allowed" : !aiCreditsAvailable ? "No AI credits available" : ""}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isRevalidating ? 'animate-spin' : ''}`} />
                  Revalidate
                </GlowButton>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Revalidation Confirmation Dialog */}
      <AlertDialog open={showRevalidateDialog} onOpenChange={setShowRevalidateDialog}>
        <AlertDialogContent className="max-w-md bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-[#ef4444]">
              <AlertTriangle className="w-5 h-5" />
              Confirm Revalidation
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to revalidate {getRequirementNumber()}. This action will replace all existing content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4">
            <div className="bg-[#fef2f2] border-l-4 border-[#ef4444] p-3 rounded">
              <p className="text-sm text-[#991b1b]">
                <strong>Warning:</strong> This will replace all existing content for this requirement, including:
              </p>
              <ul className="text-sm text-[#991b1b] mt-2 space-y-1 ml-4 list-disc">
                <li>Status and reasoning</li>
                <li>Evidence mapping</li>
                <li>SMART question</li>
                <li>Benchmark answer</li>
                <li>AI recommendations</li>
              </ul>
            </div>

            <p className="text-sm text-[#64748b]">
              The validation will be re-run against the current documents and all AI-generated content will be regenerated.
            </p>

            <div>
              <label className="text-sm text-[#1e293b] mb-2 block">
                Type <span className="font-poppins text-[#3b82f6]">confirm</span> to proceed:
              </label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type confirm here..."
                className="border-[#3b82f6] focus:border-[#3b82f6]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && confirmText.toLowerCase() === 'confirm') {
                    handleRevalidate();
                  }
                }}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setConfirmText('');
                setShowRevalidateDialog(false);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevalidate}
              disabled={confirmText.toLowerCase() !== 'confirm'}
              className="bg-[#ef4444] hover:bg-[#dc2626] text-white disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Revalidate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
