import React, { useCallback, useEffect, useRef, useState } from 'react';

interface SplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  initialRatio?: number;
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  left,
  right,
  initialRatio = 0.5,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [ratio, setRatio] = useState(initialRatio);
  const [dragging, setDragging] = useState(false);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = (e.clientX - rect.left) / Math.max(1, rect.width);
    setRatio(Math.max(0.24, Math.min(0.76, next)));
  }, []);

  const onPointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragging, onPointerMove, onPointerUp]);

  return (
    <div ref={containerRef} className="split-container">
      <div className="split-pane" style={{ width: `${ratio * 100}%` }}>
        {left}
      </div>

      <div
        className={`split-divider ${dragging ? 'dragging' : ''}`}
        onPointerDown={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDoubleClick={() => setRatio(0.5)}
        title="Drag to resize split view · Double-click to reset 50/50"
      >
        <div className="split-divider-grip" />
      </div>

      <div className="split-pane" style={{ flex: 1 }}>
        {right}
      </div>
    </div>
  );
};
