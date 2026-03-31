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

  const getColorClass = () => {
    switch (toast.type) {
      case "success":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      case "warning":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed top-6 right-6 px-6 py-4 rounded-lg shadow-lg text-white flex items-center gap-3 z-50 animate-fade-in-out ${getColorClass()}`}
    >
      <span>{toast.message}</span>
      <button
        type="button"
        onClick={handleClose}
        aria-label="Fermer"
        className="opacity-75 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  );
}
