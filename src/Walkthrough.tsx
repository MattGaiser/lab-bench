import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Compass, X } from 'lucide-react';

const steps = [
  {
    target: '.inspector',
    title: 'Start with what they should learn.',
    label: 'THE BRIEF',
    body: 'Give the lab a title, a learning objective, and a symptom to investigate. Set a duration and add hints that apprentices can reveal one at a time.',
    tip: 'The sample starts with a pump that stops when START is released.',
  },
  {
    target: '.circuit-panel',
    title: 'This is your teaching bench.',
    label: 'THE CIRCUIT',
    body: 'Select a labeled conductor (W1–W5) to inspect its role. Drag components to tidy the layout. Zoom, pan, and undo are in the toolbar.',
    tip: 'The circuit is already wired: STOP, START, a K1 coil, and its holding contact. You don’t need to draw it.',
  },
  {
    target: '.inspector',
    title: 'Choose what goes wrong.',
    label: 'THE CHALLENGE',
    body: 'Select a conductor here or on the canvas, then choose “Place open fault here.” The expected response tells you how that fault changes the circuit.',
    tip: 'An open W3 holding branch lets K1 energize while START is held, but it drops out when released.',
  },
  {
    target: '.control-station',
    title: 'Try it from their side.',
    label: 'THE APPRENTICE EXPERIENCE',
    body: 'In preview, turn the supply on, then hold and release START. Isolate the supply before inspecting a conductor. Apprentices select the fault and write an explanation.',
    tip: 'This tour is showing a temporary sample preview. Your draft stays untouched; the fault marker is hidden from apprentices.',
  },
  {
    target: '.inspector',
    title: 'Check it, then make it reusable.',
    label: 'READY FOR ANOTHER REP',
    body: 'Review checks the brief and fault are complete. Test the apprentice preview, then export a lab file. Import brings the exact exercise back, including your layout and hints.',
    tip: 'Lab files include the instructor answer. They are reusable authoring files, not secure student assignments.',
  },
];
export default function Walkthrough({
  step,
  onStep,
  onClose,
}: {
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [rect, setRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
  const current = steps[step];
  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    return () => el.close();
  }, []);
  useEffect(() => {
    const target = document.querySelector(current.target);
    if (!target) return;
    // Keep the upper part of tall panels visible above the mobile coach card.
    const y = target.getBoundingClientRect().top + window.scrollY - 20;
    window.scrollTo({ top: Math.max(0, y), behavior: 'instant' });
    const update = () => {
      const r = target.getBoundingClientRect();
      setRect({ left: r.left - 5, top: r.top - 5, width: r.width + 10, height: r.height + 10 });
    };
    update();
    heading.current?.focus({ preventScroll: true });
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [current]);
  return (
    <dialog
      ref={dialog}
      className="walkthrough"
      aria-labelledby="tour-title"
      aria-describedby="tour-body"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="tour-spotlight" style={rect} aria-hidden="true" />
      <div className={`tour-card ${step === 1 || step === 3 ? 'tour-card-right' : ''}`}>
        <div className="tour-top">
          <span>
            <Compass size={17} />
            {current.label}
          </span>
          <button className="icon-button" onClick={onClose} aria-label="Close walkthrough">
            <X size={19} />
          </button>
        </div>
        <div
          className="tour-progress"
          role="img"
          aria-label={`Step ${step + 1} of ${steps.length}`}
        >
          {steps.map((_, i) => (
            <span key={i} className={i <= step ? 'done' : ''} />
          ))}
        </div>
        <h2 ref={heading} id="tour-title" tabIndex={-1}>
          {current.title}
        </h2>
        <p id="tour-body">{current.body}</p>
        <p className="tour-tip">{current.tip}</p>
        <div className="tour-actions">
          <button className="text-button" onClick={step ? () => onStep(step - 1) : onClose}>
            {step ? <ArrowLeft size={15} /> : null}
            {step ? 'Back' : 'Skip tour'}
          </button>
          <span>
            {step + 1} / {steps.length}
          </span>
          <button
            className="button primary"
            onClick={step === steps.length - 1 ? onClose : () => onStep(step + 1)}
          >
            {step === steps.length - 1 ? 'Start building' : 'Next'}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </dialog>
  );
}
