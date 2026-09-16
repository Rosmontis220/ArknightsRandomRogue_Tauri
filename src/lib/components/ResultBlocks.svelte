<script lang="ts">
	/**
	 * Renders a generator's `ResultBlock[]`.
	 *
	 * One renderer per block variant, so adding a block type is a compile error
	 * here rather than a string that quietly renders as itself. The generator never
	 * produces markup.
	 */

	import type { ResultBlock } from '$lib/generators/types';
	import { copyText } from '$lib/clipboard';
	import { t } from '$lib/i18n';
	import { renderText, localizeResultItem } from '$lib/i18n/names';
	import { resultStore } from '$lib/stores/result.svelte';

	let { blocks }: { blocks: ResultBlock[] } = $props();

	let copiedIndex = $state<number | null>(null);

	/** `picks:先锋` -> `先锋`; see `ResultBlock`'s note on the checklist `id`. */
	function groupLabel(id: string): string {
		const separator = id.indexOf(':');
		return separator < 0 ? id : id.slice(separator + 1);
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
</script>

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
				<p class="mt-1 text-sm break-words">{renderText(block.text)}</p>
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
						<label class="chip" data-checked={resultStore.isTicked(block.id, item)}>
							<input
								type="checkbox"
								class="sr-only"
								checked={resultStore.isTicked(block.id, item)}
								onchange={() => resultStore.toggle(block.id, item)}
							/>
							{localizeResultItem(item)}
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
</div>
