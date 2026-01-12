<script lang="ts">
  import { gameState } from '$lib/stores/game-state';

  let clubName = $state('');
  let primaryColor = $state('#dc2626');
  let secondaryColor = $state('#ffffff');

  function handleSubmit(e: Event) {
    e.preventDefault();
    if (clubName.trim()) {
      gameState.createClub(clubName.trim(), primaryColor, secondaryColor);
    }
  }
</script>

<div class="creator">
  <!-- Arena spotlight effect -->
  <div class="spotlight"></div>

  <!-- Floating ice particles -->
  <div class="ice-particles">
    {#each Array(12) as _, i}
      <div class="particle" style="--delay: {i * 0.5}s; --x: {Math.random() * 100}%"></div>
    {/each}
  </div>

  <div class="content">
    <header class="header">
      <div class="logo-container">
        <div class="logo">
          <svg viewBox="0 0 100 100" class="logo-svg">
            <!-- Hockey stick crossed -->
            <path d="M20 80 L50 20 L55 22 L28 78 Z" fill="var(--score-gold)" />
            <path d="M80 80 L50 20 L45 22 L72 78 Z" fill="var(--score-gold)" />
            <!-- Puck -->
            <ellipse cx="50" cy="70" rx="18" ry="6" fill="var(--arena-elevated)" />
            <ellipse cx="50" cy="68" rx="18" ry="6" fill="#1a1a1a" />
          </svg>
        </div>
      </div>

      <h1 class="title">Ice Dynasty</h1>
      <p class="tagline">Build Your Hockey Empire</p>
    </header>

    <form onsubmit={handleSubmit} class="form">
      <div class="form-section">
        <label for="club-name" class="label">
          <span class="label-text">Club Name</span>
          <span class="label-hint">Choose wisely - this is your legacy</span>
        </label>
        <div class="input-wrapper">
          <input
            type="text"
            id="club-name"
            bind:value={clubName}
            placeholder="Enter club name..."
            maxlength="30"
            required
            class="text-input"
          />
          <div class="input-glow"></div>
        </div>
      </div>

      <div class="form-section">
        <span class="label">
          <span class="label-text">Team Colors</span>
        </span>
        <div class="color-pickers">
          <div class="color-picker">
            <label for="primary-color" class="color-label">Primary</label>
            <div class="color-input-wrapper">
              <input
                type="color"
                id="primary-color"
                bind:value={primaryColor}
                class="color-input"
              />
              <div class="color-preview" style="background: {primaryColor}"></div>
            </div>
          </div>

          <div class="color-picker">
            <label for="secondary-color" class="color-label">Secondary</label>
            <div class="color-input-wrapper">
              <input
                type="color"
                id="secondary-color"
                bind:value={secondaryColor}
                class="color-input"
              />
              <div class="color-preview" style="background: {secondaryColor}"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Jersey Preview -->
      <div class="preview-section">
        <div class="jersey-preview" style="--primary: {primaryColor}; --secondary: {secondaryColor}">
          <div class="jersey">
            <div class="jersey-body">
              <div class="jersey-stripe"></div>
              <div class="jersey-number">00</div>
            </div>
            <div class="jersey-sleeves">
              <div class="sleeve left"></div>
              <div class="sleeve right"></div>
            </div>
          </div>
          <div class="jersey-name">{clubName || 'YOUR CLUB'}</div>
          <div class="preview-ice"></div>
        </div>
      </div>

      <button type="submit" disabled={!clubName.trim()} class="submit-btn">
        <span class="btn-text">Found Club</span>
        <span class="btn-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </span>
      </button>
    </form>

    <footer class="footer">
      <p>Era 1: Grassroots</p>
    </footer>
  </div>
</div>

<style>
  .creator {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-xl);
    position: relative;
    overflow: hidden;
  }

  .spotlight {
    position: absolute;
    top: -50%;
    left: 50%;
    transform: translateX(-50%);
    width: 150%;
    height: 100%;
    background: radial-gradient(
      ellipse 50% 80% at 50% 0%,
      rgba(168, 212, 240, 0.08) 0%,
      transparent 70%
    );
    pointer-events: none;
  }

  .ice-particles {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .particle {
    position: absolute;
    width: 4px;
    height: 4px;
    background: var(--ice-blue);
    border-radius: 50%;
    left: var(--x);
    top: -10px;
    opacity: 0.3;
    animation: fall 8s linear infinite;
    animation-delay: var(--delay);
  }

  @keyframes fall {
    0% {
      transform: translateY(-10px) rotate(0deg);
      opacity: 0;
    }
    10% {
      opacity: 0.3;
    }
    90% {
      opacity: 0.3;
    }
    100% {
      transform: translateY(100vh) rotate(360deg);
      opacity: 0;
    }
  }

  .content {
    width: 100%;
    max-width: 480px;
    position: relative;
    z-index: 10;
  }

  .header {
    text-align: center;
    margin-bottom: var(--space-2xl);
  }

  .logo-container {
    margin-bottom: var(--space-lg);
  }

  .logo {
    width: 80px;
    height: 80px;
    margin: 0 auto;
    animation: float 4s ease-in-out infinite;
  }

  .logo-svg {
    width: 100%;
    height: 100%;
    filter: drop-shadow(0 0 20px var(--score-gold-glow));
  }

  .title {
    font-size: clamp(3rem, 10vw, 4.5rem);
    line-height: 1;
    color: var(--ice-white);
    text-shadow:
      0 0 40px var(--ice-glow),
      0 4px 0 var(--arena-dark);
    margin-bottom: var(--space-sm);
    letter-spacing: 0.1em;
  }

  .tagline {
    font-family: var(--font-body);
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--ice-pale);
    text-transform: uppercase;
    letter-spacing: 0.3em;
    opacity: 0.8;
  }

  .form {
    background: linear-gradient(
      180deg,
      rgba(22, 38, 68, 0.9) 0%,
      rgba(15, 31, 58, 0.95) 100%
    );
    border: 1px solid rgba(168, 212, 240, 0.15);
    border-radius: var(--radius-xl);
    padding: var(--space-2xl);
    backdrop-filter: blur(20px);
    box-shadow:
      0 25px 50px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }

  .form-section {
    margin-bottom: var(--space-xl);
  }

  .label {
    display: block;
    margin-bottom: var(--space-sm);
  }

  .label-text {
    font-family: var(--font-display);
    font-size: 1.25rem;
    color: var(--ice-white);
    letter-spacing: 0.1em;
  }

  .label-hint {
    display: block;
    font-size: 0.8rem;
    color: var(--ice-blue);
    opacity: 0.7;
    margin-top: 2px;
  }

  .input-wrapper {
    position: relative;
  }

  .text-input {
    width: 100%;
    padding: 1rem 1.25rem;
    background: var(--arena-dark);
    border: 2px solid var(--arena-elevated);
    border-radius: var(--radius-md);
    color: var(--ice-white);
    font-size: 1.1rem;
    font-weight: 500;
    transition: all 0.3s ease;
  }

  .text-input::placeholder {
    color: var(--ice-blue);
    opacity: 0.4;
  }

  .text-input:focus {
    outline: none;
    border-color: var(--ice-blue);
    box-shadow: 0 0 0 4px var(--ice-glow);
  }

  .input-glow {
    position: absolute;
    inset: -1px;
    border-radius: var(--radius-md);
    background: linear-gradient(90deg, var(--score-gold), var(--ice-blue), var(--score-gold));
    background-size: 200% 100%;
    opacity: 0;
    z-index: -1;
    transition: opacity 0.3s;
  }

  .text-input:focus + .input-glow {
    opacity: 0.3;
    animation: shimmer 2s linear infinite;
  }

  .color-pickers {
    display: flex;
    gap: var(--space-lg);
  }

  .color-picker {
    flex: 1;
  }

  .color-label {
    display: block;
    font-size: 0.85rem;
    color: var(--ice-pale);
    margin-bottom: var(--space-sm);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .color-input-wrapper {
    position: relative;
    height: 50px;
    border-radius: var(--radius-md);
    overflow: hidden;
    border: 2px solid var(--arena-elevated);
    transition: border-color 0.3s;
  }

  .color-input-wrapper:hover {
    border-color: var(--ice-blue);
  }

  .color-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }

  .color-preview {
    width: 100%;
    height: 100%;
    transition: transform 0.3s;
  }

  .color-input-wrapper:hover .color-preview {
    transform: scale(1.05);
  }

  .preview-section {
    margin-bottom: var(--space-xl);
  }

  .jersey-preview {
    position: relative;
    padding: var(--space-xl);
    background: radial-gradient(
      ellipse at center,
      var(--arena-surface) 0%,
      var(--arena-dark) 100%
    );
    border-radius: var(--radius-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow: hidden;
  }

  .preview-ice {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 30%;
    background: linear-gradient(
      180deg,
      transparent 0%,
      rgba(168, 212, 240, 0.05) 100%
    );
  }

  .jersey {
    position: relative;
    width: 100px;
    height: 110px;
  }

  .jersey-body {
    position: absolute;
    inset: 10px 15px 0;
    background: var(--primary);
    border-radius: 8px 8px 0 0;
    overflow: hidden;
  }

  .jersey-stripe {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 25%;
    background: var(--secondary);
  }

  .jersey-number {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-family: var(--font-display);
    font-size: 2.5rem;
    color: var(--secondary);
    text-shadow: 2px 2px 0 rgba(0, 0, 0, 0.3);
  }

  .jersey-sleeves {
    position: absolute;
    top: 15px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
  }

  .sleeve {
    width: 20px;
    height: 50px;
    background: var(--primary);
    border-radius: 4px;
  }

  .sleeve.left {
    transform: rotate(-15deg);
    transform-origin: top right;
  }

  .sleeve.right {
    transform: rotate(15deg);
    transform-origin: top left;
  }

  .jersey-name {
    margin-top: var(--space-md);
    font-family: var(--font-display);
    font-size: 1.5rem;
    color: var(--ice-white);
    text-transform: uppercase;
    letter-spacing: 0.15em;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    z-index: 1;
  }

  .submit-btn {
    width: 100%;
    padding: 1.25rem 2rem;
    background: linear-gradient(
      135deg,
      var(--score-gold) 0%,
      #e6c200 100%
    );
    border: none;
    border-radius: var(--radius-md);
    color: var(--arena-void);
    font-family: var(--font-display);
    font-size: 1.5rem;
    letter-spacing: 0.15em;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-md);
    transition: all 0.3s ease;
    box-shadow:
      0 4px 20px var(--score-gold-glow),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
    position: relative;
    overflow: hidden;
  }

  .submit-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.3),
      transparent
    );
    transform: translateX(-100%);
    transition: transform 0.6s;
  }

  .submit-btn:hover:not(:disabled)::before {
    transform: translateX(100%);
  }

  .submit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow:
      0 8px 30px var(--score-gold-glow),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }

  .submit-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .submit-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: var(--arena-elevated);
    color: var(--ice-pale);
    box-shadow: none;
  }

  .btn-text {
    position: relative;
    z-index: 1;
  }

  .btn-icon {
    width: 24px;
    height: 24px;
    position: relative;
    z-index: 1;
  }

  .btn-icon svg {
    width: 100%;
    height: 100%;
  }

  .footer {
    text-align: center;
    margin-top: var(--space-xl);
  }

  .footer p {
    font-family: var(--font-score);
    font-size: 0.75rem;
    color: var(--ice-blue);
    opacity: 0.5;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }
</style>
