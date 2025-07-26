// Enhanced constants with improved error handling, validation, and robustness

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
  | 'analyzing'
  | 'retrying'
  | 'recovering';

export const processingMessages: Record<ProcessingStage, string> = {
  sending: "Sending your message...",
  translating: "Processing your response...",
  reading: "Analyzing your input...",
  thinking: "Generating insights...",
  formulating: "Crafting response...",
  finalizing: "Preparing recommendations...",
  fixing: "Refining report format...",
  connecting: "Establishing connection...",
  analyzing: "Analyzing brand elements...",
  retrying: "Retrying connection...",
  recovering: "Recovering from error..."
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

// Enhanced question keywords with multiple matching strategies
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

// Enhanced question signatures with more unique identifiers
export const QUESTION_SIGNATURES = {
  discovery: [
    ['choose your business over competitors', 'positive difference do you want to make'],
    ['three principles or beliefs guide how you run your business', 'demonstrate this in your day-to-day'],
    ['business were a person walking into a networking event', 'describe their personality']
  ],
  messaging: [
    ['explain what makes your business special in one short sentence', 'why customers should care'],
    ['casual and friendly, or more professional and formal', 'write a few lines about your business'],
    ['telling the same story everywhere', 'note any places where your message differs']
  ],
  audience: [
    ['think about your favorite customer', 'makes them such a great fit'],
    ['three biggest problems or challenges that your best customers typically face', 'motivates them to seek help'],
    ['recent social media posts or emails to customers', 'address the problems you just identified']
  ]
} as const;

// Flattened signatures for easier iteration
export const QUESTION_SIGNATURES_FLAT = [
    ...QUESTION_SIGNATURES.discovery,
    ...QUESTION_SIGNATURES.messaging,
    ...QUESTION_SIGNATURES.audience
];

// Enhanced validation helpers
export const isValidPhaseId = (phase: string): phase is keyof typeof PHASE_CONFIG => {
  return phase in PHASE_CONFIG;
};

export const getQuestionsByPhase = (phase: keyof typeof PHASE_CONFIG) => {
  return PHASE_CONFIG[phase].questionIndices.map(index => PREDEFINED_QUESTIONS[index]);
};

export const getMockAnswersByPhase = (phase: keyof typeof MOCK_ANSWERS) => {
  return MOCK_ANSWERS[phase];
};

// Enhanced demo answer matching with better error handling
export const getDemoAnswerForQuestion = (
  assistantContent: string,
  currentPhase: keyof typeof MOCK_ANSWERS | 'complete',
  questionIndex: number
): string | null => {
  try {
    console.log(`getDemoAnswerForQuestion called with phase: ${currentPhase}, questionIndex: ${questionIndex}`);

    if (currentPhase === 'complete' || questionIndex >= PREDEFINED_QUESTIONS.length) {
      return null;
    }

    const phaseStartIndices = { discovery: 0, messaging: 3, audience: 6 };
    if (!(currentPhase in phaseStartIndices)) {
      return null;
    }

    const phaseStartIndex = phaseStartIndices[currentPhase];
    const questionInPhase = questionIndex - phaseStartIndex;

    const phaseAnswers = MOCK_ANSWERS[currentPhase];

    if (questionInPhase < 0 || questionInPhase >= phaseAnswers.length) {
      return null;
    }

    // Use refined signatures for matching
    const expectedSignatures = QUESTION_SIGNATURES[currentPhase][questionInPhase];
    const contentLower = assistantContent.toLowerCase();

    for (const signature of expectedSignatures) {
      if (contentLower.includes(signature.toLowerCase())) {
        console.log(`Direct signature match for question ${questionIndex}, providing demo answer.`);
        return phaseAnswers[questionInPhase];
      }
    }

    console.warn(`Could not find a direct signature match for question index ${questionIndex}.`);
    return null;
  } catch (error) {
    console.error('Error in getDemoAnswerForQuestion:', error);
    return null;
  }
};

// Enhanced error messages with more specific guidance
export const ERROR_MESSAGES = {
  // Network and connectivity errors
  NETWORK_ERROR: 'Connection issue. Please check your internet connection and try again.',
  TIMEOUT_ERROR: 'Request timed out. Please try again in a moment.',
  CONNECTION_LOST: 'Connection lost. Attempting to reconnect...',
  RATE_LIMIT_ERROR: 'Too many requests. Please wait a moment and try again.',
  
  // Session and authentication errors
  SESSION_EXPIRED: 'Your session has expired. Please start a new brand development journey.',
  SESSION_INVALID: 'Invalid session. Please start a new journey.',
  VALIDATION_FAILED: 'Unable to validate session. Please try refreshing the page.',
  ACCESS_DENIED: 'Access denied. Please start a new brand development journey.',
  
  // API and service errors
  API_ERROR: 'Service temporarily unavailable. Please try again in a moment.',
  OPENAI_ERROR: 'AI service temporarily unavailable. Please try again.',
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
  INPUT_TOO_SHORT: 'Response too brief. Please provide more detail.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  INVALID_CHARACTERS: 'Input contains invalid characters. Please use only letters, numbers, and basic punctuation.',
  
  // File and download errors
  PDF_GENERATION_ERROR: 'Failed to generate PDF. Please try downloading again.',
  DOWNLOAD_ERROR: 'Download failed. Please try again.',
  FILE_NOT_FOUND: 'File not found. Please try generating the report again.',
  
  // Security and abuse prevention
  SUSPICIOUS_ACTIVITY: 'Unusual activity detected. Please refresh and try again.',
  RATE_LIMITED: 'Too many attempts. Please wait before trying again.',
  REQUEST_BLOCKED: 'Request blocked for security reasons.',
  
  // General and fallback errors
  UNKNOWN_ERROR: 'An unexpected error occurred. Your progress has been saved.',
  REPORT_NOT_READY: 'Report not yet available. Please complete the current phase first.',
  FEATURE_UNAVAILABLE: 'This feature is temporarily unavailable.',
  MAINTENANCE_MODE: 'System is under maintenance. Please try again later.',
  BROWSER_COMPATIBILITY: 'Browser compatibility issue detected. Please try updating your browser.'
} as const;

// Enhanced app configuration with better defaults and security
export const APP_CONFIG = {
  // Session management
  SESSION_TIMEOUT_HOURS: 24,
  SESSION_CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes
  AUTO_SAVE_INTERVAL: 30000, // 30 seconds
  SESSION_RECOVERY_ATTEMPTS: 3,
  
  // Rate limiting and security
  MAX_RETRY_ATTEMPTS: 5,
  RETRY_DELAY_BASE: 1000, // milliseconds
  EXPONENTIAL_BACKOFF_FACTOR: 2,
  MAX_RETRY_DELAY: 15000, // 15 seconds
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  MAX_REQUESTS_PER_WINDOW: 10,
  SUSPICIOUS_ACTIVITY_THRESHOLD: 20, // requests per minute
  
  // API timeouts - Enhanced for reliability
  API_REQUEST_TIMEOUT: 180000, // 3 minutes
  OPENAI_MAX_WAIT_TIME: 900000, // 15 minutes
  PDF_GENERATION_TIMEOUT: 90000, // 1.5 minutes
  VALIDATION_TIMEOUT: 30000, // 30 seconds
  
  // Input validation - Enhanced security
  MAX_BRAND_NAME_LENGTH: 100,
  MAX_USER_NAME_LENGTH: 100,
  MAX_EMAIL_LENGTH: 200,
  MAX_MESSAGE_LENGTH: 5000,
  MIN_MESSAGE_LENGTH: 3, // Reduced from 10 for better UX
  MAX_INPUT_FREQUENCY: 2000, // 2 seconds between inputs
  
  // Content filtering
  PROFANITY_FILTER_ENABLED: true,
  SPAM_DETECTION_ENABLED: true,
  MAX_IDENTICAL_RESPONSES: 3,
  
  // UI and animation
  SCROLL_DEBOUNCE_MS: 100,
  MESSAGE_ANIMATION_DURATION: 500,
  TYPING_INDICATOR_DELAY: 1000,
  DEMO_ANSWER_DISPLAY_TIME: 1000,
  TOAST_DURATION: 4000,
  ERROR_TOAST_DURATION: 6000,
  
  // Performance monitoring
  PERFORMANCE_MONITORING_ENABLED: true,
  MEMORY_USAGE_CHECK_INTERVAL: 60000, // 1 minute
  MEMORY_LIMIT_WARNING_THRESHOLD: 0.8, // 80% of available memory
  
  // Feature flags
  DEMO_MODE_ENABLED: true,
  DEBUG_MODE: process.env.NODE_ENV === 'development',
  CONSOLE_LOGGING: process.env.NODE_ENV === 'development',
  ANALYTICS_ENABLED: false, // Disabled for portfolio demo
  ERROR_REPORTING_ENABLED: process.env.NODE_ENV === 'production',
  
  // Accessibility
  REDUCED_MOTION_RESPECT: true,
  HIGH_CONTRAST_SUPPORT: true,
  KEYBOARD_NAVIGATION_ENHANCED: true
} as const;

// Enhanced URL patterns with better security
export const URL_PATTERNS = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  INTERVIEW_ID: /^[a-zA-Z0-9]{8,20}$/, // More flexible length
  SAFE_FILENAME: /^[a-zA-Z0-9._-]+$/,
  BRAND_NAME: /^[a-zA-Z0-9\s\-'".&,()]+$/, // More permissive for international names
  USER_NAME: /^[a-zA-Z0-9\s\-'.]+$/,
  PHONE: /^[\+]?[0-9\s\-\(\)]+$/,
  // Security patterns
  XSS_DETECTION: /<script|javascript:|on\w+\s*=/i,
  SQL_INJECTION: /\b(ALTER|CREATE|DELETE|DROP|EXEC(?:UTE)?|INSERT(?:\s+INTO)?|MERGE|SELECT|UNION(?:\s+ALL)?|UPDATE)\b/i,
  SUSPICIOUS_PATTERNS: /(\.\.|\/\.\.|\\\.\.\\|%2e%2e|0x|union|script|eval|alert)/i
} as const;

// Enhanced error categorization
export const ERROR_CATEGORIES = {
  RECOVERABLE: [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'CONNECTION_LOST',
    'API_ERROR',
    'PROCESSING_ERROR'
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
    'INPUT_TOO_SHORT',
    'INVALID_EMAIL',
    'INVALID_CHARACTERS'
  ],
  SECURITY: [
    'SUSPICIOUS_ACTIVITY',
    'RATE_LIMITED',
    'REQUEST_BLOCKED'
  ],
  CRITICAL: [
    'DATA_CORRUPTION',
    'FIRESTORE_ERROR',
    'SERVICE_UNAVAILABLE',
    'MAINTENANCE_MODE',
    'BROWSER_COMPATIBILITY'
  ]
} as const;

// Enhanced error category helper
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

// Enhanced validation functions with better error handling
export const validateBrandName = (name: string): boolean => {
  try {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    return trimmed.length > 0 && 
           trimmed.length <= APP_CONFIG.MAX_BRAND_NAME_LENGTH && 
           URL_PATTERNS.BRAND_NAME.test(trimmed) &&
           !URL_PATTERNS.XSS_DETECTION.test(trimmed) &&
           !URL_PATTERNS.SUSPICIOUS_PATTERNS.test(trimmed);
  } catch {
    return false;
  }
};

export const validateUserName = (name: string): boolean => {
  try {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    return trimmed.length > 0 && 
           trimmed.length <= APP_CONFIG.MAX_USER_NAME_LENGTH && 
           URL_PATTERNS.USER_NAME.test(trimmed) &&
           !URL_PATTERNS.XSS_DETECTION.test(trimmed) &&
           !URL_PATTERNS.SUSPICIOUS_PATTERNS.test(trimmed);
  } catch {
    return false;
  }
};

export const validateEmail = (email: string): boolean => {
  try {
    if (!email || typeof email !== 'string') return false;
    const trimmed = email.trim();
    return trimmed.length > 0 && 
           trimmed.length <= APP_CONFIG.MAX_EMAIL_LENGTH && 
           URL_PATTERNS.EMAIL.test(trimmed) &&
           !URL_PATTERNS.XSS_DETECTION.test(trimmed);
  } catch {
    return false;
  }
};

export const validateMessage = (message: string): boolean => {
  try {
    if (!message || typeof message !== 'string') return false;
    const trimmed = message.trim();
    return trimmed.length >= APP_CONFIG.MIN_MESSAGE_LENGTH && 
           trimmed.length <= APP_CONFIG.MAX_MESSAGE_LENGTH &&
           !URL_PATTERNS.XSS_DETECTION.test(trimmed) &&
           !URL_PATTERNS.SQL_INJECTION.test(trimmed);
  } catch {
    return false;
  }
};

// Enhanced security helpers
export const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Basic XSS prevention
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
};

export const detectSuspiciousActivity = (input: string): boolean => {
  if (!input || typeof input !== 'string') return false;
  
  return URL_PATTERNS.XSS_DETECTION.test(input) ||
         URL_PATTERNS.SQL_INJECTION.test(input) ||
         URL_PATTERNS.SUSPICIOUS_PATTERNS.test(input);
};

// Performance monitoring helpers
export const PERFORMANCE_METRICS = {
  CHAT_INITIALIZATION: 'chat_initialization',
  MESSAGE_SEND: 'message_send',
  REPORT_GENERATION: 'report_generation',
  PDF_DOWNLOAD: 'pdf_download',
  PHASE_TRANSITION: 'phase_transition',
  ERROR_RECOVERY: 'error_recovery',
  VALIDATION: 'validation'
} as const;

export const measurePerformance = async <T>(
  metric: keyof typeof PERFORMANCE_METRICS, 
  fn: () => Promise<T>
): Promise<T> => {
  if (!APP_CONFIG.PERFORMANCE_MONITORING_ENABLED) return fn();
  
  const start = performance.now();
  try {
    const result = await fn();
    const end = performance.now();
    
    if (APP_CONFIG.DEBUG_MODE) {
      console.log(`${metric}: ${end - start}ms`);
    }
    
    return result;
  } catch (error) {
    const end = performance.now();
    
    if (APP_CONFIG.DEBUG_MODE) {
      console.error(`${metric} failed after ${end - start}ms:`, error);
    }
    
    throw error;
  }
};