import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { monitoringService } from '../services/monitoringService';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    monitoringService.trackError({
      errorType: 'client_error',
      errorMessage: error.message,
      errorStack: error.stack,
      severity: 'critical',
      component: 'ErrorBoundary',
      userAction: errorInfo.componentStack?.split('\n')[1]?.trim() ?? '',
    });
  }

  private handleReload = () => window.location.reload();
  private handleGoHome = () => { window.location.href = '/'; };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
          <div className="max-w-sm w-full card-base p-8 text-center">
            <div className="flex justify-center mb-5">
              <div className="w-16 h-16 rounded-2xl bg-danger-50 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-danger-500" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-ink mb-2 font-display">Something went wrong</h1>
            <p className="text-sm text-ink-muted mb-6 leading-relaxed">
              An unexpected error occurred. Please try reloading or return home.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-3 bg-surface-100 rounded-xl text-left border border-surface-200">
                <p className="text-xs font-mono text-ink-muted break-all">{this.state.error.message}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={this.handleReload}
                className="btn-base flex-1 py-2.5 text-sm bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-card hover:shadow-glow"
              >
                <RefreshCw className="w-4 h-4" />
                Reload
              </button>
              <button
                onClick={this.handleGoHome}
                className="btn-base flex-1 py-2.5 text-sm bg-surface-100 text-ink-secondary hover:bg-surface-200"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
