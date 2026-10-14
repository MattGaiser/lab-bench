export const COMPONENTS = ['stop', 'start', 'aux', 'coil'] as const;
export type ComponentId = (typeof COMPONENTS)[number];
export type Point = { x: number; y: number };
export const WIRES = ['supply', 'start', 'hold', 'coil', 'return'] as const;
export type WireId = (typeof WIRES)[number];
export const wireInfo: Record<WireId, { tag: string; name: string; description: string }> = {
  supply: {
    tag: 'W1',
    name: 'Supply conductor',
    description: 'Between +24 V and the STOP contact.',
  },
  start: { tag: 'W2', name: 'Start branch', description: 'Between the branch junction and START.' },
  hold: {
    tag: 'W3',
    name: 'Holding branch',
    description: 'Between the branch junction and the K1 auxiliary contact.',
  },
  coil: {
    tag: 'W4',
    name: 'Coil conductor',
    description: 'Between the branch junction and the K1 coil.',
  },
  return: { tag: 'W5', name: 'Return conductor', description: 'Between the K1 coil and 0 V.' },
};
export const componentInfo: Record<ComponentId, { label: string; detail: string }> = {
  stop: { label: 'STOP', detail: 'Normally closed' },
  start: { label: 'START', detail: 'Normally open' },
  aux: { label: 'K1 AUX', detail: 'Holding contact · NO' },
  coil: { label: 'K1 COIL', detail: 'Contactor coil' },
};
export const bounds: Record<
  ComponentId,
  { minX: number; maxX: number; minY: number; maxY: number }
> = {
  stop: { minX: 180, maxX: 250, minY: 220, maxY: 290 },
  start: { minX: 420, maxX: 500, minY: 140, maxY: 190 },
  aux: { minX: 420, maxX: 500, minY: 350, maxY: 410 },
  coil: { minX: 700, maxX: 740, minY: 220, maxY: 290 },
};
export function constrain(id: ComponentId, point: Point): Point {
  const b = bounds[id];
  return {
    x: Math.max(b.minX, Math.min(b.maxX, Math.round(point.x / 10) * 10)),
    y: Math.max(b.minY, Math.min(b.maxY, Math.round(point.y / 10) * 10)),
  };
}
export type Lab = {
  schemaVersion: 1;
  template: 'start-stop';
  title: string;
  objective: string;
  briefing: string;
  durationMinutes: number;
  fault: WireId | null;
  hints: string[];
  positions: Record<ComponentId, Point>;
};
export function exampleLab(): Lab {
  return {
    schemaVersion: 1,
    template: 'start-stop',
    title: "The motor won't stay on",
    objective:
      'Find the open conductor and explain why the contactor drops out when START is released.',
    briefing:
      'A pump starts while the START button is held, but stops as soon as it is released. Explore the control circuit, isolate the supply, and inspect the conductors. Identify the fault and explain the role of the holding contact.',
    durationMinutes: 15,
    fault: 'hold',
    hints: [
      'What should keep K1 energized after START is released?',
      'Trace the path through the K1 auxiliary contact.',
    ],
    positions: {
      stop: { x: 220, y: 260 },
      start: { x: 450, y: 170 },
      aux: { x: 450, y: 380 },
      coil: { x: 710, y: 260 },
    },
  };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
function stringField(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || value.length > max)
    throw new Error(`${label} must be text of at most ${max} characters.`);
  return value;
}
export const MAX_FILE_BYTES = 64 * 1024;
/** Parse into a new canonical object. Drafts may be incomplete; readiness is a separate check. */
export function parseLab(text: string): Lab {
  if (new TextEncoder().encode(text).length > MAX_FILE_BYTES)
    throw new Error('This file is too large. Lab files must be under 64 KB.');
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This is not a valid JSON lab file.');
  }
  if (!isObject(data) || data.schemaVersion !== 1 || data.template !== 'start-stop')
    throw new Error('Use a Lab Bench version 1 start/stop lab file.');
  if (data.fault !== null && !WIRES.includes(data.fault as WireId))
    throw new Error('The fault refers to an unknown conductor.');
  if (
    typeof data.durationMinutes !== 'number' ||
    !Number.isInteger(data.durationMinutes) ||
    data.durationMinutes < 5 ||
    data.durationMinutes > 60
  )
    throw new Error('Duration must be a whole number between 5 and 60 minutes.');
  if (!Array.isArray(data.hints) || data.hints.length > 3)
    throw new Error('A lab can contain up to three hints.');
  if (!isObject(data.positions)) throw new Error('Circuit component positions are missing.');
  const positions = {} as Record<ComponentId, Point>;
  for (const id of COMPONENTS) {
    const point = data.positions[id];
    const b = bounds[id];
    if (
      !isObject(point) ||
      typeof point.x !== 'number' ||
      typeof point.y !== 'number' ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      point.x < b.minX ||
      point.x > b.maxX ||
      point.y < b.minY ||
      point.y > b.maxY
    )
      throw new Error(`The ${componentInfo[id].label} position is outside its layout area.`);
    positions[id] = { x: point.x, y: point.y };
  }
  return {
    schemaVersion: 1,
    template: 'start-stop',
    title: stringField(data.title, 'Title', 80),
    objective: stringField(data.objective, 'Learning objective', 400),
    briefing: stringField(data.briefing, 'Apprentice instructions', 2000),
    durationMinutes: data.durationMinutes,
    fault: data.fault as WireId | null,
    hints: data.hints.map((h) => stringField(h, 'Hint', 300)),
    positions,
  };
}
export type Check = {
  id: 'title' | 'objective' | 'briefing' | 'fault' | 'hints';
  label: string;
  pass: boolean;
  detail: string;
};
export function checkLab(lab: Lab): Check[] {
  return [
    {
      id: 'title',
      label: 'Give the exercise a name',
      pass: lab.title.trim().length > 0,
      detail: 'A title helps instructors find and reuse this lab.',
    },
    {
      id: 'objective',
      label: 'Set a learning objective',
      pass: lab.objective.trim().length > 0,
      detail: 'Describe what the apprentice should be able to explain.',
    },
    {
      id: 'briefing',
      label: 'Write apprentice instructions',
      pass: lab.briefing.trim().length > 0,
      detail: 'Provide a symptom and a clear task to work through.',
    },
    {
      id: 'fault',
      label: 'Choose one open conductor',
      pass: lab.fault !== null,
      detail: 'Select a conductor on the canvas to place a fault.',
    },
    {
      id: 'hints',
      label: 'Finish any hints you added',
      pass: lab.hints.every((h) => h.trim().length > 0),
      detail: 'Write a hint or remove the empty field. Hints are optional.',
    },
  ];
}
export function serializeLab(lab: Lab): string {
  return JSON.stringify(parseLab(JSON.stringify(lab)), null, 2) + '\n';
}

export type CircuitState = {
  powered: boolean;
  startHeld: boolean;
  stopHeld: boolean;
  coilOn: boolean;
};
export type CircuitAction =
  'power' | 'start-down' | 'start-up' | 'stop-down' | 'stop-up' | 'release';
export const initialCircuit = (): CircuitState => ({
  powered: false,
  startHeld: false,
  stopHeld: false,
  coilOn: false,
});
/** Ideal, fixed-topology control logic. No voltage, current, motor power, or protection model. */
export function stepCircuit(
  state: CircuitState,
  action: CircuitAction,
  fault: WireId | null,
): CircuitState {
  const next = { ...state };
  if (action === 'power') {
    next.powered = !state.powered;
    next.startHeld = false;
    next.stopHeld = false;
  }
  if (action === 'start-down') next.startHeld = true;
  if (action === 'start-up') next.startHeld = false;
  if (action === 'stop-down') next.stopHeld = true;
  if (action === 'stop-up') next.stopHeld = false;
  if (action === 'release') {
    next.startHeld = false;
    next.stopHeld = false;
  }
  const commonPath = !['supply', 'coil', 'return'].includes(fault ?? '');
  next.coilOn =
    next.powered &&
    !next.stopHeld &&
    commonPath &&
    ((next.startHeld && fault !== 'start') || (state.coilOn && fault !== 'hold'));
  return next;
}

export type History = { past: Lab[]; present: Lab; future: Lab[]; group?: string };
export type Edit =
  { type: 'replace'; lab: Lab; group?: string } | { type: 'undo' | 'redo' | 'end-group' };
export function historyReducer(history: History, edit: Edit): History {
  if (edit.type === 'end-group') return { ...history, group: undefined };
  if (edit.type === 'undo') {
    if (!history.past.length) return history;
    return {
      past: history.past.slice(0, -1),
      present: history.past.at(-1)!,
      future: [history.present, ...history.future],
    };
  }
  if (edit.type === 'redo') {
    if (!history.future.length) return history;
    return {
      past: [...history.past, history.present],
      present: history.future[0],
      future: history.future.slice(1),
    };
  }
  if (edit.type === 'replace') {
    if (JSON.stringify(edit.lab) === JSON.stringify(history.present)) return history;
    return {
      past:
        edit.group && history.group === edit.group
          ? history.past
          : [...history.past.slice(-49), history.present],
      present: edit.lab,
      future: [],
      group: edit.group,
    };
  }
  return history;
}
