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
export const CONTACTS = ['stop', 'start', 'aux'] as const;
export type ContactId = (typeof CONTACTS)[number];
export type TargetId = WireId | `contact-${ContactId}`;
export type FaultCondition = 'open-wire' | 'stuck-open' | 'stuck-closed';
type FaultDetails = {
  label: string;
  target: TargetId;
  condition: FaultCondition;
  description: string;
};
export const CONTACT_FAULTS = {
  'start-stuck-open': {
    label: 'START contact stuck open',
    target: 'contact-start',
    condition: 'stuck-open',
    description: 'The START contact stays open when the button is pressed. K1 cannot pick up.',
  },
  'start-stuck-closed': {
    label: 'START contact stuck closed',
    target: 'contact-start',
    condition: 'stuck-closed',
    description:
      'The START contact stays closed after release. K1 energizes as soon as the supply is on.',
  },
  'stop-stuck-closed': {
    label: 'STOP contact stuck closed',
    target: 'contact-stop',
    condition: 'stuck-closed',
    description:
      'Pressing STOP does not open its contact. Once K1 is energized, only isolating the supply stops it.',
  },
} as const satisfies Record<string, FaultDetails>;
export type ContactFault = keyof typeof CONTACT_FAULTS;
export type FaultId = WireId | ContactFault;
export const FAULTS: FaultId[] = [...WIRES, ...(Object.keys(CONTACT_FAULTS) as ContactFault[])];
export function isWire(id: string | null): id is WireId {
  return WIRES.includes(id as WireId);
}
export function faultDetails(fault: FaultId): FaultDetails {
  return isWire(fault)
    ? {
        label: `${wireInfo[fault].tag} · ${wireInfo[fault].name} — open conductor`,
        target: fault,
        condition: 'open-wire',
        description: wireInfo[fault].description,
      }
    : CONTACT_FAULTS[fault];
}
export function targetDetails(target: TargetId): { label: string; description: string } {
  if (isWire(target))
    return {
      label: `${wireInfo[target].tag} · ${wireInfo[target].name}`,
      description: wireInfo[target].description,
    };
  const contact = target.slice(8) as ContactId;
  return {
    label: `${componentInfo[contact].label} contact`,
    description:
      contact === 'aux'
        ? 'Closes when K1 energizes to maintain the holding path.'
        : contact === 'stop'
          ? 'Normally closed. Pressing STOP should open this contact.'
          : 'Normally open. Pressing START should close this contact.',
  };
}
export function inspectTarget(target: TargetId, fault: FaultId | null) {
  const found = fault !== null && faultDetails(fault).target === target;
  if (isWire(target))
    return { faulty: found, label: found ? 'Open conductor' : 'Intact conductor' };
  if (!found) return { faulty: false, label: 'Contact opens and closes normally' };
  return {
    faulty: true,
    label:
      faultDetails(fault!).condition === 'stuck-open'
        ? 'Stuck open — does not close when pressed'
        : 'Stuck closed — does not open when operated',
  };
}
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
  schemaVersion: 2;
  template: 'start-stop';
  title: string;
  objective: string;
  briefing: string;
  durationMinutes: number;
  fault: FaultId | null;
  hints: string[];
  positions: Record<ComponentId, Point>;
};
export function exampleLab(): Lab {
  return {
    schemaVersion: 2,
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
  if (
    !isObject(data) ||
    ![1, 2].includes(data.schemaVersion as number) ||
    data.template !== 'start-stop'
  )
    throw new Error('Use a Lab Bench version 1 or 2 start/stop lab file.');
  if (
    data.fault !== null &&
    !(data.schemaVersion === 1 ? WIRES : FAULTS).includes(data.fault as WireId)
  )
    throw new Error('The file specifies an unsupported fault.');
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
    schemaVersion: 2,
    template: 'start-stop',
    title: stringField(data.title, 'Title', 80),
    objective: stringField(data.objective, 'Learning objective', 400),
    briefing: stringField(data.briefing, 'Apprentice instructions', 2000),
    durationMinutes: data.durationMinutes,
    fault: data.fault as FaultId | null,
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
      label: 'Choose a fault',
      pass: lab.fault !== null,
      detail: 'Choose an open conductor or a stuck contact in Fault setup.',
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
export function contactClosed(
  contact: ContactId,
  state: CircuitState,
  fault: FaultId | null,
): boolean {
  if (contact === 'stop') return fault === 'stop-stuck-closed' || !state.stopHeld;
  if (contact === 'start')
    return fault === 'start-stuck-closed' || (fault !== 'start-stuck-open' && state.startHeld);
  return state.coilOn;
}
/** Ideal, fixed-topology control logic. No voltage, current, motor power, or protection model. */
export function stepCircuit(
  state: CircuitState,
  action: CircuitAction,
  fault: FaultId | null,
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
    contactClosed('stop', next, fault) &&
    commonPath &&
    ((contactClosed('start', next, fault) && fault !== 'start') ||
      (state.coilOn && fault !== 'hold'));
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
