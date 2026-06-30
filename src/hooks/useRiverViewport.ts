import { useState, useRef, useEffect, useCallback } from 'react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_FACTOR = 1.1;
const DRAG_THRESHOLD = 4;

interface Pan {
  x: number;
  y: number;
}

interface DragState {
  startX: number;
  startY: number;
  panX: number;
  panY: number;
  moved: boolean;
}

/**
 * Zoom (wheel) + drag-to-pan for the river canvas. Returns props to spread on
 * the container div plus a `dragMoved` ref that consumers can check on link
 * click captures to suppress navigation after a drag.
 */
export function useRiverViewport() {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragMovedRef = useRef(false);
  // Refs mirror zoom/pan so the wheel handler (registered once) can read
  // current values without re-binding on every state change.
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // Non-passive wheel listener so we can preventDefault to stop the page from
  // scrolling. React's synthetic onWheel is passive by default.
  // Zoom is anchored at the cursor: the canvas point under the cursor stays
  // under the cursor as zoom changes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      const oldZoom = zoomRef.current;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * factor));
      if (newZoom === oldZoom) return;
      const realFactor = newZoom / oldZoom;
      const oldPan = panRef.current;
      // Keep the canvas point under the cursor fixed: solve for new pan such
      // that (cx - pan.x) / oldZoom == (cx - pan_new.x) / newZoom, and same for y.
      setPan({
        x: cx - (cx - oldPan.x) * realFactor,
        y: cy - (cy - oldPan.y) * realFactor,
      });
      setZoom(newZoom);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, moved: false };
    dragMovedRef.current = false;
  }, [pan]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    dragMovedRef.current = true;
    setDragging(true);
    setPan({ x: d.panX + dx, y: d.panY + dy });
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
  }, []);

  // Reset on unmount safety — also reset pan/zoom
  const reset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  return {
    zoom,
    pan,
    dragging,
    dragMovedRef,
    containerProps: {
      ref: containerRef,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave: onMouseUp,
      style: {
        cursor: dragging ? 'grabbing' : 'grab',
      },
    },
    canvasStyle: {
      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      transformOrigin: '0 0',
      transition: dragging ? 'none' : 'transform 0.05s linear',
      willChange: 'transform',
    },
    reset,
  };
}
