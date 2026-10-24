import { renderLootMessage } from './chat.js';
import { BANNER_IMAGE, LOOT_TYPE, MODULE_ID, SYSTEM_ID } from './constants.js';
import { registerLootActorType } from './loot-actor.js';
import { LootSheet } from './loot-sheet.js';
import { registerSettings } from './settings.js';
import { registerSocket } from './socket.js';
import { patchTokenClicks } from './token-clicks.js';

let active = false;

Hooks.once('init', () => {
	if (game.system.id !== SYSTEM_ID) {
		console.warn(`${MODULE_ID} | This module only works with the Nimble system.`);
		return;
	}

	registerSettings();
	active = registerLootActorType();
	if (!active) return;

	// Nimble's "Create Actor" dialog lists every class it knows, with a banner each.
	CONFIG.NIMBLE.actorTypeBanners ??= {};
	CONFIG.NIMBLE.actorTypeBanners[LOOT_TYPE] = BANNER_IMAGE;

	foundry.documents.collections.Actors.registerSheet(MODULE_ID, LootSheet, {
		types: [LOOT_TYPE],
		makeDefault: true,
		label: 'NIMBLE_LOOT.sheet.label',
	});
});

Hooks.on('renderChatMessageHTML', (message, html) => {
	if (active) renderLootMessage(message, html);
});

Hooks.once('setup', () => {
	if (!active) return;
	registerSocket();
	patchTokenClicks();
});
