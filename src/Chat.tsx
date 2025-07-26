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
  const [isGeneratingReport, setIsGeneratingReport] = useState(false); // NEW: Report generation status
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

  // FIXED: Enhanced question detection and counting logic
  const calculateQuestionProgress = useCallback((messageHistory: Message[]): number => {
    let completedQuestions = 0;
    
    // Only count questions that have been both asked and answered
    for (let i = 0; i < messageHistory.length - 1; i++) {
      const currentMessage = messageHistory[i];
      const nextMessage = messageHistory[i + 1];
      
      // Must be assistant question followed by user answer
      if (currentMessage.role === 'assistant' && nextMessage.role === 'user') {
        // FIXED: Ensure content is a string before calling toLowerCase()
        const messageContent = typeof currentMessage.content === 'string' 
          ? currentMessage.content 
          : '';
          
        const nextMessageContent = typeof nextMessage.content === 'string'
          ? nextMessage.content
          : '';
        
        // Check if assistant message contains a question from our predefined list
        const containsQuestion = PREDEFINED_QUESTIONS.some(question => {
          const questionSnippet = question.substring(0, 50).toLowerCase();
          return messageContent.toLowerCase().includes(questionSnippet);
        });
        
        // Also check if the user response is substantive (not just repeated demo answer)
        const isSubstantiveAnswer = nextMessageContent.trim().length > 20 && 
                                  !nextMessageContent.includes('Problem 1: Fear of AI');
        
        if (containsQuestion && isSubstantiveAnswer) {
          completedQuestions++;
        }
      }
    }
    
    return Math.min(completedQuestions, PREDEFINED_QUESTIONS.length);
  }, []);

  // FIXED: Enhanced demo answer logic with better question tracking
  const findAndSetSuggestedAnswer = useCallback((assistantContent: string, phase?: PhaseId, currentQuestionCount?: number) => {
    const phaseToCheck = phase || currentPhase;
    const questionCountToUse = currentQuestionCount !== undefined ? currentQuestionCount : questionCount;
    
    if (phaseToCheck === 'complete' || !isValidPhase(phaseToCheck)) {
      setSuggestedAnswer(null);
      return;
    }

    // Use the enhanced demo answer function from constants
    const demoAnswer = getDemoAnswerForQuestion(assistantContent, phaseToCheck, questionCountToUse);
    
    if (demoAnswer) {
      console.log(`Setting demo answer for ${phaseToCheck} phase, question count: ${questionCountToUse}`);
      setSuggestedAnswer(demoAnswer);
    } else {
      setSuggestedAnswer(null);
    }
  }, [currentPhase, questionCount]);

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

  // FIXED: Enhanced question counting with better logic
  useEffect(() => {
    if (messages.length > lastProcessedMessageCount) {
      const newCount = calculateQuestionProgress(messages);
      if (newCount !== questionCount) {
        setQuestionCount(newCount);
        console.log(`Question count updated: ${newCount}/${PREDEFINED_QUESTIONS.length}`);
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
            lastUpdate: new Date().toISOString()
          };
          sessionStorage.setItem(`interview_${interviewId}_state`, JSON.stringify(saveState));
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLoading, messages, currentPhase, interviewId, questionCount]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isTyping) {
      inputRef.current?.focus();
    }
  }, [isTyping]);

  // Enhanced API call with better error handling and retry logic
  const waitForRunCompletion = async (threadId: string, runId: string, maxAttempts = 30) => {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
        
        if (runStatus.status === 'completed') {
          return true;
        }
        
        if (runStatus.status === 'failed' || runStatus.status === 'cancelled') {
          throw new ChatError(`Run ${runStatus.status}: ${runStatus.last_error?.message || 'Unknown error'}`, 'api');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      } catch (error) {
        if (attempts >= maxAttempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
    }
    
    throw new ChatError('Run timed out', 'timeout');
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
        await cancelRun(threadId, run.id);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
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
      setReports(interviewData.reports || {});

      if (interviewData.messages.length === 0) {
        await startNewConversation(threadId);
      } else {
        // FIXED: Set demo answer when resuming existing conversation
        const lastAssistantMessage = interviewData.messages
          .filter(m => m.role === 'assistant')
          .pop();
        
        if (lastAssistantMessage) {
          findAndSetSuggestedAnswer(
            lastAssistantMessage.content, 
            interviewData.currentPhase,
            interviewData.questionCount
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
        setMessages([newMessage]);
        await updateInterviewMessages([newMessage]);
        
        // FIXED: Set demo answer for initial message
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

  // FIXED: Enhanced report parsing with correct section names
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

    if (reportContents.length > 0 && reportContents.some(r => /elevate your brand/i.test(r))) {
      const finalReport = reportContents.find(r => /elevate your brand/i.test(r));
      
      // FIXED: Updated required sections to match assistant instructions
      const requiredSections = [
        'brand breakthrough',
        'your brand at a glance', 
        'key observations',
        'personalized growth roadmap', // FIXED: Was "personalized growth formula"
        'action plan',
        'next steps for growth',
        'prioritization matrix',
        'brand alchemy mastery'
      ];
      
      const missingSections = requiredSections.filter(section => 
        !finalReport?.toLowerCase().includes(section.toLowerCase())
      );
      
      if (missingSections.length > 0) {
        console.warn(`Final report missing sections: ${missingSections.join(', ')}`);
      }
      
      // FIXED: Better prioritization matrix detection
      const hasProperMatrix = finalReport?.includes('| Recommendation | Impact | Effort | Priority |') ||
                             finalReport?.includes('|Recommendation|Impact|Effort|Priority|') ||
                             finalReport?.includes('Recommendation') && finalReport?.includes('Priority');
      
      if (!hasProperMatrix) {
        console.warn('Prioritization matrix table may be missing or malformatted');
      }
    }

    return {
      reportContents,
      remainingContent: linkedContent
    };
  };

  // NEW: Function to create download link message
  const createDownloadLinkMessage = (reportType: 'discovery' | 'messaging' | 'audience' | 'complete'): string => {
    const reportNames = {
      discovery: 'Brand Elements Discovery',
      messaging: 'Brand Voice Analysis', 
      audience: 'Brand Audience Alignment Analysis',
      complete: 'Complete Brand Transformation'
    };
    
    return `📋 **${reportNames[reportType]} Report Generated!**

Your ${reportNames[reportType].toLowerCase()} report is now ready. You can:

🔽 **Download it directly:** [Click here to download your ${reportNames[reportType].toLowerCase()} report](#download-${reportType})

📊 **Access from progress ribbon:** Expand the progress ribbon at the top of the page to see all available reports

This report contains personalized insights based on your responses and actionable recommendations for your brand development journey.`;
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
            console.log(`Processing ${markedPhaseCompletion} phase completion`);
            
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
        
        // NEW: Set report generation status
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
            console.log('Detected final report via Prioritization Matrix section');
            reportType = 'complete';
          }

          if (!reportType && markedPhaseCompletion) {
            console.log(`Using phase marker to identify report type: ${markedPhaseCompletion}`);
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
        
        // NEW: Clear report generation status
        setIsGeneratingReport(false);

        // ENHANCED: Create better response flow
        if (remainingContent?.trim()) {
          const finalPhase = phaseUpdated && newPhase ? newPhase : currentPhase;
          
          // NEW: For phase completions, create a cleaner response
          if (processedReportType && processedReportType !== 'complete') {
            // Extract just the acknowledgment and transition, skip redundant text
            const lines = remainingContent.split('\n').filter(line => line.trim());
            const cleanLines = lines.filter(line => 
              !line.includes('Now, let me summarize') && 
              !line.includes('Your insights have been') &&
              !line.includes('report:')
            );
            
            // Add download link message
            const downloadMessage = createDownloadLinkMessage(processedReportType as any);
            
            const enhancedContent = cleanLines.length > 0 
              ? `${cleanLines.join('\n\n')}\n\n${downloadMessage}`
              : downloadMessage;
            
            const newMessage: Message = {
              role: 'assistant',
              content: enhancedContent,
              timestamp: new Date(),
              phase: finalPhase
            };

            setMessages(prevMessages => {
              const updatedMessages = [...prevMessages, newMessage];
              updateInterviewMessages(updatedMessages);
              return updatedMessages;
            });
            
            // FIXED: Set demo answer with correct phase and question count
            const currentCount = calculateQuestionProgress([...(Array.isArray(messages) ? messages : messages.data), newMessage]);
            findAndSetSuggestedAnswer(enhancedContent, finalPhase, currentCount);
            
          } else if (processedReportType === 'complete') {
            // NEW: Enhanced final message
            const finalMessage = `🎉 **Congratulations! Your Brand Alchemy Spark is Complete!**

Thank you for this illuminating journey through your brand's authentic essence. We've uncovered powerful insights about your brand identity, messaging consistency, and audience alignment.

📋 **Your Complete Brand Transformation Report is Ready!**

This comprehensive analysis brings together all insights from our discussions and provides:
- Strategic brand positioning recommendations
- Actionable growth roadmap
- Prioritized next steps
- Professional brand analysis

🔽 **Download Your Complete Report:** [Click here for your Brand Alchemy Spark](#download-complete)

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
            // Regular message processing
            const newMessage: Message = {
              role: 'assistant',
              content: remainingContent,
              timestamp: new Date(),
              phase: finalPhase
            };

            setMessages(prevMessages => {
              const updatedMessages = [...prevMessages, newMessage];
              updateInterviewMessages(updatedMessages);
              return updatedMessages;
            });
            
            // FIXED: Set demo answer with correct phase and question count
            const currentCount = calculateQuestionProgress([...(Array.isArray(messages) ? messages : messages.data), newMessage]);
            findAndSetSuggestedAnswer(remainingContent, finalPhase, currentCount);
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
      // FIXED: Updated required sections to match assistant instructions
      const requiredSections = [
        'Brand Breakthrough',
        'Your Brand at a Glance',
        'Key Observations and Insights',
        'Personalized Growth Roadmap', // FIXED: Was "Personalized Growth Formula"
        'Action Plan: Where to Focus Next',
        'Next Steps for Growth',
        'Prioritization Matrix',
        'The Brand Alchemy Mastery Course'
      ];
      
      const missingSections = requiredSections.filter(section => 
        !reportContent.includes(section)
      );
      
      const hasProperMatrix = reportContent.includes('| Recommendation | Impact | Effort | Priority |');
      
      const matrixTableLines = reportContent.split('\n').filter(line => 
        line.includes('Prioritization Matrix') || 
        line.includes('| Recommendation') ||
        line.includes('|------') ||
        (line.startsWith('|') && line.includes('|'))
      );
      
      const hasProperHeaderSeparator = matrixTableLines.some(line => 
        line.includes('|----') && line.includes('-------|')
      );
      
      if (missingSections.length === 0 && hasProperMatrix && hasProperHeaderSeparator) {
        return reportContent;
      }
      
      console.log('Fixing report format issues:', {
        missingSections,
        hasProperMatrix,
        hasProperHeaderSeparator
      });
      
      let fixPrompt = "Your last report is missing required elements or has formatting issues. Please fix and regenerate the final report with ALL these sections:\n\n";
      
      if (missingSections.length > 0) {
        fixPrompt += `Missing sections: ${missingSections.join(', ')}\n\n`;
      }
      
      if (!hasProperMatrix || !hasProperHeaderSeparator) {
        fixPrompt += `The Prioritization Matrix table MUST be formatted as a proper markdown table with this exact format:

| Recommendation | Impact | Effort | Priority |
|---------------|--------|--------|----------|
| [Action 1]     | High   | Low    | Quick Win |
| [Action 2]     | High   | High   | Major Project |
| [Action 3]     | Medium | Low    | Filler |
| [Action 4]     | Low    | High   | Avoid or Postpone |

Ensure all table cells are properly formatted. Each row should contain exactly one line of content per cell with appropriate alignment. Do not use multiple lines within a single cell and ensure consistent formatting across all rows. The second line MUST contain dashes and separator pipes to properly format the header row.\n\n`;
      }
      
      fixPrompt += "Please regenerate ONLY the final report, exactly following the Final Transformation Summary template from the instructions, with all required sections. The report should start with '# Elevate Your Brand, Empower Your Vision' and include all sections in the correct order.";
      
      await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: fixPrompt
      });
      
      setProcessingStage('fixing');
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

    setMessages(prev => [...prev, userMessage]);
    scrollToBottom('instant');
    setInput('');
    setIsLoading(true);
    setIsTyping(true);
    setProcessingStage('sending');

    try {
      setProcessingStage('translating');
      await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: userMessage.content
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setProcessingStage('reading');
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
            toast.error('Request timed out. Please try again.');
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
        await updateDoc(doc(db, 'interviews', interviewId), {
          messages: newMessages,
          questionCount: calculateQuestionProgress(newMessages),
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

  // NEW: Enhanced message bubble with download link handling
  const renderEnhancedMessageBubble = (message: Message, index: number) => {
    // Check if message contains download links
    const hasDownloadLinks = message.content.includes('#download-');
    
    if (hasDownloadLinks) {
      const processedContent = message.content.replace(
        /\[Click here to download your (.*?) report\]\(#download-(.*?)\)/g,
        (match, reportName, reportType) => {
          return `<button onclick="window.downloadReport('${reportType}')" class="inline-flex items-center gap-2 px-4 py-2 bg-desert-sand hover:bg-champagne text-dark-gray font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-4-4m4 4l4-4m6 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6"/>
            </svg>
            Download ${reportName} Report
          </button>`;
        }
      );
      
      // Add download function to window for onclick handlers
      (window as any).downloadReport = downloadReport;
      
      return (
        <MessageBubble
          key={index}
          message={{...message, content: processedContent}}
          isLast={index === messages.length - 1}
          brandName={sessionStorage.getItem('brandName') || ''}
          reportContent={reports.complete || null}
        />
      );
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
          
          {/* NEW: Enhanced typing indicator with report generation status */}
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