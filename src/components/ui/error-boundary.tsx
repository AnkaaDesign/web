import React from "react";
import { Button } from "./button";
import { IconRefresh, IconAlertTriangle } from "@tabler/icons-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; reset: () => void }>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    try {
      console.error("Error caught by error boundary:", error.message);
      if (errorInfo && errorInfo.componentStack) {
        console.error("Component stack:", errorInfo.componentStack);
      }
    } catch (e) {
      // Ignore logging errors
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} reset={this.reset} />;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <IconAlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Ops! Algo deu errado</h2>
          <p className="text-muted-foreground text-center mb-4 max-w-md">
            Ocorreu um erro inesperado. Tente recarregar a página ou entre em contato com o suporte se o problema persistir.
          </p>
          {process.env.NODE_ENV === "development" && (
            <details className="mb-4 max-w-full">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Detalhes do erro (desenvolvimento)</summary>
              <pre className="mt-2 p-4 bg-muted rounded-md text-xs overflow-auto max-w-2xl">
                {this.state.error.toString()}
                {this.state.error.stack && "\n\n" + this.state.error.stack}
              </pre>
            </details>
          )}
          <Button onClick={this.reset} variant="outline">
            <IconRefresh className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook to use error boundary imperatively
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return setError;
}
