import { RUNNERS } from '../game/config.js';

export const RUNNER_IDS = Object.freeze(Object.keys(RUNNERS));

export function selectedRunnerIndex(id) {
  const index = RUNNER_IDS.indexOf(id);
  return index < 0 ? 0 : index;
}

export function nextRunnerId(id, step) {
  const count = RUNNER_IDS.length;
  return RUNNER_IDS[((selectedRunnerIndex(id) + step) % count + count) % count];
}

// Columns follows the roster's responsive layout. No focus or DOM dependency.
export function menuKeyAction({ code, key, altKey, ctrlKey, metaKey }, columns = 4) {
  if (altKey || ctrlKey || metaKey) return null;
  const input = code || key?.toLowerCase();
  if (['ArrowLeft', 'KeyA', 'arrowleft', 'a'].includes(input)) return { step: -1 };
  if (['ArrowRight', 'KeyD', 'arrowright', 'd'].includes(input)) return { step: 1 };
  if (columns === 2 && ['ArrowUp', 'KeyW', 'arrowup', 'w'].includes(input)) return { step: -2 };
  if (columns === 2 && ['ArrowDown', 'KeyS', 'arrowdown', 's'].includes(input)) return { step: 2 };
  if (['Enter', 'NumpadEnter', 'Space', 'enter', ' '].includes(input)) return { start: true };
  return null;
}

export function runnerStats(id) {
  const runner = RUNNERS[id];
  const volley = ({ attack }) => attack.damage * (attack.pellets || attack.count || 1);
  const roster = Object.values(RUNNERS);
  return [
    { id: 'health', value: runner.hp, max: Math.max(...roster.map(r => r.hp)), label: `${runner.hp} health` },
    { id: 'range', value: runner.attack.range, max: Math.max(...roster.map(r => r.attack.range)), label: `${runner.attack.range} range` },
    { id: 'damage', value: volley(runner), max: Math.max(...roster.map(volley)), label: `${volley(runner)} damage per full basic volley` },
  ];
}
