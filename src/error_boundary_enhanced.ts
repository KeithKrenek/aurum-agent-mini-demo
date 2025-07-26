import { Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { ERROR_MESSAGES, ERROR_CATEGORIES, getErrorCategory, APP_CONFIG } from './types/constants';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  errorCategory: keyof typeof ERROR_CATEGORIES | null;
  isRecovering: boolean;
  recoveryAttempts: number;
  lastErrorTimestamp: number;
  isUserActionRequired: boolean;
}

// Enhanced error types
class AppError extends Error {
  constructor(
    message: string,
    public category: keyof typeof ERROR_CATEGORIES = 'RECOVERABLE',
    public recoverable: boolean = true,
    public userMessage?: string,
    public actionRequired: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Error pattern detection
class ErrorPatternDetector {
  private static errorHistory: Array<{ timestamp: number; message: string; type?: string }> = [];
  private static readonly MAX_HISTORY = 10;
  private static readonly PATTERN_WINDOW = 60000; // 1 minute

  static addError(error: Error) {
    const now = Date.now();
    this.errorHistory.push({
      timestamp: now,
      message: error.message,
      type: error.name
    });

    // Clean old entries
    this.errorHistory = this.errorHistory.filter(
      entry => now - entry.timestamp < this.PATTERN_WINDOW
    );

    // Keep only recent entries
    if (this.errorHistory.length > this.MAX_HISTORY) {
      this.errorHistory = this.errorHistory.slice(-this.MAX_HISTORY);
    }
  }

  static detectPattern(): 'cascade' | 'repeated' | 'burst' | null {
    const now = Date.now();
    const recentErrors = this.errorHistory.filter(
      entry => now - entry.timestamp < this.PATTERN_WINDOW
    );

    if (recentErrors.length >= 5) {
      return 'burst';
    }

    if (recentErrors.length >= 3) {
      const messages = recentErrors.map(e => e.message);
      const uniqueMessages = new Set(messages);
      if (uniqueMessages.size === 1) {
        return 'repeated';
      }
      if (uniqueMessages.size >= 3) {
        return 'cascade';
      }
    }

    return null;
  }
}

class ErrorBoundary extends Component<Props, State> {
  private maxRetries = APP_CONFIG.MAX_RETRY_ATTEMPTS;
  private retryTimeout: NodeJS.Timeout | null = null;
  private recoveryTimeout: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private errorReportQueue: Array<any> = [];
  private isProcessingQueue = false;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0,
    errorCategory: null,
    isRecovering: false,
    recoveryAttempts: 0,
    lastErrorTimestamp: 0,
    isUserActionRequired: false
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    ErrorPatternDetector.addError(error);
    const category = getErrorCategory(error.message as keyof typeof ERROR_MESSAGES) || 'RECOVERABLE';
    const pattern = ErrorPatternDetector.detectPattern();
    
    return { 
      hasError: true,
      error,
      errorCategory: category,
      lastErrorTimestamp: Date.now(),
      isUserActionRequired: pattern === 'repeated' || pattern === 'burst'
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
      errorCategory: getErrorCategory(error.message as keyof typeof ERROR_MESSAGES) || 'RECOVERABLE'
    });
    
    // Enhanced state preservation
    this.preserveApplicationState(error, errorInfo);
    
    // Queue error report for batch processing
    this.queueErrorReport(error, errorInfo);
    
    // Show user-friendly error message
    const userMessage = this.getUserMessage(error);
    toast.error(userMessage);
    
    // Attempt recovery based on error pattern
    const pattern = ErrorPatternDetector.detectPattern();
    this.handleErrorPattern(pattern, error);
  }

  private preserveApplicationState(error: Error, errorInfo: ErrorInfo) {
    try {
      const currentState = {
        // Application state
        interviewId: sessionStorage.getItem('interviewId'),
        brandName: sessionStorage.getItem('brandName'),
        currentPhase: sessionStorage.getItem('currentPhase'),
        messages: this.getMessagesFromSessionStorage(),
        
        // Error context
        timestamp: new Date().toISOString(),
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
          category: this.state.errorCategory,
          recoverable: this.isRecoverable(error)
        },
        errorInfo: {
          componentStack: errorInfo.componentStack
        },
        
        // System context
        browserInfo: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          onLine: navigator.onLine,
          cookieEnabled: navigator.cookieEnabled
        },
        
        // Performance context
        performance: {
          memory: (performance as any).memory ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
          } : null,
          timing: performance.timing ? {
            loadEventEnd: performance.timing.loadEventEnd,
            loadEventStart: performance.timing.loadEventStart,
            domContentLoadedEventEnd: performance.timing.domContentLoadedEventEnd
          } : null
        }
      };
      
      sessionStorage.setItem('errorRecoveryState', JSON.stringify(currentState));
      sessionStorage.setItem('errorRecoveryAttempts', String(this.state.retryCount + 1));
      
    } catch (preservationError) {
      console.error('Failed to preserve application state:', preservationError);
    }
  }

  private getMessagesFromSessionStorage(): any[] {
    try {
      const stored = sessionStorage.getItem('messages');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private queueErrorReport(error: Error, errorInfo: ErrorInfo) {
    const report = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      errorInfo,
      sessionId: sessionStorage.getItem('interviewId'),
      userAgent: navigator.userAgent,
      pattern: ErrorPatternDetector.detectPattern(),
      retryCount: this.state.retryCount,
      category: this.state.errorCategory
    };
    
    this.errorReportQueue.push(report);
    this.processErrorQueue();
  }

  private async processErrorQueue() {
    if (this.isProcessingQueue || this.errorReportQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    
    try {
      // In production, send to error tracking service
      if (APP_CONFIG.DEBUG_MODE) {
        console.group('📊 Error Reports Queue');
        this.errorReportQueue.forEach((report, index) => {
          console.log(`Report ${index + 1}:`, report);
        });
        console.groupEnd();
      }
      
      // Simulate sending to external service
      // await sendErrorReports(this.errorReportQueue);
      
      this.errorReportQueue = [];
    } catch (reportError) {
      console.error('Failed to process error reports:', reportError);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private handleErrorPattern(pattern: string | null, error: Error) {
    switch (pattern) {
      case 'burst':
        console.warn('Error burst detected - implementing circuit breaker');
        this.setState({ isUserActionRequired: true });
        toast.error('Multiple errors detected. Please refresh the page or restart your session.', {
          duration: 10000
        });
        break;
        
      case 'repeated':
        console.warn('Repeated error detected - disabling auto-recovery');
        this.setState({ isUserActionRequired: true });
        break;
        
      case 'cascade':
        console.warn('Error cascade detected - implementing progressive recovery');
        if (this.shouldAttemptAutoRecovery(error) && this.state.retryCount < 1) {
          this.attemptProgressiveRecovery();
        }
        break;
        
      default:
        if (this.shouldAttemptAutoRecovery(error) && this.state.retryCount < this.maxRetries) {
          this.attemptAutoRecovery();
        }
    }
  }

  private isRecoverable(error: Error): boolean {
    if (error instanceof AppError) {
      return error.recoverable;
    }
    
    const category = getErrorCategory(error.message as keyof typeof ERROR_MESSAGES);
    const recoverableCategories = ['RECOVERABLE', 'SESSION_RELATED'];
    
    // Check if error happened too recently (might indicate a loop)
    const timeSinceLastError = Date.now() - this.state.lastErrorTimestamp;
    if (timeSinceLastError < 5000) { // Less than 5 seconds
      return false;
    }
    
    return recoverableCategories.includes(category || '');
  }

  private getUserMessage(error: Error): string {
    if (error instanceof AppError && error.userMessage) {
      return error.userMessage;
    }

    // Context-aware error messages
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return 'Connection issue detected. Please check your internet connection.';
    }
    if (message.includes('firebase') || message.includes('firestore')) {
      return 'Database connection issue. Your progress has been saved locally.';
    }
    if (message.includes('openai') || message.includes('api')) {
      return 'AI service temporarily unavailable. Please try again in a moment.';
    }
    if (message.includes('session') || message.includes('auth')) {
      return 'Session expired. Please start a new brand development journey.';
    }
    if (message.includes('quota') || message.includes('rate limit')) {
      return 'Service limit reached. Please try again in a few minutes.';
    }
    
    return 'An unexpected error occurred. Your progress has been saved.';
  }

  private shouldAttemptAutoRecovery(error: Error): boolean {
    const recoverableCategories = ['RECOVERABLE'];
    const category = getErrorCategory(error.message as keyof typeof ERROR_MESSAGES);
    
    return recoverableCategories.includes(category || '') && 
           this.state.recoveryAttempts < 2 &&
           !this.state.isUserActionRequired;
  }

  private attemptAutoRecovery = () => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    this.setState({ isRecovering: true });

    const retryDelay = Math.min(
      APP_CONFIG.RETRY_DELAY_BASE * Math.pow(APP_CONFIG.EXPONENTIAL_BACKOFF_FACTOR, this.state.retryCount), 
      APP_CONFIG.MAX_RETRY_DELAY
    );
    
    toast.loading(`Attempting recovery... (${this.state.retryCount + 1}/${this.maxRetries})`, {
      duration: retryDelay,
      id: 'recovery-toast'
    });

    this.retryTimeout = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
        recoveryAttempts: prevState.recoveryAttempts + 1,
        isRecovering: false,
        isUserActionRequired: false
      }));
      
      toast.dismiss('recovery-toast');
      toast.success('Recovery successful!', { duration: 2000 });
      
      this.startHealthMonitoring();
    }, retryDelay);
  };

  private attemptProgressiveRecovery = () => {
    console.log('Attempting progressive recovery...');
    
    // Clear potentially corrupted state
    try {
      const essentialState = {
        interviewId: sessionStorage.getItem('interviewId'),
        brandName: sessionStorage.getItem('brandName')
      };
      
      // Clear all session storage except essential items
      sessionStorage.clear();
      
      // Restore essential state
      if (essentialState.interviewId) {
        sessionStorage.setItem('interviewId', essentialState.interviewId);
      }
      if (essentialState.brandName) {
        sessionStorage.setItem('brandName', essentialState.brandName);
      }
      
    } catch (clearError) {
      console.error('Failed to clear state during progressive recovery:', clearError);
    }
    
    this.attemptAutoRecovery();
  };

  private startHealthMonitoring = () => {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    let healthChecks = 0;
    const maxHealthChecks = 6;

    this.healthCheckInterval = setInterval(() => {
      healthChecks++;
      
      try {
        // Enhanced health checks
        if (!document.getElementById('root')) {
          throw new Error('Root element not found');
        }
        
        if (!sessionStorage.getItem('interviewId')) {
          console.warn('Interview ID missing during health check');
        }
        
        // Memory usage check
        if ((performance as any).memory) {
          const memoryInfo = (performance as any).memory;
          const usageRatio = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
          if (usageRatio > 0.9) {
            console.warn('High memory usage detected:', usageRatio);
          }
        }
        
        if (healthChecks >= maxHealthChecks) {
          clearInterval(this.healthCheckInterval!);
          this.healthCheckInterval = null;
          console.log('Health monitoring completed successfully');
        }
        
      } catch (error) {
        console.error('Health check failed:', error);
        clearInterval(this.healthCheckInterval!);
        this.healthCheckInterval = null;
      }
    }, 5000);
  };

  private handleManualRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      isRecovering: false,
      isUserActionRequired: false
    });
    
    toast.success('Retrying...', { duration: 1000 });
  };

  private handleRestart = () => {
    const errorReport = {
      timestamp: new Date().toISOString(),
      lastError: this.state.error?.message,
      retryCount: this.state.retryCount,
      category: this.state.errorCategory,
      pattern: ErrorPatternDetector.detectPattern()
    };
    
    sessionStorage.setItem('lastErrorReport', JSON.stringify(errorReport));
    
    // Preserve essential recovery data
    const recoveryState = sessionStorage.getItem('errorRecoveryState');
    const essentialData = {
      recoveryState,
      lastErrorReport: JSON.stringify(errorReport)
    };
    
    sessionStorage.clear();
    
    // Restore essential data
    Object.entries(essentialData).forEach(([key, value]) => {
      if (value) {
        sessionStorage.setItem(key, value);
      }
    });
    
    toast.success('Restarting application...', { duration: 2000 });
    
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  };

  private handleFeedback = () => {
    const feedbackData = {
      error: this.state.error?.message,
      category: this.state.errorCategory,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    // In production, send to feedback service
    console.log('User feedback data:', feedbackData);
    toast.success('Thank you for your feedback!');
  };

  private getErrorIcon = () => {
    switch (this.state.errorCategory) {
      case 'CRITICAL':
        return '🚨';
      case 'SESSION_RELATED':
        return '🔒';
      case 'USER_INPUT':
        return '⚠️';
      default:
        return '❌';
    }
  };

  private getErrorTitle = () => {
    if (this.state.isUserActionRequired) {
      return 'Action Required';
    }
    
    switch (this.state.errorCategory) {
      case 'CRITICAL':
        return 'Critical System Error';
      case 'SESSION_RELATED':
        return 'Session Issue';
      case 'USER_INPUT':
        return 'Input Error';
      case 'RECOVERABLE':
        return 'Temporary Issue';
      default:
        return 'Something went wrong';
    }
  };

  private getErrorDescription = () => {
    if (this.state.isUserActionRequired) {
      return 'Multiple errors detected. Please restart your session or refresh the page.';
    }
    
    switch (this.state.errorCategory) {
      case 'CRITICAL':
        return 'A critical system error has occurred. Please try restarting or contact support if this continues.';
      case 'SESSION_RELATED':
        return 'Your session has encountered an issue. You may need to start a new brand development journey.';
      case 'USER_INPUT':
        return 'There was an issue with your input. Please check your response and try again.';
      case 'RECOVERABLE':
        return this.getUserMessage(this.state.error!);
      default:
        return 'An unexpected error occurred, but your progress has been saved.';
    }
  };

  public componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  public render() {
    if (this.state.hasError) {
      const canRetry = this.state.retryCount < this.maxRetries && 
                      this.state.errorCategory !== 'CRITICAL' &&
                      !this.state.isUserActionRequired;
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-white-smoke p-4">
          <AnimatePresence>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="max-w-md w-full bg-white rounded-xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className={`p-6 text-center ${
                this.state.errorCategory === 'CRITICAL' || this.state.isUserActionRequired
                  ? 'bg-red-50 border-b border-red-100' 
                  : 'bg-orange-50 border-b border-orange-100'
              }`}>
                <motion.div 
                  className="text-6xl mb-4"
                  animate={{ 
                    rotate: this.state.isRecovering ? 360 : 0,
                    scale: this.state.isRecovering ? [1, 1.1, 1] : 1
                  }}
                  transition={{ 
                    rotate: { duration: 2, repeat: this.state.isRecovering ? Infinity : 0 },
                    scale: { duration: 0.5, repeat: this.state.isRecovering ? Infinity : 0 }
                  }}
                >
                  {this.getErrorIcon()}
                </motion.div>
                
                <h1 className={`text-xl font-semibold mb-2 ${
                  this.state.errorCategory === 'CRITICAL' || this.state.isUserActionRequired
                    ? 'text-red-800' : 'text-orange-800'
                }`}>
                  {this.getErrorTitle()}
                </h1>
                
                <p className={`text-sm ${
                  this.state.errorCategory === 'CRITICAL' || this.state.isUserActionRequired
                    ? 'text-red-600' : 'text-orange-600'
                }`}>
                  {this.getErrorDescription()}
                </p>
              </div>

              {/* Error pattern warning */}
              {this.state.isUserActionRequired && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mx-6 mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                >
                  <p className="text-xs text-yellow-800 font-medium">
                    ⚠️ Multiple errors detected. Auto-recovery has been disabled for your safety.
                  </p>
                </motion.div>
              )}

              {/* Error details for development */}
              {APP_CONFIG.DEBUG_MODE && this.state.error && (
                <motion.details 
                  className="mx-6 mt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <summary className="cursor-pointer text-xs text-neutral-gray hover:text-dark-gray mb-2 font-medium">
                    🔍 Technical Details (Development Mode)
                  </summary>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs font-mono overflow-auto max-h-32 border">
                    <div className="text-red-600 mb-2 font-semibold">
                      {this.state.error.name}: {this.state.error.message}
                    </div>
                    <div className="text-blue-600 mb-2">
                      Pattern: {ErrorPatternDetector.detectPattern() || 'None'}
                    </div>
                    {this.state.error.stack && (
                      <div className="text-gray-600 whitespace-pre-wrap">
                        {this.state.error.stack.substring(0, 300)}
                        {this.state.error.stack.length > 300 && '...'}
                      </div>
                    )}
                  </div>
                </motion.details>
              )}
              
              {/* Recovery status */}
              <AnimatePresence>
                {this.state.isRecovering && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mx-6 mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200"
                  >
                    <div className="flex items-center gap-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"
                      />
                      <p className="text-xs text-blue-700 font-medium">
                        Recovery in progress... (Attempt {this.state.recoveryAttempts + 1})
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action buttons */}
              <div className="p-6 space-y-3">
                {canRetry && !this.state.isRecovering && (
                  <motion.button
                    onClick={this.handleManualRetry}
                    className="w-full bg-desert-sand hover:bg-champagne text-dark-gray font-medium py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={this.state.isRecovering}
                  >
                    Try Again {this.state.retryCount > 0 && `(${this.maxRetries - this.state.retryCount} attempts left)`}
                  </motion.button>
                )}
                
                <motion.button
                  onClick={this.handleRestart}
                  className="w-full bg-dark-gray hover:bg-black text-white font-medium py-3 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={this.state.isRecovering}
                >
                  Start New Journey
                </motion.button>

                {/* Feedback button for production */}
                {!APP_CONFIG.DEBUG_MODE && (
                  <motion.button
                    onClick={this.handleFeedback}
                    className="w-full bg-neutral-gray hover:bg-taupe-gray text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 text-sm"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Send Feedback
                  </motion.button>
                )}
                
                <div className="text-xs text-neutral-gray text-center mt-4 leading-relaxed">
                  Your progress has been automatically saved and will be restored when possible.
                  {this.state.retryCount > 0 && (
                    <span className="block mt-1 font-medium text-goldenrod">
                      Recovery attempted {this.state.retryCount} time{this.state.retryCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {this.state.isUserActionRequired && (
                    <span className="block mt-1 font-medium text-red-600">
                      Manual action required to prevent error loops
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;