import { MODULE_ID, SETTINGS } from './constants.js';

export function registerSettings() {
	game.settings.register(MODULE_ID, SETTINGS.announce, {
		name: 'NIMBLE_LOOT.settings.announce.name',
		hint: 'NIMBLE_LOOT.settings.announce.hint',
		scope: 'world',
		config: true,
		type: Boolean,
		default: true,
	});

	game.settings.register(MODULE_ID, SETTINGS.singleClick, {
		name: 'NIMBLE_LOOT.settings.singleClick.name',
		hint: 'NIMBLE_LOOT.settings.singleClick.hint',
		scope: 'world',
		config: true,
		type: Boolean,
		default: true,
	});
}

export function getSetting(key) {
	return game.settings.get(MODULE_ID, key);
}
