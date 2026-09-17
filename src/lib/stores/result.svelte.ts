/**
 * The generate screen's current result and its tick state.
 *
 * Out of the page component because the tick state has to survive re-renders and
 * be reset as one unit when a new run is generated: tick state held in the DOM is
 * discarded when the result re-renders, so it is kept here instead.
 */

import type { GenerationResult, ResultBlock } from '../generators/types';

/** NUL, because an operator or job name cannot contain one. */
const KEY_SEPARATOR = '\u0000';

function tickKey(blockId: string, item: string): string {
	return `${blockId}${KEY_SEPARATOR}${item}`;
}

class ResultStore {
	result = $state<GenerationResult | null>(null);

	/**
	 * The ID the current result was drawn for.
	 *
	 * Kept beside the result instead of being read from the app state when it is needed:
	 * the export has to name the ID the run belongs to, and the user can edit their ID
	 * while a result is still on screen — which would quietly relabel somebody else's run.
	 */
	identity = $state('');

	/** A human-readable failure, or `null`. Mirrors `appState.error`. */
	error = $state<string | null>(null);

	/** Tick keys; see {@link isTicked}. */
	ticked = $state(new Set<string>());

	/** Replaces the result, clearing every tick from the previous run. */
	set(result: GenerationResult, identity: string): void {
		this.result = result;
		this.identity = identity;
		this.error = null;
		this.ticked = new Set();
	}

	/**
	 * Records a failure.
	 *
	 * The previous result is dropped rather than kept behind the message: showing
	 * a stale run next to "generation failed" invites acting on the wrong one.
	 */
	fail(message: string): void {
		this.result = null;
		this.identity = '';
		this.error = message;
		this.ticked = new Set();
	}

	clear(): void {
		this.result = null;
		this.identity = '';
		this.error = null;
		this.ticked = new Set();
	}

	isTicked(blockId: string, item: string): boolean {
		return this.ticked.has(tickKey(blockId, item));
	}

	toggle(blockId: string, item: string): void {
		const next = new Set(this.ticked);
		const key = tickKey(blockId, item);
		if (next.has(key)) {
			next.delete(key);
		} else {
			next.add(key);
		}
		this.ticked = next;
	}

	/** The checklist blocks of the current result, for rendering. */
	get checklists(): { id: string; items: string[] }[] {
		return (this.result?.blocks ?? []).filter(
			(block): block is Extract<ResultBlock, { type: 'checklist' }> => block.type === 'checklist'
		);
	}
}

export const resultStore = new ResultStore();
