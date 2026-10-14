import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  LoaderCircle,
  Send,
  Sparkles,
  Unplug,
} from 'lucide-react';
import { checkLab, parseLab, wireInfo } from './domain';
import type { Lab } from './domain';
import { expectedSymptom } from './scenario';
import type { Proposal } from './scenario';
import Walkthrough from './Walkthrough';
import { revealAboveFooter } from './focus';

type Props = {
  lab: Lab;
  hasDraft: boolean;
  active: boolean;
  guideRequest: number;
  onResume: () => void;
  onSample: () => void;
  onApply: (lab: Lab) => void;
  onImport: () => void;
};
type Page = 'guide' | 'choice' | 'compose' | 'review';
export default function StartPage({
  lab,
  hasDraft,
  active,
  guideRequest,
  onResume,
  onSample,
  onApply,
  onImport,
}: Props) {
  const [page, setPage] = useState<Page>('guide');
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<'sample' | 'ai'>('sample');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState('');
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [context, setContext] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const lastLab = useRef<Lab | null>(null);
  const request = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    setPage('guide');
    setStep(0);
  }, [guideRequest]);
  useLayoutEffect(() => {
    if (!active || page !== 'compose') {
      request.current?.abort();
      request.current = null;
      setBusy(false);
    }
    if (active && page !== 'guide') {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }
  }, [active, page]);
  useEffect(() => {
    if (!active || page !== 'compose') return;
    const controller = new AbortController();
    fetch('/api/assistant/status', {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((v) => {
        if (!controller.signal.aborted) setAvailable(v?.available === true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailable(false);
      });
    return () => controller.abort();
  }, [active, page]);
  useEffect(() => () => request.current?.abort(), []);
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
      setProposal({ message: data.message, lab: next });
      setPrompt('');
      if (next) setPage('review');
      else requestAnimationFrame(() => input.current?.focus());
    } catch (err) {
      if (!controller.signal.aborted)
        setError(
          err instanceof Error && err.name !== 'TimeoutError'
            ? err.message
            : 'This is taking too long. Try again or use the sample.',
        );
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }
  const back = () => setPage(page === 'compose' && proposal?.lab ? 'review' : 'choice');
  return (
    <main className="start-page">
      {page === 'guide' ? (
        <Walkthrough
          step={step}
          active={active}
          onStep={setStep}
          onFinish={() => setPage('choice')}
          onResume={hasDraft ? onResume : undefined}
        />
      ) : (
        <>
          <section
            className={`flow-card ${page === 'review' ? 'review-flow' : ''}`}
            aria-labelledby="flow-title"
            onFocusCapture={(event) => {
              if (page === 'review') revealAboveFooter(event, '.flow-review-actions');
            }}
          >
            <div className="flow-topline">
              <button
                className="text-button"
                onClick={
                  page === 'choice'
                    ? () => {
                        setStep(4);
                        setPage('guide');
                      }
                    : back
                }
              >
                <ArrowLeft size={16} />
                {page === 'choice'
                  ? 'Back to walkthrough'
                  : page === 'compose' && proposal?.lab
                    ? 'Back to review'
                    : 'Back to choices'}
              </button>
            </div>
            {page === 'choice' && (
              <>
                <h1 id="flow-title" ref={heading} tabIndex={-1}>
                  How would you like to start?
                </h1>
                <p className="flow-intro">
                  Use the sample to learn the editor, or describe a teaching goal and review an AI
                  draft. Both use the same start/stop circuit; you can edit the brief, fault, and
                  hints.
                </p>
                <fieldset className="start-choice">
                  <legend className="visually-hidden">Starting point</legend>
                  <label className={choice === 'sample' ? 'selected' : ''}>
                    <input
                      type="radio"
                      name="start-choice"
                      value="sample"
                      checked={choice === 'sample'}
                      onChange={() => setChoice('sample')}
                    />
                    <BookOpen size={24} />
                    <span>
                      <strong>Explore a ready-made lab</strong>
                      <small>
                        A 15-minute beginner exercise: find why the contactor switches off when
                        START is released. Includes a brief and two hints.
                      </small>
                    </span>
                  </label>
                  <label className={choice === 'ai' ? 'selected' : ''}>
                    <input
                      type="radio"
                      name="start-choice"
                      value="ai"
                      checked={choice === 'ai'}
                      onChange={() => setChoice('ai')}
                    />
                    <Sparkles size={24} />
                    <span>
                      <strong>Describe my own lesson</strong>
                      <small>
                        Tell AI who you’re teaching and what they should learn. Review its proposed
                        instructions and fault before using them.
                      </small>
                    </span>
                  </label>
                </fieldset>
                <button
                  className="button primary full flow-continue"
                  onClick={() =>
                    choice === 'sample' ? onSample() : setPage(proposal?.lab ? 'review' : 'compose')
                  }
                >
                  {choice === 'sample' ? 'Open sample editor' : 'Continue'}
                  <ArrowRight size={17} />
                </button>
                {hasDraft && choice === 'sample' && (
                  <p className="proposal-note">
                    Loading the sample replaces your draft. Undo brings it back.
                  </p>
                )}
                <details className="other-starts">
                  <summary>Import a saved lab file</summary>
                  <button className="text-button" onClick={onImport}>
                    Import a lab file
                    <ArrowRight size={14} />
                  </button>
                </details>
              </>
            )}
            {page === 'compose' && (
              <>
                <h1 id="flow-title" ref={heading} tabIndex={-1}>
                  {proposal?.lab
                    ? 'Revise the proposed lab.'
                    : proposal
                      ? 'Reply to the assistant.'
                      : 'Describe your troubleshooting lesson.'}
                </h1>
                <p className="flow-intro">
                  Include the learners’ experience, the symptom to investigate, and the time
                  available. AI will suggest a brief, one open-conductor fault, and optional hints.
                  You’ll review them on the next screen.
                </p>
                {proposal && (
                  <p className="assistant-reply" role="status">
                    {proposal.message}
                  </p>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                >
                  <label className="field scenario-field">
                    <span>
                      {proposal?.lab
                        ? 'What would you like to change?'
                        : proposal
                          ? 'How would you like to continue?'
                          : 'What should your apprentices learn?'}
                    </span>
                    <textarea
                      ref={input}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      maxLength={2000}
                      rows={4}
                      disabled={busy}
                      placeholder="A 15-minute beginner lab about a pump that stops when START is released. Help apprentices understand the holding contact."
                    />
                  </label>
                  {!proposal && (
                    <button
                      className="text-button example-prompt"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setPrompt(
                          'Create a 15-minute beginner lab about a pump that runs only while START is held. Teach the role of the holding contact and include two hints.',
                        );
                        input.current?.focus();
                      }}
                    >
                      Use this example
                      <ArrowRight size={14} />
                    </button>
                  )}
                  <div className="assistant-submit">
                    <span role="status">
                      {busy
                        ? 'Drafting your scenario…'
                        : available === false
                          ? 'AI is unavailable on this server'
                          : available === null
                            ? 'Checking assistant…'
                            : 'Nothing changes until you choose “Use this lab.”'}
                    </span>
                    {busy ? (
                      <button
                        type="button"
                        className="button secondary"
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
                      <button
                        className="button primary"
                        disabled={!prompt.trim() || available !== true}
                      >
                        <Send size={16} />
                        {proposal?.lab
                          ? 'Revise scenario'
                          : proposal
                            ? 'Send reply'
                            : 'Draft my lab'}
                      </button>
                    )}
                  </div>
                  {error && (
                    <p className="assistant-error" role="alert">
                      {error} Your current lab is unchanged.
                    </p>
                  )}
                  {available === false && (
                    <div className="assistant-offline">
                      <p>
                        The sample works without AI. You can write your own brief in the editor.
                      </p>
                      <button type="button" className="text-button" onClick={onSample}>
                        Open sample editor
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </form>
                <details className="assistant-privacy">
                  <summary>What gets sent to AI?</summary>
                  <p>
                    Your request, the two most recent exchanges, and the previous proposal are sent
                    to OpenAI when you submit. This builder supports one start/stop circuit with a
                    single open conductor.
                  </p>
                </details>
              </>
            )}
            {page === 'review' && proposal?.lab && (
              <>
                <span className="proposal-duration">
                  <Clock3 size={15} />
                  {proposal.lab.durationMinutes} minutes
                </span>
                <h1 id="flow-title" ref={heading} tabIndex={-1}>
                  {proposal.lab.title}
                </h1>
                <p className="flow-intro">{proposal.lab.objective}</p>
                <details className="disclosure proposal-brief">
                  <summary>
                    <span>Apprentice brief</span>
                  </summary>
                  <div className="disclosure-body">
                    <p>{proposal.lab.briefing}</p>
                  </div>
                </details>
                <dl className="proposal-facts">
                  <div className="answer-fact">
                    <dt>Instructor answer</dt>
                    <dd>
                      <Unplug size={15} />
                      Open {wireInfo[proposal.lab.fault!].tag} ·{' '}
                      {wireInfo[proposal.lab.fault!].name}
                    </dd>
                  </div>
                  <div>
                    <dt>Expected circuit behavior</dt>
                    <dd>{expectedSymptom(proposal.lab)}</dd>
                  </div>
                </dl>
                {proposal.lab.hints.length > 0 && (
                  <details className="proposal-hints disclosure">
                    <summary>
                      <span>Hints</span>
                      <small>{proposal.lab.hints.length} included</small>
                    </summary>
                    <ol className="disclosure-body">
                      {proposal.lab.hints.map((hint, i) => (
                        <li key={i}>{hint}</li>
                      ))}
                    </ol>
                  </details>
                )}
                <div className="flow-review-actions">
                  <button className="button secondary" onClick={() => setPage('compose')}>
                    Make a change
                  </button>
                  <button className="button primary" onClick={() => onApply(proposal.lab!)}>
                    <Check size={16} />
                    Use this lab
                    <ArrowRight size={16} />
                  </button>
                </div>
                <p className="proposal-note">
                  {hasDraft
                    ? `Replaces “${lab.title || 'Untitled exercise'}”. Undo brings it back.`
                    : 'Opens the editor with the circuit, fault, and brief set up.'}
                </p>
              </>
            )}
          </section>
          <div className="guide-footnote">
            {hasDraft && (
              <button className="text-button" onClick={onResume}>
                Resume current draft
                <ArrowRight size={14} />
              </button>
            )}
            <button
              className="text-button"
              onClick={() => {
                setStep(0);
                setPage('guide');
              }}
            >
              Walk me through it again
            </button>
          </div>
        </>
      )}
    </main>
  );
}
