import { useRef } from 'react';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronRight,
  Circle,
  FileCheck2,
  Info,
  Lightbulb,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Unplug,
} from 'lucide-react';
import { checkLab, wireInfo, WIRES } from './domain';
import type { Lab, WireId } from './domain';
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
  const showTab = setTab;
  return (
    <aside className="inspector" aria-label="Lab settings">
      <div className="inspector-title">
        <SlidersHorizontal size={17} />
        <h2>Build the exercise</h2>
        <span>01</span>
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
                const next = (i + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
                const name = (['details', 'fault', 'review'] as Tab[])[next];
                setTab(name);
                document.getElementById(`tab-${name}`)?.focus();
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
            <div className="panel-intro">
              <span className="overline">THE BRIEF</span>
              <h3>Give the work a purpose.</h3>
              <p>A clear symptom is the beginning of a good troubleshooting exercise.</p>
            </div>
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
              <span>Learning objective</span>
              <textarea
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
                value={lab.briefing}
                maxLength={2000}
                rows={5}
                onChange={(e) => update({ briefing: e.target.value }, 'briefing')}
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
            <div className="section-line hints-title">
              <h3>Hints</h3>
              <span className="small muted">Optional · {lab.hints.length}/3</span>
            </div>
            <p className="field-help">Revealed one at a time, when the apprentice asks.</p>
            {lab.hints.map((hint, i) => (
              <div className="hint-field" key={i}>
                <label className="field">
                  <span>Hint {i + 1}</span>
                  <textarea
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
                  onClick={() => update({ hints: lab.hints.filter((_, j) => j !== i) })}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              className="button secondary full"
              disabled={lab.hints.length >= 3}
              onClick={() => update({ hints: [...lab.hints, ''] })}
            >
              <Plus size={15} />
              Add a hint
            </button>
          </>
        )}
        {tab === 'fault' && (
          <>
            <div className="panel-intro">
              <span className="overline">A LITTLE FRICTION. A LOT OF LEARNING.</span>
              <h3>Something isn’t right.</h3>
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
                <p>{wireInfo[selected].description}</p>
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
            <div className="tip-card">
              <Lightbulb size={19} />
              <div>
                <strong>Keep the answer out of sight.</strong>
                <p>
                  The fault marker is hidden in apprentice preview. Learners use the controls and
                  isolated conductor inspection to investigate.
                </p>
              </div>
            </div>
            <button className="button secondary full preview-panel-button" onClick={previewLab}>
              <Play size={15} />
              Try the exercise
              <ArrowUpRight size={15} />
            </button>
          </>
        )}
        {tab === 'review' && (
          <>
            <div className={`readiness-card ${ready ? 'ready' : ''}`}>
              <div className="readiness-icon">
                {ready ? <ShieldCheck size={28} /> : <FileCheck2 size={28} />}
              </div>
              <span className="overline">PREFLIGHT CHECK</span>
              <h3>{ready ? 'Ready for a practice run.' : 'A few things to finish.'}</h3>
              <p>
                {ready
                  ? 'The exercise has everything it needs. Try it as an apprentice before exporting.'
                  : `${checks.length - completed} ${checks.length - completed === 1 ? 'check needs' : 'checks need'} your attention.`}
              </p>
            </div>
            <div className="checklist">
              {checks.map((c) => (
                <button
                  key={c.id}
                  className={`check-item ${c.pass ? 'passed' : ''}`}
                  onClick={() => {
                    setTab(c.id === 'fault' ? 'fault' : 'details');
                    if (c.id === 'title') setTimeout(() => titleRef.current?.focus(), 0);
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
            <button className="button secondary full" onClick={previewLab}>
              <Play size={15} />
              Apprentice preview
            </button>
            <button className="button primary full export-panel-button" onClick={exportLab}>
              <ArrowDownToLine size={16} />
              Export lab file
            </button>
            <div className="tip-card neutral">
              <Info size={18} />
              <p>
                The file includes the instructor’s answer, hints, and layout. Share it with
                instructors; this is not a secure learner assignment.
              </p>
            </div>
          </>
        )}
      </div>
      <div className="inspector-footer">
        <button className="text-button" onClick={onLoadSample}>
          <RefreshCw size={14} />
          Load sample exercise
        </button>
      </div>
    </aside>
  );
}
