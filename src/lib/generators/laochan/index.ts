/**
 * 老缠杯 (LAO CHAN BEI), as a family of three editions.
 *
 * Each edition produces *two* things at once, and both are part of the result:
 *
 *   1. a complete drama run — the same core 开局生成器 and the 仙术杯 editions use: a
 *      pinned theme, a squad, an opening operator, the bans drawn by the action and the
 *      per-class picks;
 *   2. the edition's pool of N six-stars, which is the mechanic the event is named for:
 *      the run may use only those N operators, so the pool is as much a part of the
 *      result as the picks are.
 *
 * ## One table, one builder
 *
 * Three editions share one algorithm, so the editions are data
 * ({@link LAOCHAN_EDITIONS}) and the algorithm is written once
 * ({@link buildLaochanEdition}) — the same shape as {@link XIANSHU_EDITIONS}. The three
 * differ in exactly three ways: which theme they pin, how big their pool is, and whether
 * two names are weighted inside it.
 *
 * | edition | theme                  | pool | pool weighting              |
 * |---------|------------------------|------|-----------------------------|
 * | #1      | 探索者的银凇止境 (萨米)  | 10   | 老鲤 / 琳琅诗怀雅 ×5        |
 * | #2      | 萨卡兹的无终奇语        | 12   | none                        |
 * | #3      | 岁的界园志异 (界园)     | 10   | none                        |
 *
 * ## Why the pool draw derives seeds
 *
 * The pool is N *distinct* operators: "this run may use these ten" is a list of ten
 * different operators, so a name is taken out of the pool once it is in. Two things then
 * need a derived child seed:
 *
 *   - a single seed against a pool of a fixed length would land on the same index every
 *     time, so a plain modulo would hand out one operator N times (this is the reason
 *     `Seed.derive` exists at all);
 *   - the per-edition salt is not "extra randomness" but what keeps three editions from
 *     dealing the identical pool to the same user on the same day, which they would
 *     otherwise do because they all start from the run's one seed. The salt is data
 *     ({@link LaochanEdition.poolSalt}) so a copied edition cannot silently share
 *     another's pool.
 *
 * ## The easter egg
 *
 * One identity narrows the pool to 棘刺 / 引星棘刺 (see {@link isLaochanEasterEgg}). It is
 * deliberately *not* announced anywhere in the result: the narrowed pool is the joke, and
 * a line reading "easter egg detected" is the one thing that would give it away.
 */

import { isUnavailable } from '../../api/types';
import { ROGUE_ID_JIEYUAN, ROGUE_ID_SAMI, ROGUE_ID_SARKAZ } from '../../core/rogues';
import { t } from '../../i18n';
import { DRAMA_ACTIONS } from '../actions';
import { dramaBlocks, dramaFields, runDrama, type DramaOutcome } from '../drama';
import { namesAsText } from '../format';
import { buildWeightedBanPool, removeAll } from '../weighted';
import type {
	GenerationResult,
	GeneratorContext,
	GeneratorDefinition,
	ResultBlock,
	TextSpec
} from '../types';

/**
 * The easter egg: this one ID narrows the pool to two operators, so all ten draws can
 * only ever be 棘刺 and 引星棘刺.
 *
 * 棘刺 and 引星棘刺 are genuinely different dictionary entries, which is what makes the
 * joke work.
 */
export const LAOCHAN_EASTER_EGG_NAME = '逗比寒MillerRHan';

const LAOCHAN_EASTER_EGG_POOL: readonly string[] = ['棘刺', '引星棘刺'];

/** True when the configured ID triggers the easter egg. */
export function isLaochanEasterEgg(name: string): boolean {
	return name === LAOCHAN_EASTER_EGG_NAME;
}

/**
 * 老缠杯 #1's pool weighting: how many copies each name occupies in the draw pool.
 *
 * 老鲤 and 琳琅诗怀雅 are five times as likely to come up as anyone else — the event's
 * own quirk. Copies, not percentages: the generator has no notion of probability, and
 * duplicating an entry is how a multiplier is expressed without breaking determinism
 * (the same device as `XIANSHU_8_BAN_WEIGHTS`).
 *
 * Public because it is the generator's *data* rather than an implementation detail: the
 * tests assert the table directly as well as its effect on the draw, so a wrong number
 * cannot hide behind a plausible-looking hand.
 */
export const LAOCHAN_1_POOL_WEIGHTS: Readonly<Record<string, number>> = {
	老鲤: 5,
	琳琅诗怀雅: 5
};

/**
 * What one edition's pool draw needs.
 *
 * Split out from {@link LaochanEdition} so the draw can be driven on its own — a test can
 * point it at a synthetic pool spec without building a whole edition.
 */
export interface LaochanPoolSpec {
	/** How many six-stars the edition hands the run. */
	readonly poolSize: number;
	/**
	 * Salt for this edition's child seed.
	 *
	 * Unique per edition, and the only reason three editions do not deal the same hand:
	 * they all start from the run's single seed, so without a distinguishing salt they
	 * would draw the same indices from the same pool.
	 */
	readonly poolSalt: string;
	/** Copies per name in the draw pool; default 1. Present only on edition #1. */
	readonly poolWeights?: Readonly<Record<string, number>>;
}

interface LaochanEdition extends LaochanPoolSpec {
	/** The number the event writes, and the tail of the generator id: `1`, `2`, `3`. */
	readonly edition: string;
	/**
	 * The same number as a message-key fragment.
	 *
	 * Separate from `edition` for the same reason 仙术杯's is: the catalogue is a flat
	 * record of dotted strings, so a number that could not be a key fragment (like
	 * `1.5`) must still be able to appear in the id.
	 */
	readonly keySuffix: string;
	readonly rogueId: number;
}

/** Every edition, in the order the generate screen lists them. */
export const LAOCHAN_EDITIONS: readonly LaochanEdition[] = [
	{
		edition: '1',
		keySuffix: '1',
		rogueId: ROGUE_ID_SAMI,
		poolSize: 10,
		poolSalt: 'laochan-1-pool',
		poolWeights: LAOCHAN_1_POOL_WEIGHTS
	},
	{
		edition: '2',
		keySuffix: '2',
		rogueId: ROGUE_ID_SARKAZ,
		poolSize: 12,
		poolSalt: 'laochan-2-pool'
	},
	{
		edition: '3',
		keySuffix: '3',
		rogueId: ROGUE_ID_JIEYUAN,
		poolSize: 10,
		poolSalt: 'laochan-3-pool'
	}
];

/** The i18n key prefix for one edition, e.g. `generator.laochan3`. */
export function laochanKeyPrefix(edition: string): string {
	const spec = LAOCHAN_EDITIONS.find((candidate) => candidate.edition === edition);

	if (spec === undefined) {
		throw new RangeError(`unknown 老缠杯 edition ${edition}`);
	}
	return `generator.laochan${spec.keySuffix}`;
}

/**
 * The six-stars a pool may draw from: the ones in the box that the user can field.
 *
 * A `filter`, never a splice — `ctx.operators.star6` is the shared dictionary list, so
 * mutating it would corrupt every later generation in the session.
 *
 * Both exclusion reasons go through
 * {@link isUnavailable}: "not in the box" and "owned but not promoted" keep an operator
 * out of the draw, and a generator that consulted only `box.excluded` would quietly field
 * an operator the user cannot use. Reading the two lists by hand here is exactly the
 * mistake the predicate exists to prevent.
 */
function availableSixStars(ctx: GeneratorContext): string[] {
	return ctx.operators.star6.filter((name) => !isUnavailable(ctx.box, name));
}

/**
 * The edition's drawn pool: `poolSize` distinct six-stars.
 *
 * The pool is what the run may field, so it is a set of different operators rather than a
 * sequence that may repeat one: a name is taken out of the pool once it is in it. Two things
 * can shorten it: a box that cannot field `poolSize` operators (the run is then played with
 * whatever is left), and the easter egg, whose narrowed pool is only two names.
 *
 * @throws RangeError when the box holds no six-star the user can field — the same
 *   user-reachable state the other generators reject rather than answer with `undefined`.
 */
export function drawLaochanPool(ctx: GeneratorContext, spec: LaochanPoolSpec): string[] {
	// The egg narrows *what the run may field* to two names; it does not bypass the box. An
	// operator the user cannot field is still not fieldable, so the two names go through the
	// same availability filter as everyone else rather than around it.
	let source = isLaochanEasterEgg(ctx.name)
		? LAOCHAN_EASTER_EGG_POOL.filter((name) => !isUnavailable(ctx.box, name))
		: availableSixStars(ctx);

	if (source.length === 0) {
		throw new RangeError(t('error.boxEmpty'));
	}

	// Expanded once, before any draw: a weighted name occupies more slots, so the modulo
	// below lands on it more often. Nothing here is random, so the weighting stays as
	// reproducible as the rest of the run.
	if (spec.poolWeights !== undefined) {
		source = buildWeightedBanPool(source, spec.poolWeights);
	}

	const pool = [...source];
	const drawn: string[] = [];

	for (let index = 0; index < spec.poolSize && pool.length > 0; index++) {
		// One child seed per edition, one per draw: the edition salt keeps the three
		// editions apart, and deriving each draw from that child (rather than chaining
		// child onto child) keeps draw `k` independent of how many came before it.
		const seed = ctx.seed.derive(spec.poolSalt).derive(`draw-${index}`);
		const name = pool[seed.value % pool.length];

		drawn.push(name);
		// A drawn name leaves the pool *entirely* — every weighted copy of it. Leaving the
		// other four copies of a ×5 name behind would let the next seed draw it again, and
		// the pool would name the same operator twice: the run may use ten operators, not
		// one operator five times.
		removeAll(pool, name);
	}

	// Fewer than `poolSize` available is the user's box being nearly empty, not an error:
	// the run is played with everything that could be drawn. An empty one is an error —
	// see above — because "play with none of the six-stars" is not a run.
	return drawn;
}

/** The number of six-stars edition #1 and #3 hand out; #2 deals twelve. */
export const LAOCHAN_DRAW_COUNT = 10;

/** Shared result shaping; all three editions produce the same blocks from one outcome. */
function laochanResult(
	generatorId: string,
	cupNameKey: string,
	ctx: GeneratorContext,
	pool: string[],
	outcome: DramaOutcome
): GenerationResult {
	// The run's headline is the cup headline, exactly as 仙术杯's is: what varies between
	// the editions is the theme, not the sentence.
	const summary: TextSpec = {
		kind: 'key',
		key: 'result.summary.cup',
		params: {
			cup: { kind: 'key', key: cupNameKey },
			name: ctx.name,
			rogue: { kind: 'name', name: outcome.rogueName },
			team: { kind: 'name', name: outcome.teamName },
			operator: { kind: 'name', name: outcome.openingOperator }
		}
	};

	// The pool's own headline and its two renderings. `count` selects the `.one` /
	// `.other` variant, which is why it is passed rather than baked into the sentence.
	const poolSummary: TextSpec = {
		kind: 'key',
		key: 'result.summary.laochan',
		params: { name: ctx.name, count: pool.length }
	};

	const poolBlocks: ResultBlock[] = [
		{ type: 'text', text: poolSummary },
		{
			type: 'copyable',
			label: { kind: 'key', key: 'result.laochanPool' },
			text: { kind: 'names', names: pool }
		},
		// One tick per operator. The pool holds distinct names, so a tick means exactly
		// "this operator of the pool has been used".
		{
			type: 'checklist',
			id: 'pool:本局可用',
			label: { kind: 'key', key: 'field.laochanPool' },
			items: pool
		}
	];

	// The drama blocks minus the summary block they open with, which is placed at the top of
	// this result instead. Filtered by identity rather than by position, so the pool stays
	// correct even if the drama blocks ever change their order.
	const drama = dramaBlocks(summary, outcome).filter(
		(block) => !(block.type === 'text' && block.text === summary)
	);

	return {
		generatorId,
		summary,
		fields: {
			...dramaFields(outcome),
			laochan_pool: namesAsText(pool)
		},
		blocks: [{ type: 'text', text: summary }, ...poolBlocks, ...drama]
	};
}

function buildLaochanEdition(spec: LaochanEdition): GeneratorDefinition {
	const id = `laochan-${spec.edition}`;
	const key = `generator.laochan${spec.keySuffix}`;

	return {
		id,
		family: 'laochan',
		familyNameKey: 'generator.laochan.name',
		nameKey: `${key}.name`,
		descriptionKey: `${key}.description`,
		icon: 'cards',
		actions: DRAMA_ACTIONS,
		options: [],
		defaultOptions: {},
		constraintKeys: [`${key}.constraint`],
		generate: (ctx, action) => {
			// The theme is pinned, so the drama core skips the theme draw entirely — the
			// event used one theme, and the enabled set is the user's preference rather
			// than a fact about the event.
			const outcome = runDrama(ctx, action.level, { forcedRogueId: spec.rogueId });

			return laochanResult(id, `${key}.name`, ctx, drawLaochanPool(ctx, spec), outcome);
		}
	};
}

/** Every edition as a definition, in edition order. The registry lists this. */
export const laochanGenerators: readonly GeneratorDefinition[] =
	LAOCHAN_EDITIONS.map(buildLaochanEdition);

/**
 * One edition by number.
 *
 * Named lookups rather than only the list, because the tests and the registry refer to
 * specific editions and `laochanGenerators[1]` would silently become #3 if an edition were
 * ever inserted.
 */
function edition(editionNumber: string): GeneratorDefinition {
	const found = laochanGenerators.find((generator) => generator.id === `laochan-${editionNumber}`);

	if (found === undefined) {
		throw new RangeError(`unknown 老缠杯 edition ${editionNumber}`);
	}
	return found;
}

export const laochan1Generator = edition('1');
export const laochan2Generator = edition('2');
export const laochan3Generator = edition('3');