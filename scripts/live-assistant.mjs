import assert from 'node:assert/strict';
import { draftScenario } from './assistant.mjs';
import { expectedSymptom } from '../src/scenario.ts';
// Optional: sends one bounded, paid request. Default checks never need an API key.
if (!process.env.OPENAI_API_KEY)
  throw new Error('Set OPENAI_API_KEY in the server environment first.');
const proposal = await draftScenario(
  {
    prompt:
      'Create a 15-minute beginner lab about a pump that runs only while START is held. The open conductor must be in the holding branch. Give two hints.',
  },
  { apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL },
);
assert.ok(proposal.lab);
assert.equal(proposal.lab.fault, 'hold');
assert.equal(proposal.lab.durationMinutes, 15);
assert.equal(proposal.lab.hints.length, 2);
console.log('Live scenario validated:', proposal.lab.title);
console.log(expectedSymptom(proposal.lab));
