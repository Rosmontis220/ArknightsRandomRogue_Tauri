/**
 * The single exit point for persistence.
 *
 * Settings live in a JSON file written by Rust
 * (atomic write, corrupt-file quarantine), **not** in `localStorage`. The one
 * exception is a mirror of the colour scheme, which `app.html` reads before the
 * first paint so the window never flashes the wrong theme.
 *
 * Outside the Tauri shell — `pnpm dev` opened in a normal browser — the commands
 * cannot exist at all, so this module falls back to `localStorage` to keep the UI
 * workable. That fallback is a development affordance only: it is loud about
 * itself ({@link isTauriRuntime} is surfaced in the settings screen) and it is
 * not the shipping path.
 */

import { invoke } from '@tauri-apps/api/core';

import type { AppState, AppearanceState, ColorScheme } from './api/types';
import { defaultAppState } from './api/types';
import { isLocale } from './i18n/locale.svelte';

/** Development-only stand-in used when there is no Tauri host. */
const DEV_STORAGE_KEY = 'kaiju.dev.state';

/** First-paint theme mirror; deliberately separate from the real state file. */
const THEME_MIRROR_KEY = 'kaiju:resolved-theme';

const COLOR_SCHEMES: readonly string[] = ['rhodes', 'endfield', 'p5', 'p3r'];

/** True when running inside the Tauri webview rather than a plain browser. */
export function isTauriRuntime(): boolean {
	return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** Renders an unknown thrown value as something worth showing a user. */
export function describeError(cause: unknown): string {
	if (typeof cause === 'string') return cause;
	if (cause instanceof Error) return cause.message;
	return String(cause);
}

function isColorScheme(value: unknown): value is ColorScheme {
	return typeof value === 'string' && COLOR_SCHEMES.includes(value);
}

/**
 * Reads the stored state, or `null` when there is nothing usable.
 *
 * A corrupt file is not an error here: the Rust side quarantines it as `.bak` and
 * answers `null`, so the caller falls back to defaults.
 */
export async function loadState(): Promise<AppState | null> {
	if (!isTauriRuntime()) {
		return readDevState();
	}
	return await invoke<AppState | null>('load_state');
}

/** Writes the state. Rust does the atomic temp-file-then-rename dance. */
export async function saveState(state: AppState): Promise<void> {
	if (!isTauriRuntime()) {
		writeDevState(state);
		return;
	}
	await invoke('save_state', { state });
}

/** Absolute path of the state file, for the data screen. `null` outside Tauri. */
export async function stateFilePath(): Promise<string | null> {
	if (!isTauriRuntime()) return null;
	return await invoke<string>('state_file_path');
}

/**
 * The colour scheme captured before the first paint, or `null`.
 *
 * Never throws: `localStorage` is unavailable in some privacy modes, and a
 * missing mirror only costs one themed frame.
 */
export function readThemeMirror(): ColorScheme | null {
	try {
		const raw = globalThis.localStorage?.getItem(THEME_MIRROR_KEY) ?? null;
		return isColorScheme(raw) ? raw : null;
	} catch {
		return null;
	}
}

/** Records the colour scheme for the next cold start. */
export function writeThemeMirror(scheme: ColorScheme): void {
	try {
		globalThis.localStorage?.setItem(THEME_MIRROR_KEY, scheme);
	} catch {
		// Storage unavailable or full; the app still works, it just may flash.
	}
}

function readDevState(): AppState | null {
	try {
		const raw = globalThis.localStorage?.getItem(DEV_STORAGE_KEY);
		return raw ? normalizeState(JSON.parse(raw) as Partial<AppState>) : null;
	} catch {
		return null;
	}
}

/**
 * Fills in whatever a stored document predates.
 *
 * The Tauri path does not need this: `state.rs` carries `#[serde(default)]` on the
 * fields added after the first release, and its `migrate` is the hook for anything
 * cleverer. This mirrors that behaviour because the development fallback is the only
 * way to reach the app without Rust, and a browser profile left over from an earlier
 * build would otherwise hand the UI an object with keys missing that its type claims
 * are present.
 *
 * Section by section rather than a single spread: a shallow spread would let a stored
 * `appearance` replace the whole default object and drop every field it does not
 * mention — precisely the failure this exists to prevent.
 */
export function normalizeState(raw: Partial<AppState>): AppState {
	const base = defaultAppState();

	return {
		...base,
		...raw,
		identity: { ...base.identity, ...raw.identity },
		appearance: normalizeAppearance(base.appearance, raw.appearance),
		box: { ...base.box, ...raw.box },
		common: { ...base.common, ...raw.common },
		generators: { ...base.generators, ...raw.generators },
		history: raw.history ?? base.history
	};
}

/**
 * Appearance needs more than a spread: `locale` is the one field whose value has to be
 * *recognised*, not merely present.
 *
 * Every other field degrades sensibly — an unknown colour scheme falls back to the default
 * when it is applied. A locale does not: an unrecognised one finds no catalogue at all and
 * renders the entire interface as raw keys, so it is narrowed here rather than trusted.
 */
function normalizeAppearance(
	base: AppearanceState,
	raw: Partial<AppearanceState> | undefined
): AppearanceState {
	const merged = { ...base, ...raw };

	return { ...merged, locale: isLocale(merged.locale) ? merged.locale : base.locale };
}

function writeDevState(state: AppState): void {
	try {
		globalThis.localStorage?.setItem(DEV_STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Ignored for the same reason as above.
	}
}
