/**
 * The persisted document, mirroring `src-tauri/src/state.rs` one for one.
 *
 * The Rust side owns the file and this side owns the meaning, so the two must
 * agree exactly — including the camelCase wire names and the `box` key (Rust
 * renames its `box_state` field to `box` because `box` is a keyword there).
 *
 * `excluded` rather than `included` is deliberate: an operator added
 * to the dictionary later is then in the box by default, so nobody has to revisit
 * the box screen after a game update.
 */

/** Bumped whenever the shape changes in a way older files cannot satisfy. */
export const SCHEMA_VERSION = 1;

/**
 * The interface language.
 *
 * Declared here rather than imported from `$lib/i18n`: this module mirrors `state.rs` and
 * deliberately depends on nothing, which is what lets the Rust and TypeScript shapes be
 * compared directly. `$lib/i18n` re-exports the same union, and a test pins them together.
 */
export type AppLocale = 'zh-CN' | 'en';

/** Every locale the document may carry. The order is the order they are offered in. */
export const APP_LOCALES: readonly AppLocale[] = ['zh-CN', 'en'];

export type ColorScheme = 'rhodes' | 'endfield' | 'p5' | 'p3r';
export type ReduceMotion = 'always' | 'never' | 'system';

export interface IdentityState {
	/** The player name; the only source of the seed's name part. */
	name: string;
}

export interface AppearanceState {
	colorScheme: ColorScheme;
	reduceMotion: ReduceMotion;
	/**
	 * The interface language.
	 *
	 * Persisted in the state document rather than read from the webview's own locale
	 * detection: an explicit choice has to survive a restart, and the app ships two
	 * catalogues rather than negotiating a language.
	 */
	locale: AppLocale;
	/**
	 * The splash background as a data URL, or `''` for none — in which case the
	 * splash is the plain theme background.
	 *
	 * Embedded in the state document rather than stored as a path beside it: Rust owns
	 * exactly one file and deliberately knows nothing about images, so a path here
	 * would mean a second file to keep in step with this one. `$lib/image` bounds the
	 * size before the value ever reaches the state, because this document is rewritten
	 * in full on every save.
	 */
	splashImage: string;
}

export interface BoxState {
	/** Six-star operators that are **not** in the user's box. */
	excluded: string[];
}

export interface CommonOptions {
	enabledRogueIds: number[];
	isJobTeamOnly: boolean;
	isSupportUnitEnabled: boolean;
}

export interface GeneratorState {
	current: string;
	currentByFamily: Record<string, string>;
	options: Record<string, Record<string, unknown>>;
}

export interface HistoryEntry {
	/** Unix milliseconds. */
	at: number;
	generatorId: string;
	actionId: string;
	identity: string;
	/** The deterministic seed; a full u32. */
	seed: number;
	/** Structured result fields; never rendered markup. */
	fields: Record<string, string>;
}

export interface AppState {
	schemaVersion: number;
	identity: IdentityState;
	appearance: AppearanceState;
	box: BoxState;
	common: CommonOptions;
	generators: GeneratorState;
	history: HistoryEntry[];
}

/** Rogue ids that start enabled, mirroring the Rust defaults. */
export const DEFAULT_ENABLED_ROGUE_IDS = [4, 5, 6, 7];

/** History is FIFO and capped. */
export const HISTORY_LIMIT = 200;

/**
 * The defaults must match `impl Default for AppState` in `state.rs`, otherwise a
 * fresh install and a repaired state file would behave differently.
 */
export function defaultAppState(): AppState {
	return {
		schemaVersion: SCHEMA_VERSION,
		identity: { name: '' },
		appearance: { colorScheme: 'rhodes', reduceMotion: 'system', locale: 'zh-CN', splashImage: '' },
		box: { excluded: [] },
		common: {
			enabledRogueIds: [...DEFAULT_ENABLED_ROGUE_IDS],
			isJobTeamOnly: false,
			isSupportUnitEnabled: false
		},
		generators: { current: 'opening', currentByFamily: {}, options: {} },
		history: []
	};
}
