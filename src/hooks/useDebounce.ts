import React from "react";

// Hook untuk melakukan debounce pada sebuah nilai
export function useDebounce<T>(value: T, delay: number): T {
  // Generic type T = any type
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
