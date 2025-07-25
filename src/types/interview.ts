// src/types/interview.ts

export interface Interview {
  brandName: string;
  threadId: string | null; // Allow null for newly created interviews
  createdAt: Date | FirebaseFirestore.Timestamp; // Allow both Date and Firestore Timestamp
  lastUpdated: Date | FirebaseFirestore.Timestamp;
  currentPhase: PhaseId;
  questionCount: number; // Added to track completed questions
  messages: Message[];
  reports: Reports;
  contactInfo?: {
    name: string;
    email: string;
  };
}

export type PhaseId = 'discovery' | 'messaging' | 'audience' | 'complete';

export interface Reports {
  discovery?: string;
  messaging?: string;
  audience?: string;
  complete?: string;
  combined?: string;
}

// Type guard for checking if a phase exists in reports
export function isValidPhase(phase: string): phase is keyof Reports {
  return ['discovery', 'messaging', 'audience', 'complete', 'combined'].includes(phase);
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  phase: PhaseId;
}

// Helper interface for Firestore Timestamp (if not already available)
declare global {
  namespace FirebaseFirestore {
    interface Timestamp {
      seconds: number;
      nanoseconds: number;
      toDate(): Date;
    }
  }
}