import { AlertCircle, Inbox, LoaderCircle, RotateCw } from "lucide-react";
import Button from "./Button";

export function LoadingState({
  label = "Loading records...",
  message = "Securely retrieving the latest pharmacy data.",
}) {
  return (
    <div
      className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"
      role="status"
      aria-live="polite"
    >
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-teal-200 bg-teal-50 text-teal-700">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-teal-100 opacity-50" />
        <LoaderCircle className="relative animate-spin" size={25} />
      </div>
      <p className="mt-4 text-sm font-bold text-slate-800">{label}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{message}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div
      className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"
      role="alert"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-700">
        <AlertCircle size={25} />
      </div>
      <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-950">
        Unable to load records
      </h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{message}</p>
      {onRetry && (
        <Button className="mt-5" icon={RotateCw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ action, icon: Icon = Inbox, title, message }) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500">
        <Icon size={25} />
      </div>
      <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
