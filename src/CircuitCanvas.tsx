import { useRef, useState } from 'react';
import {
  Expand,
  Minus,
  Plus,
  RotateCcw,
  Undo2,
  Redo2,
  MousePointer2,
  Hand,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  COMPONENTS,
  WIRES,
  componentInfo,
  wireInfo,
  constrain,
  contactClosed,
  faultDetails,
  initialCircuit,
} from './domain';
import type { ComponentId, ContactId, Lab, Point, WireId, CircuitState } from './domain';

type Props = {
  lab: Lab;
  selected: WireId | null;
  onSelect: (wire: WireId) => void;
  selectedContact?: ContactId | null;
  onSelectContact?: (contact: ContactId) => void;
  onMove?: (id: ComponentId, point: Point) => void;
  preview?: boolean;
  state?: CircuitState;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onFeedback: (message: string) => void;
};
export default function CircuitCanvas({
  lab,
  selected,
  onSelect,
  selectedContact,
  onSelectContact,
  onMove,
  preview = false,
  state,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onFeedback,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const movementRef = useRef<HTMLDetailsElement>(null);
  const moveSelectRef = useRef<HTMLSelectElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [hand, setHand] = useState(false);
  const [moveTarget, setMoveTarget] = useState<'view' | ComponentId>('view');
  const [drag, setDrag] = useState<{ id: ComponentId; point: Point } | null>(null);
  const moving = useRef<{ id: ComponentId; offset: Point; point: Point } | null>(null);
  const panning = useRef<{ point: Point; pan: Point } | null>(null);
  const positions = { ...lab.positions, ...(drag ? { [drag.id]: drag.point } : {}) };
  const { stop, start, aux, coil } = positions;
  const left = (p: Point) => p.x - 55;
  const right = (p: Point) => p.x + 55;
  const paths: Record<WireId, string> = {
    supply: `M 80 260 H 115 V ${stop.y} H ${left(stop)}`,
    start: `M 335 260 V ${start.y} H ${left(start)}`,
    hold: `M 335 260 V ${aux.y} H ${left(aux)}`,
    coil: `M 600 260 V ${coil.y} H ${left(coil)}`,
    return: `M ${right(coil)} ${coil.y} H 840 V 260`,
  };
  const labels: Record<WireId, Point> = {
    supply: { x: 119, y: stop.y - 20 },
    start: { x: 336, y: start.y - 20 },
    hold: { x: 256, y: aux.y + 29 },
    coil: { x: 604, y: coil.y - 20 },
    return: { x: 809, y: coil.y - 20 },
  };
  const toSvg = (clientX: number, clientY: number): Point => {
    const svg = svgRef.current!;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };
  const toBoard = (clientX: number, clientY: number): Point => {
    const p = toSvg(clientX, clientY);
    return { x: (p.x - 460 - pan.x) / zoom + 460, y: (p.y - 260 - pan.y) / zoom + 260 };
  };
  const finishDrag = (commit: boolean) => {
    if (moving.current && commit) onMove?.(moving.current.id, moving.current.point);
    if (panning.current && !commit) setPan(panning.current.pan);
    moving.current = null;
    panning.current = null;
    setDrag(null);
  };
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const resetWithFeedback = () => {
    const viewport = svgRef.current?.parentElement;
    const unchanged = zoom === 1 && pan.x === 0 && pan.y === 0 && !viewport?.scrollLeft;
    resetView();
    if (viewport) viewport.scrollLeft = 0;
    onFeedback(
      unchanged ? 'Already at the default view (100%).' : 'Default view restored at 100%.',
    );
  };
  const movement = (x: number, y: number) => {
    const current = moveTarget === 'view' ? pan : lab.positions[moveTarget];
    const next =
      moveTarget === 'view'
        ? {
            x: Math.max(-300, Math.min(300, current.x + x * 30)),
            y: Math.max(-180, Math.min(180, current.y + y * 30)),
          }
        : constrain(moveTarget, { x: current.x + x * 10, y: current.y + y * 10 });
    return { next, atLimit: current.x === next.x && current.y === next.y };
  };
  return (
    <section
      className={`circuit-panel ${preview ? 'preview-circuit' : ''}`}
      aria-label="Circuit workbench"
    >
      <div className="canvas-header">
        <h2>Start / stop with seal-in</h2>
        <div className="canvas-toolbar">
          <div className="tool-group">
            <button
              type="button"
              className={`icon-button ${!hand ? 'active' : ''}`}
              aria-label="Select tool"
              aria-pressed={!hand}
              title="Select conductors or move components"
              onClick={() => setHand(false)}
            >
              <MousePointer2 size={17} />
            </button>
            <button
              type="button"
              className={`icon-button ${hand ? 'active' : ''}`}
              aria-label="Pan tool"
              aria-pressed={hand}
              title="Drag the background to pan"
              onClick={() => setHand(true)}
            >
              <Hand size={17} />
            </button>
            {!preview && (
              <>
                <span className="tool-divider" />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Undo"
                  title="Undo · Ctrl/⌘ Z"
                  disabled={!canUndo}
                  onClick={onUndo}
                >
                  <Undo2 size={17} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Redo"
                  title="Redo · Ctrl/⌘ Shift Z"
                  disabled={!canRedo}
                  onClick={onRedo}
                >
                  <Redo2 size={17} />
                </button>
              </>
            )}
          </div>
          <div className="tool-group">
            <button
              type="button"
              className="icon-button"
              aria-label="Zoom out"
              disabled={zoom <= 0.8}
              onClick={() => setZoom((v) => Math.max(0.8, +(v - 0.2).toFixed(1)))}
            >
              <Minus size={16} />
            </button>
            <span className="zoom-label" role="status" aria-label="Canvas zoom" aria-atomic="true">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="icon-button"
              aria-label="Zoom in"
              disabled={zoom >= 1.8}
              onClick={() => setZoom((v) => Math.min(1.8, +(v + 0.2).toFixed(1)))}
            >
              <Plus size={16} />
            </button>
            <span className="tool-divider" />
            <button
              type="button"
              className="icon-button"
              aria-label="Reset zoom and pan"
              title="Reset zoom and pan"
              onClick={resetWithFeedback}
            >
              <Expand size={16} />
            </button>
          </div>
        </div>
      </div>
      <p className="canvas-scroll-hint">Scroll sideways to explore the circuit →</p>
      <div className={`canvas-surface ${hand ? 'hand-tool' : ''}`}>
        <div
          className="diagram-viewport"
          tabIndex={0}
          role="region"
          aria-label="Circuit diagram. On small screens, scroll horizontally to see the full circuit."
          onKeyDown={(e) => {
            if (e.key === 'Escape') finishDrag(false);
          }}
        >
          <svg
            ref={svgRef}
            viewBox="0 0 920 520"
            className="circuit-svg"
            role="group"
            aria-label="Start-stop control circuit. Five conductors, three contacts, and a coil."
            onFocusCapture={(e) => {
              if (moving.current || panning.current) return;
              const target = e.target as SVGElement;
              if (!target.matches('[data-component], [data-wire]')) return;
              const item = target.getBoundingClientRect();
              const viewport = e.currentTarget.getBoundingClientRect();
              if (
                item.left < viewport.left ||
                item.right > viewport.right ||
                item.top < viewport.top ||
                item.bottom > viewport.bottom
              )
                resetView();
              requestAnimationFrame(() => {
                if (document.activeElement !== target) return;
                target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                // Firefox does not horizontally reveal SVG path groups with scrollIntoView.
                const scroller = target.closest('.diagram-viewport')!;
                const bounds = target.getBoundingClientRect();
                const visible = scroller.getBoundingClientRect();
                if (bounds.left < visible.left || bounds.right > visible.right)
                  scroller.scrollLeft +=
                    (bounds.left + bounds.right - visible.left - visible.right) / 2;
                if (bounds.top < 8 || bounds.bottom > window.innerHeight - 8)
                  window.scrollBy(0, (bounds.top + bounds.bottom - window.innerHeight) / 2);
              });
            }}
            onPointerDown={(e) => {
              if (!hand || (e.target as Element).closest('[data-component], [data-wire]')) return;
              panning.current = { point: toSvg(e.clientX, e.clientY), pan };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (moving.current) {
                const p = toBoard(e.clientX, e.clientY);
                const next = constrain(moving.current.id, {
                  x: p.x - moving.current.offset.x,
                  y: p.y - moving.current.offset.y,
                });
                moving.current.point = next;
                setDrag({ id: moving.current.id, point: next });
              } else if (panning.current) {
                const p = toSvg(e.clientX, e.clientY);
                setPan({
                  x: Math.max(
                    -300,
                    Math.min(300, panning.current.pan.x + p.x - panning.current.point.x),
                  ),
                  y: Math.max(
                    -180,
                    Math.min(180, panning.current.pan.y + p.y - panning.current.point.y),
                  ),
                });
              }
            }}
            onPointerUp={() => finishDrag(true)}
            onPointerCancel={() => finishDrag(false)}
            onLostPointerCapture={() => finishDrag(false)}
          >
            <g
              transform={`translate(${460 + pan.x} ${260 + pan.y}) scale(${zoom}) translate(-460 -260)`}
            >
              <path d="M80 120V420 M840 120V420" className="rail" />
              <text x="80" y="98" textAnchor="middle" className="rail-label">
                +24 V
              </text>
              <text x="840" y="98" textAnchor="middle" className="rail-label">
                0 V
              </text>
              <text x="80" y="450" textAnchor="middle" className="terminal-label">
                L+
              </text>
              <text x="840" y="450" textAnchor="middle" className="terminal-label">
                L−
              </text>
              <path
                d={`M ${right(stop)} ${stop.y} H 300 V 260 H 335 M ${right(start)} ${start.y} H 600 V 260 M ${right(aux)} ${aux.y} H 600 V 260`}
                className="wire-path"
              />
              {WIRES.map((id) => {
                const fault = !preview && lab.fault === id;
                return (
                  <g
                    key={id}
                    data-wire={id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${wireInfo[id].tag} ${wireInfo[id].name}${fault ? ', open fault' : ''}`}
                    aria-pressed={selected === id}
                    className={`wire ${selected === id ? 'selected' : ''} ${fault ? 'faulted' : ''}`}
                    onClick={() => onSelect(id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(id);
                      }
                    }}
                  >
                    <path d={paths[id]} className="wire-hit" />
                    <path d={paths[id]} className="wire-halo" />
                    <path d={paths[id]} className="wire-path" />
                    <g transform={`translate(${labels[id].x} ${labels[id].y})`}>
                      <rect
                        x="-5"
                        y="-14"
                        width={fault ? 76 : 31}
                        height="23"
                        rx="5"
                        className="wire-tag-bg"
                      />
                      <text className="wire-tag" y="2">
                        {wireInfo[id].tag}
                        {fault ? ' / OPEN' : ''}
                      </text>
                    </g>
                  </g>
                );
              })}
              {[
                { x: 335, y: 260 },
                { x: 600, y: 260 },
                { x: 80, y: 260 },
                { x: 840, y: 260 },
              ].map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="4" className="junction" />
              ))}
              {COMPONENTS.map((id) => {
                const p = positions[id];
                const closed =
                  id === 'coil'
                    ? !!state?.coilOn
                    : contactClosed(id, state ?? initialCircuit(), lab.fault);
                const componentFault =
                  !preview && lab.fault && faultDetails(lab.fault).target === `contact-${id}`
                    ? faultDetails(lab.fault)
                    : null;
                const selectable = preview && id !== 'coil';
                return (
                  <g
                    key={id}
                    data-component={id}
                    transform={`translate(${p.x} ${p.y})`}
                    className={`component ${!preview ? 'movable' : ''} ${selectable ? 'inspectable' : ''} ${selectedContact === id ? 'selected' : ''} ${componentFault ? 'faulted' : ''} ${id === 'coil' && state?.coilOn ? 'energized' : ''}`}
                    tabIndex={!preview || selectable ? 0 : undefined}
                    role={!preview || selectable ? 'button' : undefined}
                    aria-pressed={selectable ? selectedContact === id : undefined}
                    aria-label={`${componentInfo[id].label}${selectable ? ' contact' : ''}${componentFault ? `, ${componentFault.condition.replaceAll('-', ' ')}` : ''}${!preview ? '. Arrow keys move; Enter opens movement controls. Drag to reposition.' : ''}`}
                    onClick={() => {
                      if (selectable) onSelectContact?.(id);
                    }}
                    onPointerDown={(e) => {
                      if (preview || hand || e.button !== 0) return;
                      e.preventDefault();
                      e.stopPropagation();
                      const point = toBoard(e.clientX, e.clientY);
                      moving.current = {
                        id,
                        point: p,
                        offset: { x: point.x - p.x, y: point.y - p.y },
                      };
                      setDrag({ id, point: p });
                      svgRef.current?.setPointerCapture(e.pointerId);
                      e.currentTarget.focus();
                    }}
                    onKeyDown={(e) => {
                      if (selectable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onSelectContact?.(id);
                        return;
                      }
                      if (!preview && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        setMoveTarget(id);
                        if (movementRef.current) movementRef.current.open = true;
                        requestAnimationFrame(() => moveSelectRef.current?.focus());
                        return;
                      }
                      if (
                        preview ||
                        !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)
                      )
                        return;
                      e.preventDefault();
                      onMove?.(
                        id,
                        constrain(id, {
                          x: p.x + (e.key === 'ArrowLeft' ? -10 : e.key === 'ArrowRight' ? 10 : 0),
                          y: p.y + (e.key === 'ArrowUp' ? -10 : e.key === 'ArrowDown' ? 10 : 0),
                        }),
                      );
                    }}
                  >
                    <rect
                      x="-55"
                      y="-48"
                      width="110"
                      height="96"
                      rx="10"
                      className="component-box"
                    />
                    <text y="-28" textAnchor="middle" className="component-name">
                      {componentInfo[id].label}
                    </text>
                    {id === 'coil' ? (
                      <>
                        <path d="M-55 0H-22 M22 0H55" className="symbol" />
                        <circle r="20" className="coil-circle" />
                        <text y="5" textAnchor="middle" className="coil-letter">
                          K1
                        </text>
                      </>
                    ) : (
                      <>
                        <path d="M-55 0H-17 M17 0H55" className="symbol" />
                        <path
                          d={closed ? 'M-17 -13V13 M17 -13V13 M-17 0H17' : 'M-17 -13V13 M17 -13V13'}
                          className="symbol"
                        />
                        {id === 'stop' && <path d="M-23 14L23 -14" className="symbol" />}
                      </>
                    )}
                    <circle cx="-55" r="4" className="terminal" />
                    <circle cx="55" r="4" className="terminal" />
                    <text y="35" textAnchor="middle" className="component-detail">
                      {componentFault
                        ? componentFault.condition.replaceAll('-', ' ')
                        : id === 'coil' && state?.coilOn
                          ? 'Energized'
                          : componentInfo[id].detail}
                    </text>
                  </g>
                );
              })}
              <path
                d={`M${aux.x + 5} ${aux.y + 60}H${coil.x}V${coil.y + 64}`}
                className="mechanical-link"
              />
              <text x="590" y={aux.y + 81} textAnchor="middle" className="link-label">
                K1 coil operates K1 auxiliary contact
              </text>
            </g>
          </svg>
        </div>
        <div className="canvas-bottom-note">
          <button type="button" className="text-button small" onClick={resetWithFeedback}>
            <RotateCcw size={13} /> Reset view
          </button>
        </div>
      </div>
      <details ref={movementRef} className="canvas-movement disclosure">
        <summary>
          <span>{preview ? 'Pan controls' : 'Move and pan controls'}</span>
        </summary>
        <div className="disclosure-body">
          <p>
            {preview
              ? 'Move the view using the arrow buttons.'
              : 'Choose the view or a component, then use the arrow buttons to move it. Component movement changes the layout only.'}
          </p>
          <div className="movement-controls">
            {!preview && (
              <label className="field">
                <span>Move</span>
                <select
                  ref={moveSelectRef}
                  value={moveTarget}
                  onChange={(e) => setMoveTarget(e.target.value as 'view' | ComponentId)}
                >
                  <option value="view">Circuit view</option>
                  {COMPONENTS.map((id) => (
                    <option key={id} value={id}>
                      {componentInfo[id].label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div
              className="movement-arrows"
              role="group"
              aria-label={
                moveTarget === 'view'
                  ? 'Pan circuit view'
                  : `Move ${componentInfo[moveTarget].label}`
              }
            >
              {[
                { direction: 'left', x: -1, y: 0, Icon: ArrowLeft },
                { direction: 'up', x: 0, y: -1, Icon: ArrowUp },
                { direction: 'down', x: 0, y: 1, Icon: ArrowDown },
                { direction: 'right', x: 1, y: 0, Icon: ArrowRight },
              ].map(({ direction, x, y, Icon }) => (
                <button
                  type="button"
                  key={direction}
                  className="icon-button"
                  aria-label={`${moveTarget === 'view' ? 'Pan' : `Move ${componentInfo[moveTarget].label}`} ${direction}`}
                  disabled={movement(x, y).atLimit}
                  onClick={() => {
                    if (moveTarget === 'view') setPan(movement(x, y).next);
                    else onMove?.(moveTarget, movement(x, y).next);
                    onFeedback(
                      moveTarget === 'view'
                        ? `Circuit view panned ${direction}.`
                        : `${componentInfo[moveTarget].label} moved ${direction}.`,
                    );
                  }}
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </details>
      <div className="canvas-legend">
        <span>
          <i className="legend-line" /> Conductor
        </span>
        {!preview && (
          <span>
            <i className="legend-line fault" /> Open fault
          </span>
        )}
        <span>
          <i className="legend-dot" /> Connected junction
        </span>
      </div>
    </section>
  );
}
