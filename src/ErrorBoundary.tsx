import { Component, ErrorInfo, ReactNode } from 'react';
import toast from 'react-hot-toast';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    // Attempt to save current state
    const currentState = {
      messages: sessionStorage.getItem('messages'),
      phase: sessionStorage.getItem('currentPhase'),
      brandName: sessionStorage.getItem('brandName')
    };
    
    // Store recovery data
    sessionStorage.setItem('recoveryState', JSON.stringify(currentState));
    
    toast.error('An unexpected error occurred. Attempting to recover your session.');
    
    // Attempt automatic recovery
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="text-center mt-10">
          <h1 className="text-2xl font-bold mb-4">Oops, something went wrong.</h1>
          <p>We're sorry for the inconvenience. Please try refreshing the page or contact support if the problem persists.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;