import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Check, Loader, Clock, ChevronDown } from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(false);

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
  
  const progressPercentage = Math.min((questionCount / totalQuestions) * 100, 100);
  
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

  // Compact view component
  const CompactView = () => (
    <div className="flex items-center justify-between">
      {/* Left side - Phase indicators */}
      <div className="flex items-center gap-3">
        {phases.map((phase, index) => {
          const phaseStatus = getPhaseStatus(index);
          const isCompleted = phaseStatus === 'completed';
          const isCurrentPhase = phaseStatus === 'active';
          
          return (
            <div key={phase.id} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                isCompleted 
                  ? 'border-desert-sand bg-desert-sand text-white' 
                  : isCurrentPhase
                  ? 'border-goldenrod bg-white text-goldenrod animate-pulse'
                  : 'border-neutral-gray/50 text-neutral-gray'
              }`}>
                {isCompleted ? (
                  <Check className="w-3 h-3" />
                ) : isCurrentPhase ? (
                  <Clock className="w-3 h-3" />
                ) : (
                  <span className="text-xs">{index + 1}</span>
                )}
              </div>
              
              <span className={`text-sm font-medium transition-all duration-300 ${
                isCurrentPhase 
                  ? 'text-goldenrod' 
                  : isCompleted
                  ? 'text-desert-sand'
                  : 'text-neutral-gray'
              }`}>
                {phase.label}
              </span>
              
              {index < phases.length - 1 && (
                <div className={`w-8 h-0.5 mx-1 transition-all duration-300 ${
                  isCompleted ? 'bg-desert-sand' : 'bg-neutral-gray/30'
                }`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Right side - Progress and expand button */}
      <div className="flex items-center gap-3">
        {/* Progress indicator */}
        <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-neutral-gray/20">
          <div className="w-16 h-1.5 bg-neutral-gray/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-desert-sand to-goldenrod rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <span className="text-xs font-semibold text-goldenrod whitespace-nowrap">
            {Math.round(progressPercentage)}%
          </span>
        </div>

        {/* Final report download button */}
        {currentPhase === 'complete' && reports.complete && (
          <motion.button
            onClick={() => handleDownload('combined')}
            disabled={downloadingPhase === 'combined'}
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-desert-sand to-champagne text-dark-gray font-semibold rounded-full hover:from-champagne hover:to-goldenrod transition-all duration-300 shadow-sm hover:shadow-md text-sm"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {downloadingPhase === 'combined' ? (
              <Loader className="w-3 h-3 animate-spin" />
            ) : (
              <Download className="w-3 h-3" />
            )}
            <span>Brand Alchemy Spark</span>
          </motion.button>
        )}

        {/* Expand/collapse button */}
        <motion.button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 bg-white/80 backdrop-blur-sm rounded-full border border-neutral-gray/20 hover:bg-white transition-all duration-200"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            <ChevronDown className="w-4 h-4 text-neutral-gray" />
          </motion.div>
        </motion.button>
      </div>
    </div>
  );

  // Expanded view component
  const ExpandedView = () => (
    <div className="space-y-4">
      {/* Phase details */}
      <div className="grid grid-cols-3 gap-4">
        {phases.map((phase, index) => {
          const phaseStatus = getPhaseStatus(index);
          const isCompleted = phaseStatus === 'completed';
          const isCurrentPhase = phaseStatus === 'active';
          const hasReport = isValidPhase(phase.id) && reports[phase.id];
          
          const questionsPerPhase = 3;
          const phaseStartQuestion = index * questionsPerPhase;
          const phaseProgress = isCurrentPhase 
            ? Math.min(((questionCount - phaseStartQuestion) / questionsPerPhase) * 100, 100)
            : isCompleted ? 100 : 0;

          return (
            <motion.div 
              key={phase.id} 
              className={`p-3 rounded-lg border-2 transition-all duration-300 ${
                isCurrentPhase 
                  ? 'border-goldenrod bg-goldenrod/5' 
                  : isCompleted 
                  ? 'border-desert-sand bg-desert-sand/5'
                  : 'border-neutral-gray/20 bg-white/50'
              }`}
              whileHover={{ scale: 1.02 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                  isCompleted 
                    ? 'border-desert-sand bg-desert-sand text-white' 
                    : isCurrentPhase
                    ? 'border-goldenrod bg-white text-goldenrod'
                    : 'border-neutral-gray text-neutral-gray'
                }`}>
                  {isCompleted ? (
                    <Check className="w-3 h-3" />
                  ) : isCurrentPhase ? (
                    <Clock className="w-3 h-3" />
                  ) : (
                    <span className="text-xs">{index + 1}</span>
                  )}
                </div>
                
                <span className={`font-semibold text-sm ${
                  isCurrentPhase 
                    ? 'text-goldenrod' 
                    : isCompleted
                    ? 'text-desert-sand'
                    : 'text-neutral-gray'
                }`}>
                  {phase.label}
                </span>
              </div>
              
              {/* Phase progress bar */}
              <div className="w-full h-1 bg-neutral-gray/20 rounded-full mb-2 overflow-hidden">
                <motion.div 
                  className={`h-full rounded-full ${
                    isCurrentPhase ? 'bg-goldenrod' : 'bg-desert-sand'
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${phaseProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              
              {/* Download button */}
              {hasReport && (
                <motion.button
                  onClick={() => handleDownload(phase.id)}
                  disabled={downloadingPhase === phase.id}
                  className={`w-full text-xs flex items-center justify-center gap-1 p-2 rounded transition-all duration-200 ${
                    isCompleted
                      ? 'bg-desert-sand/20 text-desert-sand hover:bg-desert-sand/30'
                      : 'bg-neutral-gray/20 text-neutral-gray hover:bg-neutral-gray/30'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {downloadingPhase === phase.id ? (
                    <Loader className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  <span>Download Report</span>
                </motion.button>
              )}
              
              {!hasReport && isCompleted && (
                <div className="text-xs text-neutral-gray text-center p-2">
                  Processing...
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Overall progress */}
      <div className="flex items-center justify-between p-3 bg-white/80 backdrop-blur-sm rounded-lg border border-neutral-gray/20">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-dark-gray">Overall Progress:</span>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-neutral-gray/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-desert-sand to-goldenrod rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <span className="text-sm font-semibold text-goldenrod">
              {Math.round(progressPercentage)}%
            </span>
          </div>
        </div>
        
        <span className="text-xs text-neutral-gray">
          {questionCount}/{totalQuestions} Questions Completed
        </span>
      </div>
    </div>
  );

  return (
    <motion.div 
      className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-sm z-50 border-b border-neutral-gray/20"
      layout
    >
      <div className="max-w-4xl mx-auto p-3">
        <CompactView />
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="pt-4 border-t border-neutral-gray/20 mt-3">
                <ExpandedView />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default PhaseProgress;