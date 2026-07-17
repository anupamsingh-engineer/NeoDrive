import React from "react";
import { AlertTriangle } from "lucide-react";
import logger from "../../utils/logger";
import Button from "../ui/Button";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    logger.error("ErrorBoundary caught an error", {
      message: error.toString(),
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    this.setState({ error, errorInfo });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface p-6">
          <div className="w-full max-w-lg rounded-lg border border-border bg-canvas p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-tint">
              <AlertTriangle className="h-6 w-6 text-danger" aria-hidden="true" />
            </div>
            <h1 className="mb-2 text-xl font-semibold text-ink">Something went wrong</h1>
            <p className="mb-6 text-sm text-ink-soft">
              An unexpected error occurred. Please try reloading the page.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 rounded-sm bg-surface p-4 text-left">
                <summary className="cursor-pointer text-sm font-medium text-ink">
                  Error details (development only)
                </summary>
                <pre className="mt-3 overflow-auto text-xs text-danger">
                  {this.state.error.toString()}
                  {"\n\n"}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <Button variant="primary" onClick={this.handleReload}>
              Reload page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
