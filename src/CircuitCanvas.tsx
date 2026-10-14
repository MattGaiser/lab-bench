import { useRef, useState } from 'react';
import { Expand, Minus, Plus, RotateCcw, Undo2, Redo2, MousePointer2, Hand } from 'lucide-react';
import { COMPONENTS, WIRES, componentInfo, wireInfo, constrain } from './domain';
import type { ComponentId, Lab, Point, WireId, CircuitState } from './domain';

type Props = {
  lab: Lab;
  selected: WireId | null;
  onSelect: (wire: WireId) => void;
  onMove?: (id: ComponentId, point: Point) => void;
  preview?: boolean;
  state?: CircuitState;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
};
export default function CircuitCanvas({
  lab,
  selected,
  onSelect,
  onMove,
  preview = false,
  state,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [hand, setHand] = useState(false);
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
    moving.current = null;
    panning.current = null;
    setDrag(null);
  };
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  return (
    <section
      className={`circuit-panel ${preview ? 'preview-circuit' : ''}`}
      aria-label="Circuit workbench"
    >
      <div className="canvas-header">
        <div>
          <span className="overline">CIRCUIT 01</span>
          <h2>Start / stop with seal-in</h2>
        </div>
        <span className="model-badge">
          24 V DC <span>·</span> control model
        </span>
      </div>
      <div className="canvas-toolbar">
        <div className="tool-group">
          <button
            className={`icon-button ${!hand ? 'active' : ''}`}
            aria-label="Select tool"
            aria-pressed={!hand}
            title="Select conductors or move components"
            onClick={() => setHand(false)}
          >
            <MousePointer2 size={17} />
          </button>
          <button
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
                className="icon-button"
                aria-label="Undo"
                title="Undo · Ctrl/⌘ Z"
                disabled={!canUndo}
                onClick={onUndo}
              >
                <Undo2 size={17} />
              </button>
              <button
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
            className="icon-button"
            aria-label="Zoom out"
            disabled={zoom <= 0.8}
            onClick={() => setZoom((v) => Math.max(0.8, +(v - 0.2).toFixed(1)))}
          >
            <Minus size={16} />
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            className="icon-button"
            aria-label="Zoom in"
            disabled={zoom >= 1.8}
            onClick={() => setZoom((v) => Math.min(1.8, +(v + 0.2).toFixed(1)))}
          >
            <Plus size={16} />
          </button>
          <span className="tool-divider" />
          <button
            className="icon-button"
            aria-label="Reset zoom and pan"
            title="Reset zoom and pan"
            onClick={resetView}
          >
            <Expand size={16} />
          </button>
        </div>
      </div>
      <p className="canvas-scroll-hint">Scroll sideways to explore the circuit →</p>
      <div className={`canvas-surface ${hand ? 'hand-tool' : ''}`}>
        <div className="board-caption">
          <span className="status-dot" />
          {preview ? 'APPRENTICE VIEW · FAULT HIDDEN' : 'INSTRUCTOR VIEW · FAULT VISIBLE'}
        </div>
        <div
          className="diagram-viewport"
          tabIndex={0}
          role="region"
          aria-label="Circuit diagram. On small screens, scroll horizontally to see the full circuit."
        >
          <svg
            ref={svgRef}
            viewBox="0 0 920 520"
            className="circuit-svg"
            role="group"
            aria-label="Start-stop control circuit. Five selectable conductors and four components."
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
            onKeyDown={(e) => {
              if (e.key === 'Escape') finishDrag(false);
            }}
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
                  id === 'stop'
                    ? !state?.stopHeld
                    : id === 'start'
                      ? !!state?.startHeld
                      : id === 'aux'
                        ? !!state?.coilOn
                        : !!state?.coilOn;
                return (
                  <g
                    key={id}
                    data-component={id}
                    transform={`translate(${p.x} ${p.y})`}
                    className={`component ${!preview ? 'movable' : ''} ${id === 'coil' && state?.coilOn ? 'energized' : ''}`}
                    tabIndex={preview ? undefined : 0}
                    role={preview ? undefined : 'button'}
                    aria-label={`${componentInfo[id].label}${!preview ? '. Drag or use arrow keys to move within its layout area.' : ''}`}
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
                      {id === 'coil' && state?.coilOn ? 'Energized' : componentInfo[id].detail}
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
          <span>
            {preview
              ? 'Select a conductor to inspect or identify it.'
              : 'Select a conductor to set the fault. Drag components to adjust the layout.'}
          </span>
          <button className="text-button small" onClick={resetView}>
            <RotateCcw size={13} /> Reset view
          </button>
        </div>
      </div>
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
        <span className="legend-tail">Fixed topology · movable layout</span>
      </div>
    </section>
  );
}
