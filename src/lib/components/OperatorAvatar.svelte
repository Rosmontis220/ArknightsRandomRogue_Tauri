<script lang="ts">
	/**
	 * One operator, drawn as their portrait or as their name.
	 *
	 * The single place that decides between the two, so "portrait mode" cannot end up
	 * half-applied — a screen that rendered names while its neighbour rendered portraits
	 * would be the predictable result of each screen doing its own `if`.
	 *
	 * Three inputs, all required to be explicit rather than defaulted:
	 *
	 *   `mode`   — whether portrait mode is on at all. The caller reads the setting, because
	 *              only the caller knows whether this particular list is exempt. The opening
	 *              recommendation is: it is the line a user retypes elsewhere, so it stays
	 *              as names however the setting is set.
	 *   `masked` — draw the grey wash over the portrait. Used for operators who are out of
	 *              reach: banned in a result, or not in the box on the box screen.
	 *   `size`   — the only visual variation there is.
	 *
	 * A name with no portrait falls back to the name in every mode. That is not a degraded
	 * case to be handled later: the dictionary and the portrait set are two files that can
	 * legitimately disagree, and a name is a complete answer.
	 */

	import { operatorAvatarUrl } from '$lib/core/avatars';
	import { localizeResultItem } from '$lib/i18n/names';

	let {
		name,
		mode,
		masked = false,
		size = 'md',
		title
	}: {
		name: string;
		mode: boolean;
		masked?: boolean;
		size?: 'sm' | 'md' | 'lg';
		/** Overrides the tooltip; defaults to the operator's localised name. */
		title?: string;
	} = $props();

	const url = $derived(mode ? operatorAvatarUrl(name) : null);
	const label = $derived(localizeResultItem(name));
	const tooltip = $derived(title ?? label);
</script>

{#if url === null}
	<span class="name" title={tooltip}>{label}</span>
{:else}
	<span class="portrait" class:masked data-size={size} title={tooltip}>
		<img src={url} alt={label} draggable="false" />
	</span>
{/if}

<style>
	.name {
		white-space: nowrap;
	}

	.portrait {
		position: relative;
		display: inline-block;
		flex: none;
		overflow: hidden;
		border: 1px solid var(--c-border);
		border-radius: 8px;
		background: var(--c-surface-2);
	}

	.portrait[data-size='sm'] {
		width: 1.75rem;
		height: 1.75rem;
	}

	.portrait[data-size='md'] {
		width: 2.5rem;
		height: 2.5rem;
	}

	.portrait[data-size='lg'] {
		width: 4rem;
		height: 4rem;
	}

	.portrait img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* The grey wash. Deliberately a fixed grey rather than a theme token: its whole job is
	 * to read as "out of reach" against four different colour schemes, and a token would
	 * have to be re-tuned per theme to keep saying the same thing. It sits above the image
	 * and below nothing, so the portrait underneath stays visible through it. */
	.portrait.masked::after {
		position: absolute;
		inset: 0;
		background: var(--c-mask);
		content: '';
	}
</style>
