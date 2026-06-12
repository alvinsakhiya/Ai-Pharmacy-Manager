import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";

export function LoadingState({ label = "Loading records..." }) {
  return (
    <div
      className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 py-12 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
        <LoaderCircle className="animate-spin" size={24} />
      </div>
      <p className="text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div
      className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center"
      role="alert"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700">
        <AlertCircle size={24} />
      </div>
      <h2 className="mt-4 text-lg font-bold text-slate-900">Unable to load records</h2>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Try again
      </button>
    </div>
  );
}

export function EmptyState({ title, message }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Inbox size={24} />
      </div>
      <h2 className="mt-4 text-lg font-bold text-slate-900">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p>
    </div>
  );
}
