// src/ProgressManager.ts

import { PhaseId } from './types/interview';
import { PREDEFINED_QUESTIONS, PHASE_CONFIG, isValidPhaseId } from './types/constants';

export interface PhaseConfig {
  id: PhaseId;
  label: string;
  subPhases: number;
  reportRequired: boolean;
  description?: string;
  color?: string;
}

export interface PhaseStatus {
  id: PhaseId;
  label: string;
  status: 'pending' | 'active' | 'completed';
  progress: number;
  questionsCompleted: number;
  totalQuestions: number;
  hasReport: boolean;
}

export interface ProgressData {
  totalProgress: number;
  phases: PhaseStatus[];
  currentSubPhase: number;
  isComplete: boolean;
  currentPhaseProgress: number;
  nextPhase: PhaseId | null;
}

export class ProgressManager {
  private readonly phases: PhaseConfig[] = [
    {
      id: 'discovery',
      label: 'Discovery',
      subPhases: 3,
      reportRequired: true,
      description: 'Uncover your brand essence',
      color: 'desert-sand'
    },
    {
      id: 'messaging',
      label: 'Messaging',
      subPhases: 3,
      reportRequired: true,
      description: 'Align your communication',
      color: 'champagne'
    },
    {
      id: 'audience',
      label: 'Audience',
      subPhases: 3,
      reportRequired: true,
      description: 'Connect with your people',
      color: 'goldenrod'
    },
    {
      id: 'complete',
      label: 'Complete',
      subPhases: 0,
      reportRequired: true,
      description: 'Your brand transformation',
      color: 'dark-midnight'
    }
  ];

  /**
   * Calculate progress based on completed questions rather than current phase
   */
  public calculateProgress(questionCount: number): number {
    const totalQuestions = PREDEFINED_QUESTIONS.length;
    return Math.min((questionCount / totalQuestions) * 100, 100);
  }

  /**
   * Determine current phase based on question count
   */
  public getCurrentPhase(questionCount: number): PhaseId {
    if (questionCount >= 9) return 'complete';
    if (questionCount >= 6) return 'audience';
    if (questionCount >= 3) return 'messaging';
    return 'discovery';
  }

  /**
   * Get the next phase in sequence
   */
  public getNextPhase(currentPhase: PhaseId): PhaseId | null {
    const currentIndex = this.phases.findIndex(p => p.id === currentPhase);
    const nextPhase = this.phases[currentIndex + 1];
    return nextPhase ? nextPhase.id : null;
  }

  /**
   * Calculate questions completed for a specific phase
   */
  public getPhaseQuestionCount(questionCount: number, phaseId: PhaseId): number {
    const phaseIndex = this.phases.findIndex(p => p.id === phaseId);
    if (phaseIndex === -1) return 0;

    const phaseStartQuestion = phaseIndex * 3;
    const phaseEndQuestion = phaseStartQuestion + 3;
    
    if (questionCount <= phaseStartQuestion) return 0;
    if (questionCount >= phaseEndQuestion) return 3;
    
    return questionCount - phaseStartQuestion;
  }

  /**
   * Get detailed progress data for UI components
   */
  public getProgressData(currentPhase: PhaseId, questionCount: number, reports: Record<string, string> = {}): ProgressData {
    const totalProgress = this.calculateProgress(questionCount);
    const actualCurrentPhase = this.getCurrentPhase(questionCount);
    
    const phases: PhaseStatus[] = this.phases.slice(0, 3).map((phase, index) => {
      const phaseQuestionCount = this.getPhaseQuestionCount(questionCount, phase.id);
      const isCompleted = phaseQuestionCount >= 3;
      const isActive = actualCurrentPhase === phase.id && !isCompleted;
      
      return {
        id: phase.id,
        label: phase.label,
        status: isCompleted ? 'completed' : isActive ? 'active' : 'pending',
        progress: (phaseQuestionCount / 3) * 100,
        questionsCompleted: phaseQuestionCount,
        totalQuestions: 3,
        hasReport: Boolean(reports[phase.id])
      };
    });

    const currentPhaseIndex = this.phases.findIndex(p => p.id === actualCurrentPhase);
    const currentPhaseProgress = currentPhaseIndex < 3 
      ? (this.getPhaseQuestionCount(questionCount, actualCurrentPhase) / 3) * 100
      : 100;

    return {
      totalProgress,
      phases,
      currentSubPhase: questionCount,
      isComplete: actualCurrentPhase === 'complete',
      currentPhaseProgress,
      nextPhase: this.getNextPhase(actualCurrentPhase)
    };
  }

  /**
   * Validate phase transition
   */
  public canTransitionToPhase(targetPhase: PhaseId, questionCount: number): boolean {
    if (!isValidPhaseId(targetPhase)) return false;
    
    const requiredQuestions = {
      'discovery': 0,
      'messaging': 3,
      'audience': 6,
      'complete': 9
    };

    return questionCount >= requiredQuestions[targetPhase];
  }

  /**
   * Get current question for a given state
   */
  public getCurrentQuestion(questionCount: number): string | null {
    if (questionCount >= PREDEFINED_QUESTIONS.length) return null;
    return PREDEFINED_QUESTIONS[questionCount];
  }

  /**
   * Get questions for a specific phase
   */
  public getPhaseQuestions(phaseId: PhaseId): string[] {
    if (!isValidPhaseId(phaseId) || phaseId === 'complete') return [];
    
    const config = PHASE_CONFIG[phaseId];
    return config.questionIndices.map(index => PREDEFINED_QUESTIONS[index]);
  }

  /**
   * Validate question count consistency
   */
  public validateQuestionCount(questionCount: number, currentPhase: PhaseId): boolean {
    const calculatedPhase = this.getCurrentPhase(questionCount);
    
    // Allow for phase being ahead of question count (during transitions)
    const phaseIndex = this.phases.findIndex(p => p.id === currentPhase);
    const calculatedIndex = this.phases.findIndex(p => p.id === calculatedPhase);
    
    return calculatedIndex <= phaseIndex;
  }

  /**
   * Get phase configuration
   */
  public getPhaseConfig(phaseId: PhaseId): PhaseConfig | null {
    return this.phases.find(p => p.id === phaseId) || null;
  }

  /**
   * Calculate estimated completion time
   */
  public getEstimatedCompletionTime(questionCount: number): string {
    const remainingQuestions = PREDEFINED_QUESTIONS.length - questionCount;
    const estimatedMinutes = remainingQuestions * 2; // Assume 2 minutes per question
    
    if (estimatedMinutes <= 0) return 'Complete';
    if (estimatedMinutes < 60) return `~${estimatedMinutes} minutes`;
    
    const hours = Math.floor(estimatedMinutes / 60);
    const minutes = estimatedMinutes % 60;
    return `~${hours}h ${minutes}m`;
  }

  /**
   * Get completion percentage for specific phase
   */
  public getPhaseCompletion(phaseId: PhaseId, questionCount: number): number {
    const phaseQuestions = this.getPhaseQuestionCount(questionCount, phaseId);
    const totalPhaseQuestions = phaseId === 'complete' ? 0 : 3;
    
    if (totalPhaseQuestions === 0) return questionCount >= 9 ? 100 : 0;
    return Math.min((phaseQuestions / totalPhaseQuestions) * 100, 100);
  }

  /**
   * Check if a phase should show as in-progress
   */
  public isPhaseInProgress(phaseId: PhaseId, questionCount: number): boolean {
    const currentPhase = this.getCurrentPhase(questionCount);
    const phaseQuestions = this.getPhaseQuestionCount(questionCount, phaseId);
    
    return currentPhase === phaseId && phaseQuestions > 0 && phaseQuestions < 3;
  }

  /**
   * Get user-friendly progress description
   */
  public getProgressDescription(questionCount: number): string {
    const currentPhase = this.getCurrentPhase(questionCount);
    const phaseConfig = this.getPhaseConfig(currentPhase);
    
    if (!phaseConfig) return 'Getting started...';
    
    if (currentPhase === 'complete') {
      return 'Brand development complete!';
    }
    
    const phaseQuestions = this.getPhaseQuestionCount(questionCount, currentPhase);
    return `${phaseConfig.label} phase: ${phaseQuestions}/3 questions completed`;
  }
}