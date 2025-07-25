import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Check, Loader, Clock } from 'lucide-react';
import { generatePDF } from './pdfGenerator';
import toast from 'react-hot-toast';
import { PhaseId, Reports, isValidPhase } from './types/interview';
import { PhaseConfig } from './ProgressManager';
import { PREDEFINED_QUESTIONS } from './types/constants';

interface PhaseProgressProps {
  currentPhase: PhaseId;
  questionCount: number;
  totalQuestions: number;
  reports: Reports;
  brandName: string;
  interviewId?: string;
}

const PhaseProgress: React.FC<PhaseProgressProps> = ({
  currentPhase,
  questionCount,
  reports,
  brandName
}) => {
  const [downloadingPhase, setDownloadingPhase] = useState<string | null>(null);

  const phases: PhaseConfig[] = [
    {
      id: 'discovery',
      label: 'Discovery',
      subPhases: 3,
      reportRequired: true,
    },
    {
      id: 'messaging',
      label: 'Messaging',
      subPhases: 3,
      reportRequired: true,
    },
    {
      id: 'audience',
      label: 'Audience',
      subPhases: 3,
      reportRequired: true,
    },
  ];

  const handleDownload = async (phaseId: PhaseId | 'combined') => {
    try {
      setDownloadingPhase(phaseId);
      
      if (phaseId === 'combined') {
        if (reports.complete) {
          await generatePDF({
            brandName,
            reportParts: [reports.complete],
            phaseName: 'Complete Brand Analysis'
          });
          toast.success('Complete brand report downloaded successfully.');
          return;
        } else {
          toast.error('Complete report not yet available.');
          return;
        }
      }

      if (isValidPhase(phaseId) && reports[phaseId]) {
        const phaseNames = {
          discovery: 'Discovery',
          messaging: 'Messaging',
          audience: 'Audience'
        };

        await generatePDF({
          brandName,
          reportParts: [reports[phaseId]!],
          phaseName: phaseNames[phaseId as keyof typeof phaseNames]
        });
        toast.success(`${phaseId} phase report downloaded successfully.`);
      } else {
        toast.error(`No report available for ${phaseId} phase.`);
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download report. Please try again.');
    } finally {
      setDownloadingPhase(null);
    }
  };

  const currentPhaseIndex = phases.findIndex(phase => phase.id === currentPhase);
  const totalQuestions = PREDEFINED_QUESTIONS.length;
  
  // Enhanced progress calculation
  const progressPercentage = Math.min((questionCount / totalQuestions) * 100, 100);
  
  // Determine phase status more accurately
  const getPhaseStatus = (phaseIndex: number) => {
    if (currentPhase === 'complete') {
      return 'completed';
    }
    
    const questionsPerPhase = 3;
    const phaseStartQuestion = phaseIndex * questionsPerPhase;
    const phaseEndQuestion = phaseStartQuestion + questionsPerPhase;
    
    if (questionCount >= phaseEndQuestion) {
      return 'completed';
    } else if (questionCount > phaseStartQuestion) {
      return 'active';
    } else {
      return 'pending';
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 bg-white z-50 shadow-md">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex justify-between items-center mb-2">
          {phases.map((phase, index) => {
            const phaseStatus = getPhaseStatus(index);
            const isCompleted = phaseStatus === 'completed';
            const isCurrentPhase = phaseStatus === 'active';
            const hasReport = isValidPhase(phase.id) && reports[phase.id];
            
            // Calculate phase-specific progress for active phase
            const questionsPerPhase = 3;
            const phaseStartQuestion = index * questionsPerPhase;
            const phaseProgress = isCurrentPhase 
              ? Math.min(((questionCount - phaseStartQuestion) / questionsPerPhase) * 100, 100)
              : isCompleted ? 100 : 0;

            return (
              <div key={phase.id} className="flex flex-col items-center text-center relative">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mb-1 transition-all duration-300 ${
                  isCompleted 
                    ? 'border-desert-sand bg-desert-sand text-white' 
                    : isCurrentPhase
                    ? 'border-goldenrod bg-white text-goldenrod animate-pulse'
                    : 'border-neutral-gray text-neutral-gray'
                }`}>
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : isCurrentPhase ? (
                    <Clock className="w-4 h-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                
                <span className={`text-sm mb-1 transition-all duration-300 ${
                  isCurrentPhase 
                    ? 'font-semibold text-goldenrod' 
                    : isCompleted
                    ? 'font-medium text-desert-sand'
                    : 'text-neutral-gray'
                }`}>
                  {phase.label}
                </span>
                
                {/* Phase-specific progress indicator */}
                {isCurrentPhase && phaseProgress > 0 && (
                  <div className="w-16 h-1 bg-neutral-gray/30 rounded-full mb-1">
                    <div 
                      className="h-full bg-goldenrod rounded-full transition-all duration-500"
                      style={{ width: `${phaseProgress}%` }}
                    />
                  </div>
                )}
                
                {hasReport && (
                  <button
                    onClick={() => handleDownload(phase.id)}
                    disabled={downloadingPhase === phase.id}
                    className={`text-xs flex items-center gap-1 transition-all duration-200 ${
                      isCompleted
                        ? 'text-desert-sand hover:text-champagne'
                        : 'text-neutral-gray hover:text-dark-gray'
                    }`}
                  >
                    {downloadingPhase === phase.id ? (
                      <Loader className="w-3 h-3 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-3 h-3" />
                        Report
                      </>
                    )}
                  </button>
                )}
                
                {!hasReport && isCompleted && (
                  <span className="text-xs text-neutral-gray">
                    Processing...
                  </span>
                )}
              </div>
            );
          })}
          
          {/* Enhanced final report download button */}
          {currentPhase === 'complete' && reports.complete && (
            <div className="ml-4 flex flex-col items-center">
              <button
                onClick={() => handleDownload('combined')}
                disabled={downloadingPhase === 'combined'}
                className="px-4 py-2 bg-gradient-to-r from-desert-sand to-champagne text-dark-gray font-semibold rounded-lg hover:from-champagne hover:to-goldenrod transition-all duration-300 shadow-sm hover:shadow-md transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
              >
                {downloadingPhase === 'combined' ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Brand Alchemy Spark
                  </span>
                )}
              </button>
              <span className="text-xs text-goldenrod mt-1 font-medium">
                Complete Report
              </span>
            </div>
          )}
        </div>
        
        {/* Enhanced progress bar */}
        <div className="relative pt-1">
          <div className="flex mb-2 items-center justify-between">
            <div>
              <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-goldenrod bg-goldenrod/10">
                Progress: {Math.round(progressPercentage)}%
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold inline-block text-neutral-gray">
                {questionCount}/{totalQuestions} Questions
              </span>
            </div>
          </div>
          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded-full bg-neutral-gray/20">
            <motion.div
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r from-desert-sand to-goldenrod"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhaseProgress;