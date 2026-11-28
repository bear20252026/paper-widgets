// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as b from 'react';
import * as m from 'react/jsx-runtime';
import { Ee } from '@/compat';
import { Ec, xb } from '@/icons';

// React 类组件错误边界。

class VD extends b.Component {
  constructor(a) {
    super(a), this.state = {
      hasError: !1,
      error: null
    };
  }
  static getDerivedStateFromError(a) {
    return {
      hasError: !0,
      error: a
    };
  }
  render() {
    return this.state.hasError ? m.jsx("div", {
      className: "flex items-center justify-center min-h-screen p-8 bg-background",
      children: m.jsxs("div", {
        className: "flex flex-col items-center w-full max-w-2xl p-8",
        children: [m.jsx(Ec, {
          size: 48,
          className: "text-destructive mb-6 flex-shrink-0"
        }), m.jsx("h2", {
          className: "text-xl mb-4",
          children: "An unexpected error occurred."
        }), m.jsx("div", {
          className: "p-4 w-full rounded bg-muted overflow-auto mb-6",
          children: m.jsx("pre", {
            className: "text-sm text-muted-foreground whitespace-break-spaces",
            children: this.state.error?.stack
          })
        }), m.jsxs("button", {
          onClick: () => window.location.reload(),
          className: Ee("flex items-center gap-2 px-4 py-2 rounded-lg", "bg-primary text-primary-foreground", "hover:opacity-90 cursor-pointer"),
          children: [m.jsx(xb, {
            size: 16
          }), "Reload Page"]
        })]
      })
    }) : this.props.children;
  }
}
export { VD };
