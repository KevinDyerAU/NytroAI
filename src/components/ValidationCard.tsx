import React, { useState } from 'react';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { GlowButton } from './GlowButton';
import { 
  Sparkles, Edit, Save, X, RotateCcw, MessageCircle, FileText, AlertCircle,
  ChevronDown, ChevronUp, MessageSquare, Lightbulb, RefreshCw, AlertTriangle, FileCheck
} from 'lucide-react';
import { getRTOById, consumeAICredit } from '../types/rto';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './ui/alert-dialog';
import { ResultStatusBadge as StatusBadge } from './ResultStatusBadge';
import { toast } from 'sonner';
import wizardLogo from '../assets/wizard-logo.png';

interface ValidationResult {
  id: string;
  validation_detail_id?: number;
  requirement_number: string;
  requirement_type: string;
  requirement_text: string;
  status: 'met' | 'not-met' | 'partial';
  reasoning: string;
  recommendations?: string; // AI-generated recommendations for addressing gaps
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
  onCreditConsumed?: (newBalance: number) => void;
}

export function ValidationCard({ result, onChatClick, isReportSigned = false, aiCreditsAvailable = true, validationContext, onCreditConsumed }: ValidationCardProps) {
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
  
  // Check if this requirement type should show smart questions/benchmark answers
  const shouldShowSmartQuestions = () => {
    const reqType = getRequirementType().toLowerCase();
    return !reqType.includes('assessment_conditions') && 
           !reqType.includes('assessment conditions') &&
           !reqType.includes('assessment_instructions') &&
           !reqType.includes('assessment instructions');
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
  const [showGeneratingModal, setShowGeneratingModal] = useState(false);

  /**
   * Generate improved SMART questions using AI with comprehensive context
   * Includes: current requirement, validation status, evidence, and user feedback
   */
  const handleGenerateWithAI = async () => {
    setIsGenerating(true);
    setShowGeneratingModal(true);
    
    try {
      // Import regenerateQuestions from n8nApi
      const { regenerateQuestions } = await import('../lib/n8nApi');
      
      // Gather all context for n8n
      const requirementText = getRequirementText();
      const existingSmartQuestion = result.smart_questions;
      
      // Call n8n via edge function proxy with full context
      const validationDetailId: number = result.validation_detail_id || 0;
      const validationResultId: number = parseInt(result.id, 10);
      
      if (!validationDetailId) {
        throw new Error('validation_detail_id not found');
      }
      
      const response = await regenerateQuestions(
        validationDetailId,
        validationResultId,
        aiContext,
        requirementText,
        existingSmartQuestion
      );
      
      console.log('[ValidationCard] Full regenerate response:', JSON.stringify(response, null, 2));
      console.log('[ValidationCard] Questions array:', response.questions);
      console.log('[ValidationCard] Questions length:', response.questions?.length);
      
      // New response structure: { validation_detail_id, questions: [...], summary, response_timestamp }
      if (!response.questions || !Array.isArray(response.questions) || response.questions.length === 0) {
        console.error('[ValidationCard] No questions in response:', response);
        throw new Error('No questions generated. Check n8n workflow output.');
      }
      
      // Extract the first generated question (n8n returns array)
      const generated = response.questions[0];
      console.log('[ValidationCard] First question:', generated);
      
      if (!generated.question) {
        console.error('[ValidationCard] Question object missing "question" field:', generated);
        throw new Error('Invalid question format received from n8n');
      }
      
      // Update the edited fields with the AI-generated content
      setEditedQuestion(generated.question);
      setEditedAnswer(generated.rationale || 'No rationale provided');
      
      // Consume AI credit
      if (validationContext?.rtoId) {
        const currentRTO = getRTOById(validationContext.rtoId);
        if (currentRTO?.code) {
          console.log('[ValidationCard] Consuming AI credit for smart question generation');
          const creditResult = await consumeAICredit(currentRTO.code);
          if (creditResult.success && onCreditConsumed && creditResult.newBalance !== undefined) {
            onCreditConsumed(creditResult.newBalance);
          }
        }
      }
      
      setShowGeneratingModal(false);
      toast.success('✨ Smart question generated! Review and click Save to keep it.', { 
        duration: 4000
      });
    } catch (error) {
      console.error('Error generating with AI:', error);
      setShowGeneratingModal(false);
      toast.error('Failed to generate with AI. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    try {
      toast.loading('Saving changes...', { id: 'save-question' });
      
      // Import supabase client
      const { supabase } = await import('../lib/supabase');
      
      console.log('[ValidationCard] Updating validation_results, id:', result.id);
      
      // Simple UPDATE - record should already exist
      const { error } = await supabase
        .from('validation_results')
        .update({
          smart_questions: editedQuestion,
          benchmark_answer: editedAnswer,
          citations: generatedCitations.length > 0 ? JSON.stringify(generatedCitations) : result.citations
        })
        .eq('id', result.id);
      
      if (error) {
        console.error('[ValidationCard] Save error:', error);
        throw error;
      }
      
      console.log('[ValidationCard] Saved successfully');
      
      // Update local state
      result.smart_questions = editedQuestion;
      result.benchmark_answer = editedAnswer;
      if (generatedCitations.length > 0) {
        result.citations = JSON.stringify(generatedCitations);
      }
      
      setIsEditing(false);
      setAiContext('');
      
      toast.success('Changes saved successfully', { id: 'save-question' });
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Failed to save changes. Please try again.', { id: 'save-question' });
    }
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

    toast.loading('🤔 Nytro is thinking... Revalidating requirement', { id: 'revalidate' });
    
    try {
      // Import revalidateRequirement from n8nApi
      const { revalidateRequirement } = await import('../lib/n8nApi');
      
      // Send the complete validation result object to n8n
      const response = await revalidateRequirement(result);
      
      if (response.success) {
        // Consume AI credit
        if (validationContext?.rtoId) {
          const currentRTO = getRTOById(validationContext.rtoId);
          if (currentRTO?.code) {
            console.log('[ValidationCard] Consuming AI credit for revalidation');
            const creditResult = await consumeAICredit(currentRTO.code);
            if (creditResult.success && onCreditConsumed && creditResult.newBalance !== undefined) {
              onCreditConsumed(creditResult.newBalance);
            }
          }
        }
        
        toast.success(`✅ Revalidation started! Updated results will appear in the table once complete.`, { 
          id: 'revalidate',
          duration: 5000
        });
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
                {getRequirementType().split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
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
              
              {result.recommendations && (
                <div className="pt-3 border-t border-[#dbeafe]">
                  <p className="text-sm font-medium text-[#64748b] mb-2 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-[#f59e0b]" />
                    Recommendations:
                  </p>
                  <div className="bg-[#fffbeb] border border-[#fcd34d] rounded-lg p-3">
                    <p className="text-sm leading-relaxed text-[#92400e] whitespace-pre-wrap">{result.recommendations}</p>
                  </div>
                </div>
              )}
              
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

          {/* AI Enhancement Section - Only show for non-assessment conditions/instructions */}
          {shouldShowSmartQuestions() && (
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
                        disabled={isGenerating || !aiCreditsAvailable}
                        title={!aiCreditsAvailable ? "No AI credits available" : "Provide context to help AI generate better questions"}
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
          )}

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

      {/* AI Generation Loading Modal */}
      <AlertDialog open={showGeneratingModal} onOpenChange={setShowGeneratingModal}>
        <AlertDialogContent className="max-w-md bg-white">
          <div className="flex flex-col items-center justify-center py-8 px-4">
            {/* Wizard logo from nav pane */}
            <div className="mb-6 w-32">
              <img
                src={wizardLogo}
                alt="Nytro Wizard"
                className="w-full h-auto object-contain"
              />
            </div>
            
            <h3 className="font-poppins text-lg font-semibold text-[#1e293b] mb-3">
              Nytro is thinking...
            </h3>
            
            {/* Bouncing dots like AI chat */}
            <div className="flex items-center gap-2 mb-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
            
            <p className="text-sm text-[#64748b] text-center">
              Generating a smart question for this requirement
            </p>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
