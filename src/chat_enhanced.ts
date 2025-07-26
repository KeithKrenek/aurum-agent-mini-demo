import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import OpenAI from 'openai';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileText, Wifi, WifiOff } from 'lucide-react';
import { ProgressManager } from './ProgressManager';
import { Interview, Message, PhaseId, isValidPhase } from './types/interview';
import MessageInput from './MessageInput';
import MessageBubble from './MessageBubble';
import PhaseProgress from './PhaseProgress';
import { config } from './config/environment';
import { PREDEFINED_QUESTIONS, MOCK_ANSWERS, QUESTION_SIGNATURES_FLAT, getDemoAnswerForQuestion } from './types/constants';
import { ProcessingStage, processingMessages } from './types/constants';
import { generatePDF } from './pdfGenerator';

// Enhanced error types
class ChatError extends Error {
  constructor(
    message: string, 
    public type: 'network' | 'api' | 'validation' | 'timeout' | 'ratelimit' = 'api',
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'ChatError';
  }
}

// Request cancellation controller
class RequestController {
  private controllers: Map<string, AbortController> = new Map();
  
  create(id: string): AbortController {
    this.cancel(id); // Cancel existing if any
    const controller = new AbortController();
    this.controllers.set(id, controller);
    return controller;
  }
  
  cancel(id: string) {
    const controller = this.controllers.get(id);
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }
    this.controllers.delete(id);
  }
  
  cancelAll() {
    this.controllers.forEach(controller => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    });
    this.controllers.clear();
  }
}

// Input sanitization utility
const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Basic XSS prevention
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, 5000); // Hard limit
};

// Enhanced substantiveness check
const isSubstantive = (content: string, questionIndex: number): boolean => {
  const trimmed = content.trim();
  if (trimmed.length < 20) return false;

  const allMockAnswers = [
    ...MOCK_ANSWERS.discovery,
    ...MOCK_ANSWERS.messaging,
    ...MOCK_ANSWERS.audience
  ];

  if (allMockAnswers.includes(trimmed as typeof allMockAnswers[number])) {
    return trimmed === allMockAnswers[questionIndex];
  }

  return true;
};

// Online status hook
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

// Memoized progress calculation
const useProgressCalculation = (messageHistory: Message[]) => {
  return useMemo(() => {
    let answeredCount = 0;
    const answeredQuestionIndices = new Set<number>();

    for (let i = 0; i < messageHistory.length - 1; i++) {
      const currentMessage = messageHistory[i];
      if (currentMessage.role !== 'assistant') continue;

      const messageContent = currentMessage.content.toLowerCase();
      let questionIndexFound = -1;

      for (let qIndex = 0; qIndex < PREDEFINED_QUESTIONS.length; qIndex++) {
        if (answeredQuestionIndices.has(qIndex)) continue;

        const questionSignatures = QUESTION_SIGNATURES_FLAT[qIndex];
        for (const signature of questionSignatures) {
          if (messageContent.includes(signature.toLowerCase())) {
            questionIndexFound = qIndex;
            break;
          }
        }

        if (questionIndexFound !== -1) {
          const nextMessage = messageHistory[i + 1];
          if (nextMessage && nextMessage.role === 'user' && isSubstantive(nextMessage.content, questionIndexFound)) {
            answeredCount++;
            answeredQuestionIndices.add(questionIndexFound);
          }
          break;
        }
      }
    }

    return {
      answeredCount,
      nextQuestionIndex: answeredCount
    };
  }, [messageHistory]);
};

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<PhaseId>('discovery');
  const [questionCount, setQuestionCount] = useState(0);
  const [reports, setReports] = useState<Interview['reports']>({});
  const [threadId, setThreadId] = useState<string | null>(null);
  const [suggestedAnswer, setSuggestedAnswer] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('sending');
  const [actualQuestionIndex, setActualQuestionIndex] = useState(0);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const messageListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const progressManager = useRef<ProgressManager | null>(null);
  const requestController = useRef(new RequestController());
  const autoSaveInterval = useRef<NodeJS.Timeout | null>(null);
  const lastSaveTime = useRef<number>(0);
  
  const navigate = useNavigate();
  const { interviewId: urlInterviewId } = useParams<{ interviewId: string }>();
  const isOnline = useOnlineStatus();
  
  const interviewId = urlInterviewId || sessionStorage.getItem('interviewId');

  // Memoized OpenAI client with error handling
  const openai = useMemo(() => {
    try {
      return new OpenAI({
        apiKey: config.openai.apiKey,
        dangerouslyAllowBrowser: true
      });
    } catch (error) {
      console.error('Failed to initialize OpenAI client:', error);
      throw new ChatError('Failed to initialize AI service', 'api', false);
    }
  }, []);

  // Enhanced progress calculation
  const { answeredCount, nextQuestionIndex } = useProgressCalculation(messages);

  // Auto-save mechanism
  const saveProgress = useCallback(async (force = false) => {
    if (!interviewId || (!force && Date.now() - lastSaveTime.current < 10000)) return;

    try {
      await updateDoc(doc(db, 'interviews', interviewId), {
        messages,
        questionCount: answeredCount,
        actualQuestionIndex: nextQuestionIndex,
        currentPhase,
        lastUpdated: new Date()
      });
      lastSaveTime.current = Date.now();
    } catch (error) {
      console.warn('Auto-save failed:', error);
    }
  }, [interviewId, messages, answeredCount, nextQuestionIndex, currentPhase]);

  // Setup auto-save interval
  useEffect(() => {
    if (autoSaveInterval.current) {
      clearInterval(autoSaveInterval.current);
    }

    autoSaveInterval.current = setInterval(() => {
      saveProgress();
    }, 30000); // Save every 30 seconds

    return () => {
      if (autoSaveInterval.current) {
        clearInterval(autoSaveInterval.current);
      }
    };
  }, [saveProgress]);

  // Enhanced scroll behavior
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    requestAnimationFrame(() => {
      if (messageListRef.current) {
        messageListRef.current.scrollTo({
          top: messageListRef.current.scrollHeight,
          behavior,
        });
      }
    });
  }, []);

  // Update question count when progress changes
  useEffect(() => {
    if (answeredCount !== questionCount) {
      setQuestionCount(answeredCount);
      setActualQuestionIndex(nextQuestionIndex);
    }
  }, [answeredCount, nextQuestionIndex, questionCount]);

  // Enhanced suggestion finding
  const findAndSetSuggestedAnswer = useCallback((assistantContent: string, phase: PhaseId, currentQuestionIndex: number) => {
    if (phase === 'complete') {
      setSuggestedAnswer(null);
      return;
    }
    
    const demoAnswer = getDemoAnswerForQuestion(assistantContent, phase, currentQuestionIndex);
    setSuggestedAnswer(demoAnswer);
  }, []);

  // Enhanced PDF download with error handling
  const downloadReport = useCallback(async (reportType: 'discovery' | 'messaging' | 'audience' | 'complete') => {
    if (!reports[reportType]) {
      toast.error('Report not available');
      return;
    }
    
    try {
      const brandName = sessionStorage.getItem('brandName') || 'Brand';
      const phaseNames = {
        discovery: 'Discovery',
        messaging: 'Messaging', 
        audience: 'Audience',
        complete: 'Complete Brand Analysis'
      };
      
      await generatePDF({
        brandName,
        reportParts: [reports[reportType]!],
        phaseName: phaseNames[reportType]
      });
      
      toast.success('Report downloaded successfully!');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download report. Please try again.');
    }
  }, [reports]);

  // Enhanced run completion with better timeout handling
  const waitForRunCompletion = useCallback(async (threadId: string, runId: string, maxAttempts = 60) => {
    const controller = requestController.current.create(`run-${runId}`);
    let attempts = 0;
    
    while (attempts < maxAttempts && !controller.signal.aborted) {
      try {
        const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
        
        if (runStatus.status === 'completed') {
          requestController.current.cancel(`run-${runId}`);
          return true;
        }
        
        if (runStatus.status === 'failed' || runStatus.status === 'cancelled') {
          throw new ChatError(`Run ${runStatus.status}: ${runStatus.last_error?.message || 'Unknown error'}`, 'api');
        }
        
        // Progressive timeout increase
        const waitTime = Math.min(1000 + (attempts * 100), 3000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        attempts++;
        
        // Update processing stage for long operations
        if (attempts > 20 && attempts % 10 === 0) {
          setProcessingStage('thinking');
        }
        
      } catch (error) {
        if (controller.signal.aborted) {
          throw new ChatError('Request cancelled', 'api', true);
        }
        
        if (attempts >= maxAttempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
    }
    
    if (controller.signal.aborted) {
      throw new ChatError('Request cancelled', 'api', true);
    }
    
    throw new ChatError('Request timed out after extended wait', 'timeout');
  }, [openai]);

  // Enhanced active run management
  const ensureNoActiveRuns = useCallback(async (threadId: string) => {
    try {
      const runs = await openai.beta.threads.runs.list(threadId);
      const activeRuns = runs.data.filter(run => 
        ['in_progress', 'queued', 'cancelling'].includes(run.status)
      );
      
      for (const run of activeRuns) {
        try {
          await openai.beta.threads.runs.cancel(threadId, run.id);
        } catch (error) {
          console.warn(`Failed to cancel run ${run.id}:`, error);
        }
      }
      
      if (activeRuns.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.warn('Error managing active runs:', error);
    }
  }, [openai]);

  // Enhanced report parsing with better error handling
  const parseAssistantResponse = useCallback((response: string) => {
    try {
      const reportRegex = /```markdown\s*([\s\S]*?)\s*```/g;
      let reportContents: string[] = [];
      let match;
      let remainingContent = response;

      while ((match = reportRegex.exec(response)) !== null) {
        const reportContent = match[1].trim();
        if (reportContent.includes('#')) {
          reportContents.push(reportContent);
          remainingContent = remainingContent.replace(match[0], '').trim();
        }
      }

      // Enhanced link processing with error handling
      const courseRegex = /Brand Alchemy Mastery course|course/gi;
      const linkedContent = remainingContent.replace(courseRegex, 
        match => `<a href="https://dfl0.us/s/ab4d2c7a?em=%7B%7Bcontact.email%7D%7D" target="_blank" class="text-dark-midnight hover:text-goldenrod underline">${match}</a>`
      );

      return {
        reportContents,
        remainingContent: linkedContent
      };
    } catch (error) {
      console.error('Error parsing assistant response:', error);
      return {
        reportContents: [],
        remainingContent: response
      };
    }
  }, []);

  // Enhanced download link component generator
  const createDownloadLinkComponent = useCallback((reportType: 'discovery' | 'messaging' | 'audience' | 'complete'): string => {
    const reportNames = {
      discovery: 'Brand Elements Discovery',
      messaging: 'Brand Voice Analysis', 
      audience: 'Brand Audience Alignment Analysis',
      complete: 'Complete Brand Transformation'
    };
    
    return `<div class="my-4 p-4 bg-gradient-to-r from-desert-sand/10 to-champagne/10 border border-desert-sand/30 rounded-lg">
      <div class="flex items-center gap-3 mb-3">
        <div class="flex-shrink-0 p-2 bg-desert-sand/20 rounded-full">
          <svg class="w-5 h-5 text-goldenrod" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
        </div>
        <div>
          <h4 class="font-semibold text-dark-gray text-sm">${reportNames[reportType]} Report Ready!</h4>
          <p class="text-xs text-neutral-gray">Your personalized insights and recommendations</p>
        </div>
      </div>
      <button 
        onclick="window.downloadReport('${reportType}')" 
        class="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-desert-sand to-champagne hover:from-champagne hover:to-goldenrod text-dark-gray font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md group"
      >
        <svg class="w-4 h-4 transition-transform group-hover:translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-4-4m4 4l4-4m6 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6"/>
        </svg>
        Download ${reportNames[reportType]} Report
      </button>
      <p class="text-xs text-neutral-gray mt-2"><strong>Tip:</strong> Expand the progress ribbon above to access all reports</p>
    </div>`;
  }, []);

  // Enhanced assistant response processing
  const processAssistantResponse = useCallback(async (threadId: string, attemptNumber = 1) => {
    const MAX_RETRIES = 3;
    
    try {
      const messages = await openai.beta.threads.messages.list(threadId);
      if (!messages?.data?.length) {
        throw new ChatError('No messages received from OpenAI', 'api');
      }

      const lastMessage = messages.data[0];
      if (lastMessage.role === 'assistant' && lastMessage.content[0].type === 'text') {
        let rawContent = lastMessage.content[0].text.value;
        let cleanedContent = rawContent;
        
        const phaseMarkerRegex = /===PHASE_COMPLETE:(discovery|messaging|audience)===/i;
        const phaseMarkerMatch = rawContent.match(phaseMarkerRegex);
        let markedPhaseCompletion = phaseMarkerMatch ? phaseMarkerMatch[1].toLowerCase() : null;
        
        // Validate phase completion
        if (markedPhaseCompletion) {
          const requiredQuestions = { discovery: 3, messaging: 6, audience: 9 };
          const requiredCount = requiredQuestions[markedPhaseCompletion as keyof typeof requiredQuestions];

          if (questionCount < requiredCount) {
            console.warn(`Premature phase completion detected for ${markedPhaseCompletion}`);
            cleanedContent = rawContent.replace(phaseMarkerRegex, '').trim();
            markedPhaseCompletion = null;
          }
        }
        
        const { reportContents, remainingContent } = parseAssistantResponse(cleanedContent);

        let phaseUpdated = false;
        let newPhase: PhaseId | null = null;
        let processedReportType: string | null = null;
        
        if (reportContents.length > 0) {
          setIsGeneratingReport(true);
        }
        
        // Process reports with enhanced error handling
        for (const reportContent of reportContents) {
          if (!reportContent.includes('#')) continue;
          
          let reportType = 
            /brand elements discovery/i.test(reportContent) ? 'discovery' :
            /brand voice analysis/i.test(reportContent) ? 'messaging' :
            /brand audience alignment/i.test(reportContent) ? 'audience' :
            /elevate your brand/i.test(reportContent) ? 'complete' : null;

          if (!reportType && /prioritization matrix/i.test(reportContent)) {
            reportType = 'complete';
          }

          if (!reportType && markedPhaseCompletion) {
            reportType = markedPhaseCompletion;
          }
          
          if (reportType && interviewId) {
            try {
              processedReportType = reportType;

              let finalReportContent = reportContent;
              
              if (reportType === 'complete') {
                setProcessingStage('fixing');
                // Add report fixing logic here if needed
              }
              
              await updateDoc(doc(db, 'interviews', interviewId), {
                [`reports.${reportType}`]: finalReportContent,
                lastUpdated: new Date()
              });
              
              setReports(prev => ({...prev, [reportType]: finalReportContent}));
              
              if (reportType !== 'complete') {
                newPhase = getNextPhase(reportType as PhaseId);
                if (newPhase) {
                  await updateDoc(doc(db, 'interviews', interviewId), {
                    currentPhase: newPhase,
                    lastUpdated: new Date()
                  });
                  setCurrentPhase(newPhase);
                  phaseUpdated = true;
                }
              }
            } catch (error) {
              console.error('Error processing report:', error);
              toast.error('Failed to save report. Progress has been preserved.');
            }
          }
        }
        
        setIsGeneratingReport(false);

        // Enhanced message processing
        if (remainingContent?.trim()) {
          const finalPhase = phaseUpdated && newPhase ? newPhase : currentPhase;
          
          if (processedReportType && processedReportType !== 'complete') {
            // Process phase completion messages
            const lines = remainingContent.split('\n').filter(line => line.trim());
            const acknowledgmentLines = [];
            const transitionLines = [];
            
            let foundTransition = false;
            for (const line of lines) {
              if (line.toLowerCase().includes('now that we') || 
                  line.toLowerCase().includes('building upon') ||
                  line.toLowerCase().includes('let\'s transform') ||
                  line.toLowerCase().includes('let\'s explore') ||
                  line.toLowerCase().includes('let\'s move on')) {
                foundTransition = true;
              }
              
              if (!foundTransition && !line.includes('report:') && !line.includes('insights have been')) {
                acknowledgmentLines.push(line);
              } else if (foundTransition) {
                transitionLines.push(line);
              }
            }
            
            // Add messages sequentially
            if (acknowledgmentLines.length > 0) {
              const acknowledgmentMessage: Message = {
                role: 'assistant',
                content: acknowledgmentLines.join('\n\n'),
                timestamp: new Date(),
                phase: currentPhase
              };
              
              setMessages(prevMessages => {
                const updatedMessages = [...prevMessages, acknowledgmentMessage];
                saveProgress(true);
                return updatedMessages;
              });
            }
            
            // Add download link
            const downloadMessage: Message = {
              role: 'assistant',
              content: createDownloadLinkComponent(processedReportType as any),
              timestamp: new Date(),
              phase: currentPhase
            };
            
            setMessages(prevMessages => {
              const updatedMessages = [...prevMessages, downloadMessage];
              saveProgress(true);
              return updatedMessages;
            });
            
            // Handle phase transitions
            if (processedReportType === 'audience') {
              const hasCompleteReport = reportContents.some(content => 
                /elevate your brand/i.test(content) || /prioritization matrix/i.test(content)
              );
              
              if (hasCompleteReport) {
                return;
              }
            }
            
            if (transitionLines.length > 0) {
              const transitionMessage: Message = {
                role: 'assistant',
                content: transitionLines.join('\n\n'),
                timestamp: new Date(),
                phase: finalPhase
              };
              
              setMessages(prevMessages => {
                const updatedMessages = [...prevMessages, transitionMessage];
                const progressResult = useProgressCalculation(updatedMessages);
                setActualQuestionIndex(progressResult.nextQuestionIndex);
                findAndSetSuggestedAnswer(transitionMessage.content, finalPhase, progressResult.nextQuestionIndex);
                saveProgress(true);
                return updatedMessages;
              });
            }
            
          } else if (processedReportType === 'complete') {
            // Final completion message
            const finalMessage = `**Congratulations! Your Brand Alchemy Spark is Complete!**

Thank you for this illuminating journey through your brand's authentic essence. We've uncovered powerful insights about your brand identity, messaging consistency, and audience alignment.

${createDownloadLinkComponent('complete')}

**Your Complete Analysis Includes:**
- Strategic brand positioning recommendations
- Actionable growth roadmap with prioritized steps
- Professional brand analysis and insights
- Personalized transformation strategy

**Access All Reports:** Expand the progress ribbon above to download individual phase reports

Your brand has tremendous potential, and these insights provide the roadmap to unlock it. This analysis demonstrates the type of strategic transformation available through comprehensive brand development.

Ready to take your brand to the next level? The insights you've discovered here are just the beginning of what's possible when you fully align your brand with your authentic vision.`;

            const newMessage: Message = {
              role: 'assistant',
              content: finalMessage,
              timestamp: new Date(),
              phase: 'complete'
            };

            setMessages(prevMessages => {
              const updatedMessages = [...prevMessages, newMessage];
              saveProgress(true);
              return updatedMessages;
            });
            
          } else {
            // Regular message processing
            const newMessage: Message = {
              role: 'assistant',
              content: remainingContent,
              timestamp: new Date(),
              phase: phaseUpdated && newPhase ? newPhase : currentPhase
            };

            setMessages(prevMessages => {
              const updatedMessages = [...prevMessages, newMessage];
              const progressResult = useProgressCalculation(updatedMessages);
              findAndSetSuggestedAnswer(remainingContent, newMessage.phase, progressResult.nextQuestionIndex);
              saveProgress(true);
              return updatedMessages;
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing assistant response:', error);
      
      if (attemptNumber < MAX_RETRIES) {
        toast.error(`Processing error. Retrying... (${attemptNumber}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 2000 * attemptNumber));
        return processAssistantResponse(threadId, attemptNumber + 1);
      } else {
        setError('Failed to process response after multiple attempts');
        throw error;
      }
    }
  }, [openai, questionCount, parseAssistantResponse, createDownloadLinkComponent, findAndSetSuggestedAnswer, saveProgress, interviewId, currentPhase]);

  // Enhanced message sending with better error handling
  const sendMessage = useCallback(async () => {
    if (!input.trim() || !threadId || !interviewId || isLoading) return;
    
    const sanitizedInput = sanitizeInput(input);
    if (!sanitizedInput) {
      toast.error('Please enter a valid response');
      return;
    }

    setSuggestedAnswer(null);
    setError(null);

    // Check substantiveness
    const isResponseSubstantive = isSubstantive(sanitizedInput, questionCount);
    let userContent = sanitizedInput;

    if (!isResponseSubstantive) {
      toast('Your answer seems a bit brief. Asking the assistant for a follow-up.', { icon: '✍️', duration: 4000 });
      userContent = `[System Note: My previous answer was brief. Please ask me a clarifying follow-up question to help me provide more detail before we move on.]\n\nMy answer was: "${sanitizedInput}"`;
    }

    const userMessage: Message = {
      role: 'user',
      content: userContent,
      timestamp: new Date(),
      phase: currentPhase
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    scrollToBottom('instant');
    setInput('');
    setIsLoading(true);
    setIsTyping(true);
    setProcessingStage('sending');

    try {
      // Check online status
      if (!isOnline) {
        throw new ChatError('No internet connection. Please check your connection and try again.', 'network');
      }

      const controller = requestController.current.create('send-message');

      await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: userMessage.content
      });

      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: config.openai.assistantId
      });

      await waitForRunCompletion(threadId, run.id);
      await processAssistantResponse(threadId);
      
      setRetryCount(0); // Reset retry count on success
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove the failed message
      setMessages(prev => prev.slice(0, -1));
      setInput(sanitizedInput); // Restore input
      
      if (error instanceof ChatError) {
        switch (error.type) {
          case 'network':
            toast.error('Network error. Please check your connection and try again.');
            break;
          case 'timeout':
            toast.error('Request timed out. Please try again.');
            break;
          case 'ratelimit':
            toast.error('Too many requests. Please wait a moment and try again.');
            break;
          case 'api':
            toast.error('Service temporarily unavailable. Please try again.');
            break;
          default:
            toast.error('Failed to send message. Please try again.');
        }
      } else {
        toast.error('An unexpected error occurred. Please try again.');
      }
      
      setError(error instanceof Error ? error.message : 'Unknown error');
      setRetryCount(prev => prev + 1);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      requestController.current.cancel('send-message');
      inputRef.current?.focus();
    }
  }, [input, threadId, interviewId, isLoading, questionCount, currentPhase, messages, scrollToBottom, isOnline, openai, waitForRunCompletion, processAssistantResponse]);

  // Enhanced initialization
  const initializeChat = useCallback(async () => {
    if (!interviewId) {
      navigate('/');
      return;
    }

    try {
      const interviewDoc = await getDoc(doc(db, 'interviews', interviewId));
      if (!interviewDoc.exists()) {
        throw new ChatError('Interview not found', 'validation', false);
      }

      const interviewData = interviewDoc.data() as Interview;
      let threadId = interviewData.threadId;

      if (!threadId) {
        const newThread = await openai.beta.threads.create();
        threadId = newThread.id;

        await updateDoc(doc(db, 'interviews', interviewId), {
          threadId: newThread.id,
          lastUpdated: new Date()
        });
      }

      setThreadId(threadId);
      setMessages(interviewData.messages || []);
      setCurrentPhase(interviewData.currentPhase || 'discovery');
      setQuestionCount(interviewData.questionCount || 0);
      setActualQuestionIndex(interviewData.questionCount || 0);
      setReports(interviewData.reports || {});

      // Start new conversation or resume existing one
      if (interviewData.messages.length === 0) {
        await startNewConversation(threadId);
      } else {
        const lastAssistantMessage = interviewData.messages
          .filter(m => m.role === 'assistant')
          .pop();
        
        if (lastAssistantMessage) {
          const progressResult = useProgressCalculation(interviewData.messages);
          findAndSetSuggestedAnswer(
            lastAssistantMessage.content, 
            interviewData.currentPhase,
            progressResult.nextQuestionIndex
          );
        }
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
      if (error instanceof ChatError && !error.recoverable) {
        toast.error('Session not found. Please start a new journey.');
        navigate('/');
      } else {
        setError(error instanceof Error ? error.message : 'Initialization failed');
        toast.error('Failed to initialize chat. Please try refreshing the page.');
      }
    }
  }, [interviewId, navigate, openai, findAndSetSuggestedAnswer]);

  // Enhanced conversation starter
  const startNewConversation = useCallback(async (threadId: string) => {
    try {
      setIsTyping(true);
      await ensureNoActiveRuns(threadId);
      
      const brandName = sessionStorage.getItem('brandName');
      await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: `Please begin the brand development process for ${brandName}.`
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: config.openai.assistantId
      });
      
      await waitForRunCompletion(threadId, run.id);
      
      const messages = await openai.beta.threads.messages.list(threadId);
      const lastMessage = messages.data[0];
      
      if (lastMessage.role === 'assistant' && lastMessage.content[0].type === 'text') {
        const newMessage: Message = {
          role: 'assistant',
          content: lastMessage.content[0].text.value,
          timestamp: new Date(),
          phase: currentPhase
        };
        const newMessages = [newMessage];
        setMessages(newMessages);
        setActualQuestionIndex(0);
        await saveProgress(true);
        
        findAndSetSuggestedAnswer(newMessage.content, currentPhase, 0);
      }
      
    } catch (error) {
      console.error('Error starting conversation:', error);
      if (retryCount < 2) {
        setRetryCount(prev => prev + 1);
        toast.error('Connection issue. Retrying...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        await startNewConversation(threadId);
      } else {
        setError('Failed to start conversation');
        toast.error('Failed to start conversation. Please refresh the page.');
      }
    } finally {
      setIsTyping(false);
    }
  }, [currentPhase, ensureNoActiveRuns, openai, waitForRunCompletion, saveProgress, findAndSetSuggestedAnswer, retryCount]);

  // Helper function
  const getNextPhase = (current: string): 'messaging' | 'audience' | 'complete' | null => {
    const phases = ['discovery', 'messaging', 'audience', 'complete'];
    const currentIndex = phases.indexOf(current);
    return phases[currentIndex + 1] as 'messaging' | 'audience' | 'complete' | null;
  };

  // Enhanced message bubble renderer
  const renderEnhancedMessageBubble = useCallback((message: Message, index: number) => {
    const hasDownloadLinks = message.content.includes('onclick="window.downloadReport');
    
    if (hasDownloadLinks) {
      (window as any).downloadReport = downloadReport;
    }
    
    return (
      <MessageBubble
        key={`${message.timestamp}-${index}`}
        message={message}
        isLast={index === messages.length - 1}
        brandName={sessionStorage.getItem('brandName') || ''}
        reportContent={reports.complete || null}
      />
    );
  }, [downloadReport, reports.complete]);

  // Effects
  useEffect(() => {
    if (messages.length > 0 || isTyping) {
      scrollToBottom();
    }
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    progressManager.current = new ProgressManager();
    initializeChat();
  }, [initializeChat]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      requestController.current.cancelAll();
      if (autoSaveInterval.current) {
        clearInterval(autoSaveInterval.current);
      }
      saveProgress(true);
    };
  }, [saveProgress]);

  // Online status indicator
  const OnlineStatusIndicator = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium ${
        isOnline 
          ? 'bg-green-100 text-green-800 border border-green-200' 
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}
    >
      {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
      {isOnline ? 'Online' : 'Offline'}
    </motion.div>
  );

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Online status indicator */}
      <AnimatePresence>
        {!isOnline && <OnlineStatusIndicator />}
      </AnimatePresence>

      <PhaseProgress 
        currentPhase={currentPhase}
        questionCount={questionCount}
        totalQuestions={PREDEFINED_QUESTIONS.length}
        reports={reports}
        brandName={sessionStorage.getItem('brandName') || ''}
      />
      
      <main className="flex-grow relative overflow-hidden bg-white-smoke mt-20">
        <div 
          ref={messageListRef}
          className="absolute inset-0 overflow-y-auto px-6 pt-4 space-y-4"
          style={{ 
            paddingBottom: '120px',
            paddingTop: '2rem'
          }}
        >
          {messages.map((message, index) => renderEnhancedMessageBubble(message, index))}
          
          {(isTyping || isGeneratingReport) && (
            <div className="flex items-center text-neutral-gray italic">
              <span className="mr-2">
                {isGeneratingReport 
                  ? "Generating your personalized brand report..." 
                  : processingMessages[processingStage]
                }
              </span>
              <span className="animate-pulse">●●●</span>
            </div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800"
            >
              <p className="text-sm">
                <strong>Error:</strong> {error}
              </p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </div>
      </main>
      
      <div className="sticky bottom-0 w-full bg-white border-t border-neutral-gray">
        <MessageInput 
          input={input}
          setInput={setInput}
          isLoading={isLoading}
          sendMessage={sendMessage}
          inputRef={inputRef}
          suggestedAnswer={suggestedAnswer}
          onUseSuggestion={() => {
            if (suggestedAnswer) {
              setInput(suggestedAnswer);
              setSuggestedAnswer(null);
            }
          }}
        />
      </div>
    </div>
  );
};

export default React.memo(Chat);