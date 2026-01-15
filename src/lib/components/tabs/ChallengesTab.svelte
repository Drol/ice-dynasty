<script lang="ts">
  import { gameState, challengesWithStatus, activeChallenge as activeChallengeStore } from '$lib/stores/game-state';
  import { getChallengeGoalWins, getChallengeRestriction, getTotalChallengeReward } from '$lib/game/formulas';
  import type { Challenge, ChallengeRestriction } from '$lib/game/types';

  const challenges = $derived($challengesWithStatus);
  const currentChallenge = $derived($activeChallengeStore);

  const totalLevelsCompleted = $derived(
    challenges.reduce((sum, c) => sum + c.currentLevel, 0)
  );
  const maxTotalLevels = $derived(challenges.length * 5);

  function handleStartChallenge(challengeId: string) {
    gameState.startChallenge(challengeId);
  }

  function handleAbandonChallenge() {
    gameState.abandonChallenge();
  }

  function getChallengeProgress(challenge: Challenge): number {
    const goalWins = getChallengeGoalWins(challenge, challenge.attemptingLevel || 1);
    return (challenge.currentWins / goalWins) * 100;
  }

  function getRestrictionText(restriction: ChallengeRestriction): string {
    const { type, value } = restriction;
    switch (type) {
      case 'winChanceCap':
        return `Win chance capped at ${Math.round((value as number) * 100)}%`;
      case 'noMoney':
        return value && (value as number) > 0
          ? `No money + ${Math.round((value as number) * 100)}% slower training`
          : 'No money income (matches or passive)';
      case 'trainingDecay':
        return `Training decays ${Math.round((value as number) * 100)}% per second`;
      case 'forcedTactic':
        return `Locked to ${value} tactic`;
      case 'noUpgrades':
        return value && (value as number) > 1
          ? `No upgrades + ${value}x match cost`
          : 'Cannot buy season upgrades';
      case 'timeLimit':
        return `Complete within ${Math.round(value as number)} seconds`;
      case 'highGoal':
        return `Requires ${value} wins`;
      default:
        return '';
    }
  }

  function getLevelStars(challenge: Challenge): string {
    const filled = '★'.repeat(challenge.currentLevel);
    const empty = '☆'.repeat(challenge.maxLevel - challenge.currentLevel);
    return filled + empty;
  }

  function getNextLevelRestriction(challenge: Challenge): ChallengeRestriction {
    const nextLevel = challenge.currentLevel + 1;
    if (nextLevel > challenge.maxLevel) {
      return challenge.baseRestriction;
    }
    return getChallengeRestriction(challenge, nextLevel);
  }

  function getRewardDescription(challenge: Challenge, level: number): string {
    const baseValue = challenge.baseReward.value;
    const scaling = challenge.rewardScaling[level - 1] || 1;
    const scaledValue = baseValue * scaling;
    const percentValue = Math.round(scaledValue * 100);
    return `+${percentValue}% ${challenge.baseReward.type.replace(/([A-Z])/g, ' $1').toLowerCase().trim()}`;
  }
</script>

<section class="challenges-tab">
  <div class="challenges-header">
    <h2>Challenges</h2>
    <span class="challenges-count">{totalLevelsCompleted} / {maxTotalLevels} Levels</span>
  </div>

  <!-- Active Challenge -->
  {#if currentChallenge}
    <div class="challenge-section active-section">
      <h3 class="challenge-section-title">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        Active Challenge - Level {currentChallenge.attemptingLevel}
      </h3>

      <div class="challenge-card active">
        <div class="challenge-icon active">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          </svg>
        </div>
        <div class="challenge-content">
          <div class="challenge-header-row">
            <span class="challenge-name">{currentChallenge.name}</span>
            <span class="challenge-progress-text">{currentChallenge.currentWins}/{getChallengeGoalWins(currentChallenge, currentChallenge.attemptingLevel)} wins</span>
          </div>
          <span class="challenge-stars">{getLevelStars(currentChallenge)}</span>
          <p class="challenge-desc">{currentChallenge.description}</p>
          <p class="challenge-restriction">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            {getRestrictionText(getChallengeRestriction(currentChallenge, currentChallenge.attemptingLevel))}
          </p>
          <div class="challenge-progress-bar">
            <div class="challenge-progress-fill" style="width: {getChallengeProgress(currentChallenge)}%"></div>
          </div>
          <div class="challenge-footer">
            <span class="challenge-reward">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              {getRewardDescription(currentChallenge, currentChallenge.attemptingLevel)}
            </span>
            <button class="abandon-btn" onclick={handleAbandonChallenge}>
              Abandon
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- All Challenges (AD-style: all available from start) -->
  <div class="challenge-section">
    <h3 class="challenge-section-title">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
      </svg>
      All Challenges
    </h3>
    <p class="challenge-section-hint">Complete levels 1-5 for stacking rewards. Harder levels = bigger bonuses!</p>

    <div class="challenges-grid">
      {#each challenges as challenge}
        <div class="challenge-card" class:maxed={challenge.isMaxed} class:has-progress={challenge.hasProgress}>
          <div class="challenge-icon" class:completed={challenge.isMaxed}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              {#if challenge.isMaxed}
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              {:else}
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
              {/if}
            </svg>
          </div>
          <div class="challenge-content">
            <div class="challenge-header-row">
              <span class="challenge-name">{challenge.name}</span>
              <span class="challenge-stars" class:maxed={challenge.isMaxed}>{getLevelStars(challenge)}</span>
            </div>
            <p class="challenge-desc">{challenge.description}</p>

            {#if challenge.isMaxed}
              <!-- Maxed out - show total reward -->
              <p class="challenge-total-reward">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Total: +{Math.round(getTotalChallengeReward(challenge) * 100)}% {challenge.baseReward.type}
              </p>
            {:else}
              <!-- Show next level info -->
              <p class="challenge-restriction">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                L{challenge.currentLevel + 1}: {getRestrictionText(getNextLevelRestriction(challenge))}
              </p>
              <p class="challenge-goal">Goal: Win {getChallengeGoalWins(challenge, challenge.currentLevel + 1)} matches</p>
              <div class="challenge-footer">
                <span class="challenge-reward">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  {getRewardDescription(challenge, challenge.currentLevel + 1)}
                </span>
                <button
                  class="start-btn"
                  onclick={() => handleStartChallenge(challenge.id)}
                  disabled={!!currentChallenge}
                >
                  {currentChallenge ? 'Active' : `Level ${challenge.currentLevel + 1}`}
                </button>
              </div>
            {/if}

            {#if challenge.currentLevel > 0 && !challenge.isMaxed}
              <p class="challenge-current-bonus">
                Current bonus: +{Math.round(getTotalChallengeReward(challenge) * 100)}%
              </p>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>
