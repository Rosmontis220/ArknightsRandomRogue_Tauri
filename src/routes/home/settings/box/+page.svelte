<script lang="ts">
	/**
	 * The box screen: which six-stars the user owns.
	 *
	 * Stores the *excluded* set, so an operator added to the
	 * dictionary later is in the box by default and nobody has to revisit this screen
	 * after a game update.
	 *
	 * ## Three views, one page
	 *
	 *   1. no job, no query  -> the eight jobs as buttons, each showing its count
	 *   2. no job, a query   -> matches across every job, still grouped by job
	 *   3. `?job=先锋`       -> that job's operators
	 *
	 * The job grid replaced eight always-open blocks of chips. 137 chips on one screen is
	 * a wall, and a virtual list was the other candidate fix — but for a wrapping chip grid
	 * that would have meant fixed-height rows, i.e. making the screen worse to look at in
	 * order to make it faster. Showing one job at a time (17-40 names) solves the same
	 * problem
	 * by rendering less in the first place, so the virtual list stays unnecessary. The
	 * search results are still grouped and carry `content-visibility`, since that view can
	 * legitimately match every chip.
	 *
	 * ## Why the job is in the URL
	 *
	 * `?job=` rather than component state, so the back gesture — which matters on Android,
	 * where Android is a target platform — returns to the job grid instead of leaving the
	 * screen entirely. It also matches how 生成 selects a generator (`?g=`).
	 */

	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import { JOBS, OPERATORS_BY_STAR, OPERATORS_STAR_6_LIST } from '$lib/core/operators';
	import type { OperatorJob } from '$lib/core/operators';
	import { t } from '$lib/i18n';
	import { localizeName } from '$lib/i18n/names';
	import { appState } from '$lib/stores/app-state.svelte';

	const BOX_PATH = '/home/settings/box';

	let query = $state('');

	const excluded = $derived(appState.state.box.excluded);
	const trimmedQuery = $derived(query.trim());

	const total = OPERATORS_STAR_6_LIST.length;
	const inBoxTotal = $derived(total - excluded.length);

	const jobParam = $derived(page.url.searchParams.get('job'));
	/** The job opened via `?job=`, or `undefined` for the grid. */
	const activeJob = $derived(JOBS.find((job) => job === jobParam));

	function inBox(name: string): boolean {
		return !excluded.includes(name);
	}

	function inBoxCount(job: OperatorJob): number {
		return OPERATORS_BY_STAR['6'][job].filter(inBox).length;
	}

	/**
	 * Matches the operator's *displayed* name, and the Chinese one as well.
	 *
	 * Both, because the stored data is always Chinese while an English interface shows the
	 * official English name: matching only the Chinese would make the box look broken to
	 * someone reading English, and matching only the English would make it impossible to
	 * paste a name from a Chinese client.
	 */
	function matches(name: string): boolean {
		if (trimmedQuery === '') return true;

		const needle = trimmedQuery.toLowerCase();
		return (
			name.toLowerCase().includes(needle) || localizeName(name).toLowerCase().includes(needle)
		);
	}

	const searchGroups = $derived(
		JOBS.map((job) => ({ job, names: OPERATORS_BY_STAR['6'][job].filter(matches) })).filter(
			(group) => group.names.length > 0
		)
	);

	function toggleOperator(name: string): void {
		appState.update((state) => {
			const index = state.box.excluded.indexOf(name);
			if (index >= 0) {
				state.box.excluded.splice(index, 1);
			} else {
				state.box.excluded.push(name);
			}
		});
	}

	/**
	 * Sets a whole group in one write, so one debounced save covers the batch.
	 *
	 * `inBox` and `!inBox` are deliberately not symmetric: the first clears the exclusion
	 * wherever it is, the second adds it only where it is missing. `indexOf` inside the
	 * loop is fine at this size and keeps the two directions obviously correct.
	 */
	function setNamesInBox(names: readonly string[], value: boolean): void {
		appState.update((state) => {
			for (const name of names) {
				const index = state.box.excluded.indexOf(name);
				if (value && index >= 0) {
					state.box.excluded.splice(index, 1);
				} else if (!value && index < 0) {
					state.box.excluded.push(name);
				}
			}
		});
	}

	function openJob(job: OperatorJob): void {
		query = '';
		void goto(`${BOX_PATH}?job=${encodeURIComponent(job)}`, { noScroll: true, keepFocus: true });
	}

	function closeJob(): void {
		void goto(BOX_PATH, { noScroll: true, keepFocus: true });
	}
</script>

{#snippet operatorChip(name: string)}
	<button class="chip" data-checked={inBox(name)} onclick={() => toggleOperator(name)}>
		{localizeName(name)}
	</button>
{/snippet}

{#snippet selectButtons(names: readonly string[])}
	<button class="btn px-2 py-0.5 text-xs" onclick={() => setNamesInBox(names, true)}>
		{t('common.selectAll')}
	</button>
	<button class="btn px-2 py-0.5 text-xs" onclick={() => setNamesInBox(names, false)}>
		{t('common.selectNone')}
	</button>
{/snippet}

{#snippet jobView(job: OperatorJob)}
	{@const names = OPERATORS_BY_STAR['6'][job]}
	<div class="flex flex-wrap items-center gap-2">
		<button class="btn flex items-center gap-1 px-2 py-1 text-xs" onclick={closeJob}>
			<Icon name="arrow_back" size="14px" />
			<span>{t('settings.box.backToJobs')}</span>
		</button>
		<span class="text-sm font-medium">{localizeName(job)}</span>
		<span class="dim text-xs">{inBoxCount(job)}/{names.length}</span>
		<div class="ml-auto flex gap-2">
			{@render selectButtons(names)}
		</div>
	</div>

	<div class="chips">
		{#each names.filter(matches) as name (name)}
			{@render operatorChip(name)}
		{/each}
	</div>
{/snippet}

<section class="card flex flex-col gap-3 p-4">
	<div class="flex flex-wrap items-baseline gap-2">
		<span class="text-sm font-medium">{t('settings.box.inBox')} {inBoxTotal} / {total}</span>
		<div class="ml-auto flex gap-2">
			{@render selectButtons(OPERATORS_STAR_6_LIST)}
		</div>
	</div>
	<p class="dim text-xs">{t('settings.box.help')}</p>

	<input
		class="field"
		type="search"
		placeholder={t('settings.box.searchPlaceholder')}
		bind:value={query}
	/>

	{#if activeJob !== undefined}
		{@render jobView(activeJob)}
	{:else if trimmedQuery !== ''}
		<div class="flex flex-col gap-3">
			{#each searchGroups as group (group.job)}
				<div class="group flex flex-col gap-1">
					<div class="flex items-center gap-2">
						<span class="dim text-xs">{localizeName(group.job)}</span>
						<span class="dim text-xs">{inBoxCount(group.job)}/{OPERATORS_BY_STAR['6'][group.job].length}</span>
					</div>
					<div class="chips">
						{#each group.names as name (name)}
							{@render operatorChip(name)}
						{/each}
					</div>
				</div>
			{/each}
			{#if searchGroups.length === 0}
				<p class="dim text-xs">{t('settings.box.noMatch')}</p>
			{/if}
		</div>
	{:else}
		<div class="flex flex-col gap-2">
			<span class="dim text-xs">{t('settings.box.byJob')}</span>
			<ul class="jobs">
				{#each JOBS as job (job)}
					{@const names = OPERATORS_BY_STAR['6'][job]}
					{@const count = inBoxCount(job)}
					<li>
						<button class="job" onclick={() => openJob(job)}>
							<span class="job-name">{localizeName(job)}</span>
							<span class="job-count" data-complete={count === names.length}>
								{count}/{names.length}
							</span>
							<Icon name="chevron_right" size="16px" />
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</section>

<style>
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.jobs {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.job {
		display: grid;
		width: 100%;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid var(--c-border);
		border-radius: 12px;
		padding: 0.6rem 0.7rem;
		background: var(--c-surface-2);
		color: var(--c-text);
		font-size: 0.82rem;
		cursor: pointer;
		transition:
			border-color 160ms ease,
			background-color 160ms ease;
	}

	.job:hover {
		border-color: color-mix(in srgb, var(--c-primary) 45%, var(--c-border));
	}

	.job-name {
		text-align: left;
		font-weight: 500;
	}

	.job-count {
		color: var(--c-text-dim);
		font-size: 0.7rem;
		font-variant-numeric: tabular-nums;
	}

	/* A fully collected job is the state the user is working towards, so it reads as
	   different from one that is only partly filled. */
	.job-count[data-complete='true'] {
		color: var(--c-primary-text);
	}

	/*
	 * Only the search view needs this: it can match the whole dictionary at once, while
	 * the other two views render one job (17-40 chips) or the job grid. `contain-intrinsic-size`
	 * gives the group a placeholder height so the scrollbar does not jump as groups are
	 * skipped and then measured.
	 */
	.group {
		content-visibility: auto;
		contain-intrinsic-size: auto 6rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.job {
			transition: none;
		}
	}
</style>
