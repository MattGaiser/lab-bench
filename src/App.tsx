import { useEffect, useReducer, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Compass,
  Clock3,
  FlaskConical,
  Play,
  TriangleAlert,
  X,
} from 'lucide-react';
import CircuitCanvas from './CircuitCanvas';
import Preview from './Preview';
import Inspector from './Inspector';
import StartPage from './StartPage';
import Walkthrough from './Walkthrough';
import type { Tab } from './Inspector';
import {
  checkLab,
  exampleLab,
  historyReducer,
  MAX_FILE_BYTES,
  parseLab,
  serializeLab,
} from './domain';
import type { Lab, WireId } from './domain';
import { DRAFT_KEY, loadDraft, saveDraft } from './storage';

const storage = {
  getItem: (key: string) => window.localStorage.getItem(key),
  setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
};
type SaveStatus = 'saving' | 'saved' | 'unavailable' | 'damaged' | 'conflict';
function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [initial] = useState(() => loadDraft(storage));
  const [screen, setScreen] = useState<'start' | 'editor'>(() =>
    window.location.hash === '#editor' ? 'editor' : 'start',
  );
  const [hasOpened, setHasOpened] = useState(
    initial.status !== 'new' || window.location.hash === '#editor',
  );
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initial.lab,
    future: [],
  });
  const lab = history.present;
  const currentLab = useRef(lab);
  currentLab.current = lab;
  const lastRaw = useRef(initial.raw);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(
    initial.status === 'new' ? 'saving' : initial.status,
  );
  const [saveGeneration, retrySave] = useReducer((n) => n + 1, 0);
  const [selected, setSelected] = useState<WireId | null>(lab.fault ?? 'hold');
  const [tab, setTab] = useState<Tab>('fault');
  const [preview, setPreview] = useState<Lab | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const aboutRef = useRef<HTMLDialogElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const previewTrigger = useRef<string | null>(null);
  const checks = checkLab(lab);
  const ready = checks.every((c) => c.pass);
  const completed = checks.filter((c) => c.pass).length;

  useEffect(() => {
    if (!preview && previewTrigger.current) {
      document.getElementById(previewTrigger.current)?.focus({ preventScroll: true });
      previewTrigger.current = null;
    }
  }, [preview]);

  useEffect(() => {
    if ((screen === 'start' && !hasOpened) || saveStatus === 'damaged' || saveStatus === 'conflict')
      return;
    let canceled = false;
    setSaveStatus('saving');
    const timeout = window.setTimeout(async () => {
      const commit = () => {
        if (canceled) return;
        const result = saveDraft(storage, lab, lastRaw.current);
        if (result.ok) {
          lastRaw.current = result.raw;
          setSaveStatus('saved');
        } else setSaveStatus(result.reason);
      };
      try {
        if (navigator.locks) await navigator.locks.request(DRAFT_KEY, commit);
        else commit();
      } catch {
        if (!canceled) setSaveStatus('unavailable');
      }
    }, 300);
    return () => {
      canceled = true;
      clearTimeout(timeout);
    };
    // Save status reflects the outcome; edits and explicit recovery are the triggers.
  }, [lab, saveGeneration, screen, hasOpened]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if ((event.key === DRAFT_KEY || event.key === null) && event.newValue !== lastRaw.current)
        setSaveStatus('conflict');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (
        preview ||
        screen === 'start' ||
        tourStep !== null ||
        aboutRef.current?.open ||
        (e.target instanceof Element &&
          e.target.closest('input, textarea, select, [contenteditable="true"]'))
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      }
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [preview, screen, tourStep]);
  useEffect(() => {
    if (!message || message.error) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (saveStatus !== 'saved' && hasOpened) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveStatus, hasOpened]);

  const openEditor = () => {
    setScreen('editor');
    setHasOpened(true);
    window.history.replaceState(null, '', '#editor');
    window.scrollTo({ top: 0 });
  };
  const goToTourStep = (step: number) => {
    openEditor();
    setTourStep(step);
    setTab(step === 0 ? 'details' : step === 4 ? 'review' : 'fault');
    setPreview(step === 3 ? exampleLab() : null);
  };
  const closeTour = () => {
    setTourStep(null);
    setPreview(null);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() =>
      document.getElementById('show-tour')?.focus({ preventScroll: true }),
    );
  };

  const update = (patch: Partial<Lab>, group?: string) =>
    dispatch({ type: 'replace', lab: { ...lab, ...patch }, group });
  const endGroup = () => dispatch({ type: 'end-group' });
  const selectWire = (wire: WireId) => {
    setSelected(wire);
    setTab('fault');
  };
  const exportLab = () => {
    if (!ready) {
      setTab('review');
      setMessage({ text: 'Finish the highlighted checks before exporting.', error: true });
      return;
    }
    download(
      serializeLab(lab),
      `${
        lab.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'exercise'
      }.lab.json`,
    );
    setMessage({ text: 'Lab exported. Import the file to reopen this exact exercise.' });
  };
  const importLab = async (file: File) => {
    const snapshot = currentLab.current;
    try {
      if (file.size > MAX_FILE_BYTES)
        throw new Error('This file is too large. Lab files must be under 64 KB.');
      const imported = parseLab(await file.text());
      if (currentLab.current !== snapshot)
        throw new Error(
          'The draft changed while the file was being read. Import again when you are ready.',
        );
      dispatch({ type: 'replace', lab: imported });
      openEditor();
      setSelected(imported.fault);
      setTab('review');
      setMessage({ text: 'Lab imported. You can undo to return to the previous draft.' });
    } catch (error) {
      setMessage({
        text: `${error instanceof Error ? error.message : 'Could not read that file.'} Your draft is unchanged.`,
        error: true,
      });
    }
  };
  const adoptSaved = () => {
    const saved = loadDraft(storage);
    if (saved.status === 'saved') {
      lastRaw.current = saved.raw;
      dispatch({ type: 'replace', lab: saved.lab });
      setSaveStatus('saved');
      retrySave();
      setMessage({ text: 'Loaded the draft saved on this device.' });
    } else
      setMessage({
        text: 'No readable saved draft was found. Export this copy to keep your work.',
        error: true,
      });
  };
  const keepThisCopy = () => {
    try {
      lastRaw.current = storage.getItem(DRAFT_KEY);
      setSaveStatus('saving');
      retrySave();
    } catch {
      setSaveStatus('unavailable');
    }
  };
  const previewLab = () => {
    if (!ready) {
      setTab('review');
      setMessage({
        text: 'Finish the highlighted checks before opening the apprentice preview.',
        error: true,
      });
      return;
    }
    previewTrigger.current = document.activeElement?.id || 'preview-main';
    setPreview(structuredClone(lab));
    window.scrollTo({ top: 0 });
  };
  const showTab = (next: Tab) => {
    setTab(next);
  };
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPreview(null);
            setScreen('start');
            window.history.replaceState(null, '', window.location.pathname);
            window.scrollTo({ top: 0 });
          }}
          aria-label="Lab Bench authoring"
        >
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          <span>
            lab<span className="brand-light">bench</span>
            <span className="brand-period">.</span>
          </span>
        </a>
        <div className="header-divider" />
        <span className="workspace-name">Instructor workspace</span>
        <div className="header-right">
          <span className="independent-tag">Independent work sample</span>
          <button
            id="show-tour"
            aria-label="Show me around"
            className="text-button tour-launch"
            onClick={() => goToTourStep(0)}
          >
            <Compass size={17} />
            <span>Show me around</span>
          </button>
          <button
            className="icon-button"
            aria-label="About Lab Bench"
            onClick={() => aboutRef.current?.showModal()}
          >
            <CircleHelp size={19} />
          </button>
          <span className="avatar" aria-label="Matthew Gaiser">
            MG
          </span>
        </div>
      </header>

      <div hidden={screen !== 'start'}>
        <StartPage
          active={screen === 'start'}
          lab={lab}
          hasDraft={hasOpened}
          onResume={openEditor}
          onTour={() => goToTourStep(0)}
          onImport={() => importRef.current?.click()}
          onSample={() => {
            dispatch({ type: 'replace', lab: exampleLab() });
            setSelected('hold');
            setTab('details');
            openEditor();
          }}
          onApply={(next) => {
            dispatch({ type: 'replace', lab: next });
            setSelected(next.fault);
            setTab('details');
            openEditor();
            setMessage({
              text: 'Scenario set up. Review the brief, then try the apprentice preview. Undo restores your previous draft.',
            });
          }}
        />
      </div>
      {screen === 'editor' &&
        (preview ? (
          <Preview
            lab={preview}
            onClose={() => {
              setPreview(null);
              window.scrollTo({ top: 0 });
            }}
          />
        ) : (
          <main className="author-page">
            <div className="breadcrumbs">
              <button
                className="text-button"
                onClick={() => {
                  setScreen('start');
                  window.history.replaceState(null, '', window.location.pathname);
                }}
              >
                Start a lab
              </button>
              <ChevronRight size={13} />
              <span>Motor controls</span>
              <ChevronRight size={13} />
              <strong>Lab editor</strong>
            </div>
            <div className="page-heading">
              <div className="heading-copy">
                <div className="heading-eyebrow">
                  <span className="overline">MAKE EVERY REP COUNT</span>
                  <span className="draft-pill">Draft exercise</span>
                </div>
                <h1>{lab.title.trim() || 'Untitled exercise'}</h1>
                <p>Set the challenge. Shape the learning. Try it from their side.</p>
              </div>
              <div className="heading-actions">
                <button id="preview-main" className="button secondary" onClick={previewLab}>
                  <Play size={16} />
                  Apprentice preview
                </button>
                <button className="button primary" onClick={exportLab}>
                  <ArrowDownToLine size={16} />
                  Export lab
                </button>
              </div>
            </div>

            <div className="workbench-meta">
              <div className="meta-left">
                <span>
                  <FlaskConical size={16} />
                  Troubleshooting lab
                </span>
                <span className="meta-separator" />
                <span>
                  <Clock3 size={15} />
                  {lab.durationMinutes} minutes
                </span>
                <span className="meta-separator" />
                <span className={ready ? 'ready-text' : 'muted'}>
                  <CheckCheck size={16} />
                  {ready ? 'Ready to preview' : `${completed} of ${checks.length} checks complete`}
                </span>
              </div>
              <div className="meta-right">
                <span
                  className={`save-state ${saveStatus === 'saved' ? '' : 'attention'}`}
                  role="status"
                >
                  <i />
                  {saveStatus === 'saved'
                    ? 'Saved on this device'
                    : saveStatus === 'saving'
                      ? 'Saving draft…'
                      : 'Draft needs attention'}
                </span>
                <button className="text-button" onClick={() => importRef.current?.click()}>
                  <ArrowUpFromLine size={15} />
                  Import
                </button>
              </div>
            </div>

            {(saveStatus === 'unavailable' ||
              saveStatus === 'conflict' ||
              saveStatus === 'damaged') && (
              <div className="recovery-banner" role="alert">
                <TriangleAlert size={20} />
                <div>
                  <strong>
                    {saveStatus === 'conflict'
                      ? 'Another tab changed the saved draft.'
                      : saveStatus === 'damaged'
                        ? 'The saved draft could not be read.'
                        : 'Browser storage is unavailable.'}
                  </strong>
                  <p>
                    {saveStatus === 'conflict'
                      ? 'Your work is still here. Download this copy before choosing which draft to keep.'
                      : saveStatus === 'damaged'
                        ? 'Your stored data has been preserved. A sample is open so you can keep exploring.'
                        : 'You can keep working. Download a draft to preserve your changes.'}
                  </p>
                  <div className="recovery-actions">
                    <button
                      className="text-button"
                      onClick={() => download(serializeLab(lab), 'lab-bench-draft.json')}
                    >
                      Download this draft
                    </button>
                    {saveStatus === 'conflict' && (
                      <>
                        <button className="text-button" onClick={adoptSaved}>
                          Load saved draft
                        </button>
                        <button className="text-button" onClick={keepThisCopy}>
                          Save this copy instead
                        </button>
                      </>
                    )}
                    {saveStatus === 'damaged' && (
                      <>
                        <button
                          className="text-button"
                          onClick={() => download(lastRaw.current ?? '', 'lab-bench-recovery.txt')}
                        >
                          Download stored data
                        </button>
                        <button className="text-button" onClick={keepThisCopy}>
                          Replace stored draft with this copy
                        </button>
                      </>
                    )}
                    {saveStatus === 'unavailable' && (
                      <button className="text-button" onClick={() => retrySave()}>
                        Retry saving
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="editor-layout">
              <div className="editor-main">
                <CircuitCanvas
                  lab={lab}
                  selected={selected}
                  onSelect={selectWire}
                  onMove={(id, p) => update({ positions: { ...lab.positions, [id]: p } })}
                  onUndo={() => dispatch({ type: 'undo' })}
                  onRedo={() => dispatch({ type: 'redo' })}
                  canUndo={history.past.length > 0}
                  canRedo={history.future.length > 0}
                />
                <div className="below-canvas">
                  <div className="objective-icon">
                    <BookOpen size={21} />
                  </div>
                  <div>
                    <span className="overline">THE LEARNING OBJECTIVE</span>
                    <p>
                      {lab.objective.trim() ||
                        'Add an objective so apprentices know what they are working toward.'}
                    </p>
                  </div>
                  <button className="text-button" onClick={() => showTab('details')}>
                    Edit
                    <ArrowUpRight size={15} />
                  </button>
                </div>
                <div className="workflow-strip">
                  <div>
                    <span className="step-number">01</span>
                    <div>
                      <strong>Shape the exercise</strong>
                      <p>Choose a fault and add context.</p>
                    </div>
                  </div>
                  <ChevronRight size={17} />
                  <div>
                    <span className="step-number">02</span>
                    <div>
                      <strong>Try their experience</strong>
                      <p>Check the symptom in preview.</p>
                    </div>
                  </div>
                  <ChevronRight size={17} />
                  <div>
                    <span className="step-number">03</span>
                    <div>
                      <strong>Take it to the bench</strong>
                      <p>Export a reusable lab file.</p>
                    </div>
                  </div>
                </div>
              </div>

              <Inspector
                lab={lab}
                selected={selected}
                setSelected={setSelected}
                tab={tab}
                setTab={setTab}
                update={update}
                endGroup={endGroup}
                previewLab={previewLab}
                exportLab={exportLab}
                onLoadSample={() => {
                  dispatch({ type: 'replace', lab: exampleLab() });
                  setSelected('hold');
                  setMessage({ text: 'Sample loaded. Undo restores your previous draft.' });
                }}
              />
            </div>
            <footer className="page-footer">
              <span>Built for the moments before the real bench.</span>
              <button className="text-button small" onClick={() => aboutRef.current?.showModal()}>
                About this work sample
                <ArrowUpRight size={13} />
              </button>
            </footer>
          </main>
        ))}
      {tourStep !== null && (
        <Walkthrough step={tourStep} onStep={goToTourStep} onClose={closeTour} />
      )}
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        aria-label="Import lab file"
        className="visually-hidden"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importLab(file);
          e.target.value = '';
        }}
      />
      {message && (
        <div
          className={`toast ${message.error ? 'error' : ''}`}
          role={message.error ? 'alert' : 'status'}
        >
          {message.error ? <TriangleAlert size={18} /> : <Check size={18} />}
          <span>{message.text}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setMessage(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <dialog ref={aboutRef} className="about-dialog" aria-labelledby="about-title">
        <div className="dialog-heading">
          <span className="overline">ABOUT LAB BENCH</span>
          <button
            className="icon-button"
            aria-label="Close about dialog"
            onClick={() => aboutRef.current?.close()}
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="about-title">
          More practice.
          <br />
          Better questions.
        </h2>
        <p>
          An independent product work sample by Matthew Gaiser, exploring how instructors can author
          and check a focused troubleshooting exercise.
        </p>
        <p>
          One start/stop circuit. One open conductor. A complete path from instructor intent to
          apprentice preview and a portable lab file.
        </p>
        <div className="about-facts">
          <div>
            <strong>Model scope</strong>
            <p>
              Ideal control contacts and a contactor coil. No motor power, overload, electrical
              safety assessment, or installation guidance.
            </p>
          </div>
          <div>
            <strong>Your data</strong>
            <p>
              One draft is stored in this browser. Export files include the answer and can be
              reopened here. The optional AI assistant sends your request, recent conversation, and
              previous proposal to OpenAI only when you submit. Editing, preview, and the
              walkthrough work without AI.
            </p>
          </div>
          <div>
            <strong>Keyboard controls</strong>
            <p>
              Tab to conductors and press Enter to select. Use arrow keys on a component to move it.
              Ctrl/⌘ Z undoes canvas edits; Ctrl/⌘ Shift Z redoes them.
            </p>
          </div>
        </div>
        <p className="small muted">
          Inspired by the public Dakota Prep instructor workflow. This sample is not affiliated with
          Dakota Prep.
        </p>
        <button className="button primary full" onClick={() => aboutRef.current?.close()}>
          Back to the workbench
        </button>
      </dialog>
    </div>
  );
}
