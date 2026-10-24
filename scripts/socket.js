import { SOCKET_NAME } from './constants.js';
import {
	execPartyCoins,
	execPartyItem,
	execSplitCoins,
	execTakeCoins,
	execTakeItem,
} from './transactions.js';

const REQUEST_TIMEOUT_MS = 15000;

const handlers = {
	takeItem: execTakeItem,
	takeCoins: execTakeCoins,
	splitCoins: execSplitCoins,
	partyItem: execPartyItem,
	partyCoins: execPartyCoins,
};

const pending = new Map();

// Requests are handled one at a time, so two players reaching for the same
// object cannot both get it.
let queue = Promise.resolve();

export function registerSocket() {
	game.socket.on(SOCKET_NAME, onMessage);
}

function onMessage(message) {
	if (!message || typeof message !== 'object') return;

	if (message.type === 'request') {
		if (!game.user.isGM || game.users.activeGM?.id !== game.user.id) return;
		void run(message.action, message.userId, message.payload).then((result) => {
			game.socket.emit(SOCKET_NAME, {
				type: 'response',
				requestId: message.requestId,
				toUserId: message.userId,
				result,
			});
		});
		return;
	}

	if (message.type === 'response' && message.toUserId === game.user.id) {
		const entry = pending.get(message.requestId);
		if (!entry) return;
		window.clearTimeout(entry.timer);
		pending.delete(message.requestId);
		entry.resolve(message.result);
	}
}

function run(action, userId, payload) {
	const handler = handlers[action];
	if (!handler) return Promise.resolve({ ok: false, error: 'NIMBLE_LOOT.errors.unknownAction' });

	const result = queue.then(() => handler(userId, payload ?? {})).catch((error) => {
		console.error(`nimble-loot-actor | ${action} failed`, error);
		return { ok: false, error: 'NIMBLE_LOOT.errors.failed' };
	});
	queue = result;
	return result;
}

/**
 * Carry out a loot transfer. A GM does it directly; a player asks the active
 * GM over the socket and waits for the answer. Always resolves to
 * `{ ok, data?, error? }`, with `error` a localization key.
 */
export function requestTransaction(action, payload) {
	if (game.user.isGM) return run(action, game.user.id, payload);

	if (!game.users.activeGM) {
		return Promise.resolve({ ok: false, error: 'NIMBLE_LOOT.errors.noGM' });
	}

	const requestId = foundry.utils.randomID();
	return new Promise((resolve) => {
		const timer = window.setTimeout(() => {
			pending.delete(requestId);
			resolve({ ok: false, error: 'NIMBLE_LOOT.errors.timeout' });
		}, REQUEST_TIMEOUT_MS);
		pending.set(requestId, { resolve, timer });
		game.socket.emit(SOCKET_NAME, {
			type: 'request',
			requestId,
			userId: game.user.id,
			action,
			payload,
		});
	});
}
