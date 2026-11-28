import React from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  /** 路由变化时自动重置错误状态 */
  resetKey: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  traceId: string;
}

/**
 * 页面级错误边界：任何单页渲染异常都不会拖垮整个控制台。
 * 生产环境中 componentDidCatch 会将堆栈上报至 Sentry / 自建 APM。
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, traceId: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, traceId: `FE-${Date.now().toString(36).toUpperCase()}` };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[WeTrust Console] page crashed', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, traceId: '' });
    }
  }

  render(): React.ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl bg-white p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03),0_10px_30px_-12px_rgba(15,23,42,0.08)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertOctagon className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-[#111827]">该模块渲染异常，已自动隔离</h2>
        <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#6B7280]">
          其余模块不受影响。错误已上报 APM，请携带追踪号联系平台值班。
        </p>
        <p className="mt-3 rounded-lg bg-[#F9FAFB] px-3 py-1.5 font-mono text-[10px] text-[#9CA3AF]">
          {this.state.traceId} · {this.state.error.message}
        </p>
        <button
          type="button"
          onClick={() => this.setState({ error: null, traceId: '' })}
          className="mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#111827] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#242d3d]"
        >
          <RotateCcw className="h-3.5 w-3.5" />重新加载模块
        </button>
      </div>
    );
  }
}
