<script lang="ts">
	/**
	 * 语言. The interface language, as a settings section of its own.
	 *
	 * It used to be a row on 外观, which made it findable only by someone who had already
	 * gone looking for the theme — so the English catalogue existed but was effectively
	 * hidden from the people who needed it. The persisted shape follows: `language.locale`
	 * rather than `appearance.locale`.
	 */

	import type { AppLocale } from '$lib/api/types';
	import { LOCALES, LOCALE_LABELS, t } from '$lib/i18n';
	import { locale } from '$lib/i18n/locale.svelte';
	import { appState } from '$lib/stores/app-state.svelte';

	/**
	 * Switches the interface language.
	 *
	 * The live store first, then the document, and not the other way round: `locale` is
	 * what every `t()` call reads, so setting it is what re-renders this page in the new
	 * language; persisting is only what brings it back after a restart.
	 */
	function setLocale(next: AppLocale): void {
		locale.set(next);
		appState.update((state) => {
			state.language.locale = next;
		});
	}
</script>

<section class="card flex flex-col gap-3 p-4">
	<p class="dim text-xs">{t('language.help')}</p>

	<div class="flex flex-wrap items-center gap-2">
		<span class="dim text-xs">{t('language.label')}</span>
		{#each LOCALES as option (option)}
			<!-- Each language is named in itself, never translated: a picker that offers
			     "德语" to someone who reads only German is no use. -->
			<button
				class="chip"
				data-checked={locale.current === option}
				onclick={() => setLocale(option)}
			>
				{LOCALE_LABELS[option]}
			</button>
		{/each}
	</div>
</section>