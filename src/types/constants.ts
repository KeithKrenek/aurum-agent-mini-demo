// Enhanced constants with improved question matching and robust logic

export const PHASE_QUESTIONS = {
    'discovery': 3,
    'messaging': 3,
    'audience': 3,
    'complete': 0
} as const;

export const PREDEFINED_QUESTIONS = [
    // Discovery Phase (0-2)
    "When customers ask why they should choose your business over competitors, what's your answer? Think beyond just making money – what positive difference do you want to make for your customers?",
    "What three principles or beliefs guide how you run your business and treat your customers? For each one, what's a specific way you demonstrate this in your day-to-day operations?",
    "If your business were a person walking into a networking event, how would they act and speak? Describe their personality as if you're describing a friend.",
    
    // Messaging Phase (3-5)
    "If you had to explain what makes your business special in one short sentence, what would you say? Try to capture both what you do and why customers should care.",
    "When you talk about your business, do you tend to be more casual and friendly, or more professional and formal? Write a few lines about your business in this style to see how it sounds.",
    "Look at your website, social media, and any marketing materials. Are you telling the same story everywhere? Note any places where your message differs.",
    
    // Audience Phase (6-8)
    "Think about your favorite customer – the type you wish you had more of. What's the one thing that makes them such a great fit for your business?",
    "What are the three biggest problems or challenges that your best customers typically face before they find your business? Consider what really motivates them to seek help.",
    "When you look at your recent social media posts or emails to customers, do they directly address the problems you just identified? If not, what specific changes would make your message more relevant to your ideal customers?"
] as const;

// Enhanced mock answers with more realistic, detailed responses
export const MOCK_ANSWERS = {
  discovery: [
    // Question 1: Why choose your business?
    "Most AI companies rush to market with black-box solutions that work until they don't. We're different - every system we build is interpretable and has built-in safety guardrails. While others promise magic, we deliver AI that businesses can actually trust and understand. Our mission: make AI adoption safe for companies who can't afford catastrophic mistakes. We're not trying to replace human judgment, we're amplifying it with transparent, reliable automation that grows with your business.",
    
    // Question 2: Three guiding principles
    "Safety Before Speed: Every model goes through extensive testing scenarios, including adversarial inputs. We document failure cases and edge case handling before deployment. Interpretability Always: Our clients get plain-English explanations for every AI decision. Monthly reports show exactly how the system arrived at recommendations, no black boxes. Human-Centered Design: Regular check-ins with end users. AI suggests, humans decide. Built-in override capabilities and clear escalation paths when the system encounters uncertainty.",
    
    // Question 3: Business personality
    "Thoughtful listener who asks clarifying questions before offering solutions. Dressed professionally but approachably - think startup founder, not big tech executive. Explains AI concepts using relatable analogies instead of technical jargon. The person who stays engaged when others talk about their challenges, genuinely curious about how automation could help without overselling. Would follow up with relevant case studies, not generic sales pitches."
  ],
  messaging: [
    // Question 1: One-sentence explanation
    "We build AI systems that businesses can actually trust - transparent, safe, and designed to augment human decision-making rather than replace it.",
    
    // Question 2: Communication style
    "Professional but accessible - we avoid both AI hype and overly technical language: 'AI doesn't have to be scary or mysterious. We build systems that show their work, explain their reasoning, and give you confidence in every recommendation. No black boxes, no unpredictable behavior - just reliable automation that makes your team more effective while keeping humans in control of important decisions.'",
    
    // Question 3: Message consistency
    "Website emphasizes safety and interpretability strongly. LinkedIn posts sometimes focus too much on technical achievements, less on business value. Sales materials consistently highlight human-centered approach. Gap: case studies show impressive results but could better explain our safety methodology. Email nurture sequence needs more content addressing AI adoption fears and ROI concerns."
  ],
  audience: [
    // Question 1: Favorite customer type
    "Operations leaders at mid-sized companies who've been burned by overhyped tech solutions before. They value thorough vetting over flashy demos. Want to innovate but need to justify ROI and risk management to stakeholders. Appreciate vendors who understand regulatory constraints and the importance of explainable decisions in their industry.",
    
    // Question 2: Customer problems
    "Problem 1: Fear of AI unpredictability - worried about system failures, biased outputs, or decisions they can't explain to customers/regulators. Problem 2: Resource constraints - need AI benefits but lack ML expertise to evaluate solutions or manage complex implementations. Problem 3: Stakeholder buy-in challenges - difficulty convincing leadership that AI investment is worth the risk, especially after hearing AI horror stories in the news.",
    
    // Question 3: Message relevance
    "Content addresses safety concerns well but could better tackle the 'AI is too complex for us' worry. Recent posts focus on technical capabilities but miss the resource constraint angle - need more 'white glove implementation' messaging. Stakeholder buy-in challenge barely addressed in current materials. Should create more content around business cases, risk mitigation frameworks, and executive-level ROI discussions."
  ]
} as const;

// Enhanced processing stages with more descriptive messages
export type ProcessingStage = 
  | 'sending'
  | 'translating'
  | 'reading'
  | 'thinking'
  | 'formulating'
  | 'finalizing'
  | 'fixing'
  | 'connecting'
  | 'analyzing';

export const processingMessages: Record<ProcessingStage, string> = {
  sending: "Sending your message...",
  translating: "Processing your response...",
  reading: "Analyzing your input...",
  thinking: "Generating insights...",
  formulating: "Crafting response...",
  finalizing: "Preparing recommendations...",
  fixing: "Refining report format...",
  connecting: "Establishing connection...",
  analyzing: "Analyzing brand elements..."
} as const;

// Enhanced phase configuration with better metadata
export const PHASE_CONFIG = {
  discovery: {
    label: 'Discovery',
    description: 'Uncover your brand essence',
    questionIndices: [0, 1, 2],
    color: 'desert-sand',
    icon: '🔍',
    estimatedTime: '6-8 minutes'
  },
  messaging: {
    label: 'Messaging',
    description: 'Align your communication',
    questionIndices: [3, 4, 5],
    color: 'champagne',
    icon: '💬',
    estimatedTime: '5-7 minutes'
  },
  audience: {
    label: 'Audience',
    description: 'Connect with your people',
    questionIndices: [6, 7, 8],
    color: 'goldenrod',
    icon: '🎯',
    estimatedTime: '5-7 minutes'
  },
  complete: {
    label: 'Complete',
    description: 'Your brand transformation',
    questionIndices: [],
    color: 'dark-midnight',
    icon: '✨',
    estimatedTime: 'Complete'
  }
} as const;

// FIXED: Much more robust question keywords with multiple matching strategies
export const QUESTION_KEYWORDS = {
  discovery: [
    // Question 1: Competitors/differentiation - expanded keywords
    ['competitors', 'choose', 'business', 'different', 'why', 'over', 'customers', 'ask', 'answer', 'difference', 'positive'],
    // Question 2: Principles/beliefs - expanded keywords  
    ['principles', 'beliefs', 'guide', 'demonstrate', 'values', 'three', 'run', 'treat', 'customers', 'operations', 'way'],
    // Question 3: Personality - expanded keywords
    ['personality', 'person', 'networking', 'act', 'speak', 'friend', 'business', 'walking', 'event', 'describe']
  ],
  messaging: [
    // Question 1: One sentence explanation - expanded keywords
    ['explain', 'special', 'sentence', 'capture', 'care', 'short', 'business', 'what', 'makes', 'customers', 'should'],
    // Question 2: Communication style - expanded keywords
    ['casual', 'friendly', 'professional', 'formal', 'style', 'talk', 'business', 'tend', 'lines', 'write', 'sounds'],
    // Question 3: Consistency - expanded keywords
    ['website', 'social', 'materials', 'story', 'message', 'everywhere', 'marketing', 'telling', 'same', 'differs', 'places']
  ],
  audience: [
    // Question 1: Favorite customer - expanded keywords
    ['favorite', 'customer', 'wish', 'fit', 'great', 'type', 'think', 'about', 'more', 'thing', 'makes'],
    // Question 2: Customer problems - expanded keywords
    ['problems', 'challenges', 'customers', 'face', 'motivates', 'biggest', 'three', 'before', 'find', 'business', 'help'],
    // Question 3: Message relevance - expanded keywords
    ['posts', 'emails', 'address', 'relevant', 'changes', 'recent', 'social', 'media', 'directly', 'problems', 'identified']
  ]
} as const;

// Enhanced question signature matching for more robust detection
export const QUESTION_SIGNATURES = {
  discovery: [
    // Question 1 signatures
    ['customers ask why they should choose', 'choose your business over competitors', 'positive difference'],
    // Question 2 signatures
    ['three principles or beliefs guide', 'how you run your business', 'demonstrate this in your day-to-day'],
    // Question 3 signatures
    ['business were a person walking', 'networking event', 'describe their personality']
  ],
  messaging: [
    // Question 1 signatures
    ['explain what makes your business special', 'one short sentence', 'capture both what you do'],
    // Question 2 signatures
    ['casual and friendly, or more professional', 'write a few lines about your business', 'in this style'],
    // Question 3 signatures
    ['website, social media, and any marketing', 'telling the same story everywhere', 'message differs']
  ],
  audience: [
    // Question 1 signatures
    ['favorite customer – the type you wish', 'great fit for your business', 'one thing that makes them'],
    // Question 2 signatures
    ['three biggest problems or challenges', 'before they find your business', 'motivates them to seek help'],
    // Question 3 signatures
    ['recent social media posts or emails', 'directly address the problems', 'more relevant to your ideal customers']
  ]
} as const;

// Validation helpers with enhanced error handling
export const isValidPhaseId = (phase: string): phase is keyof typeof PHASE_CONFIG => {
  return phase in PHASE_CONFIG;
};

export const getQuestionsByPhase = (phase: keyof typeof PHASE_CONFIG) => {
  return PHASE_CONFIG[phase].questionIndices.map(index => PREDEFINED_QUESTIONS[index]);
};

export const getMockAnswersByPhase = (phase: keyof typeof MOCK_ANSWERS) => {
  return MOCK_ANSWERS[phase];
};

// COMPLETELY REWRITTEN: Super robust demo answer matching with multiple fallback strategies
export const getDemoAnswerForQuestion = (
  assistantContent: string,
  currentPhase: keyof typeof QUESTION_KEYWORDS | 'complete',
  questionIndex: number
): string | null => {
  console.log(`getDemoAnswerForQuestion called with phase: ${currentPhase}, questionIndex: ${questionIndex}`);
  
  // Early return for complete phase
  if (currentPhase === 'complete') {
    console.log('Complete phase, no demo answers');
    return null;
  }
  
  if (!QUESTION_KEYWORDS[currentPhase] || !MOCK_ANSWERS[currentPhase]) {
    console.log('Invalid phase or no keywords/answers available');
    return null;
  }

  const phaseKeywords = QUESTION_KEYWORDS[currentPhase];
  const phaseSignatures = QUESTION_SIGNATURES[currentPhase];
  const phaseAnswers = MOCK_ANSWERS[currentPhase];
  
  // Boundary checks
  if (questionIndex >= PREDEFINED_QUESTIONS.length || questionIndex < 0) {
    console.log(`Question index ${questionIndex} is out of bounds`);
    return null;
  }
  
  // Determine which question in the current phase we should be on
  const phaseStartIndices = { discovery: 0, messaging: 3, audience: 6 };
  const phaseStartIndex = phaseStartIndices[currentPhase];
  const questionInPhase = questionIndex - phaseStartIndex;
  
  console.log(`Phase start index: ${phaseStartIndex}, question in phase: ${questionInPhase}`);
  
  if (questionInPhase < 0 || questionInPhase >= phaseKeywords.length) {
    console.log(`Question in phase ${questionInPhase} is out of range for ${currentPhase} phase`);
    return null;
  }

  const contentLower = assistantContent.toLowerCase();
  
  // Strategy 1: Direct question signature matching (most reliable)
  const expectedSignatures = phaseSignatures[questionInPhase];
  for (const signature of expectedSignatures) {
    if (contentLower.includes(signature.toLowerCase())) {
      console.log(`Direct signature match for question ${questionInPhase}: "${signature}"`);
      return phaseAnswers[questionInPhase];
    }
  }
  
  // Strategy 2: Full question text matching
  const expectedQuestionIndex = phaseStartIndex + questionInPhase;
  if (expectedQuestionIndex < PREDEFINED_QUESTIONS.length) {
    const expectedQuestion = PREDEFINED_QUESTIONS[expectedQuestionIndex];
    
    // Check multiple substrings of the question
    const questionParts = [
      expectedQuestion.substring(0, 50),
      expectedQuestion.substring(0, 30),
      expectedQuestion.split('?')[0] + '?'
    ];
    
    for (const part of questionParts) {
      if (contentLower.includes(part.toLowerCase())) {
        console.log(`Direct question part match for question ${questionInPhase}: "${part}"`);
        return phaseAnswers[questionInPhase];
      }
    }
    
    // Word similarity check
    const questionWords = expectedQuestion.toLowerCase().split(' ').filter(w => w.length > 3);
    const matchingWords = questionWords.filter(word => contentLower.includes(word));
    const similarity = matchingWords.length / questionWords.length;
    
    if (similarity >= 0.35) { // Slightly lower threshold for better matching
      console.log(`Question similarity match for question ${questionInPhase}: ${Math.round(similarity * 100)}%`);
      return phaseAnswers[questionInPhase];
    }
  }
  
  // Strategy 3: Keyword density matching for current question
  const expectedKeywords = phaseKeywords[questionInPhase];
  const keywordMatches = expectedKeywords.filter(keyword =>
    contentLower.includes(keyword.toLowerCase())
  );
  
  const keywordScore = keywordMatches.length / expectedKeywords.length;
  if (keywordScore >= 0.3) { // Lower threshold than before
    console.log(`Keyword matched question ${questionInPhase} with ${keywordMatches.length}/${expectedKeywords.length} keywords (${Math.round(keywordScore * 100)}%)`);
    return phaseAnswers[questionInPhase];
  }
  
  // Strategy 4: Fallback keyword matching across all questions in phase
  let bestMatch = -1;
  let bestScore = 0;
  
  for (let i = 0; i < phaseKeywords.length; i++) {
    const keywords = phaseKeywords[i];
    const matches = keywords.filter(keyword =>
      contentLower.includes(keyword.toLowerCase())
    ).length;
    
    const score = matches / keywords.length;
    if (score > bestScore && matches >= 2) { // Require at least 2 matches
      bestScore = score;
      bestMatch = i;
    }
  }
  
  if (bestMatch >= 0) {
    console.log(`Fallback matched question ${bestMatch} with score ${Math.round(bestScore * 100)}% (expected: ${questionInPhase})`);
    return phaseAnswers[bestMatch];
  }
  
  // Strategy 5: Phase-based fallback for new phases
  if (questionInPhase === 0) {
    console.log(`New phase start for ${currentPhase}, returning first answer`);
    return phaseAnswers[0];
  }
  
  console.log(`No demo answer match found for phase: ${currentPhase}, questionInPhase: ${questionInPhase}, questionIndex: ${questionIndex}`);
  return null;
};

// Enhanced error messages with more specific guidance
export const ERROR_MESSAGES = {
  // Network and connectivity errors
  NETWORK_ERROR: 'Connection issue. Please check your internet connection and try again.',
  TIMEOUT_ERROR: 'Request timed out. Please try again in a moment.',
  CONNECTION_LOST: 'Connection lost. Attempting to reconnect...',
  
  // Session and authentication errors
  SESSION_EXPIRED: 'Your session has expired. Please start a new brand development journey.',
  SESSION_INVALID: 'Invalid session. Please start a new journey.',
  VALIDATION_FAILED: 'Unable to validate session. Please try refreshing the page.',
  ACCESS_DENIED: 'Access denied. Please start a new brand development journey.',
  
  // API and service errors
  API_ERROR: 'Service temporarily unavailable. Please try again in a moment.',
  OPENAI_ERROR: 'AI service temporarily unavailable. Please try again.',
  RATE_LIMIT_ERROR: 'Too many requests. Please wait a moment and try again.',
  SERVICE_UNAVAILABLE: 'Service is currently unavailable. Please try again later.',
  
  // Data and processing errors
  FIRESTORE_ERROR: 'Database connection issue. Your progress has been saved locally.',
  DATA_CORRUPTION: 'Data integrity issue detected. Please refresh and try again.',
  PROCESSING_ERROR: 'Error processing your request. Please try again.',
  REPORT_GENERATION_ERROR: 'Report generation failed. Please try again.',
  
  // User input and validation errors
  INVALID_INPUT: 'Invalid input. Please check your response and try again.',
  MISSING_REQUIRED_FIELD: 'Please fill in all required fields.',
  INPUT_TOO_LONG: 'Input is too long. Please shorten your response.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  
  // File and download errors
  PDF_GENERATION_ERROR: 'Failed to generate PDF. Please try downloading again.',
  DOWNLOAD_ERROR: 'Download failed. Please try again.',
  FILE_NOT_FOUND: 'File not found. Please try generating the report again.',
  
  // General and fallback errors
  UNKNOWN_ERROR: 'An unexpected error occurred. Your progress has been saved.',
  REPORT_NOT_READY: 'Report not yet available. Please complete the current phase first.',
  FEATURE_UNAVAILABLE: 'This feature is temporarily unavailable.',
  MAINTENANCE_MODE: 'System is under maintenance. Please try again later.'
} as const;

// Enhanced app configuration with better defaults
export const APP_CONFIG = {
  // Session management
  SESSION_TIMEOUT_HOURS: 24,
  SESSION_CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes
  AUTO_SAVE_INTERVAL: 30000, // 30 seconds
  
  // Retry and error handling - IMPROVED for robustness
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 1000, // milliseconds
  EXPONENTIAL_BACKOFF_FACTOR: 2,
  MAX_RETRY_DELAY: 10000, // 10 seconds
  
  // API timeouts - EXTENDED for complex operations
  API_REQUEST_TIMEOUT: 120000, // 2 minutes
  OPENAI_MAX_WAIT_TIME: 600000, // 10 minutes
  PDF_GENERATION_TIMEOUT: 60000, // 1 minute
  
  // Input validation
  MAX_BRAND_NAME_LENGTH: 100,
  MAX_USER_NAME_LENGTH: 100,
  MAX_EMAIL_LENGTH: 200,
  MAX_MESSAGE_LENGTH: 5000,
  MIN_MESSAGE_LENGTH: 10,
  
  // UI and animation
  SCROLL_DEBOUNCE_MS: 100,
  MESSAGE_ANIMATION_DURATION: 500,
  TYPING_INDICATOR_DELAY: 1000,
  DEMO_ANSWER_DISPLAY_TIME: 1000,
  
  // Demo and development
  DEMO_MODE_ENABLED: true,
  DEBUG_MODE: process.env.NODE_ENV === 'development',
  CONSOLE_LOGGING: process.env.NODE_ENV === 'development'
} as const;

// Enhanced URL patterns with better validation
export const URL_PATTERNS = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  INTERVIEW_ID: /^[a-zA-Z0-9]{20}$/, // Firestore document ID pattern
  SAFE_FILENAME: /^[a-zA-Z0-9._-]+$/,
  BRAND_NAME: /^[a-zA-Z0-9\s\-'".&]+$/,
  USER_NAME: /^[a-zA-Z0-9\s\-'.]+$/,
  PHONE: /^[\+]?[0-9\s\-\(\)]+$/
} as const;

// Enhanced error categorization for better handling
export const ERROR_CATEGORIES = {
  RECOVERABLE: [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'CONNECTION_LOST',
    'API_ERROR',
    'RATE_LIMIT_ERROR'
  ],
  SESSION_RELATED: [
    'SESSION_EXPIRED',
    'SESSION_INVALID',
    'VALIDATION_FAILED',
    'ACCESS_DENIED'
  ],
  USER_INPUT: [
    'INVALID_INPUT',
    'MISSING_REQUIRED_FIELD',
    'INPUT_TOO_LONG',
    'INVALID_EMAIL'
  ],
  CRITICAL: [
    'DATA_CORRUPTION',
    'FIRESTORE_ERROR',
    'SERVICE_UNAVAILABLE',
    'MAINTENANCE_MODE'
  ]
} as const;

// Helper function to get error category
export const getErrorCategory = (errorType: keyof typeof ERROR_MESSAGES): keyof typeof ERROR_CATEGORIES | null => {
  for (const [category, errors] of Object.entries(ERROR_CATEGORIES)) {
    if ((errors as readonly string[]).includes(errorType)) {
      return category as keyof typeof ERROR_CATEGORIES;
    }
  }
  return null;
};

// Enhanced phase transition logic
export const getNextPhase = (currentPhase: keyof typeof PHASE_CONFIG): keyof typeof PHASE_CONFIG | null => {
  const phases = Object.keys(PHASE_CONFIG) as Array<keyof typeof PHASE_CONFIG>;
  const currentIndex = phases.indexOf(currentPhase);
  
  if (currentIndex >= 0 && currentIndex < phases.length - 1) {
    return phases[currentIndex + 1];
  }
  
  return null;
};

// Enhanced validation functions
export const validateBrandName = (name: string): boolean => {
  return name.length > 0 && 
         name.length <= APP_CONFIG.MAX_BRAND_NAME_LENGTH && 
         URL_PATTERNS.BRAND_NAME.test(name);
};

export const validateUserName = (name: string): boolean => {
  return name.length > 0 && 
         name.length <= APP_CONFIG.MAX_USER_NAME_LENGTH && 
         URL_PATTERNS.USER_NAME.test(name);
};

export const validateEmail = (email: string): boolean => {
  return email.length > 0 && 
         email.length <= APP_CONFIG.MAX_EMAIL_LENGTH && 
         URL_PATTERNS.EMAIL.test(email);
};

export const validateMessage = (message: string): boolean => {
  const trimmed = message.trim();
  return trimmed.length >= APP_CONFIG.MIN_MESSAGE_LENGTH && 
         trimmed.length <= APP_CONFIG.MAX_MESSAGE_LENGTH;
};

// Performance monitoring helpers
export const PERFORMANCE_METRICS = {
  CHAT_INITIALIZATION: 'chat_initialization',
  MESSAGE_SEND: 'message_send',
  REPORT_GENERATION: 'report_generation',
  PDF_DOWNLOAD: 'pdf_download',
  PHASE_TRANSITION: 'phase_transition'
} as const;

export const measurePerformance = (metric: keyof typeof PERFORMANCE_METRICS, fn: () => Promise<any>) => {
  if (!APP_CONFIG.DEBUG_MODE) return fn();
  
  const start = performance.now();
  return fn().finally(() => {
    const end = performance.now();
    console.log(`${metric}: ${end - start}ms`);
  });
};