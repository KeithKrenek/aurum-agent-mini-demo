# Aurum Agent: Brand Development Interview Application

## Overview

Aurum Agent is an AI-powered interview application that guides users through a structured brand development process. The application interfaces with OpenAI's Assistant API to conduct a three-phase interview, storing progress in Firebase, and generating phase-specific and comprehensive PDF reports.

## Quick Start

1. **Clone and Setup**
```bash
git clone [repository-url]
cd aurum-agent
npm install
```

2. **Environment Configuration**
- Copy `.env.example` to `.env`
- Required variables:
```bash
# OpenAI Configuration
VITE_OPENAI_API_KEY=           # Your OpenAI API key
VITE_OPENAI_ASSISTANT_ID=      # ID of your configured Assistant

# Firebase Configuration
VITE_FIREBASE_API_KEY=         # Firebase API key
VITE_FIREBASE_AUTH_DOMAIN=     # your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=      # Project ID
VITE_FIREBASE_STORAGE_BUCKET=  # Storage bucket URL
VITE_FIREBASE_MESSAGING_SENDER_ID=  # Messaging sender ID
VITE_FIREBASE_APP_ID=          # Firebase app ID
```

3. **Development Server**
```bash
npm run dev
```

## Application Structure

### Core Components

```
src/
├── components/
│   ├── BrandEntry.tsx         # Initial brand name entry
│   ├── Chat.tsx              # Main interview interface
│   ├── MessageBubble.tsx     # Message display
│   ├── MessageInput.tsx      # User input handling
│   ├── PhaseProgress.tsx     # Progress tracking
│   └── ErrorBoundary.tsx     # Error handling
├── types/
│   ├── interview.ts          # Type definitions
│   └── constants.ts          # Predefined questions
├── config/
│   └── environment.ts        # Environment configuration
└── assets/                   # Report templates and images
```

### Key Dependencies

```json
{
  "dependencies": {
    "openai": "^4.x",         // OpenAI API client
    "firebase": "^10.x",      // Firebase SDK
    "jspdf": "^2.x",         // PDF generation
    "framer-motion": "^10.x", // Animations
    "react-hot-toast": "^2.x" // Notifications
  }
}
```

## Development Workflow

### 1. Interview Flow

The interview process follows a strict three-phase structure:
- Discovery Phase (3 questions)
- Messaging Phase (3 questions)
- Audience Phase (3 questions)

Each phase:
- Generates a phase-specific report
- Updates progress in Firebase
- Transitions to the next phase automatically

### 2. Report Generation

Reports are generated in two contexts:
1. Phase-specific reports (after completing each phase)
2. Comprehensive final report (combining all phases)

Key files:
- `pdfGenerator.ts`: Handles PDF creation with custom templates
- Phase-specific templates in `assets/`:
  - title1-core-essence.png
  - title2-messaging.png
  - title3-audience.png

### 3. State Management

Interview state is managed through:
- React hooks for local state
- Firebase for persistence
- Session storage for session management

Key state objects:
```typescript
interface Interview {
  brandName: string;
  threadId: string;
  currentPhase: PhaseId;
  messages: Message[];
  reports: Reports;
}

type PhaseId = 'discovery' | 'messaging' | 'audience' | 'complete';
```

### 4. OpenAI Integration

The application uses a custom-trained Assistant with specific instructions for brand development interviews. Key integration points:

- Thread management in `Chat.tsx`
- Response parsing in `parseAssistantResponse()`
- Report extraction from markdown blocks

## Common Development Tasks

### Adding a New Question

1. Update `PREDEFINED_QUESTIONS` in `types/constants.ts`
2. Modify the Assistant's instruction set
3. Update progress tracking in `ProgressManager.ts`

### Modifying Report Templates

1. Update relevant template in `assets/`
2. Modify `pdfGenerator.ts` for new template
3. Test PDF generation for all phases

### Error Handling

Key error handling locations:
- `ErrorBoundary.tsx` for React errors
- Try-catch blocks in API calls
- Toast notifications for user feedback

## Deployment

The application is designed to be embedded in an iframe container:

```html
<div id="aurum-agent-container" style="width: 100%; max-width: 1200px; margin: 0 auto;">
  <div id="aurum-agent-wrapper" style="position: relative; height: 800px;">
    <iframe 
      src="https://aurum-agent.vercel.app/"
      style="position: absolute; width: 100%; height: 100%; border: none;"
      allow="clipboard-write">
    </iframe>
  </div>
</div>
```

### Build and Deploy

```bash
npm run build
# Deploy /dist to your hosting service
```

## Troubleshooting

Common issues and solutions:

1. OpenAI rate limits
   - Implement retry logic
   - Monitor API usage

2. Firebase authentication
   - Verify security rules
   - Check environment variables

3. PDF generation
   - Verify font loading
   - Check image path resolution

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## Support

For technical support or questions:
- Email: keiqth@gmail.com
- Documentation: [link-to-docs]
