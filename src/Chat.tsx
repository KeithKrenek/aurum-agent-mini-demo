import React, { useState, useEffect, useRef } from 'react';
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

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (!messageListRef.current) return;
    
    const scrollContainer = messageListRef.current;
    const scrollHeight = scrollContainer.scrollHeight;
    const clientHeight = scrollContainer.clientHeight;
    const maxScroll = scrollHeight - clientHeight;
    
    // Ensure we're only scrolling if we need to
    if (scrollContainer.scrollTop < maxScroll) {
      try {
        scrollContainer.scrollTo({
          top: scrollHeight,
          behavior,
        });
      } catch (error) {
        // Fallback for browsers that don't support smooth scrolling
        scrollContainer.scrollTop = scrollHeight;
      }
    }
  };

  const findAndSetSuggestedAnswer = (assistantContent: string) => {
    // Return early if the interview is complete or the phase is invalid
    if (currentPhase === 'complete' || !isValidPhase(currentPhase)) {
      setSuggestedAnswer(null);
      return;
    }

    // Map phases to their corresponding question indices in the PREDEFINED_QUESTIONS array
    const phaseQuestionIndices = {
      discovery: [0, 1, 2],
      messaging: [3, 4, 5],
      audience: [6, 7, 8],
    };

    const questionIndices = phaseQuestionIndices[currentPhase];
    const phaseAnswers = MOCK_ANSWERS[currentPhase];

    // Loop through the questions for the current phase
    for (let i = 0; i < questionIndices.length; i++) {
      const questionIndex = questionIndices[i];
      const questionText = PREDEFINED_QUESTIONS[questionIndex];

      if (questionText) {
        // Use a snippet of the question to check for a match
        const questionSnippet = questionText.substring(0, 40);
        if (assistantContent.includes(questionSnippet)) {
          setSuggestedAnswer(phaseAnswers[i]);
          return; // Exit after finding a match
        }
      }
    }
  };

  // Remove all existing scroll-related useEffect hooks and replace with:
  
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;
    
    if (messages.length > 0 || isTyping) {
      // Wait for content to render and stabilize
      scrollTimeout = setTimeout(() => {
        scrollToBottom(isTyping ? 'smooth' : 'instant');
      }, 100);
    }
    
    return () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [messages, isTyping]);

  useEffect(() => {
    if (messages.length > 0) {
      updateQuestionCount(messages);
    }
  }, [messages]); 

  const adjustMessageListPadding = () => {
    if (!inputBoxRef.current || !messageListRef.current) return;
    
    const inputHeight = inputBoxRef.current.offsetHeight;
    const padding = inputHeight + 20; // 20px extra space
    
    requestAnimationFrame(() => {
      if (messageListRef.current) {
        messageListRef.current.style.paddingBottom = `${padding}px`;
      }
    });
  };
  
  useEffect(() => {
    adjustMessageListPadding();
    
    // Add resize observer to handle dynamic input height changes
    const resizeObserver = new ResizeObserver(adjustMessageListPadding);
    
    if (inputBoxRef.current) {
      resizeObserver.observe(inputBoxRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isLoading || messages.length > 0) {
            e.preventDefault();
            e.returnValue = '';
            
            // Save current state
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

  // Focus the textarea when the component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Refocus the textarea when the Assistant stops typing
  useEffect(() => {
    if (!isTyping) {
      inputRef.current?.focus();
    }
  }, [isTyping]);

  // Update question count based on Assistant messages
  // Unify the counting logic between functions:
  const updateQuestionCount = (messages: Message[]): number => {
    // Calculate total completed questions using consistent logic
    const discoveryCompleted = getCompletedQuestionsForPhase(messages, 'discovery');
    const messagingCompleted = getCompletedQuestionsForPhase(messages, 'messaging');
    const audienceCompleted = getCompletedQuestionsForPhase(messages, 'audience');
    
    const totalCompleted = discoveryCompleted + messagingCompleted + audienceCompleted;
    
    // Only log once and set state once
    console.log(`Total completed questions: ${totalCompleted}/9 (Discovery: ${discoveryCompleted}/3, Messaging: ${messagingCompleted}/3, Audience: ${audienceCompleted}/3)`);
    
    setQuestionCount(totalCompleted);
    return totalCompleted;
  };

  // Helper function to manage run status
  const waitForRunCompletion = async (threadId: string, runId: string, maxAttempts = 30) => {
    // console.log('waitForRunCompletion called');
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
      
      if (runStatus.status === 'completed') {
        return true;
      }
      
      if (runStatus.status === 'failed' || runStatus.status === 'cancelled') {
        throw new Error(`Run ${runStatus.status}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    throw new Error('Run timed out');
  };

  const getCompletedQuestionsForPhase = (messages: any[], phase: PhaseId): number => {
    // Get indices for questions in this phase
    const phaseIndices = {
      'discovery': [0, 1, 2],
      'messaging': [3, 4, 5],
      'audience': [6, 7, 8],
      'complete': []
    }[phase] || [];
    
    // Get questions for this phase
    const phaseQuestions = phaseIndices.map(idx => PREDEFINED_QUESTIONS[idx]);
    
    // Create regex patterns
    const patterns = phaseQuestions.map(q => 
      new RegExp(q.substring(0, Math.min(50, q.length)), 'i')
    );
    
    // Count assistant messages that contain a question from this phase
    let questionsAsked = 0;
    
    // Process messages in sequence
    for (const message of messages) {
      if (message.role === 'assistant') {
        const content = typeof message.content === 'string' 
          ? message.content 
          : (message.content[0]?.type === 'text' ? message.content[0].text.value : '');
        
        // Check if this message contains a phase completion marker
        const phaseMarkerRegex = /===PHASE_COMPLETE:(discovery|messaging|audience|complete)===/i;
        const phaseMarkerMatch = content.match(phaseMarkerRegex);
        const markedPhaseCompletion = phaseMarkerMatch ? phaseMarkerMatch[1].toLowerCase() : null;
        
        // If this message marks the current phase complete, count all questions as complete
        if (markedPhaseCompletion === phase) {
          return phaseQuestions.length;
        }
        
        // Otherwise, check if this message contains a question from this phase
        for (const pattern of patterns) {
          if (pattern.test(content)) {
            questionsAsked++;
            break;
          }
        }
      }
    }
    
    // Count one less than questions asked since the last question doesn't have a response yet
    return Math.min(questionsAsked, phaseQuestions.length);
  };

  // Helper function to manage active runs
  // const handleActiveRuns = async (threadId: string) => {
  //   try {
  //     const runs = await openai.beta.threads.runs.list(threadId);
  //     const activeRuns = runs.data.filter(run => 
  //       ['in_progress', 'queued'].includes(run.status)
  //     );

  //     for (const run of activeRuns) {
  //       try {
  //         await openai.beta.threads.runs.cancel(threadId, run.id);
  //         await new Promise(resolve => setTimeout(resolve, 1000));
  //       } catch (error) {
  //         console.log(`Run ${run.id} already completed or cancelled`);
  //       }
  //     }

  //     await new Promise(resolve => setTimeout(resolve, 1000));
  //   } catch (error) {
  //     console.error('Error handling active runs:', error);
  //     throw error;
  //   }
  // };

  // Helper function to check run status
  const checkRunStatus = async (threadId: string, runId: string) => {
    // console.log('checkRunStatus called');
    try {
      const runStatus = await openai.beta.threads.runs.retrieve(threadId, runId);
      return runStatus.status;
    } catch (error) {
      console.error('Error checking run status:', error);
      return 'failed';
    }
  };

  // Helper function to cancel a run
  const cancelRun = async (threadId: string, runId: string) => {
    // console.log('cancelRun called');
    try {
      await openai.beta.threads.runs.cancel(threadId, runId);
      
      // Wait and verify the cancellation
      let status;
      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        status = await checkRunStatus(threadId, runId);
      } while (status === 'cancelling');
      
    } catch (error) {
      // If we get a 'not found' or 'already cancelled' error, that's fine
      console.log('Run already completed or cancelled');
    }
  };

  // Helper function to ensure no active runs
  const ensureNoActiveRuns = async (threadId: string) => {
    // console.log('ensureNoActiveRuns called');
    try {
      const runs = await openai.beta.threads.runs.list(threadId);
      const activeRuns = runs.data.filter(run => 
        ['in_progress', 'queued', 'cancelling'].includes(run.status)
      );
      
      // Cancel all active runs sequentially
      for (const run of activeRuns) {
        await cancelRun(threadId, run.id);
      }
      
      // Add a small delay after cancelling all runs
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Error managing active runs:', error);
      throw error;
    }
  };

  // Initialize chat session
  const initializeChat = async () => {

    const savedState = sessionStorage.getItem(`interview_${interviewId}_state`);
    if (savedState) {
      try {
          const parsed = JSON.parse(savedState);
          const lastUpdate = new Date(parsed.lastUpdate);
          const now = new Date();
          
          // Only recover state if it's less than 30 minutes old
          if (now.getTime() - lastUpdate.getTime() < 30 * 60 * 1000) {
              setMessages(parsed.messages);
              setCurrentPhase(parsed.currentPhase);
              setQuestionCount(parsed.questionCount);
          }
          
          // Clear the saved state
          sessionStorage.removeItem(`interview_${interviewId}_state`);
      } catch (error) {
          console.error('Error recovering saved state:', error);
      }
    }

    // console.log('initializeChat called');
    if (!interviewId) {
        navigate('/');
        return;
    }

    try {
        const interviewDoc = await getDoc(doc(db, 'interviews', interviewId));
        if (!interviewDoc.exists()) {
            throw new Error('Interview not found');
        }

        const interviewData = interviewDoc.data() as Interview;
        let threadId = interviewData.threadId;

        // If no threadId exists, create a new OpenAI thread
        if (!threadId) {
            const newThread = await openai.beta.threads.create();
            threadId = newThread.id;

            // Update Firestore with the new threadId
            await updateDoc(doc(db, 'interviews', interviewId), {
                threadId: newThread.id,
                lastUpdated: new Date()
            });
        }

        // Set state values
        setThreadId(threadId);
        setMessages(interviewData.messages || []);
        setCurrentPhase(interviewData.currentPhase || 'discovery');
        updateQuestionCount(interviewData.messages || []);
        setReports(interviewData.reports || {});
        // console.log('updateQuestionCount called from initializeChat');

        // console.log('Firestore Interview Data:', {
        //   interviewId,
        //   threadId: interviewData.threadId
        // });

        // Auto-start the conversation if no messages exist
        if (interviewData.messages.length === 0) {
            await startNewConversation(threadId);
        }
    } catch (error) {
        console.error('Error initializing chat:', error);
        toast.error('Failed to initialize chat. Please try again.');
        navigate('/');
    }
};

  // Start new conversation
  const startNewConversation = async (threadId: string) => {
    // console.log('startNewConversation called');
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
      
      // Use the existing helper function instead of manual status checking
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

        // updateQuestionCount([newMessage]);
      }
      
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Failed to start conversation. Retrying...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      await startNewConversation(threadId); // Retry once
    } finally {
      setIsTyping(false);
    }
  };

  // // Function to verify phase completion
  // const verifyPhaseCompletion = (phase: PhaseId, messageHistory: Message[]): boolean => {
  //   // Define expected question patterns for each phase
  //   const phaseQuestions = {
  //     'discovery': [
  //       /why they should choose your business/i,
  //       /principles or beliefs guide/i,
  //       /business were a person/i
  //     ],
  //     'messaging': [
  //       /explain what makes your business special/i,
  //       /casual and friendly, or more professional/i,
  //       /telling the same story everywhere/i
  //     ],
  //     'audience': [
  //       /favorite customer/i,
  //       /biggest problems or challenges/i,
  //       /social media posts or emails/i
  //     ]
  //   };
    
  //   if (!(phase in phaseQuestions)) return false;
    
  //   // Check if all questions have been asked
  //   const questionsAsked = phaseQuestions[phase as 'discovery' | 'messaging' | 'audience'].map(pattern => {
  //     return messageHistory
  //       .filter(m => m.role === 'assistant')
  //       .some(m => pattern.test(m.content));
  //   });
    
  //   // Check if all questions have been answered
  //   const questionsAnswered: boolean[] = questionsAsked.map((asked: boolean, index: number): boolean => {
  //     if (!asked) return false;
      
  //     // Find the index of the assistant message with this question
  //     const assistantMsgIndex: number = messageHistory
  //     .findIndex((m: Message) => m.role === 'assistant' && phaseQuestions[phase as 'discovery' | 'messaging' | 'audience'][index].test(m.content));
      
  //     if (assistantMsgIndex === -1) return false;
      
  //     // Check if there's a user response after this question
  //     return messageHistory
  //     .slice(assistantMsgIndex + 1)
  //     .some((m: Message) => m.role === 'user');
  //   });
    
  //   // Return true if all questions have been asked and answered
  //   return questionsAsked.every(q => q) && questionsAnswered.every(a => a);
  // };

  // Function to validate phase transition
  // const validatePhaseTransition = (currentPhase: PhaseId, messageHistory: Message[]): boolean => {
  //   return verifyPhaseCompletion(currentPhase, messageHistory);
  // };

  const parseAssistantResponse = (response: string) => {
    // Use a more specific regex pattern to match markdown report blocks
    const reportRegex = /```markdown\s*([\s\S]*?)\s*```/g;
    let reportContents: string[] = [];
    let match;
  
    let remainingContent = response;
  
    // Extract all report blocks with improved pattern matching
    while ((match = reportRegex.exec(response)) !== null) {
      const reportContent = match[1].trim();
      // Validate that this is a properly formatted report
      if (reportContent.includes('#')) {
        reportContents.push(reportContent);
        // Remove entire matched block (including ```markdown and ```)
        remainingContent = remainingContent.replace(match[0], '').trim();
      }
    }
  
    // Add hyperlink to course mentions
    const courseRegex = /Brand Alchemy Mastery course|course/gi;
    const linkedContent = remainingContent.replace(courseRegex, 
      match => `<a href="https://dfl0.us/s/ab4d2c7a?em=%7B%7Bcontact.email%7D%7D" target="_blank" class="text-dark-midnight hover:text-goldenrod underline">${match}</a>`
    );

    // console.log(`Extracted ${reportContents.length} reports`);

    // Check if this is the final report
    if (reportContents.length > 0 && reportContents.some(r => /elevate your brand/i.test(r))) {
      const finalReport = reportContents.find(r => /elevate your brand/i.test(r));
      
      // Verify required sections
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
        // Could prompt the Assistant to fix the report
      }
      
      // Verify prioritization matrix table exists
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
        
        // Look for phase completion markers first
        const phaseMarkerRegex = /===PHASE_COMPLETE:(discovery|messaging|audience|complete)===/i;
        const phaseMarkerMatch = rawContent.match(phaseMarkerRegex);
        let markedPhaseCompletion = phaseMarkerMatch ? phaseMarkerMatch[1].toLowerCase() : null;
        
        let cleanedContent = rawContent;
        if (markedPhaseCompletion) {
          console.log(`Phase completion marker detected: ${markedPhaseCompletion}`);
        
          if (interviewId && isValidPhase(markedPhaseCompletion)) {
            console.log(`Processing ${markedPhaseCompletion} phase completion`);
            // Clean the content by removing the phase marker line and any blank lines that follow it
            
            // Split the content into lines
            const lines = rawContent.split(/\n/);
            
            // Find the index of the line with the phase marker
            const markerLineIndex = lines.findIndex(line => /===PHASE_COMPLETE:[a-z]+===/i.test(line));
            
            if (markerLineIndex !== -1) {
              // Remove the marker line
              lines.splice(markerLineIndex, 1);
              
              // Remove any blank lines that follow until we find a non-blank line
              while (markerLineIndex < lines.length && lines[markerLineIndex].trim() === '') {
                lines.splice(markerLineIndex, 1);
              }
              
              // Join the lines back together
              cleanedContent = lines.join('\n');
            }
          }
        }
        
        // Extract reports from markdown blocks
        const { reportContents, remainingContent } = parseAssistantResponse(cleanedContent);
  
        // Track if we've updated the phase during this processing
        let phaseUpdated = false;
        
        // Before processing phase completion based on markers, verify all questions are complete
        if (markedPhaseCompletion && interviewId) {
          // Check if all questions for the current phase are actually complete
          const completedInPhase = getCompletedQuestionsForPhase(messages.data, currentPhase);
          const totalInPhase = {
            'discovery': 3,
            'messaging': 3,
            'audience': 3,
            'complete': 0
          }[currentPhase] || 0;
          
          // Only process the phase marker if:
          // 1. All questions were actually completed, OR
          // 2. The marker is for a different phase than current (for handling delayed markers)
          const isAllQuestionsCompleted = completedInPhase >= totalInPhase;
          const isMarkerForPreviousPhase = currentPhase !== markedPhaseCompletion;
          
          if (!isAllQuestionsCompleted && !isMarkerForPreviousPhase) {
            console.log(`Ignoring premature phase marker for ${markedPhaseCompletion} (only ${completedInPhase}/${totalInPhase} questions completed)`);
            // Skip processing this marker for now
            markedPhaseCompletion = null;
          }
        }
        
        // Process reports first before adding the new message
        for (const reportContent of reportContents) {
          if (!reportContent.includes('#')) {
            console.error('Invalid report format detected:', reportContent);
            continue;
          }
          
          // Improved report type detection with more flexible pattern matching
          let reportType = 
          /brand elements discovery/i.test(reportContent) ? 'discovery' :
          /brand voice analysis/i.test(reportContent) ? 'messaging' :
          /brand audience alignment/i.test(reportContent) ? 'audience' :
          /elevate your brand/i.test(reportContent) ? 'complete' : null;
  
          // Additional fallback detection for final report
          if (!reportType && /prioritization matrix/i.test(reportContent)) {
            console.log('Detected final report via Prioritization Matrix section');
            reportType = 'complete';
          }
  
          // Use phase marker if report type detection failed
          if (!reportType && markedPhaseCompletion) {
            console.log(`Using phase marker to identify report type: ${markedPhaseCompletion}`);
            reportType = markedPhaseCompletion;
          }
          
          if (reportType && interviewId) {
            console.log(`Processing ${reportType} report`);
  
            let finalReportContent = reportContent;
            
            // If this is the final report, check and fix format if needed
            if (reportType === 'complete') {
              setProcessingStage('fixing');
              finalReportContent = await promptAssistantToFixReport(threadId, reportContent);
            }
            
            // Update the reports in Firestore
            await updateDoc(doc(db, 'interviews', interviewId), {
              [`reports.${reportType}`]: finalReportContent,
              lastUpdated: new Date()
            });
            
            // Update reports state
            setReports(prev => ({...prev, [reportType]: finalReportContent}));
            
            // Update phase if this wasn't the final report
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
  
        // Fallback for missing reports - check if this is a third question response
        if (reportContents.length === 0 && !phaseUpdated && currentPhase !== 'complete') {
          // Instead of immediately progressing, we should wait for the next message from Assistant
          const completedInPhase = getCompletedQuestionsForPhase(messages.data, currentPhase);
          const totalInPhase = {
            'discovery': 3,
            'messaging': 3,
            'audience': 3,
            'complete': 0
          }[currentPhase] || 0;
          
          console.log(`Completed questions in ${currentPhase} phase: ${completedInPhase}/${totalInPhase}`);
          
          // Only log that we're waiting for phase completion marker, but don't force progress
          if (completedInPhase === totalInPhase && totalInPhase > 0) {
            console.log(`All ${totalInPhase} questions completed in ${currentPhase} phase, waiting for phase marker`);
            // Remove the force progression code here, as we should wait for the marker
          }
        }
  
        // Always process the message content after handling reports
        if (remainingContent?.trim()) {
          const newMessage: Message = {
            role: 'assistant',
            content: remainingContent,
            timestamp: new Date(),
            // Use the updated phase if we just changed it
            phase: phaseUpdated ? getNextPhase(currentPhase) || currentPhase : currentPhase
          };
  
          setMessages(prevMessages => {
            const updatedMessages = [...prevMessages, newMessage];
            // updateQuestionCount(updatedMessages);
            updateInterviewMessages(updatedMessages);
            return updatedMessages;
          });
          findAndSetSuggestedAnswer(remainingContent);
        }
      }
    } catch (error) {
      console.error('Error processing assistant response:', error);
      toast.error('There was an error processing the response. Retrying...');
      
      if (attemptNumber < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return processAssistantResponse(threadId, attemptNumber + 1);
      }
      throw error;
    }
  };

  const promptAssistantToFixReport = async (threadId: string, reportContent: string): Promise<string> => {
    try {
      // Define required sections for the final report
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
      
      // Check for missing sections
      const missingSections = requiredSections.filter(section => 
        !reportContent.includes(section)
      );
      
      // Check if Prioritization Matrix has table format
      const hasProperMatrix = reportContent.includes('| Recommendation | Impact | Effort | Priority |');
      
      // Extract matrix table lines to check for proper formatting
      const matrixTableLines = reportContent.split('\n').filter(line => 
        line.includes('Prioritization Matrix') || 
        line.includes('| Recommendation') ||
        line.includes('|------') ||
        (line.startsWith('|') && line.includes('|'))
      );
      
      const hasProperHeaderSeparator = matrixTableLines.some(line => 
        line.includes('|----') && line.includes('-------|')
      );
      
      // If everything is fine, return the original content
      if (missingSections.length === 0 && hasProperMatrix && hasProperHeaderSeparator) {
        return reportContent;
      }
      
      console.log('Fixing report format issues:', {
        missingSections,
        hasProperMatrix,
        hasProperHeaderSeparator
      });
      
      // Craft prompt to fix the report
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
      
      // Send the fix prompt to the Assistant
      await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: fixPrompt
      });
      
      // Create a run to get the Assistant's response
      setProcessingStage('fixing');
      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: config.openai.assistantId
      });
      
      // Wait for the run to complete
      await waitForRunCompletion(threadId, run.id);
      
      // Get the fixed report
      const messages = await openai.beta.threads.messages.list(threadId);
      const lastMessage = messages.data[0];
      
      if (lastMessage.role === 'assistant' && lastMessage.content[0].type === 'text') {
        const fixedContent = lastMessage.content[0].text.value;
        
        // Extract the regenerated report from the response
        const reportRegex = /```markdown\s*([\s\S]*?)\s*```/g;
        const match = reportRegex.exec(fixedContent);
        
        if (match && match[1]) {
          // Verify the fixed report has the table properly formatted
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
      
      // If extraction failed, return original content
      console.error('Failed to fix report format');
      return reportContent;
      
    } catch (error) {
      console.error('Error fixing report:', error);
      return reportContent; // Return original on error
    }
  };

  // Send message
  const sendMessage = async () => {
    // console.log('sendMessage called');
    if (!input.trim() || !threadId || !interviewId || isLoading) return;
    setSuggestedAnswer(null); // Clear any existing suggestion

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      phase: currentPhase
    };

    setMessages(prev => [...prev, userMessage]);
    scrollToBottom('instant');  // Immediate scroll after user message
    setInput('');
    setIsLoading(true);
    setIsTyping(true);
    setProcessingStage('sending');

    try {
      // Create message
      setProcessingStage('translating');
      await openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: userMessage.content
      });

      // Short delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setProcessingStage('reading');
      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: config.openai.assistantId
      });

      // Monitor run status with stage updates
      setProcessingStage('thinking');
      await waitForRunCompletion(threadId, run.id);
      
      setProcessingStage('formulating');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setProcessingStage('finalizing');
      await processAssistantResponse(threadId);
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  // Update interview messages in Firestore
  const updateInterviewMessages = async (newMessages: Message[]) => {
    // console.log('updateInterviewMessages called');
    if (interviewId) {
      try {
        await updateDoc(doc(db, 'interviews', interviewId), {
          messages: newMessages,
          lastUpdated: new Date()
        });
      } catch (error) {
        console.error('Error updating messages:', error);
        toast.error('Failed to save message history.');
      }
    }
  };

  const getNextPhase = (current: string): 'messaging' | 'audience' | 'complete' | null => {
    // console.log('getNextPhase called');
    const phases = ['discovery', 'messaging', 'audience', 'complete'];
    const currentIndex = phases.indexOf(current);
    return phases[currentIndex + 1] as 'messaging' | 'audience' | 'complete' | null;
  };

  // const handleReportGeneration = async (reportText: string) => {
  //   // console.log('handleReportGeneration called');
  //   try {
  //       if (!interviewId) throw new Error('Interview ID not found');
  //       const interviewRef = doc(db, 'interviews', interviewId);
  //       const interviewDoc = await getDoc(interviewRef);
  //       if (!interviewDoc.exists()) throw new Error('Interview not found');

  //       const interviewData = interviewDoc.data() as Interview;
  //       const currentReports = interviewData.reports || {};

  //       const updatedReports = {
  //           ...currentReports,
  //           [currentPhase]: reportText
  //       };

  //       await updateDoc(interviewRef, {
  //           reports: updatedReports,
  //           currentPhase: getNextPhase(currentPhase) || 'complete',
  //           lastUpdated: new Date(),
  //       });

  //       setReports(updatedReports);
  //       setCurrentPhase(prev => getNextPhase(prev) || 'complete');

  //   } catch (error) {
  //       console.error('Error handling report generation:', error);
  //       toast.error('Failed to save report. Please try again.');
  //   }
  // };
  

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
      
      <main className="flex-grow relative overflow-hidden bg-white-smoke mt-24"> {/* Add mt-24 to push content below the progress bar */}
        <div 
          ref={messageListRef}
          className="absolute inset-0 overflow-y-auto px-6 pt-4 space-y-4"
          style={{ 
            paddingBottom: `${inputBoxRef.current?.offsetHeight || 80}px`,
            paddingTop: '1rem'
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
              <span className="animate-pulse"></span>
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