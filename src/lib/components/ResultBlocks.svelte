<script lang="ts">
	/**
	 * Renders a generator's `ResultBlock[]`.
	 *
	 * One renderer per block variant, so adding a block type is a compile error
	 * here rather than a string that quietly renders as itself. The generator never
	 * produces markup.
	 *
	 * ## Portrait mode
	 *
	 * When `appearance.avatarMode` is on, every list of operators is drawn as portraits
	 * with the name kept as the tooltip, and the operators that are out of reach — the
	 * banned ones — get a grey wash so the two lists cannot be confused at a glance.
	 *
	 * Two things deliberately keep their names:
	 *
	 *   - the `text` blocks, i.e. the summary. It is the one line a user retypes into a
	 *     chat or a spreadsheet, and a row of pictures cannot be retyped.
	 *   - anything whose text is not a list. Only `names` and `picks` are swapped, because
	 *     only those are known to be operators.
	 *
	 * With the setting off, every branch below takes the same path it always did.
	 */

	import type { ResultBlock } from '$lib/generators/types';
	import OperatorAvatar from '$lib/components/OperatorAvatar.svelte';
	import { copyText } from '$lib/clipboard';
	import { exportText } from '$lib/export-text';
	import { t } from '$lib/i18n';
	import { renderText, localizeResultItem, jobName } from '$lib/i18n/names';
	import { appState } from '$lib/stores/app-state.svelte';
	import { resultStore } from '$lib/stores/result.svelte';

	let { blocks }: { blocks: ResultBlock[] } = $props();

	let copiedIndex = $state<number | null>(null);
	let exported = $state(false);

	const avatarMode = $derived(appState.state.appearance.avatarMode);

	/** `picks:先锋` -> `先锋`; see `ResultBlock`'s note on the checklist `id`. */
	function groupLabel(id: string): string {
		const separator = id.indexOf(':');
		return separator < 0 ? id : id.slice(separator + 1);
	}

	/** Whether a block's text is a list of operators, and so a candidate for portraits. */
	function isOperatorList(block: ResultBlock): boolean {
		return block.type === 'copyable' && (block.text.kind === 'names' || block.text.kind === 'picks');
	}

	/**
	 * Whether a block's operators are banned rather than merely listed.
	 *
	 * Read from the block's own `tone` rather than inferred from its shape: 老缠杯's pool is
	 * a list of names too, and washing those grey would say the opposite of what is true.
	 */
	function isBanned(block: ResultBlock): boolean {
		return block.type === 'copyable' && block.tone === 'ban';
	}

	async function copy(index: number, text: string): Promise<void> {
		// The flash is the only feedback there is, so it must not appear for a copy
		// the webview refused.
		if (!(await copyText(text))) return;

		copiedIndex = index;
		setTimeout(() => {
			if (copiedIndex === index) copiedIndex = null;
		}, 1500);
	}

	/**
	 * Copies the whole run in the format people paste into a chat.
	 *
	 * The ID comes from the result store rather than the current app state, so editing
	 * your ID after a draw cannot relabel the run you are looking at.
	 */
	async function exportResult(): Promise<void> {
		const current = resultStore.result;
		if (current === null) return;

		if (!(await copyText(exportText(resultStore.identity, current.fields)))) return;

		exported = true;
		setTimeout(() => {
			exported = false;
		}, 1500);
	}
</script>

{#snippet nameRow(names: readonly string[], masked: boolean)}
	<div class="flex flex-wrap items-center gap-1.5">
		{#each names as name, index (index)}
			<!-- Keyed by position: 老缠杯 allows the same operator twice, and two identical
			     keys would throw. -->
			<OperatorAvatar {name} mode size="md" {masked} />
		{/each}
	</div>
{/snippet}

<div class="flex flex-col gap-3">
	{#each blocks as block, index (index)}
		{#if block.type === 'text'}
			<p class="text-base leading-relaxed">{renderText(block.text)}</p>
		{:else if block.type === 'copyable'}
			<div>
				<div class="flex items-center gap-2">
					<h2 class="text-sm font-semibold">{renderText(block.label)}</h2>
					<button class="btn px-2 py-1 text-xs" onclick={() => copy(index, renderText(block.text))}>
						{copiedIndex === index ? t('result.copied') : t('result.copy')}
					</button>
				</div>

				{#if avatarMode && isOperatorList(block) && block.text.kind === 'names'}
					<div class="mt-1">
						{@render nameRow(block.text.names, isBanned(block))}
					</div>
				{:else if avatarMode && isOperatorList(block) && block.text.kind === 'picks'}
					<!-- Grouped by class here because the portraits cannot carry the class
					     name the text form spells out per group. -->
					<div class="mt-1 flex flex-col gap-1.5">
						{#each Object.entries(block.text.picks) as [job, names] (job)}
							<div class="flex flex-wrap items-center gap-2">
								<span class="dim text-xs">{jobName(job)}</span>
								{@render nameRow(names, false)}
							</div>
						{/each}
					</div>
				{:else}
					<p class="mt-1 text-sm break-words">{renderText(block.text)}</p>
				{/if}
			</div>
		{:else if block.type === 'checklist'}
			<div>
				<!-- The label is a `name` spec when the generator set one; without it the
				     id's own tail is the best available heading, and it is a Chinese class
				     name in either language. -->
				<h2 class="text-sm font-semibold">
					{block.label === undefined ? groupLabel(block.id) : renderText(block.label)}
				</h2>
				<div class="mt-1 flex flex-wrap gap-1.5">
					<!-- Keyed by position, not by name: 老缠杯 allows repeats, and two
					     identical keys would throw. -->
					{#each block.items as item, itemIndex (itemIndex)}
						<label
							class="chip"
							data-portrait={avatarMode}
							data-checked={resultStore.isTicked(block.id, item)}
							title={avatarMode ? localizeResultItem(item) : undefined}
						>
							<input
								type="checkbox"
								class="sr-only"
								checked={resultStore.isTicked(block.id, item)}
								onchange={() => resultStore.toggle(block.id, item)}
							/>
							{#if avatarMode}
								<OperatorAvatar name={item} mode size="sm" />
							{:else}
								{localizeResultItem(item)}
							{/if}
						</label>
					{/each}
				</div>
			</div>
		{:else if block.type === 'note'}
			{#each block.lines as line, lineIndex (lineIndex)}
				<p class="dim text-sm">{renderText(line)}</p>
			{/each}
		{/if}
	{/each}

	<div class="flex items-center gap-2">
		<button class="btn px-3 py-1.5 text-xs" onclick={() => void exportResult()}>
			{exported ? t('result.exported') : t('result.export')}
		</button>
	</div>
</div>

<style>
	/* A ticked operator is drawn in the accent colour, which is what `data-checked`
	 * already does. In portrait mode the chip is only a frame around the portrait, so the
	 * generous horizontal padding it needs for text would make it look like a button that
	 * failed to load. */
	.chip[data-portrait='true'] {
		padding: 0.2rem;
	}
</style>
