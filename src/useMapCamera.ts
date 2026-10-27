import { useEffect, useMemo, useRef, useState } from "react";

import {
  easeOutCubic,
  fitViewBox,
  formatViewBox,
  interpolateViewBox,
  parseViewBox,
  viewBoxesMatch,
  type ViewBox,
} from "./map-camera.mjs";

const ZOOM_DURATION_MS = 880;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useMapCamera(
  nationalViewBox: string,
  selectedAbbreviation: string | null,
  stateBoxes: Record<string, ViewBox> | null,
) {
  const national = useMemo(
    () => parseViewBox(nationalViewBox),
    [nationalViewBox],
  );
  const target = useMemo(() => {
    if (!selectedAbbreviation || !stateBoxes?.[selectedAbbreviation]) {
      return national;
    }
    return fitViewBox(stateBoxes[selectedAbbreviation], national);
  }, [national, selectedAbbreviation, stateBoxes]);
  const [current, setCurrent] = useState(national);
  const [progress, setProgress] = useState(1);
  const currentRef = useRef(current);
  const hasMeasuredRef = useRef(false);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    if (!stateBoxes && selectedAbbreviation) {
      return;
    }

    if (!hasMeasuredRef.current) {
      hasMeasuredRef.current = true;
      currentRef.current = target;
      setCurrent(target);
      setProgress(1);
      return;
    }

    if (viewBoxesMatch(currentRef.current, target)) {
      setProgress(1);
      return;
    }

    if (prefersReducedMotion()) {
      currentRef.current = target;
      setCurrent(target);
      setProgress(1);
      return;
    }

    const from = currentRef.current;
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const nextProgress = Math.min(1, (now - startedAt) / ZOOM_DURATION_MS);
      const eased = easeOutCubic(nextProgress);
      const next = interpolateViewBox(from, target, eased);
      currentRef.current = next;
      setCurrent(next);
      setProgress(nextProgress);

      if (nextProgress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    setProgress(0);
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [selectedAbbreviation, stateBoxes, target]);

  return {
    viewBox: formatViewBox(current),
    isAnimating: progress < 1,
    progress,
  };
}
