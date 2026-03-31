import { useEffect, useState } from "react";
import { checkLTAvailable } from "../services/languagetool";

export function useLanguageTool() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      setIsChecking(true);
      try {
        const available = await checkLTAvailable();
        if (!cancelled) {
          setIsAvailable(available);
        }
      } catch {
        if (!cancelled) {
          setIsAvailable(false);
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    }
    check();

    return () => {
      cancelled = true;
    };
  }, []);

  return { isAvailable, isChecking };
}
