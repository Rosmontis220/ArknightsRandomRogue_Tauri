/**
 * Small formatting helpers shared by the generators and the screens that render
 * their results.
 *
 * These live here rather than in a component because the same strings end up in
 * three places — the result area, the clipboard, and the history entry — and the
 * three must agree. Deriving all three from one implementation is what keeps them
 * in step: there is no second code path that can drift.
 */

/**
 * Renders a job -> operators map as the one-line form the tool has always shown:
 * `先锋：A、B；近卫：C`.
 *
 * Job order is the map's own insertion order, which the generators build in the
 * dictionary's job order.
 */
export function picksAsText(picks: Readonly<Record<string, readonly string[]>>): string {
	return Object.entries(picks)
		.map(([job, names]) => `${job}：${names.join('、')}`)
		.join('；');
}

/** Joins names for display and clipboard, using the tool's usual separator. */
export function namesAsText(names: readonly string[]): string {
	return names.join('、');
}
