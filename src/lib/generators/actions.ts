/**
 * The four actions shared by every generator in the drama family.
 *
 * They live here rather than on one generator because 开局生成器 and 仙术杯 #6/#7/#8
 * all use the same four buttons — for the cups, the button only decides how many
 * operators are picked, since their bans are a fixed list.
 *
 * The order is ascending by level, and it is also the button order on the generate
 * screen: `actions[0]` renders as the primary button and the rest follow it. So 开局
 * leads and the three BP sizes run smallest to largest.
 */

import type { GeneratorAction } from './types';

export const DRAMA_ACTIONS: readonly GeneratorAction[] = [
	{ id: 'opening', labelKey: 'action.opening', level: 0 },
	{ id: 'bp4', labelKey: 'action.bp4', level: 3 },
	{ id: 'bp8', labelKey: 'action.bp8', level: 7 },
	{ id: 'bp16', labelKey: 'action.bp16', level: 15 }
];
