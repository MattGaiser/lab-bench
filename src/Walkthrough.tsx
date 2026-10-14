import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Check, Compass, FileDown, Lightbulb } from 'lucide-react';

const slides = [
  {
    title: 'Let’s walk the bench.',
    label: 'WELCOME TO LAB BENCH',
    body: 'Create a troubleshooting exercise for your apprentices. Choose a fault, write the instructions, then test the circuit before sharing the lab.',
    detail:
      'You’ll work with a ready-wired start/stop circuit. These five cards explain the process before you choose a sample or ask AI to draft a lesson.',
  },
  {
    title: 'Write the apprentice’s instructions.',
    label: '01 / WRITE THE BRIEF',
    body: 'Give the lab a title, describe the symptom, and explain what the apprentice should investigate. Add a learning objective, a duration, and optional hints.',
    detail:
      'Apprentices see these instructions in preview. The fault marker is hidden, so keep the answer out of your brief and let them work it out.',
  },
  {
    title: 'Choose one open conductor.',
    label: '02 / SET THE FAULT',
    body: 'Select a conductor, labeled W1–W5, then choose “Place open fault here.” An open conductor is a break in the path that carries current.',
    detail:
      'In the sample, W3 is the holding branch. It normally keeps the K1 contactor energized after START is released. Opening W3 makes K1 switch off when you let go.',
  },
  {
    title: 'Test the lab as an apprentice.',
    label: '03 / RUN A PRACTICE ATTEMPT',
    body: 'Open Apprentice preview, turn the simulated supply on, then hold and release START. Check that the circuit behaves as your instructions describe.',
    detail:
      'Next, isolate the supply and inspect a conductor. The apprentice selects the faulty conductor and explains what it changes. Preview leaves your lab draft unchanged.',
  },
  {
    title: 'Export a reusable lab file.',
    label: '04 / SAVE AND REUSE',
    body: 'Review checks that the brief and fault are complete. Export downloads a .lab.json file containing your instructions, fault, hints, and circuit layout.',
    detail:
      'Import reopens the same exercise on this or another device. The file includes the instructor’s answer, so share it with instructors rather than using it as a secure student assignment.',
  },
];
function Illustration({ step }: { step: number }) {
  if (step === 1)
    return (
      <div className="guide-note">
        <span className="guide-note-icon">
          <Lightbulb size={22} />
        </span>
        <span className="overline">THE APPRENTICE’S BRIEF</span>
        <strong>
          “The pump runs while START is held.
          <br />
          Why does it stop when you let go?”
        </strong>
        <span className="guide-note-caption">Example instructions for a holding-circuit lab</span>
      </div>
    );
  if (step === 3)
    return (
      <div className="guide-observation">
        <div>
          <span className="demo-start">START</span>
          <span>Hold the button</span>
          <strong>
            <i className="demo-light lit" />
            K1 energizes
          </strong>
        </div>
        <ArrowRight size={22} />
        <div>
          <span className="demo-start released">START</span>
          <span>Release the button</span>
          <strong>
            <i className="demo-light" />
            K1 drops out
          </strong>
        </div>
        <p>Example: an open holding branch</p>
      </div>
    );
  if (step === 4)
    return (
      <div className="guide-file">
        <FileDown size={35} strokeWidth={1.4} />
        <strong>Holding circuit.lab.json</strong>
        <span>
          <Check size={15} />
          Brief, fault, hints, and layout
        </span>
        <p>Reusable instructor file · includes the answer</p>
      </div>
    );
  return (
    <svg
      className="guide-diagram"
      viewBox="0 0 560 210"
      role="img"
      aria-label={
        step === 0
          ? 'A prepared start and stop circuit with a holding branch'
          : 'An open gap in the W3 holding branch'
      }
    >
      <path
        d="M60 42V173 M500 42V173 M60 100H180 M180 100V55H340V100H500 M180 100V155H340V100"
        fill="none"
        stroke="#6c8976"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect x="84" y="78" width="66" height="44" rx="9" fill="#fffefa" stroke="#9caf98" />
      <text x="117" y="104">
        STOP
      </text>
      <rect x="224" y="33" width="72" height="44" rx="9" fill="#fffefa" stroke="#9caf98" />
      <text x="260" y="59">
        START
      </text>
      <rect x="224" y="133" width="72" height="44" rx="9" fill="#fffefa" stroke="#9caf98" />
      <text x="260" y="159">
        K1 AUX
      </text>
      <rect x="389" y="78" width="72" height="44" rx="9" fill="#fffefa" stroke="#9caf98" />
      <text x="425" y="104">
        K1 COIL
      </text>
      <circle cx="180" cy="100" r="4" fill="#6c8976" />
      <circle cx="340" cy="100" r="4" fill="#6c8976" />
      {step === 2 && (
        <>
          <path d="M180 113V139" stroke="#edf2e6" strokeWidth="9" />
          <path d="M180 113L191 132" stroke="#a55b16" strokeWidth="3" />
          <circle cx="180" cy="139" r="3" fill="#a55b16" />
          <text x="142" y="158" fill="#8b501c">
            W3 OPEN
          </text>
        </>
      )}
    </svg>
  );
}
export default function Walkthrough({
  step,
  active,
  onStep,
  onFinish,
  onResume,
}: {
  step: number;
  active: boolean;
  onStep: (step: number) => void;
  onFinish: () => void;
  onResume?: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (active) {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    }
  }, [step, active]);
  const slide = slides[step];
  return (
    <>
      <section className="guide-card" aria-labelledby="guide-title">
        <div className="guide-art" aria-label="Illustrated example">
          <Illustration step={step} />
        </div>
        <div className="guide-copy" key={step}>
          <span className="overline">{slide.label}</span>
          <h1 id="guide-title" ref={heading} tabIndex={-1}>
            {slide.title}
          </h1>
          <p>{slide.body}</p>
          <p className="guide-detail">{slide.detail}</p>
        </div>
        <nav className="guide-navigation" aria-label="Walkthrough pages">
          <button className="text-button" onClick={step ? () => onStep(step - 1) : onFinish}>
            {step ? <ArrowLeft size={16} /> : null}
            {step ? 'Back' : 'Skip intro'}
          </button>
          <span
            className="guide-pagination"
            aria-label={`Page ${step + 1} of ${slides.length}`}
            role="img"
          >
            {slides.map((_, i) => (
              <i key={i} className={i === step ? 'current' : ''} />
            ))}
          </span>
          <button
            className="button primary"
            onClick={step === slides.length - 1 ? onFinish : () => onStep(step + 1)}
          >
            {step === 0 ? 'Let’s begin' : step === slides.length - 1 ? 'Create a lab' : 'Next'}
            <ArrowRight size={16} />
          </button>
        </nav>
      </section>
      <div className="guide-footnote">
        {onResume ? (
          <button className="text-button" onClick={onResume}>
            Resume current draft
            <ArrowRight size={14} />
          </button>
        ) : (
          <span>
            <Compass size={14} />
            Five cards · Your saved draft stays unchanged
          </span>
        )}
      </div>
    </>
  );
}
