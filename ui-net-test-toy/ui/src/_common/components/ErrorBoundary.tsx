import React, { ReactNode, ErrorInfo } from "react";
import { logger } from "../utils/logger.ts";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorDetails {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  functionName: string;
  componentName: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorDetails: ErrorDetails | null;
}

/**
 * Enhanced Error Boundary with better error reporting
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorDetails: null };
  }

  static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Enhanced error logging with more context
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      // Add function name extraction from stack trace
      functionName: this.extractFunctionName(error.stack),
      // Add component name from component stack
      componentName: this.extractComponentName(errorInfo.componentStack),
    };

    // Log to console with better formatting
    console.group("🚨 React Error Boundary Caught Error");
    console.error("Error:", error);
    console.error("Error Info:", errorInfo);
    console.error("Full Details:", errorDetails);
    console.groupEnd();

    // Log using your logger
    logger.error("React Error Boundary:", errorDetails);

    // Store error details in state for display
    this.setState({
      error,
      errorInfo,
      errorDetails,
    });

    // Send to error reporting service (if you have one)
    this.reportError(errorDetails);
  }

  extractFunctionName(stack: string | undefined): string {
    if (!stack) return "Unknown";

    // Try to extract function name from stack trace
    const functionMatch = stack.match(/at\s+([^\s]+)\s+\(/);
    if (functionMatch && functionMatch[1]) {
      return functionMatch[1];
    }

    // Fallback: try different patterns
    const altMatch = stack.match(/at\s+([^\s(]+)/);
    return altMatch && altMatch[1] ? altMatch[1] : "Anonymous";
  }

  extractComponentName(componentStack: string | undefined): string {
    if (!componentStack) return "Unknown";

    // Extract the first component from the component stack
    const componentMatch = componentStack.match(/in\s+(\w+)/);
    return componentMatch && componentMatch[1] ? componentMatch[1] : "Unknown";
  }

  reportError(errorDetails: ErrorDetails): void {
    // You can integrate with error reporting services here
    // Examples: Sentry, Bugsnag, LogRocket, etc.

    // For now, just log to console in a structured way
    if (process.env.NODE_ENV === "production") {
      // In production, you might want to send to an error tracking service
      console.error(
        "Production Error Report:",
        JSON.stringify(errorDetails, null, 2),
      );
    }
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div
          className="error-boundary"
          style={{
            padding: "20px",
            margin: "20px",
            border: "2px solid var(--btn-delete-bg, #ff6b6b)",
            borderRadius: "8px",
            backgroundColor: "var(--card-bg)",
            color: "var(--text)",
            fontFamily: "monospace",
            boxShadow: "0 4px 12px var(--shadow-color)",
          }}
        >
          <h2 style={{ color: "var(--btn-delete-bg, #d63031)", marginTop: 0 }}>
            🚨 Something went wrong
          </h2>

          <details style={{ marginBottom: "16px", color: "var(--text)" }}>
            <summary
              style={{
                cursor: "pointer",
                fontWeight: "bold",
                color: "var(--text)",
                marginBottom: "8px",
              }}
            >
              Error Details
            </summary>
            <div
              style={{
                marginTop: "12px",
                fontSize: "14px",
                color: "var(--text-muted)",
              }}
            >
              <p>
                <strong style={{ color: "var(--text)" }}>Function:</strong>{" "}
                {this.state.errorDetails?.functionName}
              </p>
              <p>
                <strong style={{ color: "var(--text)" }}>Component:</strong>{" "}
                {this.state.errorDetails?.componentName}
              </p>
              <p>
                <strong style={{ color: "var(--text)" }}>Message:</strong>{" "}
                {this.state.error?.message}
              </p>
              <p>
                <strong style={{ color: "var(--text)" }}>Time:</strong>{" "}
                {this.state.errorDetails?.timestamp}
              </p>
            </div>
          </details>

          <details style={{ color: "var(--text)" }}>
            <summary
              style={{
                cursor: "pointer",
                fontWeight: "bold",
                color: "var(--text)",
                marginBottom: "8px",
              }}
            >
              Technical Details
            </summary>
            <pre
              style={{
                backgroundColor: "var(--nav-bg)",
                color: "var(--text)",
                padding: "12px",
                borderRadius: "4px",
                overflow: "auto",
                fontSize: "12px",
                marginTop: "12px",
                border: "1px solid var(--accent-dark)",
              }}
            >
              {this.state.error?.stack}
            </pre>
          </details>

          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "16px",
              padding: "8px 16px",
              backgroundColor: "var(--btn-primary-bg, #0984e3)",
              color: "var(--btn-primary-text, white)",
              border: "1px solid var(--accent-dark)",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              transition: "all 0.2s ease",
            }}
            onMouseOver={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor =
                "var(--btn-primary-hover, #0770c7)";
            }}
            onMouseOut={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = "var(--btn-primary-bg, #0984e3)";
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
