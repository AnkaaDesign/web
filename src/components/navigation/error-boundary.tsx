import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error safely
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.error("ErrorBoundary caught an error:", error.message);
        if (errorInfo && errorInfo.componentStack) {
          console.error("Component stack:", errorInfo.componentStack);
        }
      }
    } catch (e) {
      // Ignore logging errors
    }

    // Check if it's a hook call error
    if (error.message.includes("Invalid hook call")) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn("Detected React hook call error. This might be due to authentication state changes.");
      }

      // Auto-refresh the page after a short delay to recover from hook errors
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md w-full bg-card shadow-sm rounded-lg p-4">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-destructive/10 rounded-full mb-4">
              <svg className="w-6 h-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-center text-card-foreground mb-2">Algo deu errado</h1>
            <p className="text-muted-foreground text-center mb-6">
              {this.state.error?.message.includes("Invalid hook call")
                ? "Detectamos um problema de autenticação. A página será recarregada automaticamente."
                : "Ocorreu um erro inesperado. Tente novamente."}
            </p>
            {!this.state.error?.message.includes("Invalid hook call") && (
              <div className="flex gap-3">
                <button onClick={this.handleRetry} className="flex-1 bg-primary hover:opacity-90 text-primary-foreground font-medium py-2 px-4 rounded-lg transition-opacity">
                  Tentar novamente
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 bg-secondary hover:opacity-90 text-secondary-foreground font-medium py-2 px-4 rounded-lg transition-opacity"
                >
                  Recarregar página
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
