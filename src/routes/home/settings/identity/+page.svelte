<script lang="ts">
	import { t } from '$lib/i18n';
	import { appState } from '$lib/stores/app-state.svelte';

	function setName(value: string): void {
		appState.update((state) => {
			state.identity.name = value;
		});
	}
</script>

<section class="card flex flex-col gap-3 p-4">
	<p class="dim text-xs">{t('settings.identity.help')}</p>
	<input
		class="field"
		type="text"
		placeholder={t('identity.placeholder')}
		value={appState.state.identity.name}
		oninput={(event) => setName((event.target as HTMLInputElement).value)}
	/>
</section>
