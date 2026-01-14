<script lang="ts">
  import { gameState } from '$lib/stores/game-state';
  import Modal from './Modal.svelte';

  const game = $derived($gameState);

  const speeds = [1, 10, 100, 1000, 10000];

  let showResetModal = $state(false);

  function handleReset() {
    gameState.reset();
    showResetModal = false;
  }

  function setSpeed(speed: number) {
    gameState.setDevSpeed(speed);
  }
</script>

{#if game.dev.enabled}
  <div class="devtools">
    <div class="dev-badge">
      <svg viewBox="0 0 24 24" fill="currentColor" class="dev-icon">
        <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
      </svg>
      <span>DEV</span>
    </div>

    <div class="speed-controls">
      <span class="speed-label">Speed</span>
      <div class="speed-buttons">
        {#each speeds as speed}
          <button
            class="speed-btn"
            class:active={game.dev.speedMultiplier === speed}
            onclick={() => setSpeed(speed)}
          >
            {speed}x
          </button>
        {/each}
      </div>
    </div>

    <button class="reset-btn" onclick={() => showResetModal = true}>
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
      </svg>
      <span>Reset</span>
    </button>
  </div>

  <Modal
    open={showResetModal}
    title="Reset Game?"
    onclose={() => showResetModal = false}
    onconfirm={handleReset}
    confirmText="Reset Everything"
    cancelText="Cancel"
    confirmDanger={true}
  >
    {#snippet children()}
      <p>This will completely reset all progress:</p>
      <ul style="margin: 0.5rem 0; padding-left: 1.2rem; color: var(--ice-pale);">
        <li>Training, fans, and money</li>
        <li>All upgrades</li>
        <li>Reputation and rep upgrades</li>
        <li>Challenge progress</li>
        <li>Achievements</li>
      </ul>
      <p style="color: var(--score-red); font-weight: bold;">This cannot be undone!</p>
    {/snippet}
  </Modal>
{/if}

<style>
  .devtools {
    position: fixed;
    bottom: var(--space-lg);
    right: var(--space-lg);
    background: linear-gradient(
      135deg,
      rgba(22, 38, 68, 0.95) 0%,
      rgba(15, 31, 58, 0.98) 100%
    );
    backdrop-filter: blur(12px);
    border: 1px solid var(--score-gold);
    border-radius: var(--radius-lg);
    padding: var(--space-md);
    display: flex;
    align-items: center;
    gap: var(--space-lg);
    z-index: 1000;
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.4),
      0 0 20px var(--score-gold-glow);
  }

  .dev-badge {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    background: var(--score-gold);
    color: var(--arena-void);
    padding: 0.35rem 0.6rem;
    border-radius: var(--radius-sm);
    font-family: var(--font-score);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.1em;
  }

  .dev-icon {
    width: 14px;
    height: 14px;
  }

  .speed-controls {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  .speed-label {
    font-size: 0.75rem;
    color: var(--ice-pale);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .speed-buttons {
    display: flex;
    gap: 2px;
    background: var(--arena-dark);
    padding: 2px;
    border-radius: var(--radius-sm);
  }

  .speed-btn {
    padding: 0.35rem 0.6rem;
    background: transparent;
    border: none;
    border-radius: var(--radius-sm);
    color: var(--ice-pale);
    font-family: var(--font-score);
    font-size: 0.7rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .speed-btn:hover {
    background: var(--arena-surface);
    color: var(--ice-white);
  }

  .speed-btn.active {
    background: var(--ice-blue);
    color: var(--arena-void);
    box-shadow: 0 0 10px var(--ice-glow);
  }

  .reset-btn {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: 0.4rem 0.75rem;
    background: linear-gradient(135deg, var(--score-red), #b91c1c);
    border: none;
    border-radius: var(--radius-sm);
    color: white;
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px var(--score-red-glow);
  }

  .reset-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--score-red-glow);
  }

  .reset-btn:active {
    transform: translateY(0);
  }

  .reset-btn svg {
    width: 14px;
    height: 14px;
  }

  /* Responsive */
  @media (max-width: 600px) {
    .devtools {
      bottom: var(--space-md);
      right: var(--space-md);
      left: var(--space-md);
      justify-content: space-between;
    }

    .speed-label {
      display: none;
    }
  }
</style>
