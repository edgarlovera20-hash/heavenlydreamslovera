import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  label?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label || 'unknown'}]`, error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/8 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-rose-400" />
          <div>
            <p className="text-sm font-semibold text-rose-300">{this.props.label ? `Error en ${this.props.label}` : 'Algo salió mal'}</p>
            <p className="mt-1 text-xs text-slate-400">{this.state.error.message}</p>
          </div>
          <button
            onClick={this.reset}
            className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> Reintentar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
