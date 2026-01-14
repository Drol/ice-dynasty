<script lang="ts">
  interface Props {
    open: boolean;
    title: string;
    onclose: () => void;
    onconfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
    confirmDanger?: boolean;
    children?: import('svelte').Snippet;
  }

  let {
    open = false,
    title,
    onclose,
    onconfirm,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmDanger = false,
    children
  }: Props = $props();

  function handleConfirm() {
    if (onconfirm) {
      onconfirm();
    }
    onclose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      onclose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div class="modal-overlay" onclick={onclose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <h2 id="modal-title" class="modal-title">{title}</h2>

      <div class="modal-body">
        {#if children}
          {@render children()}
        {/if}
      </div>

      <div class="modal-actions">
        <button class="modal-btn cancel" onclick={onclose}>
          {cancelText}
        </button>
        {#if onconfirm}
          <button
            class="modal-btn confirm"
            class:danger={confirmDanger}
            onclick={handleConfirm}
          >
            {confirmText}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: linear-gradient(135deg, var(--arena-surface) 0%, var(--arena-dark) 100%);
    border: 2px solid var(--arena-elevated);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    max-width: 400px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .modal-title {
    font-family: var(--font-display);
    font-size: 1.3rem;
    color: var(--ice-white);
    margin: 0 0 var(--space-md) 0;
    text-align: center;
    letter-spacing: 0.05em;
  }

  .modal-body {
    color: var(--ice-pale);
    font-size: 0.9rem;
    line-height: 1.5;
    margin-bottom: var(--space-lg);
  }

  .modal-actions {
    display: flex;
    gap: var(--space-sm);
    justify-content: flex-end;
  }

  .modal-btn {
    padding: var(--space-sm) var(--space-md);
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    font-family: var(--font-display);
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .modal-btn.cancel {
    background: var(--arena-surface);
    border-color: var(--arena-elevated);
    color: var(--ice-pale);
  }

  .modal-btn.cancel:hover {
    background: var(--arena-elevated);
    color: var(--ice-white);
  }

  .modal-btn.confirm {
    background: var(--ice-blue);
    color: white;
  }

  .modal-btn.confirm:hover {
    background: var(--ice-medium);
    box-shadow: 0 0 15px var(--ice-glow);
  }

  .modal-btn.confirm.danger {
    background: var(--score-red);
  }

  .modal-btn.confirm.danger:hover {
    background: #b91c1c;
    box-shadow: 0 0 15px rgba(220, 38, 38, 0.5);
  }
</style>
