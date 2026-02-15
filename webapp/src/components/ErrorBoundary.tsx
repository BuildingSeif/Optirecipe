import React from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("[ErrorBoundary] Unhandled error:", error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-black/90">
          <div className="ct-card relative max-w-md w-full rounded-2xl bg-black/40 border border-white/12 backdrop-blur-[12px] p-8 text-center">
            {/* Top glow */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-t-2xl" />

            <div className="flex flex-col items-center gap-5">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-7 h-7 text-red-400" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-heading font-semibold text-white">
                  Oops, une erreur est survenue
                </h2>
                <p className="text-sm text-white/50 leading-relaxed">
                  Quelque chose s'est mal passe. Veuillez recharger la page pour continuer.
                </p>
              </div>

              <button
                onClick={this.handleReload}
                className="mt-2 px-6 py-2.5 rounded-lg bg-white/10 border border-white/12 text-white text-sm font-medium hover:bg-white/15 transition-colors duration-200"
              >
                Recharger la page
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
