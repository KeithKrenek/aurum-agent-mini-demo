import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Interview } from './types/interview';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, RefreshCw, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

type ValidationState = 'loading' | 'valid' | 'invalid' | 'error' | 'network_error' | 'timeout';

interface ValidationContext {
  attempt: number;
  maxAttempts: number;
  lastError?: string;
  isOnline: boolean;
  hasSessionData: boolean;
}

// Session validation utilities
class SessionValidator {
  private static readonly MAX_VALIDATION_TIME = 30000; // 30 seconds
  private static readonly SESSION_TIMEOUT_HOURS = 24;
  
  static async validateWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number = this.MAX_VALIDATION_TIME
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Validation timeout')), timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }
  
  static validateSessionAge(createdAt: any): boolean {
    if (!createdAt) return true; // Allow if no timestamp (graceful degradation)
    
    try {
      const createdDate = createdAt instanceof Date 
        ? createdAt 
        : new Date((createdAt as any).seconds * 1000);
      
      const ageInHours = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
      return ageInHours <= this.SESSION_TIMEOUT_HOURS;
    } catch {
      return true; // Graceful fallback
    }
  }
  
  static validateInterviewData(interview: Interview): { valid: boolean; reason?: string } {
    if (!interview) {
      return { valid: false, reason: 'No interview data' };
    }
    
    if (!interview.brandName || interview.brandName.trim() === '') {
      return { valid: false, reason: 'Missing brand name' };
    }
    
    if (!this.validateSessionAge(interview.createdAt)) {
      return { valid: false, reason: 'Session expired' };
    }
    
    return { valid: true };
  }
}

// Online status hook with enhanced detection
const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'offline'>('good');

  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      setConnectionQuality(online ? 'good' : 'offline');
    };

    const testConnection = async () => {
      if (!navigator.onLine) return;
      
      try {
        const start = Date.now();
        await fetch('/favicon.ico', { 
          method: 'HEAD', 
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000)
        });
        const latency = Date.now() - start;
        setConnectionQuality(latency > 2000 ? 'poor' : 'good');
      } catch {
        setConnectionQuality('poor');
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Test connection quality periodically
    const connectionTest = setInterval(testConnection, 30000);
    testConnection(); // Initial test

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      clearInterval(connectionTest);
    };
  }, []);

  return { isOnline, connectionQuality };
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [validationState, setValidationState] = useState<ValidationState>('loading');
  const [validationContext, setValidationContext] = useState<ValidationContext>({
    attempt: 0,
    maxAttempts: 5,
    isOnline: navigator.onLine,
    hasSessionData: false
  });
  
  const { interviewId } = useParams();
  const { isOnline, connectionQuality } = useOnlineStatus();
  const validationAttempted = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Enhanced validation with comprehensive error handling
  const validateSession = useCallback(async (attemptNumber = 1) => {
    if (validationAttempted.current && attemptNumber === 1) return;
    
    try {
      setValidationContext(prev => ({
        ...prev,
        attempt: attemptNumber,
        isOnline,
        lastError: undefined
      }));

      // Enhanced offline handling
      if (!isOnline) {
        setValidationState('network_error');
        return;
      }

      // Basic parameter validation
      if (!interviewId) {
        console.warn('No interview ID in URL parameters');
        setValidationState('invalid');
        return;
      }

      // Session storage validation
      const storedInterviewId = sessionStorage.getItem('interviewId');
      const hasSessionData = Boolean(
        storedInterviewId || 
        sessionStorage.getItem('brandName') || 
        sessionStorage.getItem('currentPhase')
      );
      
      setValidationContext(prev => ({ ...prev, hasSessionData }));

      if (!storedInterviewId) {
        console.warn('No interview ID in session storage');
        // Don't immediately fail - might be a direct link
      }

      if (storedInterviewId && storedInterviewId !== interviewId) {
        console.warn('Interview ID mismatch between URL and session');
        // Clear mismatched session data
        sessionStorage.removeItem('interviewId');
      }

      // Enhanced Firestore validation with timeout
      const validationPromise = getDoc(doc(db, 'interviews', interviewId));
      const interviewDoc = await SessionValidator.validateWithTimeout(validationPromise);

      if (!interviewDoc || !interviewDoc.exists()) {
        console.warn(`Interview document not found after attempt ${attemptNumber}`);
        
        if (attemptNumber < validationContext.maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, attemptNumber - 1), 5000);
          setTimeout(() => validateSession(attemptNumber + 1), delay);
          return;
        }
        
        setValidationState('invalid');
        return;
      }

      const interview = interviewDoc.data() as Interview;
      
      // Enhanced document validation
      const validation = SessionValidator.validateInterviewData(interview);
      if (!validation.valid) {
        console.warn('Interview validation failed:', validation.reason);
        setValidationContext(prev => ({ ...prev, lastError: validation.reason }));
        setValidationState('invalid');
        return;
      }

      // Enhanced phase validation
      const currentPath = window.location.pathname;
      const isReportPath = currentPath.includes('/report');
      const isComplete = interview.currentPhase === 'complete';

      if (isReportPath && !isComplete) {
        console.warn('Attempted to access report before completion');
        setValidationState('invalid');
        return;
      }

      // Success - update session storage if needed
      if (!storedInterviewId) {
        sessionStorage.setItem('interviewId', interviewId);
      }
      
      if (interview.brandName && !sessionStorage.getItem('brandName')) {
        sessionStorage.setItem('brandName', interview.brandName);
      }
      
      if (interview.currentPhase && !sessionStorage.getItem('currentPhase')) {
        sessionStorage.setItem('currentPhase', interview.currentPhase);
      }

      setValidationState('valid');
      validationAttempted.current = true;
      
    } catch (error) {
      console.error(`Session validation error (attempt ${attemptNumber}):`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setValidationContext(prev => ({ ...prev, lastError: errorMessage }));

      // Enhanced error categorization
      if (errorMessage.includes('timeout')) {
        setValidationState('timeout');
        return;
      }
      
      if (errorMessage.includes('network') || errorMessage.includes('offline')) {
        setValidationState('network_error');
        return;
      }

      // Retry logic with exponential backoff
      if (attemptNumber < validationContext.maxAttempts) {
        const delay = Math.min(1000 * Math.pow(2, attemptNumber - 1), 10000);
        console.log(`Retrying validation in ${delay}ms (attempt ${attemptNumber + 1}/${validationContext.maxAttempts})`);
        
        setTimeout(() => validateSession(attemptNumber + 1), delay);
        return;
      }

      // Final failure
      setValidationState('error');
    }
  }, [interviewId, isOnline, validationContext.maxAttempts]);

  // Initialize validation
  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Start validation with a small delay to allow for proper mount
    timeoutRef.current = setTimeout(() => {
      validateSession();
    }, 100);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [validateSession]);

  // Manual retry handler
  const handleRetry = useCallback(() => {
    setValidationState('loading');
    setValidationContext(prev => ({ ...prev, attempt: 0, lastError: undefined }));
    validationAttempted.current = false;
    validateSession(1);
  }, [validateSession]);

  // Enhanced loading state with progress
  if (validationState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white-smoke">
        <motion.div 
          className="text-center max-w-md mx-auto p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="relative mb-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 mx-auto"
            >
              <Shield className="w-full h-full text-goldenrod" />
            </motion.div>
            
            {validationContext.attempt > 1 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute -bottom-2 left-1/2 transform -translate-x-1/2"
              >
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Attempt {validationContext.attempt}
                </span>
              </motion.div>
            )}
          </div>
          
          <h2 className="text-xl font-semibold text-dark-gray mb-2">
            Validating Your Session
          </h2>
          
          <p className="text-neutral-gray text-sm mb-4">
            {validationContext.attempt <= 1 
              ? 'Verifying your brand development session...'
              : `Retrying connection... (${validationContext.attempt}/${validationContext.maxAttempts})`
            }
          </p>
          
          {/* Connection status indicator */}
          <div className="flex items-center justify-center gap-2 text-xs">
            {isOnline ? (
              <>
                <Wifi className={`w-4 h-4 ${connectionQuality === 'good' ? 'text-green-500' : 'text-yellow-500'}`} />
                <span className="text-neutral-gray">
                  {connectionQuality === 'good' ? 'Connection stable' : 'Connection slow'}
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-red-500" />
                <span className="text-neutral-gray">Connection lost</span>
              </>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // Enhanced error states with specific recovery options
  if (['error', 'network_error', 'timeout'].includes(validationState)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white-smoke p-4">
        <motion.div 
          className="max-w-md w-full bg-white rounded-lg shadow-lg overflow-hidden"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          {/* Header */}
          <div className={`p-6 text-center border-b ${
            validationState === 'network_error' 
              ? 'bg-blue-50 border-blue-100' 
              : validationState === 'timeout'
              ? 'bg-yellow-50 border-yellow-100'
              : 'bg-red-50 border-red-100'
          }`}>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-white/50">
              {validationState === 'network_error' ? (
                <WifiOff className="w-8 h-8 text-blue-600" />
              ) : validationState === 'timeout' ? (
                <RefreshCw className="w-8 h-8 text-yellow-600" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-red-600" />
              )}
            </div>
            
            <h2 className={`text-xl font-semibold mb-2 ${
              validationState === 'network_error' 
                ? 'text-blue-800' 
                : validationState === 'timeout'
                ? 'text-yellow-800'
                : 'text-red-800'
            }`}>
              {validationState === 'network_error' && 'Connection Issue'}
              {validationState === 'timeout' && 'Validation Timeout'}
              {validationState === 'error' && 'Validation Error'}
            </h2>
            
            <p className={`text-sm ${
              validationState === 'network_error' 
                ? 'text-blue-600' 
                : validationState === 'timeout'
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}>
              {validationState === 'network_error' && 'Please check your internet connection and try again.'}
              {validationState === 'timeout' && 'Session validation is taking longer than expected.'}
              {validationState === 'error' && 'We encountered an issue validating your session.'}
            </p>
          </div>

          {/* Status information */}
          <div className="p-4 bg-gray-50 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-medium text-gray-600">Connection:</span>
                <span className={`ml-2 ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Session Data:</span>
                <span className={`ml-2 ${validationContext.hasSessionData ? 'text-green-600' : 'text-yellow-600'}`}>
                  {validationContext.hasSessionData ? 'Present' : 'Missing'}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Attempts:</span>
                <span className="ml-2 text-gray-800">
                  {validationContext.attempt}/{validationContext.maxAttempts}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Quality:</span>
                <span className={`ml-2 ${
                  connectionQuality === 'good' ? 'text-green-600' : 
                  connectionQuality === 'poor' ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {connectionQuality}
                </span>
              </div>
            </div>
            
            {validationContext.lastError && (
              <div className="mt-3 p-2 bg-red-50 rounded text-xs text-red-700">
                <strong>Last Error:</strong> {validationContext.lastError}
              </div>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="p-6 space-y-3">
            <motion.button
              onClick={handleRetry}
              disabled={!isOnline && validationState === 'network_error'}
              className="w-full bg-desert-sand hover:bg-champagne text-dark-gray font-medium py-3 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: isOnline ? 1.02 : 1 }}
              whileTap={{ scale: isOnline ? 0.98 : 1 }}
            >
              {!isOnline && validationState === 'network_error' 
                ? 'Waiting for Connection...' 
                : 'Try Again'
              }
            </motion.button>
            
            <motion.button
              onClick={() => window.location.href = '/'}
              className="w-full bg-dark-gray hover:bg-black text-white font-medium py-3 px-4 rounded-lg transition-all duration-200"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Start New Journey
            </motion.button>
            
            <p className="text-xs text-neutral-gray text-center leading-relaxed">
              If this problem persists, try refreshing the page or clearing your browser cache.
              {validationContext.hasSessionData && (
                <span className="block mt-1 text-goldenrod font-medium">
                  Your progress appears to be saved locally.
                </span>
              )}
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Invalid session - redirect to home
  if (validationState === 'invalid') {
    return <Navigate to="/" replace />;
  }

  // Valid session - render protected content with success animation
  if (validationState === 'valid') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {children}
      </motion.div>
    );
  }

  // Fallback
  return null;
};