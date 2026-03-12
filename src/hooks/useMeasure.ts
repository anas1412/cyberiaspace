import { useState, useEffect, useRef } from 'react';

export interface Dimensions {
  width: number;
  height: number;
}

export function useMeasure<T extends HTMLElement>() {
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 });
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      }
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return [ref, dimensions] as const;
}
