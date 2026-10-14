# Lab Bench design system

Lab Bench uses a compact interface system built for a technical authoring workflow. The UI should feel calm and precise while keeping the circuit, the current task, and the next action easy to find.

## Foundations

The semantic custom properties at the top of `src/styles.css` are the shared source for product UI. They cover surfaces, text, actions, borders, status colors, type roles, radii, focus, and shadows. Add or reuse a semantic role instead of introducing another near-match. Circuit-specific colors may stay local because they communicate electrical state.

Edit existing component rules and their responsive variants before adding another override. Remove declarations superseded at every viewport. Keep source lint exceptions scoped to the relevant file: the SVG circuit uses keyboard-interactive groups and a focusable scroll region, while ordinary interface elements use the standard accessibility rules.

## Component rules

- Primary buttons advance or complete the current task. Secondary buttons perform useful side actions. Text buttons handle navigation or low-emphasis actions.
- Feature cards use the feature radius and shadow. Workbench panels use the smaller card radius and card shadow. Nested disclosures use the control radius and no shadow.
- Body copy explains the task in complete sentences. Labels name the field or action directly. Status text reports what changed or what the user should do next.
- Every action provides visible feedback through a state change, inline status, or notification. Destructive or unavailable actions explain how to recover.
- Focus indicators use the shared focus color. Controls keep visible labels, keyboard behavior, and at least a 40-pixel primary target height.
- Desktop layouts keep controls beside the work they affect. Mobile layouts preserve the same reading order and allow the circuit to scroll horizontally.

## Review checklist

Before shipping a UI change, check the walkthrough, start choice, editor, all three authoring tabs, apprentice preview, notifications, dialogs, and recovery states at desktop and mobile widths. Run `npm run check` and the full browser suite, then inspect screenshots for hierarchy, spacing, overflow, and action feedback.
