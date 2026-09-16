/**
 * 老缠杯: draw ten six-star operators, repeats allowed, and play the whole run with
 * only those.
 *
 * Correctness rests on the rule assertions in `laochan.test.ts`: ten draws, repeats
 * allowed, the box honoured, and the easter-egg pool.
 *
 * ## Why this needs derived seeds
 *
 * The pool is deliberately *not* shrunk — repeats are part of the format — but a
 * fixed seed against a fixed-length pool makes `seed % pool.length` the same index
 * every time, so ten draws would return ten copies of one operator. Each draw
 * therefore uses `seed.derive('laochan-' + k)`, a deterministic child seed. This is
 * the only place in the app that derives, and it is why `Seed.derive` exists at all.
 *
 * Deriving from the run's seed each time rather than chaining (child of a child)
 * keeps draw `k` independent of how many draws came before it.
 */

import { namesAsText } from '../format';
import type {
	GenerationResult,
	GeneratorContext,
	GeneratorDefinition,
	ResultBlock,
	TextSpec
} from '../types';

export const LAOCHAN_DRAW_COUNT = 10;

/**
 * The easter egg: this one ID narrows the pool to two operators, so the ten draws
 * can only ever be 棘刺 and 引星棘刺.
 *
 * 棘刺 and 引星棘刺 are genuinely different dictionary entries, which is what makes
 * the joke work.
 */
export const LAOCHAN_EASTER_EGG_NAME = '逗比寒MillerRHan';

const LAOCHAN_EASTER_EGG_POOL: readonly string[] = ['棘刺', '引星棘刺'];

/** True when the configured ID triggers the easter egg. */
export function isLaochanEasterEgg(name: string): boolean {
	return name === LAOCHAN_EASTER_EGG_NAME;
}

/**
 * The ten draws.
 *
 * @throws RangeError when the box holds no six-star operators — the same
 *   user-reachable state the other generators reject rather than answer with
 *   `undefined`.
 */
export function drawLaochanPool(ctx: GeneratorContext): string[] {
	const pool = isLaochanEasterEgg(ctx.name)
		? [...LAOCHAN_EASTER_EGG_POOL]
		: ctx.operators.star6.filter((name) => !ctx.box.excluded.includes(name));

	if (pool.length === 0) {
		throw new RangeError('laochan: the box holds no six-star operators to draw from');
	}

	return Array.from(
		{ length: LAOCHAN_DRAW_COUNT },
		// The pool is read, never spliced: repeats are the point.
		(_, index) => pool[ctx.seed.derive(`laochan-${index}`).value % pool.length]
	);
}

/** Turns the drawn pool into renderable blocks and flat fields. */
export function laochanResult(ctx: GeneratorContext, pool: string[]): GenerationResult {
	const summary: TextSpec = {
		kind: 'key',
		key: 'result.summary.laochan',
		params: { name: ctx.name, count: pool.length }
	};

	const blocks: ResultBlock[] = [
		{ type: 'text', text: summary },
		{
			type: 'copyable',
			label: { kind: 'key', key: 'result.laochanPool' },
			text: { kind: 'names', names: pool }
		},
		// Duplicates are kept: drawing the same operator twice is a real outcome, and
		// hiding it would misrepresent the run.
		{
			type: 'checklist',
			id: 'pool:本局可用',
			label: { kind: 'key', key: 'field.laochanPool' },
			items: pool
		}
	];

	if (isLaochanEasterEgg(ctx.name)) {
		blocks.push({
			type: 'note',
			lines: [
				{
					kind: 'key',
					key: 'result.laochanEasterEgg',
					params: {
						first: { kind: 'name', name: LAOCHAN_EASTER_EGG_POOL[0] },
						second: { kind: 'name', name: LAOCHAN_EASTER_EGG_POOL[1] }
					}
				}
			]
		});
	}

	return {
		generatorId: 'laochan',
		summary,
		fields: { laochan_pool: namesAsText(pool) },
		blocks
	};
}

export const laochanGenerator: GeneratorDefinition = {
	id: 'laochan',
	nameKey: 'generator.laochan.name',
	descriptionKey: 'generator.laochan.description',
	icon: 'cards',
	// A single action: this mode has no ban/pick levels to choose from.
	actions: [{ id: 'draw10', labelKey: 'action.draw10', level: LAOCHAN_DRAW_COUNT }],
	options: [],
	defaultOptions: {},
	generate: (ctx) => laochanResult(ctx, drawLaochanPool(ctx))
};
