import { useEffect, useState } from 'react';

export function useStickyStateSet(
  defaultValue: Set<string>,
  key: string,
): [Set<string>, (value: Set<string>) => void] {
  const [value, setValue] = useState(() => {
    const stickyValue = window.localStorage.getItem(key);
    if (stickyValue === null) return defaultValue;
    try {
      return new Set<string>(JSON.parse(stickyValue));
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (value) {
      window.localStorage.setItem(key, JSON.stringify(Array.from(value)));
    }
  }, [key, value]);

  return [value, setValue];
}
