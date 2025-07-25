// Enhanced constants with better organization and validation

export const PHASE_QUESTIONS = {
    'discovery': 3,
    'messaging': 3,
    'audience': 3,
    'complete': 0
} as const;

export const PREDEFINED_QUESTIONS = [
    // Discovery Phase (0-2)
    "When customers ask why they should choose your business over competitors",
    "What three principles or beliefs guide how you run your business and treat your",
    "If your business were a person walking into a networking event, how would they",
    
    // Messaging Phase (3-5)
    "If you had to explain what makes your business special in one short sentence",
    "When you talk about your business, do you tend to be more casual and friendly",
    "Look at your website, social media, and any marketing materials. Are you telling",
    
    // Audience Phase (6-8)
    "Think about your favorite customer – the type you wish you had more of",
    "What are the three biggest problems or challenges that your best customers",
    "When you look at your recent social media posts or emails to customers"
] as const;

// Enhanced mock answers with better variety and realism
export const MOCK_ANSWERS = {
  discovery: [
    "Most AI companies rush to market with black-box solutions that work until they don't. We're different - every system we build is interpretable and has built-in safety guardrails. While others promise magic, we deliver AI that businesses can actually trust and understand. Our mission: make AI adoption safe for companies who can't afford catastrophic mistakes. We're not trying to replace human judgment, we're amplifying it with transparent, reliable automation that grows with your business.",
    
    "Safety Before Speed: Every model goes through extensive testing scenarios, including adversarial inputs. We document failure cases and edge case handling before deployment.\nInterpretability Always: Our clients get plain-English explanations for every AI decision. Monthly reports show exactly how the system arrived at recommendations, no black boxes.\nHuman-Centered Design: Regular check-ins with end users. AI suggests, humans decide. Built-in override capabilities and clear escalation paths when the system encounters uncertainty.",
    
    "Thoughtful listener who asks clarifying questions before offering solutions. Dressed professionally but approachably - think startup founder, not big tech executive. Explains AI concepts using relatable analogies instead of technical jargon. The person who stays engaged when others talk about their challenges, genuinely curious about how automation could help without overselling. Would follow up with relevant case studies, not generic sales pitches."
  ],
  messaging: [
    "We build AI systems that businesses can actually trust - transparent, safe, and designed to augment human decision-making rather than replace it.",
    
    "Professional but accessible - we avoid both AI hype and overly technical language:\n'AI doesn't have to be scary or mysterious. We build systems that show their work, explain their reasoning, and give you confidence in every recommendation. No black boxes, no unpredictable behavior - just reliable automation that makes your team more effective while keeping humans in control of important decisions.'",
    
    "Website emphasizes safety and interpretability strongly. LinkedIn posts sometimes focus too much on technical achievements, less on business value. Sales materials consistently highlight human-centered approach. Gap: case studies show impressive results but could better explain our safety methodology. Email nurture sequence needs more content addressing AI adoption fears and ROI concerns."
  ],
  audience: [
    "Operations leaders at mid-sized companies who've been burned by overhyped tech solutions before. They value thorough vetting over flashy demos. Want to innovate but need to justify ROI and risk management to stakeholders. Appreciate vendors who understand regulatory constraints and the importance of explainable decisions in their industry.",
    
    "Problem 1: Fear of AI unpredictability - worried about system failures, biased outputs, or decisions they can't explain to customers/regulators.\nProblem 2: Resource constraints - need AI benefits but lack ML expertise to evaluate solutions or manage complex implementations.\nProblem 3: Stakeholder buy-in challenges - difficulty convincing leadership that AI investment is worth the risk, especially after hearing AI horror stories in the news.",
    
    "Content addresses safety concerns well but could better tackle the 'AI is too complex for us' worry. Recent posts focus on technical capabilities but miss the resource constraint angle - need more 'white glove implementation' messaging. Stakeholder buy-in challenge barely addressed in current materials. Should create more content around business cases, risk mitigation frameworks, and executive-level ROI discussions."
  ]
} as const;

// Processing stages with enhanced user feedback
export type ProcessingStage = 
  | 'sending'
  | 'translating'
  | 'reading'
  | 'thinking'
  | 'formulating'
  | 'finalizing'
  | 'fixing';

export const processingMessages: Record<ProcessingStage, string> = {
  sending: "Sending your message...",
  translating: "Processing your response...",
  reading: "Analyzing your input...",
  thinking: "Generating insights...",
  formulating: "Crafting response...",
  finalizing: "Preparing recommendations...",
  fixing: "Refining report format..."
} as const;

// Phase configuration for better type safety
export const PHASE_CONFIG = {
  discovery: {
    label: 'Discovery',
    description: 'Uncover your brand essence',
    questionIndices: [0, 1, 2],
    color: 'desert-sand'
  },
  messaging: {
    label: 'Messaging',
    description: 'Align your communication',
    questionIndices: [3, 4, 5],
    color: 'champagne'
  },
  audience: {
    label: 'Audience',
    description: 'Connect with your people',
    questionIndices: [6, 7, 8],
    color: 'goldenrod'
  },
  complete: {
    label: 'Complete',
    description: 'Your brand transformation',
    questionIndices: [],
    color: 'dark-midnight'
  }
} as const;

// Validation helpers
export const isValidPhaseId = (phase: string): phase is keyof typeof PHASE_CONFIG => {
  return phase in PHASE_CONFIG;
};

export const getQuestionsByPhase = (phase: keyof typeof PHASE_CONFIG) => {
  return PHASE_CONFIG[phase].questionIndices.map(index => PREDEFINED_QUESTIONS[index]);
};

export const getMockAnswersByPhase = (phase: keyof typeof MOCK_ANSWERS) => {
  return MOCK_ANSWERS[phase];
};

// Enhanced error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Connection issue. Please check your internet connection and try again.',
  SESSION_EXPIRED: 'Your session has expired. Please start a new brand development journey.',
  VALIDATION_FAILED: 'Unable to validate session. Please try refreshing the page.',
  API_ERROR: 'Service temporarily unavailable. Please try again in a moment.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Your progress has been saved.',
  FIRESTORE_ERROR: 'Database connection issue. Your progress has been saved locally.',
  OPENAI_ERROR: 'AI service temporarily unavailable. Please try again.',
  PDF_GENERATION_ERROR: 'Failed to generate PDF. Please try downloading again.',
  REPORT_NOT_READY: 'Report not yet available. Please complete the current phase first.'
} as const;

// App configuration constants
export const APP_CONFIG = {
  SESSION_TIMEOUT_HOURS: 24,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 1000, // milliseconds
  MAX_BRAND_NAME_LENGTH: 100,
  MAX_USER_NAME_LENGTH: 100,
  MAX_EMAIL_LENGTH: 200,
  AUTO_SAVE_INTERVAL: 30000, // 30 seconds
  SCROLL_DEBOUNCE_MS: 100,
  MESSAGE_ANIMATION_DURATION: 500,
  PDF_GENERATION_TIMEOUT: 30000 // 30 seconds
} as const;

// URL patterns for validation
export const URL_PATTERNS = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  INTERVIEW_ID: /^[a-zA-Z0-9]{20}$/, // Firestore document ID pattern
  SAFE_FILENAME: /^[a-zA-Z0-9._-]+$/
} as const;