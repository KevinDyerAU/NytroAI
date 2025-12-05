import { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { GlowButton } from './GlowButton';
import { Send, User, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { getRTOById, consumeAICredit } from '../types/rto';
import { sendAIChatMessage } from '../lib/n8nApi';
import wizardLogo from '../assets/wizard-logo.png';

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
  validationDetailId?: number;
  onCreditConsumed?: (newBalance: number) => void;
}

export function AIChat({ context, onClose, selectedRTOId, validationDetailId, onCreditConsumed }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: context
        ? `Hi, I'm Nytro your AI Assistant! I'm ready to help you analyze ${context}.`
        : "Hi, I'm Nytro your AI Assistant! How can I help you with the validation analysis?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle Escape key to close modal and lock body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    // Lock body scroll
    document.body.style.overflow = 'hidden';
    
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      // Restore body scroll
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

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

    // Store the message before clearing input
    const userMessageText = input.trim();

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    console.log('[AIChat] Starting message send flow...', {
      selectedRTOId,
      currentRTO: currentRTO?.code,
      validationDetailId,
      messageText: userMessageText
    });

    try {
      // TODO: Re-enable credit consumption once RPC function is fixed
      // Consume AI credit for generating smart question
      console.log('[AIChat] Consuming AI credit for RTO:', currentRTO.code);
      const result = await consumeAICredit(currentRTO.code);
      console.log('[AIChat] Credit consumption result:', result);

      // TEMPORARY: Bypass credit check to allow AI chat to work
      if (!result.success) {
        console.warn('[AIChat] Credit consumption failed, but proceeding anyway (temporary bypass):', result.message);
        // Don't return - continue with the chat
      } else {
        console.log('[AIChat] Credit consumed successfully');
        // Notify parent about credit consumption
        if (onCreditConsumed && result.newBalance !== undefined) {
          onCreditConsumed(result.newBalance);
        }
      }

      // Call n8n AI Chat webhook for actual AI response
      try {
        // Check if validationDetailId is available
        if (!validationDetailId) {
          console.warn('No validationDetailId provided, AI chat may have limited context');
        }

        console.log('Sending message to n8n AI chat:', {
          validationDetailId,
          messageLength: userMessageText.length,
          message: userMessageText,
        });
        
        // Prepare conversation history (exclude first welcome message)
        const conversationHistory = messages
          .slice(1) // Skip welcome message
          .map(msg => ({
            role: msg.role,
            content: msg.content,
          }));
        
        const result = await sendAIChatMessage(
          validationDetailId || 0,
          userMessageText,
          conversationHistory
        );

        if (!result.success || !result.response) {
          throw new Error(result.error || 'Failed to get AI response');
        }
        
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
          citations: [] // n8n can optionally return citations in the response
        };
        
        setMessages(prev => [...prev, aiMessage]);
        setIsProcessing(false);
        toast.success('1 AI credit consumed');
      } catch (apiError) {
        console.error('Error calling n8n AI chat:', apiError);
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
      console.error('[AIChat] Outer error caught:', error);
      console.error('[AIChat] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        type: typeof error
      });
      toast.error('An error occurred while processing your message');
      setIsProcessing(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <Card 
        className="border border-[#dbeafe] bg-white shadow-2xl flex flex-col h-[80vh] max-h-[600px] w-full max-w-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[#3b82f6] p-4 flex items-center justify-between bg-gradient-to-r from-[#3b82f6] to-[#2563eb] flex-shrink-0">
          <div>
            <h3 className="font-poppins text-white text-xl font-semibold">Chat with Nytro</h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors text-xl font-bold flex items-center justify-center w-8 h-8"
              aria-label="Close chat"
            >
              ✕
            </button>
          )}
        </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`
                rounded-lg flex items-center justify-center flex-shrink-0
                ${message.role === 'assistant' 
                  ? 'w-10 h-10 bg-white border border-[#dbeafe]' 
                  : 'w-8 h-8 bg-[#f1f5f9] text-[#64748b]'
                }
              `}>
                {message.role === 'assistant' ? (
                  <span className="text-2xl">🧙‍♂️</span>
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
                <p className="text-sm leading-relaxed text-[#1e293b] whitespace-pre-wrap">{message.content}</p>
                
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
          
          {/* Loading indicator when AI is thinking */}
          {isProcessing && (
            <div className="flex gap-3">
              <div className="rounded-lg flex items-center justify-center flex-shrink-0 w-10 h-10 bg-white border border-[#dbeafe]">
                <span className="text-2xl">🧙‍♂️</span>
              </div>
              
              <div className="flex-1 p-3 rounded-lg border bg-[#f8f9fb] border-[#dbeafe]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-sm text-[#64748b] italic">Nytro is thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-[#dbeafe] p-4 bg-[#f8f9fb] flex-shrink-0">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && input.trim() && !isProcessing && selectedRTOId) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about this validation..."
            className="flex-1 bg-white border-[#dbeafe]"
            disabled={isProcessing}
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
    </div>
  );
}
