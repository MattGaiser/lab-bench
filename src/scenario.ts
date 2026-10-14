import { checkLab, exampleLab, initialCircuit, parseLab, stepCircuit, FAULTS } from './domain.ts';
import type { Lab } from './domain.ts';

export type Proposal = { message: string; lab: Lab | null };
const text = (maxLength: number) => ({ type: 'string', minLength: 1, maxLength });
export const scenarioSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['message', 'scenario'],
  properties: {
    message: text(800),
    scenario: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'objective', 'briefing', 'durationMinutes', 'fault', 'hints'],
          properties: {
            title: text(80),
            objective: text(400),
            briefing: text(2000),
            durationMinutes: { type: 'integer', minimum: 5, maximum: 60 },
            fault: { type: 'string', enum: [...FAULTS] },
            hints: { type: 'array', maxItems: 3, items: text(300) },
          },
        },
      ],
    },
  },
};
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/** External data is untrusted even when the provider promises a schema. */
export function parseScenario(value: unknown): Proposal {
  if (
    !object(value) ||
    typeof value.message !== 'string' ||
    !value.message.trim() ||
    value.message.length > 800
  )
    throw new Error('Invalid assistant response.');
  if (value.scenario === null) return { message: value.message, lab: null };
  const s = value.scenario;
  if (!object(s)) throw new Error('Missing scenario.');
  // The provider never controls the circuit topology, version, or layout.
  const lab = parseLab(
    JSON.stringify({
      ...exampleLab(),
      title: s.title,
      objective: s.objective,
      briefing: s.briefing,
      durationMinutes: s.durationMinutes,
      fault: s.fault,
      hints: s.hints,
    }),
  );
  if (!checkLab(lab).every((check) => check.pass)) throw new Error('Incomplete scenario.');
  return { message: value.message, lab };
}

export function expectedSymptom(lab: Lab): string {
  if (lab.fault === 'start-stuck-closed')
    return 'K1 energizes as soon as the supply is on. STOP turns it off only while held; releasing STOP restarts it.';
  if (lab.fault === 'stop-stuck-closed')
    return 'K1 starts normally and stays energized after START is released. Pressing STOP has no effect; isolating the supply turns K1 off.';
  const held = stepCircuit(
    stepCircuit(initialCircuit(), 'power', lab.fault),
    'start-down',
    lab.fault,
  );
  const released = stepCircuit(held, 'start-up', lab.fault);
  return !held.coilOn
    ? 'K1 does not energize when START is held.'
    : released.coilOn
      ? 'K1 stays energized after START is released.'
      : 'K1 energizes while START is held, then drops out when released.';
}
