import { Component, type ErrorInfo, type ReactNode } from "react";

import * as authApi from "../auth/authApi";
import { redirectToLogin, reloadPage } from "../lib/navigation";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last-resort boundary around the whole app. A render error anywhere below it
 * shows a calm recovery screen instead of a blank page. The fallback is
 * deliberately self-contained (no context, no shared components, no motion):
 * it must render even when the rest of the app cannot, and it never exposes
 * error internals or stack traces to the user.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    // Console only — nothing from here is rendered to the user.
    console.error("Unhandled application error.", error, info.componentStack);
  }

  handleReload = (): void => {
    reloadPage();
  };

  handleSignOut = (): void => {
    void authApi
      .logout()
      .catch(() => undefined)
      .finally(() => {
        redirectToLogin();
      });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main
        role="alert"
        className="flex min-h-screen items-center justify-center bg-canvas px-6"
      >
        <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-line bg-surface px-6 py-12 text-center shadow-soft">
          <h1 className="text-base font-bold text-ink">
            Something went wrong.
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            An unexpected error stopped this page from rendering. Your data is
            safe. Reload the page to continue, or sign out and back in if the
            problem keeps happening.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex h-10 items-center justify-center rounded-full border border-lilac bg-lilac px-4 text-sm font-semibold text-lilac-ink outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              Reload page
            </button>
            <button
              type="button"
              onClick={this.handleSignOut}
              className="inline-flex h-10 items-center justify-center rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink-soft outline-none focus-visible:ring-2 focus-visible:ring-brand-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }
}
