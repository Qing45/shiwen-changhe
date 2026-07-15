import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RiverNode } from './RiverNode';
import { fontSizes } from '../theme';

function renderNode(props: React.ComponentProps<typeof RiverNode>) {
  return render(
    <MemoryRouter>
      <RiverNode {...props} />
    </MemoryRouter>,
  );
}

const baseProps = {
  id: 'p1',
  to: '/poet/p1',
  label: '李白',
  size: 24,
  textFontSize: fontSizes.nodeDefault,
  isFocal: false,
  isVisited: false,
  tooltip: <div>tooltip</div>,
  x: 50,
  y: 0,
  floatDuration: 4,
  floatDelay: 0,
  dragMovedRef: { current: false },
  onVisited: () => {},
};

describe('RiverNode', () => {
  it('renders poet label for poet variant', () => {
    renderNode({ ...baseProps, variant: 'poet' });
    expect(screen.getByText('李白')).toBeInTheDocument();
  });

  it('renders poem label for poem variant', () => {
    renderNode({ ...baseProps, variant: 'poem', label: '静夜思' });
    expect(screen.getByText('静夜思')).toBeInTheDocument();
  });

  it('shows tooltip on hover (poet variant with dynasty)', () => {
    renderNode({
      ...baseProps,
      variant: 'poet',
      tooltip: <div>701—762 · 唐</div>,
    });
    expect(screen.queryByText('701—762 · 唐')).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByText('李白'));
    expect(screen.getByText('701—762 · 唐')).toBeInTheDocument();
  });

  it('hides tooltip on mouse leave', () => {
    renderNode({
      ...baseProps,
      variant: 'poet',
      tooltip: <div>701—762 · 唐</div>,
    });
    const label = screen.getByText('李白');
    fireEvent.mouseEnter(label);
    fireEvent.mouseLeave(label);
    expect(screen.queryByText('701—762 · 唐')).not.toBeInTheDocument();
  });

  it('focal node uses focal-pulse animation on the circle', () => {
    const { container } = renderNode({
      ...baseProps,
      variant: 'poet',
      isFocal: true,
      textFontSize: fontSizes.nodeFocal,
    });
    const pulseEl = container.querySelector('[style*="focal-pulse"]');
    expect(pulseEl).not.toBeNull();
  });

  it('non-focal node has no focal-pulse animation', () => {
    const { container } = renderNode({
      ...baseProps,
      variant: 'poet',
      isFocal: false,
    });
    const pulseEl = container.querySelector('[style*="focal-pulse"]');
    expect(pulseEl).toBeNull();
  });

  it('enablePress=true (default) scales on mousedown', () => {
    const { container } = renderNode({
      ...baseProps,
      variant: 'poet',
    });
    const inner = container.querySelector('[style*="node-float"]') as HTMLElement;
    fireEvent.mouseDown(inner);
    expect(inner.style.transform).toContain('scale(0.92)');
  });

  it('enablePress=false does not bind mousedown scaling', () => {
    const { container } = renderNode({
      ...baseProps,
      variant: 'poem',
      enablePress: false,
    });
    const inner = container.querySelector('[style*="node-float"]') as HTMLElement;
    fireEvent.mouseDown(inner);
    expect(inner.style.transform).not.toContain('scale');
  });

  it('visible=false renders placeholder without label or Link', () => {
    const { container } = renderNode({
      ...baseProps,
      variant: 'poet',
      visible: false,
    });
    expect(screen.queryByText('李白')).not.toBeInTheDocument();
    // No anchor tag (Link) rendered
    expect(container.querySelector('a')).toBeNull();
  });

  it('calls onVisited on click when drag did not move', () => {
    const onVisited = vi.fn();
    renderNode({
      ...baseProps,
      variant: 'poet',
      onVisited,
    });
    fireEvent.click(screen.getByText('李白'));
    expect(onVisited).toHaveBeenCalledTimes(1);
  });

  it('skips onVisited when drag moved (click captured)', () => {
    const onVisited = vi.fn();
    renderNode({
      ...baseProps,
      variant: 'poet',
      onVisited,
      dragMovedRef: { current: true },
    });
    fireEvent.click(screen.getByText('李白'));
    expect(onVisited).not.toHaveBeenCalled();
  });

  it('visited node uses dimmer highlight core color', () => {
    const { container, rerender } = render(
      <MemoryRouter>
        <RiverNode {...baseProps} variant="poet" isVisited={false} />
      </MemoryRouter>,
    );
    const unvisitedCircle = container.querySelector('[style*="radial-gradient"]') as HTMLElement;
    expect(unvisitedCircle.style.background).toContain('#fff');

    rerender(
      <MemoryRouter>
        <RiverNode {...baseProps} variant="poet" isVisited />
      </MemoryRouter>,
    );
    const visitedCircle = container.querySelector('[style*="radial-gradient"]') as HTMLElement;
    expect(visitedCircle.style.background).toContain('#d8e0f0');
  });
});
