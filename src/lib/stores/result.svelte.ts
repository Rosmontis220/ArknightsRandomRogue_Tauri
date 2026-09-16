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

	/** A human-readable failure, or `null`. Mirrors `appState.error`. */
	error = $state<string | null>(null);

	/** Tick keys; see {@link isTicked}. */
	ticked = $state(new Set<string>());

	/** Replaces the result, clearing every tick from the previous run. */
	set(result: GenerationResult): void {
		this.result = result;
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
		this.error = message;
		this.ticked = new Set();
	}

	clear(): void {
		this.result = null;
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
