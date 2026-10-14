import { describe, expect, it } from 'vitest';
import {
  checkLab,
  constrain,
  exampleLab,
  historyReducer,
  initialCircuit,
  parseLab,
  serializeLab,
  stepCircuit,
  WIRES,
  CONTACT_FAULTS,
  contactClosed,
  faultDetails,
  inspectTarget,
} from './domain';
import type { ContactFault, History } from './domain';
import { parseScenario, scenarioSchema, expectedSymptom } from './scenario';
import { DRAFT_KEY, loadDraft, saveDraft } from './storage';

describe('start/stop control model', () => {
  it('seals in after release, stops on STOP, and does not restart after STOP is released', () => {
    let s = stepCircuit(initialCircuit(), 'power', null);
    s = stepCircuit(s, 'start-down', null);
    expect(s.coilOn).toBe(true);
    s = stepCircuit(s, 'start-up', null);
    expect(s.coilOn).toBe(true);
    s = stepCircuit(s, 'stop-down', null);
    expect(s.coilOn).toBe(false);
    s = stepCircuit(s, 'stop-up', null);
    expect(s.coilOn).toBe(false);
  });
  it.each(WIRES)('models the open %s conductor consistently', (fault) => {
    let s = stepCircuit(initialCircuit(), 'power', fault);
    s = stepCircuit(s, 'start-down', fault);
    expect(s.coilOn).toBe(fault === 'hold');
    s = stepCircuit(s, 'start-up', fault);
    expect(s.coilOn).toBe(false);
  });
  it('makes STOP dominant when both buttons are held', () => {
    let s = stepCircuit(initialCircuit(), 'power', null);
    s = stepCircuit(s, 'start-down', null);
    s = stepCircuit(s, 'stop-down', null);
    expect(s.coilOn).toBe(false);
    s = stepCircuit(s, 'start-down', null);
    expect(s.coilOn).toBe(false);
  });
  it('drops the seal-in on power loss without restarting on restored power', () => {
    let s = stepCircuit(initialCircuit(), 'power', null);
    s = stepCircuit(s, 'start-down', null);
    s = stepCircuit(s, 'start-up', null);
    s = stepCircuit(s, 'power', null);
    expect(s.coilOn).toBe(false);
    s = stepCircuit(s, 'power', null);
    expect(s.coilOn).toBe(false);
  });
  it('releases a held START when the pointer session is canceled', () => {
    let s = stepCircuit(initialCircuit(), 'power', 'hold');
    s = stepCircuit(s, 'start-down', 'hold');
    expect(s.coilOn).toBe(true);
    s = stepCircuit(s, 'release', 'hold');
    expect(s.startHeld).toBe(false);
    expect(s.coilOn).toBe(false);
  });
});

describe('lab file boundary', () => {
  it('upgrades version 1 drafts and files without changing exercise content', () => {
    const legacy = { ...exampleLab(), schemaVersion: 1 };
    expect(parseLab(JSON.stringify(legacy))).toEqual(exampleLab());
    expect(() => parseLab(JSON.stringify({ ...legacy, fault: 'start-stuck-closed' }))).toThrow(
      'unsupported fault',
    );
    expect(() => parseLab(JSON.stringify({ ...legacy, schemaVersion: 3 }))).toThrow();
  });
  it('round-trips the entire exercise into a fresh object', () => {
    const lab = exampleLab();
    const parsed = parseLab(serializeLab(lab));
    expect(parsed).toEqual(lab);
    expect(parsed.positions).not.toBe(lab.positions);
    expect(checkLab(parsed).every((c) => c.pass)).toBe(true);
  });
  it.each([
    null,
    [],
    { schemaVersion: 2 },
    { ...exampleLab(), fault: 'missing' },
    { ...exampleLab(), durationMinutes: null },
    { ...exampleLab(), hints: [null] },
    { ...exampleLab(), objective: 5 },
    { ...exampleLab(), positions: null },
    { ...exampleLab(), positions: { ...exampleLab().positions, coil: { x: 0, y: 0 } } },
  ])('rejects malformed contracts without a usable partial result', (input) => {
    expect(() => parseLab(JSON.stringify(input))).toThrow();
  });
  it('rejects invalid JSON, oversized input, and future templates', () => {
    expect(() => parseLab('{broken')).toThrow('valid JSON');
    expect(() => parseLab('x'.repeat(65537))).toThrow('too large');
    expect(() => parseLab(JSON.stringify({ ...exampleLab(), template: 'another' }))).toThrow(
      'version 1',
    );
  });
  it('allows incomplete drafts but identifies missing authoring requirements', () => {
    const lab = parseLab(
      JSON.stringify({ ...exampleLab(), title: ' ', objective: '', fault: null, hints: [''] }),
    );
    expect(
      checkLab(lab)
        .filter((c) => !c.pass)
        .map((c) => c.id),
    ).toEqual(['title', 'objective', 'fault', 'hints']);
  });
});

describe('contact faults', () => {
  const actions = [
    'power',
    'start-down',
    'start-up',
    'stop-down',
    'stop-up',
    'power',
    'power',
  ] as const;
  const responses: Record<ContactFault, boolean[]> = {
    'start-stuck-open': [false, false, false, false, false, false, false],
    'start-stuck-closed': [true, true, true, false, true, false, true],
    'stop-stuck-closed': [false, true, true, true, true, false, false],
  };
  it.each(Object.keys(CONTACT_FAULTS) as ContactFault[])(
    '%s has correct control behavior, inspection and file round-trip',
    (fault) => {
      let state = initialCircuit();
      const observed = actions.map((action) => {
        state = stepCircuit(state, action, fault);
        return state.coilOn;
      });
      expect(observed).toEqual(responses[fault]);
      const target = faultDetails(fault).target;
      expect(inspectTarget(target, fault).faulty).toBe(true);
      for (const wire of WIRES)
        expect(inspectTarget(wire, fault)).toEqual({ faulty: false, label: 'Intact conductor' });
      expect(inspectTarget('contact-aux', fault).faulty).toBe(false);
      const lab = { ...exampleLab(), fault };
      expect(parseLab(serializeLab(lab))).toEqual(lab);
      expect(parseScenario({ message: 'Draft ready.', scenario: lab }).lab).toEqual(lab);
      expect(scenarioSchema.properties.scenario.anyOf[1].properties?.fault.enum).toContain(fault);
      expect(expectedSymptom(lab)).toBeTruthy();
    },
  );
  it('keeps the displayed contacts consistent with the failed mechanism', () => {
    const held = { ...initialCircuit(), startHeld: true, stopHeld: true };
    expect(contactClosed('start', held, 'start-stuck-open')).toBe(false);
    expect(contactClosed('start', initialCircuit(), 'start-stuck-closed')).toBe(true);
    expect(contactClosed('stop', held, 'stop-stuck-closed')).toBe(true);
    expect(contactClosed('stop', held, null)).toBe(false);
    expect(contactClosed('aux', { ...held, coilOn: true }, null)).toBe(true);
  });
  it('rejects unsupported contact faults from AI and imported files', () => {
    for (const fault of ['aux-stuck-open', 'coil-stuck-closed', 'short-circuit']) {
      expect(() => parseLab(JSON.stringify({ ...exampleLab(), fault }))).toThrow();
      expect(() =>
        parseScenario({ message: 'Draft ready.', scenario: { ...exampleLab(), fault } }),
      ).toThrow();
    }
  });
});

describe('editor history', () => {
  it('coalesces typing, restores imported content on undo, and clears a stale redo branch', () => {
    const original = exampleLab();
    let h: History = { past: [], present: original, future: [] };
    h = historyReducer(h, { type: 'replace', lab: { ...h.present, title: 'A' }, group: 'title' });
    h = historyReducer(h, { type: 'replace', lab: { ...h.present, title: 'AB' }, group: 'title' });
    expect(h.past).toHaveLength(1);
    h = historyReducer(h, { type: 'end-group' });
    h = historyReducer(h, { type: 'replace', lab: { ...h.present, fault: 'supply' } });
    h = historyReducer(h, { type: 'undo' });
    expect(h.present.fault).toBe('hold');
    h = historyReducer(h, { type: 'undo' });
    expect(h.present).toEqual(original);
    h = historyReducer(h, { type: 'redo' });
    expect(h.present.title).toBe('AB');
    h = historyReducer(h, { type: 'replace', lab: { ...h.present, title: 'Different' } });
    expect(h.future).toHaveLength(0);
  });
  it('clamps and snaps component movement to its non-overlapping area', () => {
    expect(constrain('start', { x: 5000, y: -500 })).toEqual({ x: 500, y: 140 });
    expect(constrain('aux', { x: 433, y: 376 })).toEqual({ x: 430, y: 380 });
  });
});

describe('persistent drafts', () => {
  const memory = (value: string | null = null) => ({
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  });
  it('preserves unreadable raw data instead of silently overwriting it', () => {
    const store = memory('{broken');
    expect(loadDraft(store)).toMatchObject({ status: 'damaged', raw: '{broken' });
    expect(store.getItem()).toBe('{broken');
  });
  it('round-trips a saved draft and detects another writer before committing', () => {
    const store = memory();
    const lab = exampleLab();
    const saved = saveDraft(store, lab, null);
    expect(saved.ok).toBe(true);
    expect(loadDraft(store).lab).toEqual(lab);
    const other = serializeLab({ ...lab, title: 'Another tab' });
    store.setItem(DRAFT_KEY, other);
    expect(saveDraft(store, lab, saved.ok ? saved.raw : null)).toEqual({
      ok: false,
      reason: 'conflict',
    });
    expect(store.getItem()).toBe(other);
  });
  it('surfaces access denial and quota failures', () => {
    expect(
      loadDraft({
        getItem: () => {
          throw new Error('denied');
        },
      }).status,
    ).toBe('unavailable');
    expect(
      saveDraft(
        {
          getItem: () => null,
          setItem: () => {
            throw new Error('quota');
          },
        },
        exampleLab(),
        null,
      ),
    ).toEqual({ ok: false, reason: 'unavailable' });
  });
});
