<script lang="ts">
	/**
	 * 关于. Version, features, developer — and nothing about how the draw works.
	 *
	 * The determinism section that used to be here spelled out the seed derivation. That
	 * is the one part of the app that is not meant to be documented in the product, so it
	 * moved out of the interface entirely; the explanation lives in the source comments.
	 */

	import { isTauri } from '@tauri-apps/api/core';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { t } from '$lib/i18n';

	// The one version number in the app. Kept in step with tauri.conf.json and Cargo.toml
	// by hand, because the bundle's copy is not readable from the webview.
	const VERSION = '0.1.0';

	/** This machine's `gh` CLI identity, so the name here matches the repository. */
	const DEVELOPER = 'Rosmontis220';

	/** The repository the developer's name links to. */
	const REPOSITORY = 'https://github.com/Rosmontis220/ArknightsRogueGenerator_Tauri';

	/**
	 * Hands the repository to the system browser.
	 *
	 * The webview does not follow the href itself: it has no address bar and no back
	 * button, so navigating away would strand the user on a page they cannot leave.
	 * Outside Tauri — a plain browser serving the static build — following the link is
	 * exactly right, so the event is only intercepted when there is an app to open it
	 * with.
	 */
	async function openRepository(event: MouseEvent): Promise<void> {
		if (!isTauri()) return;
		event.preventDefault();
		await openUrl(REPOSITORY);
	}

	const FEATURE_KEYS = [
		'about.featureOpening',
		'about.featureCups',
		'about.featureBilingual'
	] as const;
</script>

<div class="flex flex-col gap-4">
	<section class="card flex flex-col gap-1 p-4">
		<h2 class="text-sm font-semibold">{t('app.title')}</h2>
		<p class="dim text-xs">{t('about.version')} {VERSION}</p>
	</section>

	<section class="card flex flex-col gap-2 p-4">
		<h2 class="text-sm font-semibold">{t('about.features')}</h2>
		<ul class="features">
			{#each FEATURE_KEYS as key (key)}
				<li>{t(key)}</li>
			{/each}
		</ul>
	</section>

	<section class="card flex flex-col gap-1 p-4">
		<h2 class="text-sm font-semibold">{t('about.developer')}</h2>
		<p class="text-xs">
			<a class="repo" href={REPOSITORY} onclick={openRepository} rel="noreferrer">{DEVELOPER}</a>
		</p>
	</section>
</div>

<style>
	.features {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin: 0;
		padding-left: 1.1rem;
		color: var(--c-text-dim);
		font-size: 0.75rem;
	}

	.repo {
		color: var(--c-accent);
		text-decoration: none;
	}

	.repo:hover,
	.repo:focus-visible {
		text-decoration: underline;
	}
</style>