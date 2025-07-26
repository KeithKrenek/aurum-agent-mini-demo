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
}

// Enhanced error types for better categorization
class AppError extends Error {
  constructor(
    message: string,
    public category: keyof typeof ERROR_CATEGORIES = 'RECOVERABLE',
    public recoverable: boolean = true,
    public userMessage?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

class ErrorBoundary extends Component<Props, State> {
  private maxRetries = APP_CONFIG.MAX_RETRY_ATTEMPTS;
  private retryTimeout: NodeJS.Timeout | null = null;
  private recoveryTimeout: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0,
    errorCategory: null,
    isRecovering: false,
    recoveryAttempts: 0
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    const category = getErrorCategory(error.message as keyof typeof ERROR_MESSAGES) || 'RECOVERABLE';
    
    return { 
      hasError: true,
      error,
      errorCategory: category
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
      errorCategory: getErrorCategory(error.message as keyof typeof ERROR_MESSAGES) || 'RECOVERABLE'
    });
    
    // Enhanced state preservation with error context
    const currentState = {
      messages: sessionStorage.getItem('messages'),
      phase: sessionStorage.getItem('currentPhase'),
      brandName: sessionStorage.getItem('brandName'),
      interviewId: sessionStorage.getItem('interviewId'),
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        category: this.state.errorCategory,
        recoverable: this.isRecoverable(error)
      },
      browserInfo: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        viewport: `${window.innerWidth}x${window.innerHeight}`
      }
    };
    
    // Store recovery data with comprehensive context
    sessionStorage.setItem('errorRecoveryState', JSON.stringify(currentState));
    sessionStorage.setItem('errorRecoveryAttempts', String(this.state.retryCount + 1));
    
    // Enhanced error reporting
    this.reportError(error, errorInfo, currentState);
    
    // Show categorized user-friendly error message
    const userMessage = this.getUserMessage(error);
    toast.error(userMessage);
    
    // Attempt automatic recovery for recoverable errors
    if (this.shouldAttemptAutoRecovery(error) && this.state.retryCount < this.maxRetries) {
      this.attemptAutoRecovery();
    } else if (this.state.errorCategory === 'CRITICAL') {
      this.handleCriticalError(error);
    }
  }

  private isRecoverable(error: Error): boolean {
    if (error instanceof AppError) {
      return error.recoverable;
    }
    
    const category = getErrorCategory(error.message as keyof typeof ERROR_MESSAGES);
    return category === 'RECOVERABLE' || category === 'SESSION_RELATED';
  }

  private getUserMessage(error: Error): string {
    if (error instanceof AppError && error.userMessage) {
      return error.userMessage;
    }

    // Categorized error messages
    if (error.message.includes('Network') || error.message.includes('fetch')) {
      return 'Connection issue detected. Please check your internet connection.';
    }
    if (error.message.includes('Firebase') || error.message.includes('Firestore')) {
      return 'Database connection issue. Your progress has been saved locally.';
    }
    if (error.message.includes('OpenAI') || error.message.includes('API')) {
      return 'AI service temporarily unavailable. Please try again in a moment.';
    }
    if (error.message.includes('Session') || error.message.includes('Auth')) {
      return 'Session expired. Please start a new brand development journey.';
    }
    
    return 'An unexpected error occurred. Your progress has been saved.';
  }

  private shouldAttemptAutoRecovery(error: Error): boolean {
    const recoverableCategories = ['RECOVERABLE'];
    const category = getErrorCategory(error.message as keyof typeof ERROR_MESSAGES);
    
    return recoverableCategories.includes(category || '') && 
           this.state.recoveryAttempts < 2; // Limit recovery attempts
  }

  private handleCriticalError(error: Error) {
    console.error('Critical error detected:', error);
    
    // Save comprehensive error report
    const criticalErrorReport = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      userState: {
        interviewId: sessionStorage.getItem('interviewId'),
        currentPhase: sessionStorage.getItem('currentPhase'),
        messageCount: sessionStorage.getItem('messages')?.length || 0
      },
      systemState: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        localStorage: Object.keys(localStorage),
        sessionStorage: Object.keys(sessionStorage)
      }
    };
    
    sessionStorage.setItem('criticalErrorReport', JSON.stringify(criticalErrorReport));
    
    // Show critical error notification
    toast.error('Critical system error. Please contact support if this persists.', {
      duration: 10000
    });
  }

  private reportError(error: Error, errorInfo: ErrorInfo, context: any) {
    // In a production app, you would send this to your error reporting service
    if (APP_CONFIG.DEBUG_MODE) {
      console.group('🚨 Error Report');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.log('Context:', context);
      console.groupEnd();
    }
    
    // Simulate error reporting to external service
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      errorInfo,
      context,
      sessionId: sessionStorage.getItem('interviewId'),
      userAgent: navigator.userAgent
    };
    
    // In production, send to error tracking service like Sentry
    // await sendErrorReport(errorReport);
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
        isRecovering: false
      }));
      
      toast.dismiss('recovery-toast');
      toast.success('Recovery successful!', { duration: 2000 });
      
      // Start health monitoring after recovery
      this.startHealthMonitoring();
    }, retryDelay);
  };

  private startHealthMonitoring = () => {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Monitor app health for 30 seconds after recovery
    let healthChecks = 0;
    const maxHealthChecks = 6; // 30 seconds / 5 second intervals

    this.healthCheckInterval = setInterval(() => {
      healthChecks++;
      
      try {
        // Basic health checks
        if (!document.getElementById('root')) {
          throw new Error('Root element not found');
        }
        
        if (!sessionStorage.getItem('interviewId')) {
          console.warn('Interview ID missing during health check');
        }
        
        // Stop monitoring after max checks
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
      isRecovering: false
    });
    
    toast.success('Retrying...', { duration: 1000 });
  };

  private handleRestart = () => {
    // Preserve error report for debugging
    const errorReport = {
      timestamp: new Date().toISOString(),
      lastError: this.state.error?.message,
      retryCount: this.state.retryCount,
      category: this.state.errorCategory
    };
    
    sessionStorage.setItem('lastErrorReport', JSON.stringify(errorReport));
    
    // Clear application data but preserve error reporting
    const recoveryState = sessionStorage.getItem('errorRecoveryState');
    sessionStorage.clear();
    
    if (recoveryState) {
      sessionStorage.setItem('errorRecoveryState', recoveryState);
    }
    
    toast.success('Restarting application...', { duration: 2000 });
    
    // Redirect to home page
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
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
                      this.state.errorCategory !== 'CRITICAL';
      
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
                this.state.errorCategory === 'CRITICAL' 
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
                  this.state.errorCategory === 'CRITICAL' ? 'text-red-800' : 'text-orange-800'
                }`}>
                  {this.getErrorTitle()}
                </h1>
                
                <p className={`text-sm ${
                  this.state.errorCategory === 'CRITICAL' ? 'text-red-600' : 'text-orange-600'
                }`}>
                  {this.getErrorDescription()}
                </p>
              </div>

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
                
                <p className="text-xs text-neutral-gray text-center mt-4 leading-relaxed">
                  Your progress has been automatically saved and will be restored when possible. 
                  {this.state.retryCount > 0 && (
                    <span className="block mt-1 font-medium text-goldenrod">
                      Recovery attempted {this.state.retryCount} time{this.state.retryCount > 1 ? 's' : ''}
                    </span>
                  )}
                </p>
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