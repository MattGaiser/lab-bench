import assert from 'node:assert/strict';
import { draftScenario } from './assistant.mjs';
import { expectedSymptom } from '../src/scenario.ts';
import { CONTACT_FAULTS } from '../src/domain.ts';
// Optional: sends one bounded, paid request. Default checks never need an API key.
if (!process.env.OPENAI_API_KEY)
  throw new Error('Set OPENAI_API_KEY in the server environment first.');
const faultIndex = process.argv.indexOf('--fault');
const fault = faultIndex === -1 ? 'hold' : process.argv[faultIndex + 1];
if (fault !== 'hold' && !Object.hasOwn(CONTACT_FAULTS, fault))
  throw new Error('Choose hold, start-stuck-open, start-stuck-closed, or stop-stuck-closed.');
const proposal = await draftScenario(
  {
    prompt:
      fault === 'hold'
        ? 'Create a 15-minute beginner lab about a pump that runs only while START is held. The open conductor must be in the holding branch. Give two hints.'
        : `Create a 15-minute beginner lab with this fault: ${CONTACT_FAULTS[fault].label}. ${CONTACT_FAULTS[fault].description} Give two hints. Keep the answer out of the title, objective, and apprentice instructions.`,
  },
  { apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL },
);
assert.ok(proposal.lab);
assert.equal(proposal.lab.fault, fault);
assert.equal(proposal.lab.schemaVersion, 2);
assert.equal(proposal.lab.durationMinutes, 15);
assert.equal(proposal.lab.hints.length, 2);
console.log('Live scenario validated:', proposal.lab.title);
console.log(expectedSymptom(proposal.lab));
