import { useCallback, useEffect } from "react";

export type ToastType = "success" | "error" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface Props {
  toast: Toast | null;
  onClose: () => void;
}

export function Toast({ toast, onClose }: Props) {
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(handleClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast, handleClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && toast) {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toast, handleClose]);

  if (!toast) return null;

  const getStyles = () => {
    switch (toast.type) {
      case "success":
        return "bg-gray-900/90 dark:bg-white/90 text-white dark:text-gray-900";
      case "error":
        return "bg-red-600/90 text-white";
      case "warning":
        return "bg-amber-500/90 text-white";
      default:
        return "bg-gray-900/90 text-white";
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return (
          <svg
            aria-hidden="true"
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 13l4 4L19 7" />
          </svg>
        );
      case "error":
        return (
          <svg
            aria-hidden="true"
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case "warning":
        return (
          <svg
            aria-hidden="true"
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed top-5 right-5 px-4 py-3 rounded-2xl shadow-elevated backdrop-blur-lg
        flex items-center gap-2.5 z-50 animate-fade-in-out text-sm font-medium ${getStyles()}`}
    >
      {getIcon()}
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Fermer"
        className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
      >
        <svg
          aria-hidden="true"
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
