import { useEffect, useReducer, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Lightbulb,
  Power,
  RotateCcw,
  Search,
  Clock3,
  ChevronRight,
} from 'lucide-react';
import CircuitCanvas from './CircuitCanvas';
import {
  CONTACTS,
  faultDetails,
  initialCircuit,
  inspectTarget,
  isWire,
  stepCircuit,
  targetDetails,
  wireInfo,
  WIRES,
} from './domain';
import type { CircuitAction, ContactId, FaultCondition, Lab, TargetId } from './domain';

export default function Preview({
  lab,
  onClose,
  onFeedback,
}: {
  lab: Lab;
  onClose: () => void;
  onFeedback: (message: string) => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  const [state, dispatch] = useReducer(
    (s: ReturnType<typeof initialCircuit>, a: CircuitAction) => stepCircuit(s, a, lab.fault),
    undefined,
    initialCircuit,
  );
  const [selected, setSelected] = useState<TargetId | null>(null);
  const [inspected, setInspected] = useState<
    Partial<Record<TargetId, ReturnType<typeof inspectTarget>>>
  >({});
  const [condition, setCondition] = useState<FaultCondition | ''>('');
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
              ? `STOP held → K1 ${next.coilOn ? 'stays energized' : 'de-energized'}.`
              : a === 'stop-up'
                ? `STOP released → K1 ${next.coilOn ? 'energized' : 'de-energized'}.`
                : '';
    if (message) setObservations((old) => [message, ...old].slice(0, 6));
  };
  const selectTarget = (target: TargetId) => {
    setSelected(target);
    setCondition('');
    setAnswer(null);
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
        <button type="button" className="button subtle" onClick={onClose}>
          <ArrowLeft size={16} /> Back to authoring
        </button>
        <span className="preview-label">APPRENTICE PREVIEW</span>
      </div>
      <div className="page-heading preview-heading">
        <div>
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
          <details className="side-card preview-brief disclosure" open>
            <summary>
              <span>Read the scenario</span>
            </summary>
            <div className="disclosure-body">
              <p className="briefing-copy">{lab.briefing}</p>
              {lab.hints.length > 0 && (
                <div className="hints-box">
                  <div role="log" aria-label="Revealed hints">
                    {lab.hints.slice(0, hints).map((hint, i) => (
                      <p key={i}>
                        <Lightbulb size={15} />
                        <span>{hint}</span>
                      </p>
                    ))}
                  </div>
                  <button
                    type="button"
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
            </div>
          </details>
          <div className="control-station">
            <div className="station-title">
              <span className={`coil-state ${state.coilOn ? 'on' : ''}`} role="status">
                <i />
                K1 {state.coilOn ? 'energized' : 'de-energized'}
              </span>
            </div>
            <div className="station-controls">
              <button
                type="button"
                className={`button power-button ${state.powered ? 'powered' : ''}`}
                aria-pressed={state.powered}
                onClick={() => action('power')}
              >
                <Power size={17} />
                {state.powered ? 'Isolate supply' : 'Turn supply on'}
              </button>
              <span className="tool-divider" />
              <button
                type="button"
                className={`pushbutton start ${state.startHeld ? 'held' : ''}`}
                aria-label="Hold START"
                aria-pressed={state.startHeld}
                {...momentary('start')}
              >
                START
              </button>
              <button
                type="button"
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
            selected={isWire(selected) ? selected : null}
            onSelect={selectTarget}
            selectedContact={
              selected && !isWire(selected) ? (selected.slice(8) as ContactId) : null
            }
            onSelectContact={(contact) => selectTarget(`contact-${contact}`)}
            onFeedback={onFeedback}
            preview
            state={state}
          />
        </div>
        <aside className="preview-aside" aria-label="Inspection and diagnosis">
          <section className="side-card inspect-card">
            <h3>{selected ? targetDetails(selected).label : 'Choose what to inspect'}</h3>
            <label className="field">
              <span>Item to inspect</span>
              <select
                value={selected ?? ''}
                onChange={(e) => {
                  selectTarget(e.target.value as TargetId);
                }}
              >
                <option value="" disabled>
                  Choose a conductor or contact
                </option>
                <optgroup label="Conductors">
                  {WIRES.map((id) => (
                    <option key={id} value={id}>
                      {wireInfo[id].tag} · {wireInfo[id].name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Contacts">
                  {CONTACTS.map((id) => (
                    <option key={id} value={`contact-${id}`}>
                      {targetDetails(`contact-${id}`).label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <p>
              {selected
                ? targetDetails(selected).description
                : 'Choose a conductor or contact on the circuit. Isolate the supply, then inspect it.'}
            </p>
            <button
              type="button"
              className="button secondary full"
              disabled={!selected || state.powered}
              onClick={() => {
                if (selected && !state.powered) {
                  if (inspected[selected])
                    onFeedback(
                      `${targetDetails(selected).label} checked again: ${inspectTarget(selected, lab.fault).label}.`,
                    );
                  setInspected((old) => ({
                    ...old,
                    [selected]: inspectTarget(selected, lab.fault),
                  }));
                }
              }}
            >
              <Search size={16} />
              {selected && !isWire(selected)
                ? 'Operate isolated contact'
                : 'Inspect isolated conductor'}
            </button>
            {state.powered && (
              <p className="field-help">Isolate the supply to enable inspection.</p>
            )}
            {selected && inspected[selected] !== undefined && (
              <div
                className={`inspection-result ${inspected[selected]?.faulty ? 'open' : ''}`}
                role="status"
              >
                {inspected[selected]?.label}
              </div>
            )}
            <div className="diagnosis-heading">
              <p>Identify the fault and explain the symptom.</p>
            </div>
            {selected && !isWire(selected) && (
              <label className="field explanation-field">
                <span>Contact fault</span>
                <select
                  value={condition}
                  onChange={(e) => {
                    setCondition(e.target.value as FaultCondition);
                    setAnswer(null);
                  }}
                >
                  <option value="" disabled>
                    Choose a condition
                  </option>
                  <option value="stuck-open">Stuck open</option>
                  <option value="stuck-closed">Stuck closed</option>
                </select>
              </label>
            )}
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
              type="button"
              className="button primary full"
              disabled={!selected || !explanation.trim() || (!isWire(selected) && !condition)}
              onClick={() => {
                const result =
                  lab.fault &&
                  selected === faultDetails(lab.fault).target &&
                  (isWire(selected) || condition === faultDetails(lab.fault).condition)
                    ? 'correct'
                    : 'wrong';
                if (answer === result)
                  onFeedback(
                    result === 'correct'
                      ? 'Diagnosis checked again: the selected fault matches.'
                      : 'Diagnosis checked again: the selected item or condition does not match the fault.',
                  );
                setAnswer(result);
              }}
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
                        Your diagnosis matches the fault. Discuss your explanation with your
                        instructor.
                      </p>
                    </div>
                  </>
                ) : (
                  <p>
                    That diagnosis doesn’t match. Compare your observations, check the selected item
                    and its condition, then try again.
                  </p>
                )}
              </div>
            )}
          </section>
          <details className="side-card observations disclosure">
            <summary>
              <span>Observation log</span>
              <small>{observations.length} events</small>
            </summary>
            <div className="disclosure-body">
              {observations.length ? (
                <ol>
                  {observations.map((o, i) => (
                    <li key={`${o}-${i}`}>{o}</li>
                  ))}
                </ol>
              ) : (
                <p>Use the control station to see what the circuit does.</p>
              )}
              <button
                type="button"
                className="text-button"
                aria-label="Clear observations"
                disabled={observations.length === 0}
                onClick={() => {
                  setObservations([]);
                  onFeedback('Observation log cleared.');
                }}
              >
                <RotateCcw size={14} /> Clear observations
              </button>
            </div>
          </details>
        </aside>
      </div>
    </main>
  );
}
