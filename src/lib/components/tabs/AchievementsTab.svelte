<script lang="ts">
  import { gameState } from '$lib/stores/game-state';
  import type { Achievement } from '$lib/game/types';

  const game = $derived($gameState);

  const bonusAchievements = $derived(
    game.achievements.filter((a: Achievement) => a.rewardType === 'bonus')
  );
  const cosmeticAchievements = $derived(
    game.achievements.filter((a: Achievement) => a.rewardType === 'cosmetic')
  );
  const unlockedCount = $derived(
    game.achievements.filter((a: Achievement) => a.unlocked).length
  );
</script>

<section class="achievements-tab">
  <div class="achievements-header">
    <h2>Achievements</h2>
    <span class="achievements-count">{unlockedCount} / {game.achievements.length} Unlocked</span>
  </div>

  <!-- Bonus Achievements (always visible) -->
  <div class="achievement-section">
    <h3 class="achievement-section-title">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
      Bonus Achievements
    </h3>
    <p class="achievement-section-hint">These achievements grant permanent bonuses</p>

    <div class="achievements-grid">
      {#each bonusAchievements as achievement}
        <div class="achievement-card" class:unlocked={achievement.unlocked}>
          <div class="achievement-icon" class:unlocked={achievement.unlocked}>
            {#if achievement.unlocked}
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            {:else}
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" opacity="0.3"/>
              </svg>
            {/if}
          </div>
          <div class="achievement-info">
            <span class="achievement-name">{achievement.name}</span>
            <span class="achievement-desc">
              {#if achievement.unlocked}
                {achievement.description}
              {:else}
                ???
              {/if}
            </span>
            <span class="achievement-reward">
              {#if achievement.bonusType === 'all'}
                +{(achievement.bonusValue || 0) * 100}% to all stats
              {:else if achievement.bonusType === 'winChance'}
                +{(achievement.bonusValue || 0) * 100}% win chance
              {:else if achievement.bonusType === 'fanGain'}
                +{(achievement.bonusValue || 0) * 100}% fan gain
              {:else if achievement.bonusType === 'moneyGain'}
                +{(achievement.bonusValue || 0) * 100}% money gain
              {:else if achievement.bonusType === 'trainingRate'}
                +{(achievement.bonusValue || 0) * 100}% training rate
              {:else if achievement.bonusType === 'baseMoney'}
                +${achievement.bonusValue} base income
              {:else}
                +{(achievement.bonusValue || 0) * 100}% bonus
              {/if}
            </span>
          </div>
          {#if achievement.unlocked}
            <div class="achievement-check">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- Cosmetic Achievements (hidden until unlocked) -->
  <div class="achievement-section">
    <h3 class="achievement-section-title">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
      Secret Achievements
    </h3>
    <p class="achievement-section-hint">Discover hidden achievements through gameplay</p>

    <div class="achievements-grid">
      {#each cosmeticAchievements as achievement}
        {#if achievement.unlocked}
          <div class="achievement-card unlocked cosmetic">
            <div class="achievement-badge">
              {achievement.badge}
            </div>
            <div class="achievement-info">
              <span class="achievement-name">{achievement.name}</span>
              <span class="achievement-desc">{achievement.description}</span>
            </div>
            <div class="achievement-check">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </div>
          </div>
        {:else}
          <div class="achievement-card hidden">
            <div class="achievement-icon hidden">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2z"/>
              </svg>
            </div>
            <div class="achievement-info">
              <span class="achievement-name">???</span>
              <span class="achievement-desc">Keep playing to discover</span>
            </div>
          </div>
        {/if}
      {/each}
    </div>
  </div>
</section>
<!-- Styles are in app.css (SHARED TAB COMPONENT STYLES) -->
