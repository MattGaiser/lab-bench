import { useRef } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronRight,
  Circle,
  FileCheck2,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Unplug,
} from 'lucide-react';
import { checkLab, initialCircuit, stepCircuit, wireInfo, WIRES } from './domain';
import type { Lab, WireId } from './domain';
import { revealAboveFooter } from './focus';
export type Tab = 'details' | 'fault' | 'review';
type Props = {
  lab: Lab;
  selected: WireId | null;
  setSelected: (wire: WireId | null) => void;
  tab: Tab;
  setTab: (tab: Tab) => void;
  update: (patch: Partial<Lab>, group?: string) => void;
  endGroup: () => void;
  previewLab: () => void;
  exportLab: () => void;
  onLoadSample: () => void;
};
export default function Inspector({
  lab,
  selected,
  setSelected,
  tab,
  setTab,
  update,
  endGroup,
  previewLab,
  exportLab,
  onLoadSample,
}: Props) {
  const titleRef = useRef<HTMLInputElement>(null);
  const checks = checkLab(lab);
  const ready = checks.every((c) => c.pass);
  const completed = checks.filter((c) => c.pass).length;
  const showTab = (next: Tab) => {
    setTab(next);
    requestAnimationFrame(() => {
      const button = document.getElementById(`tab-${next}`);
      button?.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 900px)').matches)
        button?.scrollIntoView({ block: 'start' });
    });
  };
  const held = stepCircuit(
    stepCircuit(initialCircuit(), 'power', lab.fault),
    'start-down',
    lab.fault,
  );
  const released = stepCircuit(held, 'start-up', lab.fault);
  return (
    <aside
      className="inspector"
      aria-label="Lab settings"
      onFocusCapture={(event) => revealAboveFooter(event, '.inspector-footer')}
    >
      <div className="inspector-title">
        <SlidersHorizontal size={17} />
        <h2>Build the exercise</h2>
      </div>
      <div className="inspector-tabs" role="tablist" aria-label="Authoring panels">
        {(['details', 'fault', 'review'] as Tab[]).map((name, i) => (
          <button
            key={name}
            id={`tab-${name}`}
            role="tab"
            aria-selected={tab === name}
            aria-controls={`panel-${name}`}
            tabIndex={tab === name ? 0 : -1}
            onClick={() => showTab(name)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const next = (i + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
                const name = (['details', 'fault', 'review'] as Tab[])[next];
                setTab(name);
                document.getElementById(`tab-${name}`)?.focus();
              }
              if (e.key === 'Home' || e.key === 'End') {
                e.preventDefault();
                showTab(e.key === 'Home' ? 'details' : 'review');
              }
            }}
          >
            {name === 'details' ? 'Lab details' : name === 'fault' ? 'Fault setup' : 'Review'}
            {name === 'review' && <span className={`review-dot ${ready ? 'complete' : ''}`} />}
          </button>
        ))}
      </div>
      <div
        className="inspector-content"
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        {tab === 'details' && (
          <>
            <details className="disclosure" name="lab-details" id="details-basic">
              <summary>
                <span>Title and duration</span>
                <small>{lab.durationMinutes} min</small>
              </summary>
              <div className="disclosure-body">
                <label className="field">
                  <span>Exercise title</span>
                  <input
                    ref={titleRef}
                    value={lab.title}
                    maxLength={80}
                    onChange={(e) => update({ title: e.target.value }, 'title')}
                    onBlur={endGroup}
                  />
                </label>
                <label className="field">
                  <span>Suggested duration</span>
                  <select
                    value={lab.durationMinutes}
                    onChange={(e) => update({ durationMinutes: Number(e.target.value) })}
                  >
                    {Array.from({ length: 56 }, (_, i) => i + 5).map((n) => (
                      <option value={n} key={n}>
                        {n} minutes
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
            <details className="disclosure" name="lab-details" id="details-brief">
              <summary>
                <span>Objective and instructions</span>
              </summary>
              <div className="disclosure-body">
                <p className="field-help">
                  Write what apprentices should observe and investigate. Keep the fault location out
                  of the instructions.
                </p>
                <label className="field">
                  <span>Learning objective</span>
                  <textarea
                    id="field-objective"
                    value={lab.objective}
                    maxLength={400}
                    rows={3}
                    onChange={(e) => update({ objective: e.target.value }, 'objective')}
                    onBlur={endGroup}
                  />
                </label>
                <label className="field">
                  <span>Apprentice instructions</span>
                  <textarea
                    id="field-briefing"
                    value={lab.briefing}
                    maxLength={2000}
                    rows={5}
                    onChange={(e) => update({ briefing: e.target.value }, 'briefing')}
                    onBlur={endGroup}
                  />
                </label>
              </div>
            </details>
            <details className="disclosure" name="lab-details" id="details-hints">
              <summary>
                <span>Hints</span>
                <small>{lab.hints.length} of 3 - Optional</small>
              </summary>
              <div className="disclosure-body">
                <p className="field-help">Revealed one at a time, when the apprentice asks.</p>
                {lab.hints.map((hint, i) => (
                  <div className="hint-field" key={i}>
                    <label className="field">
                      <span>Hint {i + 1}</span>
                      <textarea
                        id={`field-hint-${i}`}
                        value={hint}
                        maxLength={300}
                        rows={2}
                        onChange={(e) =>
                          update(
                            { hints: lab.hints.map((h, j) => (j === i ? e.target.value : h)) },
                            `hint-${i}`,
                          )
                        }
                        onBlur={endGroup}
                      />
                    </label>
                    <button
                      className="icon-button"
                      aria-label={`Remove hint ${i + 1}`}
                      onClick={() => {
                        update({ hints: lab.hints.filter((_, j) => j !== i) });
                        requestAnimationFrame(() => document.getElementById('add-hint')?.focus());
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  id="add-hint"
                  className="button secondary full"
                  disabled={lab.hints.length >= 3}
                  onClick={() => {
                    update({ hints: [...lab.hints, ''] });
                    requestAnimationFrame(() =>
                      document.getElementById(`field-hint-${lab.hints.length}`)?.focus(),
                    );
                  }}
                >
                  <Plus size={15} />
                  Add a hint
                </button>
              </div>
            </details>
          </>
        )}
        {tab === 'fault' && (
          <>
            <div className="panel-intro">
              <h3>Choose the fault.</h3>
              <p>
                Introduce one open conductor. The apprentice’s job is to find it and explain why.
              </p>
            </div>
            <label className="field">
              <span>Selected conductor</span>
              <select
                value={selected ?? ''}
                onChange={(e) => setSelected(e.target.value as WireId)}
              >
                <option value="" disabled>
                  Choose a conductor
                </option>
                {WIRES.map((id) => (
                  <option value={id} key={id}>
                    {wireInfo[id].tag} · {wireInfo[id].name}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <div className="selected-wire-card">
                <div className="wire-card-symbol">
                  <Unplug size={23} />
                </div>
                <span className="overline">{wireInfo[selected].tag}</span>
                <h3>{wireInfo[selected].name}</h3>
                <details className="disclosure compact-disclosure">
                  <summary>
                    <span>About this conductor</span>
                  </summary>
                  <div className="disclosure-body">
                    <p>{wireInfo[selected].description}</p>
                  </div>
                </details>
                {lab.fault === selected ? (
                  <div className="fault-state">
                    <span />
                    <strong>Open conductor</strong>
                    <span className="small">Fault placed</span>
                  </div>
                ) : (
                  <button
                    className="button fault-button full"
                    onClick={() => update({ fault: selected })}
                  >
                    <Plus size={16} />
                    Place open fault here
                  </button>
                )}
              </div>
            )}
            <div className="fault-summary">
              <div className="section-line">
                <span className="overline">EXERCISE FAULT</span>
                <span className="count-badge">{lab.fault ? '1 / 1' : '0 / 1'}</span>
              </div>
              {lab.fault ? (
                <div className="placed-fault">
                  <div>
                    <strong>
                      {wireInfo[lab.fault].tag} · {wireInfo[lab.fault].name}
                    </strong>
                    <p>Open conductor</p>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Remove fault"
                    title="Remove fault"
                    onClick={() => update({ fault: null })}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <p className="empty-note">No fault placed. Select a conductor above to add one.</p>
              )}
            </div>
            <details className="disclosure">
              <summary>
                <span>Expected circuit response</span>
              </summary>
              <div className="disclosure-body expected-behavior">
                <p>
                  START held: K1 {held.coilOn ? 'energizes' : 'stays off'}.<br />
                  START released: K1 {released.coilOn ? 'stays energized' : 'is off'}.
                </p>
                <button className="text-button small" onClick={() => showTab('details')}>
                  Check that your brief matches
                  <ArrowUpRight size={13} />
                </button>
              </div>
            </details>
          </>
        )}
        {tab === 'review' && (
          <>
            <div className={`readiness-card ${ready ? 'ready' : ''}`}>
              <div className="readiness-icon">
                {ready ? <ShieldCheck size={28} /> : <FileCheck2 size={28} />}
              </div>
              <h3>{ready ? 'Ready for a practice run.' : 'A few things to finish.'}</h3>
              <p>
                {ready
                  ? 'The exercise has everything it needs. Try it as an apprentice before exporting.'
                  : `${checks.length - completed} ${checks.length - completed === 1 ? 'check needs' : 'checks need'} your attention.`}
              </p>
            </div>
            <details className="disclosure" open={!ready}>
              <summary>
                <span>Readiness checks</span>
                <small>
                  {completed} of {checks.length} complete
                </small>
              </summary>
              <div className="disclosure-body checklist">
                {checks.map((c) => (
                  <button
                    key={c.id}
                    className={`check-item ${c.pass ? 'passed' : ''}`}
                    onClick={() => {
                      showTab(c.id === 'fault' ? 'fault' : 'details');
                      if (c.id !== 'fault')
                        requestAnimationFrame(() => {
                          const section = document.getElementById(
                            c.id === 'title'
                              ? 'details-basic'
                              : c.id === 'hints'
                                ? 'details-hints'
                                : 'details-brief',
                          ) as HTMLDetailsElement | null;
                          if (section) section.open = true;
                          const field =
                            c.id === 'title'
                              ? titleRef.current
                              : c.id === 'hints'
                                ? document.getElementById(
                                    `field-hint-${Math.max(
                                      0,
                                      lab.hints.findIndex((h) => !h.trim()),
                                    )}`,
                                  )
                                : document.getElementById(`field-${c.id}`);
                          field?.focus();
                        });
                    }}
                  >
                    {c.pass ? <Check size={17} /> : <Circle size={17} />}
                    <div>
                      <strong>{c.label}</strong>
                      {!c.pass && <p>{c.detail}</p>}
                    </div>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            </details>
          </>
        )}
      </div>
      <div className="inspector-footer">
        {tab === 'details' ? (
          <button className="button primary full" onClick={() => showTab('fault')}>
            Next: choose a fault <ChevronRight size={16} />
          </button>
        ) : tab === 'fault' ? (
          <button className="button primary full" onClick={() => showTab('review')}>
            Next: review lab <ChevronRight size={16} />
          </button>
        ) : (
          <>
            <button id="preview-review" className="button primary full" onClick={previewLab}>
              <Play size={15} /> Apprentice preview
            </button>
            <button className="button secondary full" onClick={exportLab}>
              <ArrowDownToLine size={16} /> Export lab file
            </button>
            <p className="field-help">The file includes the answer. Share it with instructors.</p>
          </>
        )}
        <button className="text-button" onClick={onLoadSample}>
          <RefreshCw size={14} />
          Load sample exercise
        </button>
      </div>
    </aside>
  );
}
