import { useState, useEffect } from 'react';
import { checkLTAvailable } from '../services/languagetool';

export function useLanguageTool() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function check() {
      setIsChecking(true);
      const available = await checkLTAvailable();
      setIsAvailable(available);
      setIsChecking(false);
    }
    check();
  }, []);

  return { isAvailable, isChecking };
}
