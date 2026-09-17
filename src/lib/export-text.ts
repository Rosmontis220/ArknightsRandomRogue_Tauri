/**
 * The exported form of a result.
 *
 * ## Why this shape is not in the message catalogue
 *
 * Everything else the app renders is translated. This is not, and that is a decision: the
 * export exists to be pasted into a Chinese-language community post or chat, where the
 * labels `ID：` / `主题：` / `BAN：` / `PICK:` are what readers scan for. Translating them
 * would produce a block nobody there recognises, and each reader could get a different one.
 *
 * The *values* are still localised, so an English-interface user exports their own names.
 *
 * The mixed punctuation is the specification, not an oversight: `BAN：` takes the fullwidth
 * colon and `PICK:` the ASCII one, with no space after either. It is reproduced exactly,
 * and there is a test pinning each character.
 *
 * ## Empty lines
 *
 * A line is emitted only when it has content. An opening draw bans and picks nobody, so it
 * exports as the one line that says something, rather than as two lines ending in a colon
 * and nothing — which reads as a broken export rather than as an accurate one.
 */

import { localizeFields } from './i18n/names';

/** The separator between the two ban sources and within each, matching the app's lists. */
const LIST_SEPARATOR = '、';

/**
 * Builds the text the 导出结果 button copies.
 *
 * `fields` is the same record a history entry stores, so the export can never disagree with
 * the archive; `identity` is passed in rather than read from the store so this stays a pure
 * function and is testable without a browser.
 */
export function exportText(identity: string, fields: Record<string, string>): string {
	const display = localizeFields(fields);

	// `fixed_ban` is the event's own permanent ban and `bans` the ones this run drew. They
	// are two fields because the app needs to tell them apart, but one list to a reader.
	const bans = [display.fixed_ban, display.bans]
		.filter((value) => value !== undefined && value !== '')
		.join(LIST_SEPARATOR);

	const lines = [
		`ID：${identity} 主题：${display.opening_rogue_name ?? ''} 分队：${display.opening_team_name ?? ''} 开局干员：${display.opening_operator_name ?? ''}`
	];

	if (bans !== '') lines.push(`BAN：${bans}`);

	const picks = display.picks ?? '';
	if (picks !== '') lines.push(`PICK:${picks}`);

	return lines.join('\n');
}