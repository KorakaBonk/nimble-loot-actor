import { MODULE_ID, SETTINGS } from './constants.js';
import { canUserLoot, isLootActor } from './loot-actor.js';
import { getSetting } from './settings.js';

/**
 * A player who does not own a loot token can neither select nor open it in
 * core Foundry. These patches let them open its sheet by clicking it, while
 * keeping them from selecting or dragging it.
 */
function isLootFor(token, user) {
	const actor = token.actor;
	if (!user || user.isGM || !isLootActor(actor) || actor.isOwner) return false;
	if (game.activeTool === 'target') return false;
	return canUserLoot(actor, user);
}

function openLoot(token) {
	token.actor?.sheet?.render({ force: true });
}

function wrap(proto, name, wrapper) {
	const original = proto[name];
	if (typeof original !== 'function') {
		console.warn(`${MODULE_ID} | Token#${name} not found; clicking loot tokens may not open them.`);
		return;
	}
	proto[name] = function (...args) {
		return wrapper.call(this, original, ...args);
	};
}

export function patchTokenClicks() {
	const proto = CONFIG.Token.objectClass?.prototype;
	if (!proto) return;

	// Single clicks are only delivered to tokens the user can control.
	wrap(proto, '_canControl', function (original, user, event) {
		if (isLootFor(this, user) && getSetting(SETTINGS.singleClick)) return true;
		return original.call(this, user, event);
	});

	wrap(proto, '_canView', function (original, user, event) {
		if (isLootFor(this, user)) return true;
		return original.call(this, user, event);
	});

	wrap(proto, '_canDrag', function (original, user, event) {
		if (isLootFor(this, user)) return false;
		return original.call(this, user, event);
	});

	wrap(proto, 'control', function (original, ...args) {
		if (isLootFor(this, game.user)) return false;
		return original.apply(this, args);
	});

	wrap(proto, '_onClickLeft', function (original, event) {
		if (isLootFor(this, game.user) && getSetting(SETTINGS.singleClick)) {
			openLoot(this);
			return;
		}
		return original.call(this, event);
	});

	wrap(proto, '_onClickLeft2', function (original, event) {
		if (isLootFor(this, game.user)) {
			openLoot(this);
			return;
		}
		return original.call(this, event);
	});
}
