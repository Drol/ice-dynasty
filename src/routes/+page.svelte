<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gameState, hasClub } from '$lib/stores/game-state';
  import { startEngine, stopEngine } from '$lib/game/engine';
  import ClubCreator from '$lib/components/ClubCreator.svelte';
  import GameDashboard from '$lib/components/GameDashboard.svelte';

  const clubExists = $derived($hasClub);

  onMount(() => {
    gameState.init();
    startEngine();
  });

  onDestroy(() => {
    stopEngine();
  });
</script>

<svelte:head>
  <title>Ice Dynasty - Hockey Empire Builder</title>
  <meta name="description" content="Build your hockey empire from the ground up in this incremental game" />
</svelte:head>

{#if clubExists}
  <GameDashboard />
{:else}
  <ClubCreator />
{/if}
