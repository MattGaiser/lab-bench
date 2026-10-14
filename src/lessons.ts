import type { ContactFault, Lab } from './domain';

export const contactLessons: Record<
  ContactFault,
  Pick<Lab, 'title' | 'objective' | 'briefing' | 'hints'>
> = {
  'start-stuck-open': {
    title: 'The pump will not start',
    objective:
      'Distinguish a failed control contact from a broken conductor using observations and isolated inspection.',
    briefing:
      'The control supply is on, but pressing START does not start the pump. Observe K1 while operating the buttons. Isolate the supply, inspect the conductors and operate the contacts. Identify the fault and explain why K1 cannot energize.',
    hints: [
      'What must change in the starting path when START is pressed?',
      'If the conductors are intact, check whether the starting contact can close.',
    ],
  },
  'start-stuck-closed': {
    title: 'The pump starts by itself',
    objective:
      'Explain why a control circuit can energize before a start command and restart after STOP is released.',
    briefing:
      'Switching on the control supply starts the pump before anyone presses START. Observe what happens when you hold and release STOP. Isolate the supply, then inspect the conductors and operate the contacts. Identify the fault and explain the unexpected startup.',
    hints: [
      'Which path can supply K1 before its holding contact closes?',
      'Check whether the starting contact returns to its open position after release.',
    ],
  },
  'stop-stuck-closed': {
    title: 'The pump will not stop',
    objective: 'Explain how the stopping path should interrupt an energized holding circuit.',
    briefing:
      'The pump starts normally and continues running after START is released. Pressing STOP has no effect. Observe K1 while operating the controls, then isolate the supply. Inspect the conductors and operate the contacts to find the fault. Explain why the stopping command fails.',
    hints: [
      'Which contact should break both the starting and holding paths?',
      'Check whether the stopping contact opens when pressed.',
    ],
  },
};
