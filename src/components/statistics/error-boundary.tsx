import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, RefreshCw, Bug, Clock } from "lucide-react";

// =====================
// Error Boundary Props and State
// =====================

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
  resetOnPropsChange?: boolean;
  isolate?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  retryCount: number;
}

// =====================
// Main Error Boundary Component
// =====================

export class StatisticsErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: number | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: Math.random().toString(36).substr(2, 9),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Log the error
    console.error('Statistics Error Boundary caught an error:', error, errorInfo);

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);

    // Report to error tracking service (if available)
    this.reportError(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys, resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset error boundary if resetKeys changed
    if (hasError && resetKeys !== prevProps.resetKeys) {
      if (resetKeys?.some((key, idx) => key !== prevProps.resetKeys?.[idx])) {
        this.resetErrorBoundary();
      }
    }

    // Reset on any props change if resetOnPropsChange is true
    if (hasError && resetOnPropsChange && prevProps !== this.props) {
      this.resetErrorBoundary();
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to your error tracking service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errorId: this.state.errorId,
    };

    // Example: Send to error tracking service
    // errorTrackingService.report(errorReport);

    console.group('Error Report');
    console.log('Error ID:', errorReport.errorId);
    console.log('Message:', errorReport.message);
    console.log('Stack:', errorReport.stack);
    console.log('Component Stack:', errorReport.componentStack);
    console.groupEnd();
  };

  private resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
    });
  };

  private handleRetry = () => {
    this.setState(prevState => ({
      retryCount: prevState.retryCount + 1,
    }));

    // Reset after a short delay to allow for state cleanup
    this.resetTimeoutId = window.setTimeout(() => {
      this.resetErrorBoundary();
    }, 100);
  };

  private handleRefresh = () => {
    window.location.reload();
  };

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback component
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <StatisticsErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          retryCount={this.state.retryCount}
          onRetry={this.handleRetry}
          onRefresh={this.handleRefresh}
          isolate={this.props.isolate}
        />
      );
    }

    return this.props.children;
  }
}

// =====================
// Error Fallback Component
// =====================

interface StatisticsErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  retryCount: number;
  onRetry: () => void;
  onRefresh: () => void;
  isolate?: boolean;
}

function StatisticsErrorFallback({
  error,
  errorInfo,
  errorId,
  retryCount,
  onRetry,
  onRefresh,
  isolate = false,
}: StatisticsErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  // Determine error severity and type
  const getErrorType = (error: Error | null) => {
    if (!error) return 'unknown';

    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return 'network';
    }
    if (message.includes('timeout')) {
      return 'timeout';
    }
    if (message.includes('permission') || message.includes('unauthorized')) {
      return 'permission';
    }
    if (message.includes('not found') || message.includes('404')) {
      return 'notfound';
    }
    return 'runtime';
  };

  const errorType = getErrorType(error);

  const getErrorMessage = (type: string) => {
    switch (type) {
      case 'network':
        return 'Erro de conexão com o servidor. Verifique sua conexão com a internet.';
      case 'timeout':
        return 'A operação demorou mais que o esperado. Tente novamente.';
      case 'permission':
        return 'Você não tem permissão para acessar estes dados.';
      case 'notfound':
        return 'Os dados solicitados não foram encontrados.';
      default:
        return 'Ocorreu um erro inesperado ao carregar as estatísticas.';
    }
  };

  const getErrorIcon = (type: string) => {
    switch (type) {
      case 'network':
        return <AlertTriangle className="h-8 w-8 text-orange-500" />;
      case 'timeout':
        return <Clock className="h-8 w-8 text-yellow-500" />;
      case 'permission':
        return <AlertTriangle className="h-8 w-8 text-red-500" />;
      default:
        return <Bug className="h-8 w-8 text-red-500" />;
    }
  };

  const shouldShowRetry = retryCount < 3 && !['permission', 'notfound'].includes(errorType);

  if (isolate) {
    // Minimal error display for isolated components
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Erro ao carregar dados</AlertTitle>
        <AlertDescription className="mt-2">
          <div className="space-y-2">
            <p className="text-sm">{getErrorMessage(errorType)}</p>
            {shouldShowRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="mr-2"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Tentar novamente
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto mt-8">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          {getErrorIcon(errorType)}
        </div>
        <CardTitle className="text-lg">Erro nas Estatísticas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Algo deu errado</AlertTitle>
          <AlertDescription>
            {getErrorMessage(errorType)}
          </AlertDescription>
        </Alert>

        {/* Error ID for support */}
        <div className="text-sm text-muted-foreground">
          <p>ID do erro: <code className="px-1 py-0.5 bg-muted rounded text-xs">{errorId}</code></p>
          {retryCount > 0 && (
            <p>Tentativas: {retryCount}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 justify-center">
          {shouldShowRetry && (
            <Button onClick={onRetry} variant="default">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar novamente
            </Button>
          )}

          <Button onClick={onRefresh} variant="outline">
            Recarregar página
          </Button>

          <Button
            onClick={() => setShowDetails(!showDetails)}
            variant="ghost"
            size="sm"
          >
            {showDetails ? 'Ocultar' : 'Ver'} detalhes
          </Button>
        </div>

        {/* Error details (collapsible) */}
        {showDetails && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">
              Detalhes técnicos
            </summary>
            <div className="mt-2 p-3 bg-muted rounded text-xs">
              <div className="space-y-2">
                <div>
                  <strong>Erro:</strong> {error?.message}
                </div>
                {error?.stack && (
                  <div>
                    <strong>Stack:</strong>
                    <pre className="whitespace-pre-wrap mt-1 text-xs">
                      {error.stack}
                    </pre>
                  </div>
                )}
                {errorInfo?.componentStack && (
                  <div>
                    <strong>Component Stack:</strong>
                    <pre className="whitespace-pre-wrap mt-1 text-xs">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </details>
        )}

        {/* Help text */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Se o problema persistir, entre em contato com o suporte técnico
            informando o ID do erro.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// =====================
// HOC for easy error boundary wrapping
// =====================

export function withStatisticsErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <StatisticsErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </StatisticsErrorBoundary>
  );

  WrappedComponent.displayName = `withStatisticsErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// =====================
// Specialized Error Boundaries
// =====================

export function ChartErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <StatisticsErrorBoundary
      isolate
      onError={(error, errorInfo) => {
        console.error('Chart rendering error:', error, errorInfo);
      }}
    >
      {children}
    </StatisticsErrorBoundary>
  );
}

export function TableErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <StatisticsErrorBoundary
      isolate
      onError={(error, errorInfo) => {
        console.error('Table rendering error:', error, errorInfo);
      }}
    >
      {children}
    </StatisticsErrorBoundary>
  );
}

export function MetricsErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <StatisticsErrorBoundary
      isolate
      onError={(error, errorInfo) => {
        console.error('Metrics calculation error:', error, errorInfo);
      }}
    >
      {children}
    </StatisticsErrorBoundary>
  );
}