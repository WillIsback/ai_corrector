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
        className="relative underline decoration-wavy decoration-amber-400/80 dark:decoration-amber-500/60
          cursor-pointer px-0.5 -mx-0.5 rounded
          hover:bg-amber-50 dark:hover:bg-amber-500/10
          text-amber-800 dark:text-amber-200
          transition-colors duration-150"
      >
        {word}
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-gray-800
            border border-gray-200/80 dark:border-gray-700/80 rounded-2xl shadow-elevated
            p-2 min-w-[200px] animate-scale-in"
        >
          <p className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1.5 mb-1">
            Non reconnu par LanguageTool
          </p>
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => {
                onKeep();
                setIsOpen(false);
              }}
              className="text-sm px-3 py-2 rounded-xl
                text-green-700 dark:text-green-300
                hover:bg-green-50 dark:hover:bg-green-500/10
                text-left transition-colors duration-150 font-medium"
            >
              Garder &ldquo;{word}&rdquo;
            </button>
            <button
              type="button"
              onClick={() => {
                onReject();
                setIsOpen(false);
              }}
              className="text-sm px-3 py-2 rounded-xl
                text-orange-700 dark:text-orange-300
                hover:bg-orange-50 dark:hover:bg-orange-500/10
                text-left transition-colors duration-150 font-medium"
            >
              Accepter correction
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
