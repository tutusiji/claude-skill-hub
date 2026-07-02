'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="text-center py-20 text-[var(--muted)]">
            <p className="text-sm mb-2">页面加载出错了</p>
            <p className="text-xs">{this.state.error?.message}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="mt-4 px-4 py-2 text-xs bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              重试
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
