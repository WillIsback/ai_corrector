import { useEffect, useRef, useState } from "react";

interface Props {
  word: string;
  onKeep: () => void;
  onReject: () => void;
}

export function SuspectWord({ word, onKeep, onReject }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="underline decoration-wavy decoration-orange-400 cursor-pointer
                   hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded px-0.5
                   transition-colors"
      >
        {word}
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800
                        border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg
                        p-3 min-w-48"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            &ldquo;{word}&rdquo; non reconnu par LanguageTool
          </p>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => {
                onKeep();
                setIsOpen(false);
              }}
              className="text-sm px-3 py-1.5 bg-green-50 dark:bg-green-900/30
                         text-green-700 dark:text-green-300 rounded hover:bg-green-100
                         dark:hover:bg-green-900/50 text-left transition-colors"
            >
              Garder &ldquo;{word}&rdquo;
            </button>
            <button
              type="button"
              onClick={() => {
                onReject();
                setIsOpen(false);
              }}
              className="text-sm px-3 py-1.5 bg-orange-50 dark:bg-orange-900/30
                         text-orange-700 dark:text-orange-300 rounded hover:bg-orange-100
                         dark:hover:bg-orange-900/50 text-left transition-colors"
            >
              Accepter correction
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
