import { useState } from 'react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { GlowButton } from './GlowButton';
import { Send, Bot, User, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { getRTOById, consumeAICredit } from '../types/rto';

interface Citation {
  type: 'file' | 'web' | 'unknown';
  // File citations
  documentName?: string;
  displayName?: string;
  pageNumbers?: number[];
  chunkText?: string;
  // Web citations
  source?: string;
  title?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: Citation[];
}

interface AIChatProps {
  context?: string;
  onClose?: () => void;
  selectedRTOId?: string;
  onCreditConsumed?: (newBalance: number) => void;
}

export function AIChat({ context, onClose, selectedRTOId, onCreditConsumed }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: context
        ? `I'm your AI assistant. I'm ready to help you analyze ${context}.`
        : "I'm your AI assistant. How can I help you with the validation analysis?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    // Check if RTO is selected
    if (!selectedRTOId) {
      toast.error('RTO not selected');
      return;
    }

    const currentRTO = getRTOById(selectedRTOId);
    if (!currentRTO?.code) {
      toast.error('RTO not found');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      // Consume AI credit for generating smart question
      const result = await consumeAICredit(currentRTO.code);

      if (!result.success) {
        toast.error(result.message || 'Insufficient AI credits');
        setIsProcessing(false);
        return;
      }

      // Notify parent about credit consumption
      if (onCreditConsumed && result.newBalance !== undefined) {
        onCreditConsumed(result.newBalance);
      }

      // Call the query-document Edge Function for actual AI response
      try {
        const requestBody = {
          query: input,
          rtoCode: currentRTO.code,
        };
        
        console.log('Sending request to query-document:', requestBody);
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/query-document`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify(requestBody),
          }
        );

        let data;
        try {
          // Clone the response to safely read the body without stream conflicts
          try {
            data = await response.clone().json();
          } catch (cloneError) {
            // Fallback: if cloning fails, try reading directly
            console.warn('Clone json() failed, attempting direct read:', cloneError);
            data = await response.json();
          }
        } catch (jsonError) {
          console.error('Failed to parse response:', jsonError);
          throw new Error(`Failed to parse API response: ${jsonError.message}`);
        }

        if (!response.ok) {
          let errorMessage = 'Unknown error';
          try {
            errorMessage = data.error || data.message || 'API request failed';
          } catch {
            errorMessage = 'API request failed';
          }

          console.error('Edge Function error response:', {
            status: response.status,
            statusText: response.statusText,
            body: data
          });

          throw new Error(`API request failed (${response.status}): ${errorMessage}`);
        }
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.answer || data.response || 'I apologize, but I could not generate a response at this time.',
          timestamp: new Date(),
          citations: data.citations || []
        };
        
        setMessages(prev => [...prev, aiMessage]);
        setIsProcessing(false);
        toast.success('1 AI credit consumed');
      } catch (apiError) {
        console.error('Error calling AI API:', apiError);
        console.error('Full error details:', {
          message: apiError instanceof Error ? apiError.message : String(apiError),
          stack: apiError instanceof Error ? apiError.stack : undefined
        });
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'I apologize, but I encountered an error processing your request. Please try again.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        setIsProcessing(false);
        toast.error('Failed to get AI response');
      }
    } catch (error) {
      console.error('Error sending message:', error instanceof Error ? error.message : JSON.stringify(error));
      toast.error('An error occurred while processing your message');
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border border-[#dbeafe] bg-white shadow-medium flex flex-col h-[600px]">
      {/* Header */}
      <div className="border-b border-[#dbeafe] p-4 flex items-center justify-between bg-gradient-blue">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/20 border border-white/30 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-poppins text-white">AI Assistant</h3>
            <p className="text-xs text-white/80">Intelligent Analysis Co-Pilot</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-white hover:bg-white/10 rounded p-1 transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`
                w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0
                ${message.role === 'assistant' 
                  ? 'bg-[#dbeafe] text-[#3b82f6]' 
                  : 'bg-[#f1f5f9] text-[#64748b]'
                }
              `}>
                {message.role === 'assistant' ? (
                  <Bot className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
              
              <div className={`
                flex-1 p-3 rounded-lg border
                ${message.role === 'assistant'
                  ? 'bg-[#f8f9fb] border-[#dbeafe]'
                  : 'bg-[#dbeafe] border-[#93c5fd]'
                }
              `}>
                <p className="text-sm leading-relaxed text-[#1e293b]">{message.content}</p>
                
                {/* Citations */}
                {message.citations && message.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#dbeafe]">
                    <p className="text-xs font-medium text-[#64748b] mb-2">Sources:</p>
                    <div className="space-y-1">
                      {message.citations.map((citation, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs">
                          <FileText className="w-3 h-3 text-[#3b82f6] mt-0.5 flex-shrink-0" />
                          {citation.type === 'file' && citation.displayName && (
                            <div className="text-[#64748b]">
                              <span className="font-medium text-[#1e293b]">{citation.displayName}</span>
                              {citation.pageNumbers && citation.pageNumbers.length > 0 && (
                                <span className="text-[#3b82f6] ml-1">
                                  (Pages: {citation.pageNumbers.join(', ')})
                                </span>
                              )}
                            </div>
                          )}
                          {citation.type === 'web' && citation.title && (
                            <a
                              href={citation.source}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#3b82f6] hover:underline"
                            >
                              {citation.title}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <span className="text-xs text-[#64748b] mt-2 block">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-[#dbeafe] p-4 bg-[#f8f9fb]">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about this validation..."
            className="flex-1 bg-white border-[#dbeafe]"
          />
          <GlowButton
            onClick={handleSend}
            variant="primary"
            size="icon"
            disabled={!input.trim() || isProcessing || !selectedRTOId}
          >
            <Send className="w-4 h-4" />
          </GlowButton>
        </div>
      </div>
    </Card>
  );
}
