import { Game } from './core/Game.js';

const canvas = document.getElementById('game');

try {
  window.__gridfall = new Game(canvas);
} catch (error) {
  console.error(error);
  const loading = document.getElementById('loading');
  loading.innerHTML = '<strong>GRID BOOT FAILED</strong><span>Your browser needs WebGL 2 support.</span>';
}
