/**
 * Game engine - handles the main game loop
 */

import { browser } from '$app/environment';
import { gameState } from '$lib/stores/game-state';

let lastTime = 0;
let animationFrameId: number | null = null;
let autoSaveInterval: number | null = null;

/**
 * Main game loop using requestAnimationFrame
 */
function gameLoop(currentTime: number) {
  if (lastTime === 0) {
    lastTime = currentTime;
  }

  const deltaMs = currentTime - lastTime;
  const deltaSeconds = deltaMs / 1000;

  // Cap delta to prevent huge jumps (e.g., when tab was inactive)
  const cappedDelta = Math.min(deltaSeconds, 1);

  if (cappedDelta > 0) {
    gameState.tick(cappedDelta);
  }

  lastTime = currentTime;
  animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Start the game engine
 */
export function startEngine() {
  if (!browser) return;
  if (animationFrameId !== null) return; // Already running

  lastTime = 0;
  animationFrameId = requestAnimationFrame(gameLoop);

  // Set up auto-save every 30 seconds
  autoSaveInterval = window.setInterval(() => {
    gameState.save();
  }, 30000);

  // Save when page is hidden/closed
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handleBeforeUnload);
}

/**
 * Stop the game engine
 */
export function stopEngine() {
  if (!browser) return;

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (autoSaveInterval !== null) {
    clearInterval(autoSaveInterval);
    autoSaveInterval = null;
  }

  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('beforeunload', handleBeforeUnload);
}

function handleVisibilityChange() {
  if (document.hidden) {
    gameState.save();
  }
}

function handleBeforeUnload() {
  gameState.save();
}
