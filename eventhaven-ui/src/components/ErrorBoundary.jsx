import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
          <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-10 shadow-xl">
            <p className="text-5xl">⚠️</p>
            <h1 className="mt-5 text-2xl font-black text-slate-950">Something went wrong</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.state.error?.message && (
              <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-xs font-mono text-red-600 border border-red-100 break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 w-full rounded-full bg-violet-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-violet-500"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
