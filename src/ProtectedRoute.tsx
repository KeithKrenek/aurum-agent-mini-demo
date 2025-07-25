import React, { useEffect, useState, useCallback } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Interview } from './types/interview';
import toast from 'react-hot-toast';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

type ValidationState = 'loading' | 'valid' | 'invalid' | 'error';

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [validationState, setValidationState] = useState<ValidationState>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const { interviewId } = useParams();
  
  const validateSession = useCallback(async () => {
    try {
      // Enhanced validation with multiple checks
      const storedInterviewId = sessionStorage.getItem('interviewId');
      
      // Basic parameter validation
      if (!interviewId) {
        console.warn('No interview ID in URL parameters');
        setValidationState('invalid');
        return;
      }
      
      // Session storage validation
      if (!storedInterviewId) {
        console.warn('No interview ID in session storage');
        setValidationState('invalid');
        return;
      }
      
      // ID consistency check
      if (storedInterviewId !== interviewId) {
        console.warn('Interview ID mismatch between URL and session');
        setValidationState('invalid');
        return;
      }

      // Enhanced Firestore document validation with retry logic
      let interviewDoc: ReturnType<typeof getDoc> extends Promise<infer T> ? T | undefined : never = undefined;
      let retryAttempt = 0;
      const maxRetries = 3;
      
      // Retry logic for Firestore consistency issues
      while (retryAttempt < maxRetries) {
        const docSnap = await getDoc(doc(db, 'interviews', interviewId));
        interviewDoc = docSnap;
        
        if (interviewDoc && interviewDoc.exists()) {
          break; // Document found, exit retry loop
        }
        
        retryAttempt++;
        if (retryAttempt < maxRetries) {
          console.log(`Interview document not found, retrying... (${retryAttempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        }
      }
      
      if (!interviewDoc || !interviewDoc.exists()) {
        console.warn('Interview document not found in Firestore after retries');
        setValidationState('invalid');
        return;
      }

      const interview = interviewDoc.data() as Interview;
      
      // Enhanced document structure validation with better error logging
      console.log('Interview document data:', interview); // Debug log
      console.log('BrandName value:', interview.brandName, 'Type:', typeof interview.brandName, 'Length:', interview.brandName?.length); // Detailed debug
      
      if (!interview) {
        console.warn('Interview document exists but has no data');
        setValidationState('invalid');
        return;
      }
      
      // More flexible validation - check for essential fields only
      if (!interview.brandName || interview.brandName.trim() === '') {
        console.warn('Interview document missing or empty brandName field');
        console.warn('Full document:', JSON.stringify(interview, null, 2));
        setValidationState('invalid');
        return;
      }
      
      // Handle missing createdAt field gracefully
      if (!interview.createdAt) {
        console.warn('Interview document missing createdAt field, but allowing access');
        // Don't fail validation for missing createdAt - just skip age check
      } else {
        // Check document age (sessions expire after 24 hours) - only if createdAt exists
        const createdAt = interview.createdAt instanceof Date 
          ? interview.createdAt 
          : new Date((interview.createdAt as any).seconds * 1000); // Handle Firestore Timestamp
        const ageInHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        
        if (ageInHours > 24) {
          console.warn('Interview session expired (> 24 hours old)');
          toast.error('Your session has expired. Please start a new brand development journey.');
          setValidationState('invalid');
          return;
        }
      }
      
      // Enhanced phase validation
      const currentPath = window.location.pathname;
      const isReportPath = currentPath.includes('/report');
      const isComplete = interview.currentPhase === 'complete';
      
      // Allow access to report if interview is complete
      if (isComplete) {
        setValidationState('valid');
        return;
      }
      
      // Block access to report route if interview is not complete
      if (isReportPath && !isComplete) {
        console.warn('Attempted to access report before completion');
        setValidationState('invalid');
        return;
      }
      
      // All validations passed
      setValidationState('valid');
      
    } catch (error) {
      console.error('Session validation error:', error);
      
      // Enhanced error handling with retry logic
      if (retryCount < 2) {
        console.log(`Retrying validation (attempt ${retryCount + 1}/3)`);
        setRetryCount(prev => prev + 1);
        
        // Exponential backoff retry
        setTimeout(() => {
          validateSession();
        }, Math.pow(2, retryCount) * 1000);
        
        return;
      }
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Final validation error after retries:', errorMessage);
      
      if (errorMessage.includes('offline') || errorMessage.includes('network')) {
        toast.error('Connection issue. Please check your internet and try again.');
      } else if (errorMessage.includes('permission') || errorMessage.includes('unauthorized')) {
        toast.error('Access denied. Please start a new brand development journey.');
      } else {
        toast.error('Unable to verify session. Please try refreshing the page or start a new journey.');
      }
      
      setValidationState('error');
    }
  }, [interviewId, retryCount]);

  useEffect(() => {
    validateSession();
  }, [validateSession]);

  // Enhanced loading state with progress indicator
  if (validationState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white-smoke">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dark-gray mx-auto"></div>
            {retryCount > 0 && (
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2">
                <span className="text-xs text-neutral-gray">
                  Reconnecting... ({retryCount}/3)
                </span>
              </div>
            )}
          </div>
          <p className="mt-6 text-neutral-gray">Validating your session...</p>
        </div>
      </div>
    );
  }

  // Enhanced error state with recovery options
  if (validationState === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white-smoke p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-dark-gray mb-2">
            Connection Issue
          </h2>
          <p className="text-neutral-gray text-sm mb-6">
            We're having trouble verifying your session. This might be due to a connection issue.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => {
                setValidationState('loading');
                setRetryCount(0);
                validateSession();
              }}
              className="w-full bg-desert-sand hover:bg-champagne text-dark-gray font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="w-full bg-dark-gray hover:bg-black text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
            >
              Start New Journey
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Valid session - render protected content
  if (validationState === 'valid') {
    return <>{children}</>;
  }

  // Invalid session - redirect to home
  return <Navigate to="/" replace />;
};