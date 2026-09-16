<script lang="ts">
	import type { AppLocale, ColorScheme, ReduceMotion } from '$lib/api/types';
	import { COLOR_SCHEMES, applyColorScheme } from '$lib/appearance';
	import { LOCALES, LOCALE_LABELS, t } from '$lib/i18n';
	import { locale } from '$lib/i18n/locale.svelte';
	import { SPLASH_IMAGE_PREVIEW_EDGE, dataUrlBytes, prepareSplashImage } from '$lib/image';
	import { appState } from '$lib/stores/app-state.svelte';

	const REDUCE_MOTION_LABELS: readonly { id: ReduceMotion; labelKey: string }[] = [
		{ id: 'system', labelKey: 'common.motionSystem' },
		{ id: 'always', labelKey: 'common.motionAlways' },
		{ id: 'never', labelKey: 'common.motionNever' }
	];

	let fileInput = $state<HTMLInputElement | null>(null);
	let busy = $state(false);
	/** A failed pick is reported here rather than swallowed by the change handler. */
	let error = $state<string | null>(null);

	const splashImage = $derived(appState.state.appearance.splashImage ?? '');

	const splashSize = $derived(
		splashImage === '' ? '' : `${Math.round(dataUrlBytes(splashImage) / 1024)} KB`
	);

	function setScheme(scheme: ColorScheme): void {
		appState.update((state) => {
			state.appearance.colorScheme = scheme;
		});
		// Applied immediately as well as persisted: the write is debounced, and a
		// theme that lags the click by 400ms feels broken.
		applyColorScheme(scheme);
	}

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
			state.appearance.locale = next;
		});
	}

	function setReduceMotion(value: ReduceMotion): void {
		appState.update((state) => {
			state.appearance.reduceMotion = value;
		});
	}

	/**
	 * Reads the picked file and stores a downscaled copy.
	 *
	 * Deliberately takes no event and goes through the bound `fileInput` instead of
	 * `event.currentTarget`: Svelte 5 delegates `change` to the root node, so
	 * `currentTarget` there is that root rather than this input, and `input.files`
	 * would be undefined — a pick that silently does nothing.
	 */
	async function onPick(): Promise<void> {
		if (fileInput === null) return;

		const file = fileInput.files?.[0];

		// Cleared before anything is awaited: picking the same file twice in a row
		// fires no `change` event while the input still holds the first selection.
		fileInput.value = '';

		if (file === undefined) return;

		busy = true;
		error = null;

		try {
			const result = await prepareSplashImage(file);

			if (!result.ok) {
				error = t(`appearance.splashError.${result.reason}`);
				return;
			}

			appState.update((state) => {
				state.appearance.splashImage = result.image.dataUrl;
			});
		} finally {
			busy = false;
		}
	}

	function clearSplash(): void {
		appState.update((state) => {
			state.appearance.splashImage = '';
		});
		error = null;
	}
</script>

<section class="card flex flex-col gap-3 p-4">
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
		{#each COLOR_SCHEMES as scheme (scheme.id)}
			<button
				class="chip flex-col items-start gap-0.5 px-3 py-2"
				data-checked={appState.state.appearance.colorScheme === scheme.id}
				onclick={() => setScheme(scheme.id)}
			>
				<span class="font-medium">{t(scheme.labelKey)}</span>
				<span class="dim text-xs">{t(scheme.descriptionKey)}</span>
			</button>
		{/each}
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<span class="dim text-xs">{t('appearance.language')}</span>
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

	<div class="flex flex-wrap items-center gap-2">
		<span class="dim text-xs">{t('appearance.motion')}</span>
		{#each REDUCE_MOTION_LABELS as option (option.id)}
			<button
				class="chip"
				data-checked={appState.state.appearance.reduceMotion === option.id}
				onclick={() => setReduceMotion(option.id)}
			>
				{t(option.labelKey)}
			</button>
		{/each}
	</div>
</section>

<section class="card flex flex-col gap-3 p-4">
	<div class="flex flex-col gap-1">
		<h2 class="text-sm font-semibold">{t('appearance.splashTitle')}</h2>
		<p class="dim text-xs">{t('appearance.splashHelp')}</p>
	</div>

	<div class="flex flex-wrap items-start gap-4">
		<div class="preview" style:--preview-edge={`${SPLASH_IMAGE_PREVIEW_EDGE / 2}px`}>
			{#if splashImage === ''}
				<span class="dim text-xs">{t('appearance.splashDefault')}</span>
			{:else}
				<img src={splashImage} alt={t('appearance.splashPreviewAlt')} />
			{/if}
		</div>

		<div class="flex flex-col gap-2">
			<!-- A real button plus a hidden input, rather than a <label> wrapping it:
			     `display: none` takes the input out of the tab order, so the label
			     pattern would leave this reachable by mouse only. -->
			<input
				bind:this={fileInput}
				class="hidden"
				type="file"
				accept="image/*"
				onchange={onPick}
			/>

			<button
				class="btn self-start px-3 py-1.5 text-xs"
				disabled={busy}
				onclick={() => fileInput?.click()}
			>
				{busy
					? t('appearance.splashBusy')
					: splashImage === ''
						? t('appearance.splashChoose')
						: t('appearance.splashReplace')}
			</button>

			{#if splashImage !== ''}
				<div class="flex items-center gap-2">
					<button class="btn px-2 py-1 text-xs" onclick={clearSplash}>
						{t('appearance.splashRemove')}
					</button>
					<span class="dim text-xs">{splashSize}</span>
				</div>
			{/if}
		</div>
	</div>

	{#if error !== null}
		<p class="error text-xs" role="alert">{error}</p>
	{/if}
</section>

<style>
	.preview {
		display: grid;
		width: var(--preview-edge);
		height: calc(var(--preview-edge) * 9 / 16);
		overflow: hidden;
		border: 1px solid var(--c-border);
		border-radius: 12px;
		place-items: center;
		/* The default preview *is* the theme background, so the empty state shows the
		 * colour the splash would actually use rather than a grey placeholder. */
		background: var(--c-bg);
	}

	.preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.error {
		color: var(--c-danger);
	}
</style>
