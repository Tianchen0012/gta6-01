// Neon Tide — save.js
// The save is a small JSON blob in localStorage: cash, which jobs are
// done, where Milo is standing, and his health. Nothing else leaves the
// browser, and loading a bad save just starts a new game.

import { SAVE_KEY } from './config.js';

export function saveGame(game) {
  try {
    const data = {
      version: 1,
      cash: game.player.cash,
      completed: game.missions.completed,
      missionIndex: game.missions.index,
      x: Math.round(game.player.x),
      y: Math.round(game.player.y),
      health: Math.round(game.player.health),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* no storage, no save */ }
}

export function hasSave() {
  return loadSave() !== null;
}
