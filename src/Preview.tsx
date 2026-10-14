import { useEffect, useReducer, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Lightbulb,
  Power,
  RotateCcw,
  Search,
  Zap,
  Clock3,
  ChevronRight,
} from 'lucide-react';
import CircuitCanvas from './CircuitCanvas';
import { initialCircuit, stepCircuit, wireInfo, WIRES } from './domain';
import type { CircuitAction, Lab, WireId } from './domain';

export default function Preview({ lab, onClose }: { lab: Lab; onClose: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof initialCircuit>, a: CircuitAction) => stepCircuit(s, a, lab.fault),
    undefined,
    initialCircuit,
  );
  const [selected, setSelected] = useState<WireId | null>(null);
  const [inspected, setInspected] = useState<Partial<Record<WireId, boolean>>>({});
  const [hints, setHints] = useState(0);
  const [answer, setAnswer] = useState<'correct' | 'wrong' | null>(null);
  const [explanation, setExplanation] = useState('');
  const [observations, setObservations] = useState<string[]>([]);
  useEffect(() => {
    const release = () => dispatch('release');
    const visibility = () => {
      if (document.hidden) release();
    };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const action = (a: CircuitAction) => {
    dispatch(a);
    const next = stepCircuit(state, a, lab.fault);
    const message =
      a === 'power'
        ? `Supply ${next.powered ? 'on' : 'isolated'}.`
        : a === 'start-down'
          ? `START held → K1 ${next.coilOn ? 'energized' : 'de-energized'}.`
          : a === 'start-up'
            ? `START released → K1 ${next.coilOn ? 'stays energized' : 'de-energized'}.`
            : a === 'stop-down'
              ? 'STOP held → K1 de-energized.'
              : '';
    if (message) setObservations((old) => [message, ...old].slice(0, 6));
  };
  const momentary = (type: 'start' | 'stop') => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      action(`${type}-down`);
    },
    onPointerUp: () => action(`${type}-up`),
    onPointerCancel: () => action(`${type}-up`),
    onLostPointerCapture: () => dispatch(`${type}-up`),
    onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        action(`${type}-down`);
      }
    },
    onKeyUp: (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        action(`${type}-up`);
      }
    },
    onBlur: () => dispatch(`${type}-up`),
  });
  return (
    <main className="preview-page">
      <div className="preview-top">
        <button className="button subtle" onClick={onClose}>
          <ArrowLeft size={16} /> Back to authoring
        </button>
        <span className="preview-label">APPRENTICE PREVIEW</span>
        <span className="model-badge">Practice attempt · stays in this session</span>
      </div>
      <div className="page-heading preview-heading">
        <div>
          <span className="overline">MOTOR CONTROLS / TROUBLESHOOTING</span>
          <h1 ref={headingRef} tabIndex={-1}>
            {lab.title}
          </h1>
          <p>{lab.objective}</p>
        </div>
        <span className="duration">
          <Clock3 size={16} />
          {lab.durationMinutes} min
        </span>
      </div>
      <div className="preview-layout">
        <div className="preview-main">
          <section className="side-card preview-brief" aria-label="Read the scenario">
            <h2 className="overline">01 / READ THE SCENARIO</h2>
            <p className="briefing-copy">{lab.briefing}</p>
            {lab.hints.length > 0 && (
              <div className="hints-box">
                {lab.hints.slice(0, hints).map((hint, i) => (
                  <p key={i}>
                    <Lightbulb size={15} />
                    <span>{hint}</span>
                  </p>
                ))}
                <button
                  className="text-button"
                  disabled={hints >= lab.hints.length}
                  onClick={() => setHints((n) => n + 1)}
                >
                  <Lightbulb size={15} />
                  {hints >= lab.hints.length
                    ? 'All hints revealed'
                    : `Reveal hint ${hints + 1} of ${lab.hints.length}`}
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </section>
          <div className="control-station">
            <div className="station-title">
              <span className="overline">02 / OBSERVE</span>
              <span className={`coil-state ${state.coilOn ? 'on' : ''}`} role="status">
                <i />
                K1 {state.coilOn ? 'energized' : 'de-energized'}
              </span>
            </div>
            <div className="station-controls">
              <button
                className={`button power-button ${state.powered ? 'powered' : ''}`}
                aria-pressed={state.powered}
                onClick={() => action('power')}
              >
                <Power size={17} />
                {state.powered ? 'Isolate supply' : 'Turn supply on'}
              </button>
              <span className="tool-divider" />
              <button
                className={`pushbutton start ${state.startHeld ? 'held' : ''}`}
                aria-label="Hold START"
                aria-pressed={state.startHeld}
                {...momentary('start')}
              >
                START
              </button>
              <button
                className={`pushbutton stop ${state.stopHeld ? 'held' : ''}`}
                aria-label="Hold STOP"
                aria-pressed={state.stopHeld}
                {...momentary('stop')}
              >
                STOP
              </button>
              <span className="control-hint">
                Press and hold.
                <br />
                Keyboard: hold Space or Enter.
              </span>
            </div>
          </div>
          <CircuitCanvas
            lab={lab}
            selected={selected}
            onSelect={(wire) => {
              setSelected(wire);
              setAnswer(null);
            }}
            preview
            state={state}
          />
          <div className="model-note">
            <Zap size={16} />
            <p>
              <strong>Conceptual control model.</strong> Ideal contacts and one open conductor. The
              motor power circuit, protection, and real measurements are outside this exercise.
            </p>
          </div>
        </div>
        <aside className="preview-aside">
          <section className="side-card inspect-card">
            <span className="overline">03 / INSPECT</span>
            <h3>
              {selected
                ? `${wireInfo[selected].tag} · ${wireInfo[selected].name}`
                : 'Select a conductor'}
            </h3>
            <label className="field">
              <span>Conductor to inspect</span>
              <select
                value={selected ?? ''}
                onChange={(e) => {
                  setSelected(e.target.value as WireId);
                  setAnswer(null);
                }}
              >
                <option value="" disabled>
                  Choose W1–W5
                </option>
                {WIRES.map((id) => (
                  <option key={id} value={id}>
                    {wireInfo[id].tag} · {wireInfo[id].name}
                  </option>
                ))}
              </select>
            </label>
            <p>
              {selected
                ? wireInfo[selected].description
                : 'Choose W1–W5 on the circuit. Isolate the supply before inspecting a conductor.'}
            </p>
            <button
              className="button secondary full"
              disabled={!selected || state.powered}
              onClick={() => {
                if (selected && !state.powered)
                  setInspected((old) => ({ ...old, [selected]: selected !== lab.fault }));
              }}
            >
              <Search size={16} />
              Inspect isolated conductor
            </button>
            {state.powered && (
              <p className="field-help">Isolate the supply to enable inspection.</p>
            )}
            {selected && inspected[selected] !== undefined && (
              <div
                className={`inspection-result ${inspected[selected] ? '' : 'open'}`}
                role="status"
              >
                {inspected[selected] ? 'Intact conductor' : 'Open conductor'}
                <small>Model inspection · not a meter reading</small>
              </div>
            )}
            <div className="diagnosis-heading">
              <span className="overline">04 / EXPLAIN</span>
              <p>Which conductor explains the symptom?</p>
            </div>
            <label className="field explanation-field">
              <span>Your explanation</span>
              <textarea
                value={explanation}
                onChange={(e) => {
                  setExplanation(e.target.value);
                  setAnswer(null);
                }}
                placeholder="Explain what the fault changes in this circuit…"
                maxLength={1000}
                rows={3}
              />
            </label>
            <button
              className="button primary full"
              disabled={!selected || !explanation.trim()}
              onClick={() => setAnswer(selected === lab.fault ? 'correct' : 'wrong')}
            >
              Check diagnosis
              <ChevronRight size={16} />
            </button>
            {answer && (
              <div className={`feedback ${answer}`} role="status">
                {answer === 'correct' ? (
                  <>
                    <Check size={18} />
                    <div>
                      <strong>Fault located.</strong>
                      <p>
                        Your selected conductor matches the fault. Your written explanation is ready
                        for an instructor to discuss; it is not automatically graded.
                      </p>
                    </div>
                  </>
                ) : (
                  <p>
                    That conductor isn’t the fault. Compare your observations and inspect another
                    conductor, then try again.
                  </p>
                )}
              </div>
            )}
          </section>
          <section className="side-card observations">
            <div className="section-line">
              <span className="overline">OBSERVATIONS</span>
              <button
                className="icon-button"
                aria-label="Clear observations"
                onClick={() => setObservations([])}
              >
                <RotateCcw size={14} />
              </button>
            </div>
            {observations.length ? (
              <ol>
                {observations.map((o, i) => (
                  <li key={`${o}-${i}`}>{o}</li>
                ))}
              </ol>
            ) : (
              <p>Use the control station to see what the circuit does.</p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
