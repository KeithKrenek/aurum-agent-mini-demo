import React, { useState, useEffect, useRef, useCallback } from 'react';
import OpenAI from 'openai';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from './firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { ProgressManager } from './ProgressManager';
import { Interview, Message, PhaseId, isValidPhase } from './types/interview';
import MessageInput from './MessageInput';
import MessageBubble from './MessageBubble';
import PhaseProgress from './PhaseProgress';
import { config } from './config/environment';
import { PREDEFINED_QUESTIONS, MOCK_ANSWERS } from './types/constants';
import { ProcessingStage, processingMessages } from './types/constants';

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
  const messageListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const progressManager = useRef<ProgressManager | null>(null);
  const navigate = useNavigate();
  const { interviewId: urlInterviewId } = useParams<{ interviewId: string }>();
  const inputBoxRef = useRef<HTMLDivElement>(null);

  // Fallback to sessionStorage
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

  // Enhanced question detection and counting logic
  const calculateQuestionProgress = useCallback((messageHistory: Message[]): number => {
    // Only count completed question-answer pairs
    let completedQuestions = 0;
    
    // Look for pairs where assistant asks a question and user responds
    for (let i = 0; i < messageHistory.length - 1; i++) {
      const currentMessage = messageHistory[i];
      const nextMessage = messageHistory[i + 1];
      
      if (currentMessage.role === 'assistant' && nextMessage.role === 'user') {
        // Check if assistant message contains a question from our predefined list
        const containsQuestion = PREDEFINED_QUESTIONS.some(question => {
          const questionSnippet = question.substring(0, 40).toLowerCase();
          return currentMessage.content.toLowerCase().includes(questionSnippet);
        });
        
        if (containsQuestion) {
          completedQuestions++;
        }
      }
    }
    
    // Don't exceed the total number of questions
    return Math.min(completedQuestions, PREDEFINED_QUESTIONS.length);
  }, []);

  const findAndSetSuggestedAnswer = useCallback((assistantContent: string) => {
    if (currentPhase === 'complete' || !isValidPhase(currentPhase)) {
      setSuggestedAnswer(null);
      return;
    }

    const phaseQuestionIndices = {
      discovery: [0, 1, 2],
      messaging: [3, 4, 5],
      audience: [6, 7, 8],
    };

    const questionIndices = phaseQuestionIndices[currentPhase];
    const phaseAnswers = MOCK_ANSWERS[currentPhase];

    for (let i = 0; i < questionIndices.length; i++) {
      const questionIndex = questionIndices[i];
      const questionText = PREDEFINED_QUESTIONS[questionIndex];

      if (questionText) {
        const questionSnippet = questionText.substring(0, 40);
        if (assistantContent.includes(questionSnippet)) {
          setSuggestedAnswer(phaseAnswers[i]);
          return;
        }
      }
    }
    
    setSuggestedAnswer(null);
  }, [currentPhase]);

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

  // Enhanced question counting with better logic
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
          throw new Error(`Run ${runStatus.status}: ${runStatus.last_error?.message || 'Unknown error'}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      } catch (error) {
        if (attempts >= maxAttempts - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
    }
    
    throw new Error('Run timed out');
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
      throw error;
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
        console.error('Interview document not found during chat initialization');
        throw new Error('Interview not found');
      }

      const interviewData = interviewDoc.data() as Interview;
      console.log('Chat initialization - Interview data:', interviewData); // Debug log
      
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
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
      toast.error('Failed to initialize chat. Please try again.');
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
        findAndSetSuggestedAnswer(newMessage.content);
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
      
      const requiredSections = [
        'brand breakthrough',
        'your brand at a glance',
        'key observations',
        'personalized growth formula',
        'action plan',
        'next steps for growth',
        'prioritization matrix',
        'brand alchemy mastery'
      ];
      
      const missingSections = requiredSections.filter(section => 
        !finalReport?.toLowerCase().includes(section.toLowerCase())
      );
      
      if (missingSections.length > 0) {
        console.error(`Final report missing required sections: ${missingSections.join(', ')}`);
      }
      
      if (!finalReport?.includes('| Recommendation | Impact | Effort | Priority |')) {
        console.error('Prioritization matrix table is missing or malformatted');
      }
    }

    return {
      reportContents,
      remainingContent: linkedContent
    };
  };

  const processAssistantResponse = async (threadId: string, attemptNumber = 1) => {
    const MAX_RETRIES = 3;
    
    try {
      const messages = await openai.beta.threads.messages.list(threadId);
      if (!messages?.data?.length) {
        throw new Error('No messages received from OpenAI');
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
        
        if (markedPhaseCompletion && interviewId) {
          const completedInPhase = calculateQuestionProgress(messages.data.filter(m => m.role === 'assistant' || m.role === 'user').map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content[0].type === 'text' ? m.content[0].text.value : '',
            timestamp: new Date(),
            phase: currentPhase
          })));
          
          const totalInPhase = {
            'discovery': 3,
            'messaging': 3,
            'audience': 3,
            'complete': 0
          }[currentPhase] || 0;
          
          const isAllQuestionsCompleted = completedInPhase >= totalInPhase;
          const isMarkerForPreviousPhase = currentPhase !== markedPhaseCompletion;
          
          if (!isAllQuestionsCompleted && !isMarkerForPreviousPhase) {
            console.log(`Ignoring premature phase marker for ${markedPhaseCompletion} (only ${completedInPhase}/${totalInPhase} questions completed)`);
            markedPhaseCompletion = null;
          }
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
              const nextPhase = getNextPhase(reportType as PhaseId);
              if (nextPhase) {
                console.log(`Transitioning phase from ${reportType} to ${nextPhase}`);
                await updateDoc(doc(db, 'interviews', interviewId), {
                  currentPhase: nextPhase,
                  lastUpdated: new Date()
                });
                setCurrentPhase(nextPhase);
                phaseUpdated = true;
              }
            }
          }
        }

        if (remainingContent?.trim()) {
          const newMessage: Message = {
            role: 'assistant',
            content: remainingContent,
            timestamp: new Date(),
            phase: phaseUpdated ? getNextPhase(currentPhase) || currentPhase : currentPhase
          };

          setMessages(prevMessages => {
            const updatedMessages = [...prevMessages, newMessage];
            updateInterviewMessages(updatedMessages);
            return updatedMessages;
          });
          findAndSetSuggestedAnswer(remainingContent);
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
        'Personalized Growth Formula',
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
          const fixedTableLines = fixedReport.split('\n').filter(line => 
            line.includes('| Recommendation') ||
            line.includes('|------') ||
            (line.startsWith('|') && line.includes('|'))
          );
          
          const fixedHeaderSeparator = fixedTableLines.some(line => 
            line.includes('|----') && line.includes('-------|')
          );
          
          if (!fixedHeaderSeparator) {
            console.warn('Fixed report still has table formatting issues');
          } else {
            console.log('Successfully fixed report format');
          }
          
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
      toast.error('Failed to send message. Please try again.');
      
      // Attempt recovery by removing the failed user message
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
      
      <main className="flex-grow relative overflow-hidden bg-white-smoke mt-24">
        <div 
          ref={messageListRef}
          className="absolute inset-0 overflow-y-auto px-6 pt-4 space-y-4"
          style={{ 
            paddingBottom: `${inputBoxRef.current?.offsetHeight || 80}px`,
            paddingTop: '8rem'
          }}
        >
          {messages.map((message, index) => (
            <MessageBubble
              key={index}
              message={message}
              isLast={index === messages.length - 1}
              brandName={sessionStorage.getItem('brandName') || ''}
              reportContent={reports.complete || null}
            />
          ))}
          {isTyping && (
            <div className="flex items-center text-neutral-gray italic">
              <span className="mr-2">{processingMessages[processingStage]}</span>
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