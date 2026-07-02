import { Component, type ErrorInfo, type ReactNode } from "react";
import { copyErrorToClipboard, formatErrorForUser } from "@/lib/errors";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  copied: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, copied: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, copied: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.app.error("Unhandled UI error", {
      error: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  handleCopy = async () => {
    if (!this.state.error) return;
    const ok = await copyErrorToClipboard(this.state.error);
    this.setState({ copied: ok });
  };

  handleRetry = () => {
    this.setState({ error: null, copied: false });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-full items-center justify-center p-8" data-testid="error-boundary">
        <div className="max-w-md rounded-lg border border-destructive/50 bg-card p-6 shadow-lg">
          <h2 className="text-lg font-semibold text-destructive">Something went wrong</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            An unexpected error occurred in this view.
          </p>
          <pre className="mt-3 max-h-32 overflow-auto rounded bg-muted p-2 text-xs">
            {formatErrorForUser(this.state.error)}
          </pre>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={this.handleCopy}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
              data-testid="error-copy"
            >
              {this.state.copied ? "Copied" : "Copy error"}
            </button>
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
              data-testid="error-retry"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
