# Product decisions

## The problem and the evidence

An instructor has a teaching idea: “Why does this contactor drop out when START is released?” Turning that into a repeatable lab requires a circuit, a deliberate fault, a clear brief, and confidence that learners will see the intended symptom.

Dakota's [public educator page](https://www.dakotaprep.com/schools) describes custom labs built from a selected circuit, a fault, and instructor instructions. The supplied design-engineer role emphasizes owning interactions and authoring features while another engineer owns the simulator engine. That suggests a useful work sample at the boundary between the instructor's intent and a known circuit model.

The instructor pain points here are **hypotheses from that public workflow**, not findings from customer interviews. No access to Dakota's software or private curriculum was used.

## One complete loop

Lab Bench answers one question: can an instructor make and verify a focused troubleshooting exercise?

The starting point is an editable sample, so the instructor can immediately see what a finished exercise looks like. The canvas and fault inspector remain together. Brief writing has its own panel, and a readiness panel gives actionable checks. Apprentice preview uses a cloned snapshot, so a practice attempt cannot mutate the instructor's draft.

Export is the completion boundary. The instructor gets a versioned file containing the configured exercise and can verify it by importing it into a fresh browser context. There is no decorative assignment button that implies a class received it.

## Interaction decisions

| Decision                                        | Reason                                                                                                           | Tradeoff                                                          |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| A known circuit template                        | Gives instructors a useful starting point and keeps the engine contract explicit.                                | Arbitrary circuits and wiring are outside scope.                  |
| Select a conductor, then place a fault          | Selection is exploratory; mutation is deliberate. Choosing another wire does not move the fault until requested. | Adds one click to changing a fault.                               |
| Bounded component movement                      | Demonstrates a spatial editor without allowing unreadable overlaps or suggesting layout changes connectivity.    | Layout freedom is limited.                                        |
| Open-conductor faults only                      | All five fault locations have defined, testable behavior.                                                        | No shorts, resistive faults, or protection simulation.            |
| Press-and-hold controls                         | Makes the distinction between starting and sealing-in visible.                                                   | Requires pointer cancellation, focus-loss, and keyboard handling. |
| Model inspection, not fabricated meter readings | Learners can distinguish fault locations without implying an accurate measurement engine.                        | The preview exercises diagnosis, not meter technique.             |
| Written explanation is not auto-graded          | Instructors need to judge the learner's reasoning; no evidence supports automated grading here.                  | It remains a discussion prompt in the preview.                    |
| Browser-local draft plus portable file          | Produces a runnable, inspectable sample without speculative infrastructure or accounts.                          | No cross-device sync or managed assignments.                      |

## State and failure boundaries

File parsing validates the schema version, template identity, field types and lengths, fault identity, duration, hint limits, and every component position before producing a canonical object. A draft may be incomplete; export and preview require the authoring checks to pass. Text is rendered by React, never inserted as HTML.

Imports capture the current draft before reading the file. If the draft changes during that asynchronous read, the result is rejected instead of overwriting newer work. A successful import is a single undoable edit. Typing into one field is grouped until blur; a drag commits once on release and is canceled by Escape or pointer cancellation.

Draft saves are debounced. A write checks that storage still contains the last value this tab read. Web Locks serialize Lab Bench writes where supported; without them, the compare-before-write check is best effort rather than an atomic cross-tab transaction. Storage events surface changes from another tab. The user can download their copy, load the saved draft, or explicitly choose to replace it.

Unreadable stored data is preserved until the user chooses a replacement. Storage denial and quota failures leave the editor usable and offer a downloadable draft. The page warns before leaving when changes have not been saved.

## The next product questions

Before adding circuit types or assignment features, watch instructors author an exercise from their own teaching notes:

1. Can they create a coherent brief and fault without help?
2. Do they use preview to catch a mismatch between the written symptom and the selected fault?
3. Are progressive hints useful, and when do instructors want them to appear?
4. What evidence do instructors need to review an apprentice's reasoning?

Measure unassisted completion and where people pause or revise, rather than treating export clicks as proof of learning. The next engineering integration would connect the versioned exercise to the real simulator's supported template/fault contract and a program's assignment system. That work should follow observed needs and domain review.
