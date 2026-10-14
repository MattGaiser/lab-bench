import { exampleLab, parseLab, serializeLab } from './domain';
import type { Lab } from './domain';
export const DRAFT_KEY = 'lab-bench:draft:v1';
export type LoadedDraft = {
  lab: Lab;
  raw: string | null;
  status: 'new' | 'saved' | 'unavailable' | 'damaged';
};
export function loadDraft(storage: Pick<Storage, 'getItem'>): LoadedDraft {
  let raw: string | null;
  try {
    raw = storage.getItem(DRAFT_KEY);
  } catch {
    return { lab: exampleLab(), raw: null, status: 'unavailable' };
  }
  if (raw === null) return { lab: exampleLab(), raw, status: 'new' };
  try {
    return { lab: parseLab(raw), raw, status: 'saved' };
  } catch {
    return { lab: exampleLab(), raw, status: 'damaged' };
  }
}
/** Compare the last read value before each write so another tab's draft isn't silently replaced. */
export function saveDraft(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  lab: Lab,
  expected: string | null,
): { ok: true; raw: string } | { ok: false; reason: 'conflict' | 'unavailable' } {
  try {
    if (storage.getItem(DRAFT_KEY) !== expected) return { ok: false, reason: 'conflict' };
    const raw = serializeLab(lab);
    storage.setItem(DRAFT_KEY, raw);
    return { ok: true, raw };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
