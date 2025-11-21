import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Sparkles, FileText, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SmartQuestionGeneratorProps {
  rtoId: number;
  unitId: number;
  documentId?: number;
  requirementId?: number;
  onQuestionsGenerated?: (questions: any[]) => void;
}

export function SmartQuestionGenerator({
  rtoId,
  unitId,
  documentId,
  requirementId,
  onQuestionsGenerated,
}: SmartQuestionGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [questionCount, setQuestionCount] = useState(5);
  const [requirementType, setRequirementType] = useState('knowledge_evidence');
  const [requirementText, setRequirementText] = useState('');
  const [userContext, setUserContext] = useState('');
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [hasDocument, setHasDocument] = useState(!!documentId);

  const handleGenerate = async () => {
    if (!rtoId || !unitId) {
      toast.error('RTO and Unit are required');
      return;
    }

    setIsGenerating(true);
    setGeneratedQuestions([]);

    try {
      // Call Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-smart-questions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            rtoId,
            unitId,
            documentId,
            requirementId,
            requirementType,
            requirementText,
            questionCount,
            userContext,
          }),
        }
      );

      let result;
      try {
        // Clone the response to safely read the body without stream conflicts
        try {
          result = await response.clone().json();
        } catch (cloneError) {
          // Fallback: if cloning fails, try reading directly
          console.warn('Clone json() failed, attempting direct read:', cloneError);
          result = await response.json();
        }
      } catch (jsonError) {
        console.error('Failed to parse questions response:', jsonError);
        throw new Error(`Failed to parse questions response: ${jsonError.message}`);
      }

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate questions');
      }

      if (result.success) {
        setGeneratedQuestions(result.questions);
        toast.success(result.message);
        
        if (onQuestionsGenerated) {
          onQuestionsGenerated(result.questions);
        }
      } else {
        throw new Error(result.error || 'Failed to generate questions');
      }
    } catch (error: any) {
      console.error('Error generating questions:', error);
      toast.error(error.message || 'Failed to generate questions');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="text-lg font-semibold">SMART Question Generator</h3>
        </div>

        {documentId && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
            <FileText className="w-5 h-5 text-blue-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">Document Context Available</p>
              <p className="text-xs text-blue-700 mt-1">
                Questions will be generated using the uploaded assessment document as context
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="questionCount">Number of Questions</Label>
              <Input
                id="questionCount"
                type="number"
                min="1"
                max="20"
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value) || 5)}
                placeholder="5"
              />
            </div>

            <div>
              <Label htmlFor="requirementType">Requirement Type</Label>
              <Select value={requirementType} onValueChange={setRequirementType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="knowledge_evidence">Knowledge Evidence</SelectItem>
                  <SelectItem value="performance_evidence">Performance Evidence</SelectItem>
                  <SelectItem value="foundation_skills">Foundation Skills</SelectItem>
                  <SelectItem value="elements_criteria">Elements & Criteria</SelectItem>
                  <SelectItem value="assessment_conditions">Assessment Conditions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="requirementText">Specific Requirement (Optional)</Label>
            <Textarea
              id="requirementText"
              value={requirementText}
              onChange={(e) => setRequirementText(e.target.value)}
              placeholder="Enter specific requirement text to focus question generation..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="userContext">Additional Context (Optional)</Label>
            <Textarea
              id="userContext"
              value={userContext}
              onChange={(e) => setUserContext(e.target.value)}
              placeholder="Provide additional context, scenarios, or specific areas to focus on..."
              rows={3}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Questions...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate SMART Questions
              </>
            )}
          </Button>
        </div>
      </Card>

      {generatedQuestions.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <h3 className="text-lg font-semibold">Generated Questions ({generatedQuestions.length})</h3>
          </div>

          <div className="space-y-6">
            {generatedQuestions.map((q, index) => (
              <div key={q.id || index} className="border-b pb-6 last:border-b-0 last:pb-0">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                        {q.question_type || 'knowledge'}
                      </span>
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                        {q.difficulty_level || 'intermediate'}
                      </span>
                      {q.assessment_category && (
                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded">
                          {q.assessment_category}
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-gray-900 mb-2">{q.question}</p>
                    
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Benchmark Answer:</p>
                      <p className="text-sm text-gray-600">{q.benchmark_answer}</p>
                    </div>

                    {q.doc_references && (
                      <div className="mt-2 flex items-start gap-2">
                        <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                        <p className="text-xs text-gray-500">
                          <span className="font-medium">Document Reference:</span> {q.doc_references}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
