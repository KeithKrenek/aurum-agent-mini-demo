import React, { useState, useEffect, useRef, useCallback } from 'react';
import OpenAI from 'openai';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Download, FileText } from 'lucide-react';
import { ProgressManager } from './ProgressManager';
import { Interview, Message, PhaseId, isValidPhase } from './types/interview';
import MessageInput from './MessageInput';
import MessageBubble from './MessageBubble';
import PhaseProgress from './PhaseProgress';
import { config } from './config/environment';
import { PREDEFINED_QUESTIONS, MOCK_ANSWERS, getDemoAnswerForQuestion } from './types/constants';
import { ProcessingStage, processingMessages } from './types/constants';
import { generatePDF } from './pdfGenerator';

// Enhanced error types for better error handling
class ChatError extends Error {
  constructor(message: string, public type: 'network' | 'api' | 'validation' | 'timeout' = 'api') {
    super(message);
    this.name = 'ChatError';
  }
}

const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'discovery' | 'messaging' | 'audience' | 'complete'>('discovery');
  const [questionCount, setQuestionCount] = useState(0);
  const [reports, setReports] = useState<Interview['reports']>({});
  const [threadId, setThreadId] = useState<string | null>(null);
  const [suggestedAnswer, setSuggestedAnswer] = useState<string | null>(null);
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('sending');
  const [lastProcessedMessageCount, setLastProcessedMessageCount] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [actualQuestionIndex, setActualQuestionIndex] = useState(0); // NEW: Track actual question position
  const messageListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const progressManager = useRef<ProgressManager | null>(null);
  const navigate = useNavigate();
  const { interviewId: urlInterviewId } = useParams<{ interviewId: string }>();
  const inputBoxRef = useRef<HTMLDivElement>(null);

  const interviewId = urlInterviewId || sessionStorage.getItem('interviewId');
 
  const openai = new OpenAI({
    apiKey: config.openai.apiKey,
    dangerouslyAllowBrowser: true
  });

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (!messageListRef.current) return;
    
    const scrollContainer = messageListRef.current;
    const scrollHeight = scrollContainer.scrollHeight;
    const clientHeight = scrollContainer.clientHeight;
    const maxScroll = scrollHeight - clientHeight;
    
    if (scrollContainer.scrollTop < maxScroll) {
      try {
        scrollContainer.scrollTo({
          top: scrollHeight,
          behavior,
        });
      } catch (error) {
        scrollContainer.scrollTop = scrollHeight;
      }
    }
  }, []);

  // FIXED: More robust question counting with actual question tracking
  const calculateQuestionProgress = useCallback((messageHistory: Message[]): { answeredCount: number; nextQuestionIndex: number } => {
    let answeredQuestions = 0;
    let lastQuestionIndex = -1;
    
    // First pass: Find which questions have been asked
    for (let i = 0; i < messageHistory.length; i++) {
      const message = messageHistory[i];
      
      if (message.role === 'assistant') {
        const messageContent = typeof message.content === 'string' ? message.content : '';
        
        // Check for each predefined question in order
        for (let qIndex = lastQuestionIndex + 1; qIndex < PREDEFINED_QUESTIONS.length; qIndex++) {
          const question = PREDEFINED_QUESTIONS[qIndex];
          
          // Multiple matching strategies for robustness
          const strategies = [
            // Strategy 1: Look for quoted question
            () => messageContent.includes(`"${question.substring(0, 50)}`),
            // Strategy 2: Look for bold question  
            () => messageContent.includes(`**"${question.substring(0, 50)}`),
            // Strategy 3: Keyword density check
            () => {
              const questionWords = question.toLowerCase().split(' ').filter(w => w.length > 3);
              const contentWords = messageContent.toLowerCase();
              const matches = questionWords.filter(word => contentWords.includes(word));
              return matches.length >= Math.min(3, questionWords.length * 0.4);
            },
            // Strategy 4: Direct substring match
            () => messageContent.toLowerCase().includes(question.substring(0, 40).toLowerCase())
          ];
          
          const found = strategies.some(strategy => strategy());
          
          if (found) {
            lastQuestionIndex = qIndex;
            console.log(`Found question ${qIndex}: "${question.substring(0, 50)}..."`);
            break;
          }
        }
      }
    }
    
    // Second pass: Count user responses to questions
    for (let i = 0; i < messageHistory.length - 1; i++) {
      const currentMessage = messageHistory[i];
      const nextMessage = messageHistory[i + 1];
      
      if (currentMessage.role === 'assistant' && nextMessage.role === 'user') {
        const userContent = typeof nextMessage.content === 'string' ? nextMessage.content : '';
        
        // Must be substantive (not just demo answer repetition)
        const isSubstantive = userContent.trim().length > 30 && 
                             !userContent.startsWith('Problem 1: Fear of AI') &&
                             !userContent.includes('Problem 1: Fear of AI unpredictability');
        
        if (isSubstantive) {
          answeredQuestions++;
        }
      }
    }
    
    // The next question index should be the number of answered questions
    const nextQuestionIndex = Math.min(answeredQuestions, PREDEFINED_QUESTIONS.length - 1);
    
    console.log(`Question tracking: lastFound=${lastQuestionIndex + 1}, answered=${answeredQuestions}, nextIndex=${nextQuestionIndex}`);
    
    return {
      answeredCount: answeredQuestions,
      nextQuestionIndex: nextQuestionIndex
    };
  }, []);

  // FIXED: Enhanced demo answer logic with actual question index
  const findAndSetSuggestedAnswer = useCallback((assistantContent: string, phase?: 'discovery' | 'messaging' | 'audience' | 'complete', currentQuestionIndex?: number) => {
    const phaseToCheck = phase || currentPhase;
    const questionIndex = currentQuestionIndex !== undefined ? currentQuestionIndex : actualQuestionIndex;
    
    console.log(`Demo answer check: phase=${phaseToCheck}, questionIndex=${questionIndex}, actualQuestionIndex=${actualQuestionIndex}`);
    
    if (phaseToCheck === 'complete' || questionIndex >= PREDEFINED_QUESTIONS.length) {
      setSuggestedAnswer(null);
      return;
    }

    // Use actual question index for demo answer matching
    const demoAnswer = getDemoAnswerForQuestion(assistantContent, phaseToCheck, questionIndex);
    
    if (demoAnswer) {
      console.log(`Setting demo answer for ${phaseToCheck} phase, question index: ${questionIndex}`);
      setSuggestedAnswer(demoAnswer);
    } else {
      setSuggestedAnswer(null);
    }
  }, [currentPhase, actualQuestionIndex]);

  // Enhanced report download function
  const downloadReport = async (reportType: 'discovery' | 'messaging' | 'audience' | 'complete') => {
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
      toast.error('Failed to download report');
    }
  };

  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;
    
    if (messages.length > 0 || isTyping) {
      scrollTimeout = setTimeout(() => {
        scrollToBottom(isTyping ? 'smooth' : 'instant');
      }, 100);
    }
    
    return () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [messages, isTyping, scrollToBottom]);

  // FIXED: Enhanced question counting with actual question index tracking
  useEffect(() => {
    if (messages.length > lastProcessedMessageCount) {
      const { answeredCount, nextQuestionIndex } = calculateQuestionProgress(messages);
      
      if (answeredCount !== questionCount) {
        setQuestionCount(answeredCount);
        setActualQuestionIndex(nextQuestionIndex);
        console.log(`Question count updated: ${answeredCount}/${PREDEFINED_QUESTIONS.length}, nextQuestionIndex: ${nextQuestionIndex}`);
      }
      setLastProcessedMessageCount(messages.length);
    }
  }, [messages, lastProcessedMessageCount, questionCount, calculateQuestionProgress]);

  const adjustMessageListPadding = useCallback(() => {
    if (!inputBoxRef.current || !messageListRef.current) return;
    
    const inputHeight = inputBoxRef.current.offsetHeight;
    const padding = inputHeight + 20;
    
    requestAnimationFrame(() => {
      if (messageListRef.current) {
        messageListRef.current.style.paddingBottom = `${padding}px`;
      }
    });
  }, []);
  
  useEffect(() => {
    adjustMessageListPadding();
    
    const resizeObserver = new ResizeObserver(adjustMessageListPadding);
    
    if (inputBoxRef.current) {
      resizeObserver.observe(inputBoxRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [adjustMessageListPadding]);

  // Enhanced error recovery and state persistence
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isLoading || messages.length > 0) {
        e.preventDefault();
        e.returnValue = '';
        
        if (interviewId) {
          const saveState = {
            messages,
            currentPhase,
            questionCount,
            actualQuestionIndex,
            lastUpdate: new Date().toISOString()
          };
          sessionStorage.setItem(`interview_${interviewId}_state`, JSON.stringify(saveState));
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLoading, messages, currentPhase, interviewId, questionCount, actualQuestionIndex]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isTyping) {
      inputRef.current?.focus();
    }
  }, [isTyping]);

  // FIXED: Enhanced API call with context trimming and better timeout handling
  const waitForRunCompletion = async (threadId: string, runId: string, maxAttempts = 40) => { // Increased attempts
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
        
        if (runStatus.status === 'completed') {
          return true;
        }
        
        if (runStatus.status === 'failed' || runStatus.status === 'cancelled') {
          console.error('Run failed:', runStatus.last_error);
          throw new ChatError(`Run ${runStatus.status}: ${runStatus.last_error?.message || 'Unknown error'}`, 'api');
        }
        
        if (runStatus.status === 'requires_action') {
          console.log('Run requires action, waiting...');
        }
        
        // Progressive timeout increase for long operations
        const waitTime = attempts < 10 ? 1000 : attempts < 20 ? 2000 : 3000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        attempts++;
        
        // Show progress for long operations
        if (attempts > 15 && attempts % 5 === 0) {
          console.log(`Still processing... (${attempts}/${maxAttempts})`);
          setProcessingStage('thinking');
        }
        
      } catch (error) {
        console.error(`Attempt ${attempts + 1} failed:`, error);
        if (attempts >= maxAttempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
    }
    
    throw new ChatError('Request timed out after extended wait', 'timeout');
  };

  // NEW: Context trimming to prevent overflow
  const trimContextIfNeeded = async (threadId: string) => {
    try {
      const messages = await openai.beta.threads.messages.list(threadId, { limit: 50 });
      const messageCount = messages.data.length;
      
      // If we have too many messages, we need to manage context
      if (messageCount > 40) {
        console.log(`Context has ${messageCount} messages, considering trimming`);
        
        // For now, just log - in production, you might implement context summarization
        // or selective message removal while preserving key information
        toast('Large conversation detected. Processing may take longer.', {
          icon: 'ℹ️',
          duration: 4000
        });
      }
    } catch (error) {
      console.warn('Could not check context size:', error);
    }
  };

  const checkRunStatus = async (threadId: string, runId: string) => {
    try {
      const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
      return runStatus.status;
    } catch (error) {
      console.error('Error checking run status:', error);
      return 'failed';
    }
  };

  const cancelRun = async (threadId: string, runId: string) => {
    try {
      await openai.beta.threads.runs.cancel(threadId, runId);
      
      let status;
      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        status = await checkRunStatus(threadId, runId);
      } while (status === 'cancelling');
      
    } catch (error) {
      console.log('Run already completed or cancelled');
    }
  };

  const ensureNoActiveRuns = async (threadId: string) => {
    try {
      const runs = await openai.beta.threads.runs.list(threadId);
      const activeRuns = runs.data.filter(run => 
        ['in_progress', 'queued', 'cancelling'].includes(run.status)
      );
      
      for (const run of activeRuns) {
        console.log(`Cancelling active run: ${run.id}`);
        await cancelRun(threadId, run.id);
      }
      
      if (activeRuns.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (error) {
      console.error('Error managing active runs:', error);
      throw new ChatError('Failed to manage active runs', 'api');
    }
  };

  // Enhanced initialization with better error recovery
  const initializeChat = async () => {
    const savedState = sessionStorage.getItem(`interview_${interviewId}_state`);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        const lastUpdate = new Date(parsed.lastUpdate);
        const now = new Date();
        
        if (now.getTime() - lastUpdate.getTime() < 30 * 60 * 1000) {
          setMessages(parsed.messages);
          setCurrentPhase(parsed.currentPhase);
          setQuestionCount(parsed.questionCount);
          setActualQuestionIndex(parsed.actualQuestionIndex || 0);
        }
        
        sessionStorage.removeItem(`interview_${interviewId}_state`);
      } catch (error) {
        console.error('Error recovering saved state:', error);
      }
    }

    if (!interviewId) {
      navigate('/');
      return;
    }

    try {
      const interviewDoc = await getDoc(doc(db, 'interviews', interviewId));
      if (!interviewDoc.exists()) {
        throw new ChatError('Interview not found', 'validation');
      }

      const interviewData = interviewDoc.data() as Interview;
      console.log('Chat initialization - Interview data:', interviewData);
      
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

      if (interviewData.messages.length === 0) {
        await startNewConversation(threadId);
      } else {
        // Set demo answer when resuming existing conversation
        const lastAssistantMessage = interviewData.messages
          .filter(m => m.role === 'assistant')
          .pop();
        
        if (lastAssistantMessage) {
          const { nextQuestionIndex } = calculateQuestionProgress(interviewData.messages);
          findAndSetSuggestedAnswer(
            lastAssistantMessage.content, 
            interviewData.currentPhase,
            nextQuestionIndex
          );
        }
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
      if (error instanceof ChatError && error.type === 'validation') {
        toast.error('Session not found. Please start a new journey.');
      } else {
        toast.error('Failed to initialize chat. Please try again.');
      }
      navigate('/');
    }
  };

  const startNewConversation = async (threadId: string) => {
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
        setActualQuestionIndex(0); // First question will be answered
        await updateInterviewMessages(newMessages);
        
        // For the first question, the next question index should be 0
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
        toast.error('Failed to start conversation. Please refresh the page.');
      }
    } finally {
      setIsTyping(false);
    }
  };

  // Enhanced report parsing with correct section names
  const parseAssistantResponse = (response: string) => {
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

    const courseRegex = /Brand Alchemy Mastery course|course/gi;
    const linkedContent = remainingContent.replace(courseRegex, 
      match => `<a href="https://dfl0.us/s/ab4d2c7a?em=%7B%7Bcontact.email%7D%7D" target="_blank" class="text-dark-midnight hover:text-goldenrod underline">${match}</a>`
    );

    return {
      reportContents,
      remainingContent: linkedContent
    };
  };

  // Create enhanced download link component
  const createDownloadLinkComponent = (reportType: 'discovery' | 'messaging' | 'audience' | 'complete'): string => {
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
      <p class="text-xs text-neutral-gray mt-2">💡 <strong>Tip:</strong> Expand the progress ribbon above to access all reports</p>
    </div>`;
  };

  const processAssistantResponse = async (threadId: string, attemptNumber = 1) => {
    const MAX_RETRIES = 3;
    
    try {
      const messages = await openai.beta.threads.messages.list(threadId);
      if (!messages?.data?.length) {
        throw new ChatError('No messages received from OpenAI', 'api');
      }

      const lastMessage = messages.data[0];
      if (lastMessage.role === 'assistant' && lastMessage.content[0].type === 'text') {
        const rawContent = lastMessage.content[0].text.value;
        
        const phaseMarkerRegex = /===PHASE_COMPLETE:(discovery|messaging|audience|complete)===/i;
        const phaseMarkerMatch = rawContent.match(phaseMarkerRegex);
        let markedPhaseCompletion = phaseMarkerMatch ? phaseMarkerMatch[1].toLowerCase() : null;
        
        let cleanedContent = rawContent;
        if (markedPhaseCompletion) {
          console.log(`Phase completion marker detected: ${markedPhaseCompletion}`);
        
          if (interviewId && isValidPhase(markedPhaseCompletion)) {
            const lines = rawContent.split(/\n/);
            const markerLineIndex = lines.findIndex(line => /===PHASE_COMPLETE:[a-z]+===/i.test(line));
            
            if (markerLineIndex !== -1) {
              lines.splice(markerLineIndex, 1);
              
              while (markerLineIndex < lines.length && lines[markerLineIndex].trim() === '') {
                lines.splice(markerLineIndex, 1);
              }
              
              cleanedContent = lines.join('\n');
            }
          }
        }
        
        const { reportContents, remainingContent } = parseAssistantResponse(cleanedContent);

        let phaseUpdated = false;
        let newPhase: PhaseId | null = null;
        let processedReportType: string | null = null;
        
        if (reportContents.length > 0) {
          setIsGeneratingReport(true);
        }
        
        for (const reportContent of reportContents) {
          if (!reportContent.includes('#')) {
            console.error('Invalid report format detected:', reportContent);
            continue;
          }
          
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
            console.log(`Processing ${reportType} report`);
            processedReportType = reportType;

            let finalReportContent = reportContent;
            
            if (reportType === 'complete') {
              setProcessingStage('fixing');
              finalReportContent = await promptAssistantToFixReport(threadId, reportContent);
            }
            
            await updateDoc(doc(db, 'interviews', interviewId), {
              [`reports.${reportType}`]: finalReportContent,
              lastUpdated: new Date()
            });
            
            setReports(prev => ({...prev, [reportType]: finalReportContent}));
            
            if (reportType !== 'complete') {
              newPhase = getNextPhase(reportType as PhaseId);
              if (newPhase) {
                console.log(`Transitioning phase from ${reportType} to ${newPhase}`);
                await updateDoc(doc(db, 'interviews', interviewId), {
                  currentPhase: newPhase,
                  lastUpdated: new Date()
                });
                setCurrentPhase(newPhase);
                phaseUpdated = true;
              }
            }
          }
        }
        
        setIsGeneratingReport(false);

        // Enhanced response flow with proper sequencing
        if (remainingContent?.trim()) {
          const finalPhase = phaseUpdated && newPhase ? newPhase : currentPhase;
          
          if (processedReportType && processedReportType !== 'complete') {
            // FIXED: Handle all individual phase reports including audience
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
            
            // Add acknowledgment message first
            if (acknowledgmentLines.length > 0) {
              const acknowledgmentMessage: Message = {
                role: 'assistant',
                content: acknowledgmentLines.join('\n\n'),
                timestamp: new Date(),
                phase: currentPhase
              };
              
              setMessages(prevMessages => {
                const updatedMessages = [...prevMessages, acknowledgmentMessage];
                updateInterviewMessages(updatedMessages);
                return updatedMessages;
              });
            }
            
            // Add download link message for the completed phase
            const downloadMessage: Message = {
              role: 'assistant',
              content: createDownloadLinkComponent(processedReportType as any),
              timestamp: new Date(),
              phase: currentPhase
            };
            
            setMessages(prevMessages => {
              const updatedMessages = [...prevMessages, downloadMessage];
              updateInterviewMessages(updatedMessages);
              return updatedMessages;
            });
            
            // FIXED: Handle audience phase completion specially - don't transition yet if there's a final report coming
            if (processedReportType === 'audience') {
              // For audience phase, we might have both audience and complete reports
              // Check if there's a complete report in the original response
              const hasCompleteReport = reportContents.some(content => 
                /elevate your brand/i.test(content) || /prioritization matrix/i.test(content)
              );
              
              if (hasCompleteReport) {
                // Don't add transition message yet - wait for complete report processing
                console.log('Audience report generated, complete report also detected');
                return;
              }
            }
            
            // Add transition to next phase with updated question index (for non-audience or audience without complete report)
            if (transitionLines.length > 0) {
              const transitionMessage: Message = {
                role: 'assistant',
                content: transitionLines.join('\n\n'),
                timestamp: new Date(),
                phase: finalPhase
              };
              
              setMessages(prevMessages => {
                const updatedMessages = [...prevMessages, transitionMessage];
                updateInterviewMessages(updatedMessages);
                
                // Calculate next question index based on the updated conversation
                const progressResult = calculateQuestionProgress(updatedMessages);
                setActualQuestionIndex(progressResult.nextQuestionIndex);
                
                findAndSetSuggestedAnswer(transitionMessage.content, finalPhase, progressResult.nextQuestionIndex);
                return updatedMessages;
              });
            }
            
          } else if (processedReportType === 'complete') {
            // Final completion message
            const finalMessage = `🎉 **Congratulations! Your Brand Alchemy Spark is Complete!**

Thank you for this illuminating journey through your brand's authentic essence. We've uncovered powerful insights about your brand identity, messaging consistency, and audience alignment.

${createDownloadLinkComponent('complete')}

**Your Complete Analysis Includes:**
- Strategic brand positioning recommendations
- Actionable growth roadmap with prioritized steps
- Professional brand analysis and insights
- Personalized transformation strategy

📊 **Access All Reports:** Expand the progress ribbon above to download individual phase reports

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
              updateInterviewMessages(updatedMessages);
              return updatedMessages;
            });
            
          } else {
            // Regular message processing - calculate next question index properly
            const newMessage: Message = {
              role: 'assistant',
              content: remainingContent,
              timestamp: new Date(),
              phase: finalPhase
            };

            setMessages(prevMessages => {
              const updatedMessages = [...prevMessages, newMessage];
              updateInterviewMessages(updatedMessages);
              
              // Calculate the next question index from the updated message history  
              const progressResult = calculateQuestionProgress(updatedMessages);
              findAndSetSuggestedAnswer(remainingContent, finalPhase, progressResult.nextQuestionIndex);
              return updatedMessages;
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing assistant response:', error);
      
      if (attemptNumber < MAX_RETRIES) {
        toast.error(`Processing error. Retrying... (${attemptNumber}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return processAssistantResponse(threadId, attemptNumber + 1);
      } else {
        toast.error('Failed to process response after multiple attempts. Please try refreshing.');
        throw error;
      }
    }
  };

  const promptAssistantToFixReport = async (threadId: string, reportContent: string): Promise<string> => {
    try {
      const requiredSections = [
        'Brand Breakthrough',
        'Your Brand at a Glance',
        'Key Observations and Insights',
        'Personalized Growth Roadmap',
        'Action Plan: Where to Focus Next',
        'Next Steps for Growth',
        'Prioritization Matrix',
        'The Brand Alchemy Mastery Course'
      ];
      
      const missingSections = requiredSections.filter(section => 
        !reportContent.includes(section)
      );
      
      const hasProperMatrix = reportContent.includes('| Recommendation | Impact | Effort | Priority |');
      
      if (missingSections.length === 0 && hasProperMatrix) {
        return reportContent;
      }
      
      console.log('Fixing report format issues:', { missingSections, hasProperMatrix });
      
      let fixPrompt = "Your last report is missing required elements or has formatting issues. Please fix and regenerate the final report with ALL these sections:\n\n";
      
      if (missingSections.length > 0) {
        fixPrompt += `Missing sections: ${missingSections.join(', ')}\n\n`;
      }
      
      if (!hasProperMatrix) {
        fixPrompt += `The Prioritization Matrix table MUST be formatted as a proper markdown table.\n\n`;
      }
      
      fixPrompt += "Please regenerate ONLY the final report, exactly following the Final Transformation Summary template.";
      
      await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: fixPrompt
      });
      
      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: config.openai.assistantId
      });
      
      await waitForRunCompletion(threadId, run.id);
      
      const messages = await openai.beta.threads.messages.list(threadId);
      const lastMessage = messages.data[0];
      
      if (lastMessage.role === 'assistant' && lastMessage.content[0].type === 'text') {
        const fixedContent = lastMessage.content[0].text.value;
        
        const reportRegex = /```markdown\s*([\s\S]*?)\s*```/g;
        const match = reportRegex.exec(fixedContent);
        
        if (match && match[1]) {
          const fixedReport = match[1].trim();
          console.log('Successfully fixed report format');
          return fixedReport;
        }
      }
      
      console.error('Failed to fix report format');
      return reportContent;
      
    } catch (error) {
      console.error('Error fixing report:', error);
      return reportContent;
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !threadId || !interviewId || isLoading) return;
    setSuggestedAnswer(null);

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
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
      // Check context size before sending
      await trimContextIfNeeded(threadId);
      
      setProcessingStage('translating');
      await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: userMessage.content
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setProcessingStage('reading');
      await ensureNoActiveRuns(threadId);
      
      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: config.openai.assistantId
      });

      setProcessingStage('thinking');
      await waitForRunCompletion(threadId, run.id);
      
      setProcessingStage('formulating');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setProcessingStage('finalizing');
      await processAssistantResponse(threadId);
      
    } catch (error) {
      console.error('Error sending message:', error);
      
      if (error instanceof ChatError) {
        switch (error.type) {
          case 'network':
            toast.error('Network error. Please check your connection and try again.');
            break;
          case 'timeout':
            toast.error('Request timed out. This may happen with complex requests. Please try again.');
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
      
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  const updateInterviewMessages = async (newMessages: Message[]) => {
    if (interviewId) {
      try {
        const { answeredCount, nextQuestionIndex } = calculateQuestionProgress(newMessages);
        await updateDoc(doc(db, 'interviews', interviewId), {
          messages: newMessages,
          questionCount: answeredCount,
          actualQuestionIndex: nextQuestionIndex,
          lastUpdated: new Date()
        });
      } catch (error) {
        console.error('Error updating messages:', error);
        toast.error('Failed to save message history.');
      }
    }
  };

  const getNextPhase = (current: string): 'messaging' | 'audience' | 'complete' | null => {
    const phases = ['discovery', 'messaging', 'audience', 'complete'];
    const currentIndex = phases.indexOf(current);
    return phases[currentIndex + 1] as 'messaging' | 'audience' | 'complete' | null;
  };

  // Enhanced message bubble with download link handling
  const renderEnhancedMessageBubble = (message: Message, index: number) => {
    const hasDownloadLinks = message.content.includes('onclick="window.downloadReport');
    
    if (hasDownloadLinks) {
      (window as any).downloadReport = downloadReport;
    }
    
    return (
      <MessageBubble
        key={index}
        message={message}
        isLast={index === messages.length - 1}
        brandName={sessionStorage.getItem('brandName') || ''}
        reportContent={reports.complete || null}
      />
    );
  };

  useEffect(() => {
    if (!interviewId) {
      toast.error('Session expired. Please restart your brand development journey.');
      navigate('/');
      return;
    }

    progressManager.current = new ProgressManager();
    initializeChat();
  }, [interviewId]);

  return (
    <div className="flex flex-col h-screen bg-white">
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
            paddingBottom: `${inputBoxRef.current?.offsetHeight || 80}px`,
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
        </div>
      </main>
      
      <div ref={inputBoxRef} className="sticky bottom-0 w-full bg-white border-t border-neutral-gray">
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

export default Chat;