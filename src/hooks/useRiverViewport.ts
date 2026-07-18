import { useState, useRef, useEffect, useCallback } from 'react';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_FACTOR = 1.1;
const DRAG_THRESHOLD = 4;

interface Pan {
  x: number;
  y: number;
}

// River 页路由切换时组件卸载，useState 的 zoom/pan 会丢。按 cacheKey 缓存到 module
// scope，重挂载时从缓存恢复；cacheKey 变化（如切换 corpus 或诗人）也走同一缓存。
// 仅 session 内有效，浏览器刷新清空 —— 匹配「刚才点击诗文的位置」语义。
interface ViewportState { zoom: number; pan: Pan; }
const viewportCache = new Map<string, ViewportState>();

interface DragState {
  startX: number;
  startY: number;
  panX: number;
  panY: number;
  moved: boolean;
}

interface PinchState {
  startDist: number;
  startZoom: number;
  startPan: Pan;
  // Midpoint of the two fingers, in container-local coords (relative to containerRef).
  midX: number;
  midY: number;
}

interface Pointer {
  x: number;
  y: number;
}

/**
 * River canvas interaction:
 *   - mouse drag / single-finger drag → pan
 *   - wheel / two-finger pinch        → zoom (anchored at gesture center)
 *   - tap (no drag past threshold)    → link onClick fires (dragMovedRef guard)
 *
 * Uses Pointer Events so the same code path handles mouse + touch + pen.
 * Two pointers (two-finger pinch) cancel the single-pointer drag.
 */
export function useRiverViewport(cacheKey?: string) {
  const initial = cacheKey ? viewportCache.get(cacheKey) : undefined;
  const [zoom, setZoom] = useState(initial?.zoom ?? 1);
  const [pan, setPan] = useState<Pan>(initial?.pan ?? { x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragMovedRef = useRef(false);
  const pointersRef = useRef<Map<number, Pointer>>(new Map());
  const pinchRef = useRef<PinchState | null>(null);
  // Refs mirror zoom/pan so the wheel handler (registered once) can read
  // current values without re-binding on every state change.
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);

  // cacheKey 变化（如切换 corpus / 诗人）→ 从缓存恢复或复位。
  // 必要：useCorpus / useParams 改变只 re-render，不重挂载，useState 不会重新初始化。
  useEffect(() => {
    if (!cacheKey) return;
    const cached = viewportCache.get(cacheKey);
    if (cached) {
      setZoom(cached.zoom);
      setPan(cached.pan);
    } else {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [cacheKey]);

  // zoom/pan 变化 → 同步回缓存（重挂载时恢复）。
  useEffect(() => {
    if (cacheKey) viewportCache.set(cacheKey, { zoom, pan });
  }, [zoom, pan, cacheKey]);

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
      setPan({
        x: cx - (cx - oldPan.x) * realFactor,
        y: cy - (cy - oldPan.y) * realFactor,
      });
      setZoom(newZoom);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* not capturable */ }

    if (pointersRef.current.size === 1) {
      // Single pointer — start a drag. Use the ref-captured pan so we don't
      // restart at (0,0) if the user pressed, panned, lifted a finger, and
      // pressed again mid-pan.
      dragRef.current = {
        startX: e.clientX, startY: e.clientY,
        panX: panRef.current.x, panY: panRef.current.y,
        moved: false,
      };
      dragMovedRef.current = false;
    } else if (pointersRef.current.size === 2) {
      // Two pointers — start a pinch anchored at the midpoint.
      const pts = Array.from(pointersRef.current.values());
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const el = containerRef.current;
      if (!el || dist === 0) return;
      const rect = el.getBoundingClientRect();
      pinchRef.current = {
        startDist: dist,
        startZoom: zoomRef.current,
        startPan: { ...panRef.current },
        midX: (a.x + b.x) / 2 - rect.left,
        midY: (a.y + b.y) / 2 - rect.top,
      };
      // Cancel any in-progress single-pointer drag so a tap+second-finger
      // doesn't jump.
      dragRef.current = null;
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const stored = pointersRef.current.get(e.pointerId);
    if (!stored) return;
    stored.x = e.clientX;
    stored.y = e.clientY;

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const factor = dist / pinchRef.current.startDist;
      const oldZoom = pinchRef.current.startZoom;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * factor));
      if (newZoom === oldZoom) return;
      const realFactor = newZoom / oldZoom;
      const { midX: cx, midY: cy, startPan: oldPan } = pinchRef.current;
      setPan({
        x: cx - (cx - oldPan.x) * realFactor,
        y: cy - (cy - oldPan.y) * realFactor,
      });
      setZoom(newZoom);
      setDragging(true);
      return;
    }

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

  const endPointer = useCallback((e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) {
      dragRef.current = null;
      setDragging(false);
    }
    try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch { /* not capturable */ }
  }, []);

  const onPointerUp = endPointer;
  const onPointerCancel = endPointer;
  // If the pointer leaves the element without an up event (e.g. touch lifted
  // off-screen on some browsers), end the drag.
  const onPointerLeave = useCallback((e: React.PointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) endPointer(e);
  }, [endPointer]);

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
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onPointerLeave,
      style: {
        cursor: dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
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
