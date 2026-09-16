/**
 * Shared generator contracts.
 *
 * Three shapes matter here and each exists to stop a specific mistake:
 *
 *   - {@link GeneratorContext} is everything a generator may know. It carries the
 *     seed *object* rather than a name and date, so no generator can derive a
 *     second seed and break the one-derivation-per-run invariant. `date` stays a
 *     pre-formatted string for the same reason — a `Date` would let a
 *     locale-dependent format creep back in and silently change every result.
 *   - {@link GenerationResult} is structured data rather than rendered markup. The
 *     result store, the history screen and the clipboard all read this object, so a
 *     result that came back as HTML could not be stored, re-rendered or copied
 *     reliably.
 *   - {@link GeneratorDefinition} makes actions, options and defaults per
 *     generator, so the generate screen renders any of them without a hand-written
 *     branch for each.
 */

import type { BoxState, CommonOptions } from '../api/types';
import type { IconName } from '../icons';
import type { OperatorJob } from '../core/operators';
import type { Seed } from '../core/seed';

/**
 * The operator dictionary, pre-indexed.
 *
 * Injected rather than pulled in directly, so a generator cannot reach for a different
 * index than the one its caller built, and so tests can drive one against a small
 * synthetic dictionary.
 */
export interface OperatorIndex {
	/** The eight jobs, in `JOB_ALIAS_MAP`'s declaration order. */
	jobs: readonly OperatorJob[];
	/** `byStar['6']['先锋']` -> six-star vanguards, in dictionary order. */
	byStar: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
	/** Every six-star, jobs in {@link jobs} order. */
	star6: readonly string[];
}

/** Everything a generator is allowed to know about the current session. */
export interface GeneratorContext {
	operators: OperatorIndex;
	/** The user's box. Stores *excluded* six-stars. */
	box: BoxState;
	/** Identity name from the settings screen; the only source of the name part. */
	name: string;
	/** `yyyy/M/d`, produced by `formatDate`. */
	date: string;
	/** The run's single seed, already derived from `(name, date)`. */
	seed: Seed;
	/** This generator's own option values, keyed by `OptionField.key`. */
	options: Record<string, unknown>;
	/** Options shared by every generator. */
	common: CommonOptions;
}

/**
 * One button on the generate screen.
 *
 * `level` is not a user-facing count: the drama algorithm bans `level + 1` operators
 * and picks `level`, so 1/4/8/16 picks are levels 0/3/7/15. The three BP actions are
 * named after their pick count (`bp4`, `bp8`, `bp16`), not after their level, and the
 * translation between the two is exactly this `level + 1`.
 *
 * An `emphasis` field for per-button colours is deliberately absent: every action
 * button is styled identically, so nothing would ever have set it. (The layout
 * still differs — the opening draw has its own row — but that is not something a
 * per-button colour would express.)
 */
export interface GeneratorAction {
	/** `opening` | `bp4` | `bp8` | `bp16` | `draw10` … */
	id: string;
	/** i18n key for the button label. */
	labelKey: string;
	/** Passed to the generator as `level`. */
	level: number;
}

/**
 * A piece of display text, before it is localised.
 *
 * Results are re-renderable rather than pre-rendered. A generator that composed
 * `"我掐指一算，今天 …"` itself could only ever produce that one language, and the same
 * text also has to be re-rendered by the history screen when the locale changes. So a
 * generator names *which* message it means and the bits that vary, and
 * `$lib/i18n/names` substitutes the proper nouns at render time.
 *
 * `name` is a single proper noun, `names` a list joined the locale's way, and `picks` a
 * class -> operators map in the locale's own punctuation. All three exist because the
 * separators differ: `A、B；C` is not `A, B; C`.
 */
export type TextSpec =
	| { kind: 'name'; name: string }
	| { kind: 'names'; names: readonly string[] }
	| { kind: 'picks'; picks: Readonly<Record<string, readonly string[]>> }
	| { kind: 'key'; key: string; params?: Record<string, string | number | TextSpec> };

/**
 * One piece of a rendered result.
 *
 * The variants are what the generate screen knows how to draw; adding a variant
 * means adding a renderer, not loosening a string.
 */
export type ResultBlock =
	| { type: 'text'; text: TextSpec }
	/** A labelled string the user is expected to copy verbatim. */
	| { type: 'copyable'; label: TextSpec; text: TextSpec }
	/**
	 * Tickable items. `id` is the tick-store key, namespaced as `picks:<职业>` or
	 * `pool:<用途>`.
	 *
	 * `items` may contain duplicates — 老缠杯 draws ten operators with repeats
	 * allowed — so renderers must key by position, and a tick is per *name*: ticking
	 * one 棘刺 ticks every 棘刺, which is what a "have I used this operator" list
	 * means.
	 *
	 * The tick key stays the Chinese name even in English: it is what the result store
	 * and the history entry agree on, and localising it would make a tick survive a
	 * language change only by accident.
	 */
	| { type: 'checklist'; id: string; items: string[]; label?: TextSpec }
	| { type: 'note'; lines: TextSpec[] };

/** What a generator produces: a summary, flat fields, and renderable blocks. */
export interface GenerationResult {
	generatorId: string;
	/** The headline, e.g. "我掐指一算，今天 X 适合在 Y 用 Z W 开局" once rendered. */
	summary: TextSpec;
	/** Structured fields for history and later analysis. Never markup. */
	fields: Record<string, string>;
	blocks: ResultBlock[];
}

/**
 * A declarative option, so the settings screen renders a generator's options
 * without a hand-written form for each.
 */
export type OptionField =
	| { key: string; type: 'switch'; labelKey: string; helpKey?: string; default: boolean }
	| {
			key: string;
			type: 'select';
			labelKey: string;
			default: string;
			choices: { value: string; labelKey: string }[];
	  }
	| { key: string; type: 'number'; labelKey: string; default: number; min: number; max: number };

/**
 * One generator. Every cup's rule set is its own definition; the ones sharing a
 * `family` are grouped into a horizontal tab strip on the generate screen.
 */
export interface GeneratorDefinition {
	/** `opening` | `xianshu-6` | `xianshu-7` | `xianshu-8` | `laochan`. */
	id: string;
	/** Groups the cup's editions, e.g. `xianshu`. Absent for standalone ones. */
	family?: string;
	/**
	 * i18n key for the family's tab label, e.g. 仙术杯 while its editions are #6/#7/#8.
	 *
	 * Only meaningful alongside `family`. Without it the tab strip would label the
	 * group with its first member's name ("仙术杯 #6"), which reads as a missing tab
	 * rather than as a group.
	 */
	familyNameKey?: string;
	nameKey: string;
	descriptionKey: string;
	/**
	 * The icon shown on the generator selection page.
	 *
	 * Typed as {@link IconName} rather than `string`: the app ships hand-drawn SVG paths
	 * and has no icon font, so an icon name that is not in `ICON_PATHS` renders as
	 * nothing at all. Making it a union means a typo is a compile error instead of a
	 * blank square somebody notices in a screenshot.
	 */
	icon: IconName;
	actions: readonly GeneratorAction[];
	options: readonly OptionField[];
	defaultOptions: Record<string, unknown>;
	/**
	 * Read-only rules shown above the action buttons in the constraint banner,
	 * e.g. "肉鸽固定萨卡兹 · 整局禁用维什戴尔".
	 *
	 * The keys live on the definition because the rules are the generator's own, and
	 * they are shown before anything is generated: a user who finds a setting ignored
	 * needs to know why at that moment, not in the result.
	 */
	constraintKeys?: readonly string[];
	/**
	 * Runs one generation.
	 *
	 * The action is a second argument rather than something folded into `ctx`: it
	 * has to reach the algorithm somehow, and an explicit parameter is clearer than
	 * smuggling the level through `options`, which is for user-facing settings.
	 */
	generate(ctx: GeneratorContext, action: GeneratorAction): GenerationResult;
}
