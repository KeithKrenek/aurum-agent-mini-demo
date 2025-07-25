// src/PhaseProgress.tsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Check, Loader } from 'lucide-react';
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
            }
        }

        // For individual phase reports
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

  // // Add a utility function to combine reports
  // const combineReports = (phaseReports: string[]): string => {
  //   const sections = [
  //     "Brand Elements Discovery",
  //     "Brand Voice Analysis",
  //     "Brand Audience Alignment Analysis"
  //   ];

  //   return phaseReports.map((report, index) => {
  //     // Remove any existing top-level headers that might conflict
  //     const cleanedReport = report.replace(/^# .*$/m, '').trim();
      
  //     // Add section header
  //     return `# ${sections[index]}\n\n${cleanedReport}`;
  //   }).join('\n\n---\n\n');  // Add separator between sections
  // };

  const currentPhaseIndex = phases.findIndex(phase => phase.id === currentPhase);
  const totalQuestions = PREDEFINED_QUESTIONS.length;
  const progressPercentage = Math.min(((questionCount) / totalQuestions) * 100, 100);
  // const progressPercentage = ((questionCount) / totalQuestions) * 100;
  // console.log('Progress percentage:', progressPercentage, ' of ', totalQuestions);  // Debug log

  return (
    <div className="fixed top-0 left-0 right-0 bg-white z-50 shadow-md">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex justify-between items-center mb-2">
          {phases.map((phase, index) => {
            const isCompleted = currentPhase === 'complete' || index < currentPhaseIndex;
            const isCurrentPhase = index === currentPhaseIndex;
            const hasReport = isValidPhase(phase.id) && reports[phase.id];
  
            return (
              <div key={phase.id} className="flex flex-col items-center text-center">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mb-1 ${
                  isCompleted ? 'border-desert-sand text-desert-sand' : 'border-neutral-gray text-neutral-gray'
                }`}>
                  {isCompleted ? <Check className="w-4 h-4" /> : <span>{index + 1}</span>}
                </div>
                <span className={`text-sm mb-1 ${isCurrentPhase ? 'font-semibold' : 'text-neutral-gray'}`}>
                  {phase.label}
                </span>
                {hasReport && (
                  <button
                    onClick={() => handleDownload(phase.id)}
                    disabled={downloadingPhase === phase.id}
                    className="text-xs text-desert-sand hover:text-champagne flex items-center gap-1"
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
              </div>
            );
          })}
          
          {/* Combined report download button */}
          {currentPhase === 'complete' && (
            <button
              onClick={() => {
                // console.log('Complete report button clicked'); // Debug log
                handleDownload('combined');
              }}
              disabled={downloadingPhase === 'combined'}
              className="ml-4 px-4 py-2 bg-desert-sand text-dark-gray rounded-lg hover:bg-champagne transition-colors"
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
          )}
        </div>
        
        <div className="relative pt-1">
          <motion.div
            className="h-2 rounded-full bg-desert-sand"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}            
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </div>
  );
};

export default PhaseProgress;