import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Compass,
  LoaderCircle,
  Send,
  Sparkles,
  Unplug,
} from 'lucide-react';
import { checkLab, parseLab, wireInfo } from './domain';
import type { Lab } from './domain';
import { expectedSymptom } from './scenario';
import type { Proposal } from './scenario';

type Props = {
  lab: Lab;
  hasDraft: boolean;
  active: boolean;
  onResume: () => void;
  onSample: () => void;
  onTour: () => void;
  onApply: (lab: Lab) => void;
  onImport: () => void;
};
const prompts = [
  {
    label: 'The motor won’t stay on',
    text: 'Create a 15-minute beginner lab about a pump that runs only while START is held. Teach the role of the holding contact.',
  },
  {
    label: 'Find a no-start fault',
    text: 'Create a 20-minute lab for first-year apprentices: a conveyor contactor will not energize because of an open supply conductor. Include two hints.',
  },
];
export default function StartPage({
  lab,
  hasDraft,
  active,
  onResume,
  onSample,
  onTour,
  onApply,
  onImport,
}: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState('');
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [context, setContext] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const lastLab = useRef<Lab | null>(null);
  const request = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const result = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!active) {
      request.current?.abort();
      request.current = null;
      setBusy(false);
    }
  }, [active]);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/assistant/status', {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => setAvailable(v?.available === true))
      .catch(() => {
        if (!controller.signal.aborted) setAvailable(false);
      });
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, []);
  async function submit() {
    if (!prompt.trim() || busy) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, previous: lastLab.current, context }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35000)]),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Could not draft this lab. Try again.',
        );
      if (
        !data ||
        typeof data.message !== 'string' ||
        !data.message.trim() ||
        data.message.length > 800
      )
        throw new Error('The assistant response could not be read. Please try again.');
      const next = data.lab === null ? null : parseLab(JSON.stringify(data.lab));
      if (next && !checkLab(next).every((c) => c.pass))
        throw new Error('The proposed lab was incomplete. Please try again.');
      if (controller.signal.aborted) return;
      setContext(
        [
          ...context,
          { role: 'user' as const, content: prompt },
          { role: 'assistant' as const, content: data.message },
        ].slice(-4),
      );
      if (next) lastLab.current = next;
      setLastPrompt(prompt);
      setProposal({ message: data.message, lab: next });
      setPrompt('');
      requestAnimationFrame(() => result.current?.focus());
    } catch (err) {
      if (!controller.signal.aborted)
        setError(
          err instanceof Error && err.name !== 'TimeoutError'
            ? err.message
            : 'This is taking too long. Try again or open the sample.',
        );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <main className="start-page">
      <div className="start-heading">
        <span className="overline">FROM TEACHING GOAL TO HANDS-ON PRACTICE</span>
        <h1>What will they figure out today?</h1>
        <p>
          Build a troubleshooting lab your apprentices can learn by doing.
          <br className="desktop-break" /> Start with an idea. We’ll help you set the scene.
        </p>
      </div>
      <div className="start-layout">
        <section className="scenario-assistant" aria-labelledby="assistant-title">
          <div className="assistant-heading">
            <span className="assistant-icon">
              <Sparkles size={22} />
            </span>
            <div>
              <span className="overline">YOUR LAB, WITH A LITTLE HELP</span>
              <h2 id="assistant-title">Describe the lesson. Get a working lab.</h2>
            </div>
          </div>
          <p className="assistant-intro">
            Tell the scenario assistant who you’re teaching and what they should discover. You’ll
            review the plan before anything changes.
          </p>
          {proposal && (
            <section
              className="scenario-result"
              ref={result}
              tabIndex={-1}
              aria-label="Scenario proposal"
            >
              <p className="request-bubble">{lastPrompt}</p>
              <p className="assistant-reply">{proposal.message}</p>
              {proposal.lab && (
                <>
                  <div className="proposal-title">
                    <span className="overline">PROPOSED LAB</span>
                    <span>
                      <Clock3 size={14} />
                      {proposal.lab.durationMinutes} min
                    </span>
                  </div>
                  <h3>{proposal.lab.title}</h3>
                  <p className="proposal-objective">{proposal.lab.objective}</p>
                  <dl className="proposal-facts">
                    <div>
                      <dt>Apprentice brief</dt>
                      <dd>{proposal.lab.briefing}</dd>
                    </div>
                    <div>
                      <dt>Instructor answer</dt>
                      <dd>
                        <Unplug size={15} />
                        Open {wireInfo[proposal.lab.fault!].tag} ·{' '}
                        {wireInfo[proposal.lab.fault!].name}
                      </dd>
                    </div>
                    <div>
                      <dt>What the model will do</dt>
                      <dd>{expectedSymptom(proposal.lab)}</dd>
                    </div>
                  </dl>
                  {proposal.lab.hints.length > 0 && (
                    <details>
                      <summary>{proposal.lab.hints.length} progressive hints</summary>
                      <ol>
                        {proposal.lab.hints.map((hint, i) => (
                          <li key={i}>{hint}</li>
                        ))}
                      </ol>
                    </details>
                  )}
                  <button
                    className="button primary full"
                    disabled={busy}
                    onClick={() => onApply(proposal.lab!)}
                  >
                    <Check size={17} />
                    Use this lab
                    <ArrowRight size={17} />
                  </button>
                  <p className="proposal-note">
                    {hasDraft
                      ? `Replaces “${lab.title || 'Untitled exercise'}”. Undo brings it back.`
                      : 'Opens the editor with the circuit, fault and brief set up.'}{' '}
                    Review the wording and test the apprentice experience before sharing.
                  </p>
                </>
              )}
            </section>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <label className="field scenario-field">
              <span>
                {proposal
                  ? 'What would you like to change?'
                  : 'What should your apprentices learn?'}
              </span>
              <textarea
                ref={input}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={2000}
                rows={4}
                disabled={busy}
                placeholder="e.g. A 15-minute lab for first-year apprentices: a pump runs while START is held, but stops when released. Help them understand why."
              />
            </label>
            {!proposal && (
              <div className="prompt-examples">
                <span>Try an idea</span>
                {prompts.map((p) => (
                  <button
                    type="button"
                    key={p.label}
                    disabled={busy}
                    onClick={() => {
                      setPrompt(p.text);
                      input.current?.focus();
                    }}
                  >
                    {p.label}
                    <ArrowRight size={13} />
                  </button>
                ))}
              </div>
            )}
            <div className="assistant-submit">
              <span role="status">
                {busy
                  ? 'Drafting your scenario…'
                  : available === false
                    ? 'AI is unavailable on this server'
                    : available === null
                      ? 'Checking assistant…'
                      : 'AI drafts · You decide'}
              </span>
              {busy ? (
                <button
                  className="button secondary"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    request.current?.abort();
                    request.current = null;
                    setBusy(false);
                  }}
                >
                  <LoaderCircle size={16} className="spin" />
                  Cancel
                </button>
              ) : (
                <button className="button primary" disabled={!prompt.trim() || available !== true}>
                  <Send size={16} />
                  {proposal ? 'Revise scenario' : 'Draft my lab'}
                </button>
              )}
            </div>
            {error && (
              <p className="assistant-error" role="alert">
                {error} Your current lab is unchanged.
              </p>
            )}
            {available === false && (
              <p className="field-help">
                The sample and walkthrough work without AI. To enable drafting, start the local
                server with OPENAI_API_KEY configured.
              </p>
            )}
          </form>
          <p className="assistant-privacy">
            Your request, the two most recent exchanges, and the previous proposal are sent to
            OpenAI when you submit. This builder supports one start/stop circuit with a single open
            conductor.
          </p>
        </section>
        <aside className="start-options" aria-label="Other ways to start">
          <section className="tour-invitation">
            <Compass size={26} />
            <span className="overline">FIRST TIME HERE?</span>
            <h2>Let’s walk the bench.</h2>
            <p>
              A quick tour of the actual tools, from your first brief to the apprentice’s first
              attempt.
            </p>
            <button className="button secondary full" onClick={onTour}>
              Take the 2-minute tour
              <ArrowRight size={16} />
            </button>
            <span className="small">5 stops · Skip or replay any time</span>
          </section>
          <section className="sample-invitation">
            <BookOpen size={22} />
            <span className="overline">START WITH SOMETHING REAL</span>
            <h3>The motor won’t stay on</h3>
            <p>
              A ready-made pump scenario. The holding circuit has an open conductor. Your
              apprentices figure out why.
            </p>
            <div className="sample-tags">
              <span>Beginner</span>
              <span>15 minutes</span>
              <span>2 hints</span>
            </div>
            <button className="text-button" onClick={onSample}>
              Open sample editor
              <ArrowRight size={16} />
            </button>
            {hasDraft && <p className="small muted">Loading the sample is undoable.</p>}
          </section>
          {hasDraft && (
            <button className="resume-card" onClick={onResume}>
              <span>
                <span className="overline">PICK UP WHERE YOU LEFT OFF</span>
                <strong>{lab.title || 'Untitled exercise'}</strong>
                <span className="small">Resume current draft</span>
              </span>
              <ArrowRight size={20} />
            </button>
          )}
          <button className="text-button import-start" onClick={onImport}>
            Already have a lab file? Import it
            <ArrowRight size={14} />
          </button>
        </aside>
      </div>
      <div className="start-process">
        <span>
          <b>01</b> Set the scene
        </span>
        <ArrowRight size={15} />
        <span>
          <b>02</b> Try it as an apprentice
        </span>
        <ArrowRight size={15} />
        <span>
          <b>03</b> Export and reuse
        </span>
      </div>
    </main>
  );
}
