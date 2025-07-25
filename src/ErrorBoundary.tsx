import { Component, ErrorInfo, ReactNode } from 'react';
import toast from 'react-hot-toast';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  private maxRetries = 3;
  private retryTimeout: NodeJS.Timeout | null = null;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { 
      hasError: true,
      error
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
    
    // Enhanced state preservation
    const currentState = {
      messages: sessionStorage.getItem('messages'),
      phase: sessionStorage.getItem('currentPhase'),
      brandName: sessionStorage.getItem('brandName'),
      interviewId: sessionStorage.getItem('interviewId'),
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack
    };
    
    // Store recovery data with error context
    sessionStorage.setItem('recoveryState', JSON.stringify(currentState));
    sessionStorage.setItem('errorRecoveryAttempts', String(this.state.retryCount + 1));
    
    // Show user-friendly error message
    const errorMessage = this.getErrorMessage(error);
    toast.error(errorMessage);
    
    // Attempt automatic recovery for certain error types
    if (this.shouldAttemptAutoRecovery(error) && this.state.retryCount < this.maxRetries) {
      this.attemptAutoRecovery();
    }
  }

  private getErrorMessage(error: Error): string {
    if (error.message.includes('Network')) {
      return 'Connection issue detected. Please check your internet connection.';
    }
    if (error.message.includes('Firebase')) {
      return 'Database connection issue. Your progress has been saved locally.';
    }
    if (error.message.includes('OpenAI')) {
      return 'AI service temporarily unavailable. Please try again in a moment.';
    }
    return 'An unexpected error occurred. Your progress has been saved.';
  }

  private shouldAttemptAutoRecovery(error: Error): boolean {
    // Auto-recover for network, timeout, and API errors
    const recoverableErrors = ['Network', 'timeout', 'fetch', 'OpenAI', 'API'];
    return recoverableErrors.some(keyword => 
      error.message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private attemptAutoRecovery = () => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    const retryDelay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000); // Exponential backoff, max 10s
    
    toast.loading(`Attempting recovery... (${this.state.retryCount + 1}/${this.maxRetries})`, {
      duration: retryDelay
    });

    this.retryTimeout = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));
    }, retryDelay);
  };

  private handleManualRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    });
  };

  private handleRestart = () => {
    // Clear all session data except recovery state
    const recoveryState = sessionStorage.getItem('recoveryState');
    sessionStorage.clear();
    if (recoveryState) {
      sessionStorage.setItem('recoveryState', recoveryState);
    }
    
    // Redirect to home page
    window.location.href = '/';
  };

  public componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  public render() {
    if (this.state.hasError) {
      const canRetry = this.state.retryCount < this.maxRetries;
      const errorType = this.state.error?.message || 'Unknown error';
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-white-smoke p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="mb-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-dark-gray mb-2">
                Oops! Something went wrong
              </h1>
              <p className="text-neutral-gray text-sm mb-4">
                {this.getErrorMessage(this.state.error!)}
              </p>
            </div>
            
            {/* Error details for development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-xs text-neutral-gray hover:text-dark-gray">
                  Technical Details
                </summary>
                <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono overflow-auto max-h-32">
                  <div className="text-red-600 mb-1">{this.state.error.message}</div>
                  {this.state.error.stack && (
                    <div className="text-gray-600">{this.state.error.stack.substring(0, 200)}...</div>
                  )}
                </div>
              </details>
            )}
            
            <div className="space-y-2">
              {canRetry && (
                <button
                  onClick={this.handleManualRetry}
                  className="w-full bg-desert-sand hover:bg-champagne text-dark-gray font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                  disabled={this.state.retryCount >= this.maxRetries}
                >
                  Try Again {this.state.retryCount > 0 && `(${this.maxRetries - this.state.retryCount} attempts left)`}
                </button>
              )}
              
              <button
                onClick={this.handleRestart}
                className="w-full bg-dark-gray hover:bg-black text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
              >
                Start Over
              </button>
              
              <p className="text-xs text-neutral-gray mt-4">
                Your progress has been automatically saved and will be restored when possible.
              </p>
            </div>
            
            {/* Recovery status */}
            {this.state.retryCount > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-700">
                  Recovery attempt {this.state.retryCount} of {this.maxRetries}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;