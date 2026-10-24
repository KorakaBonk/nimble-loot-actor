import { announce } from './chat.js';
import { chooseRecipient, promptCoins, promptQuantity, promptSplit } from './dialogs.js';
import { hasCoins, readPurse } from './lib/coins.js';
import { getQuantity, visibleName } from './lib/objects.js';
import { requestTransaction } from './socket.js';

async function perform(action, lootActor, payload, speaker) {
	const result = await requestTransaction(action, { lootUuid: lootActor.uuid, ...payload });
	if (!result?.ok) {
		ui.notifications.warn(game.i18n.localize(result?.error ?? 'NIMBLE_LOOT.errors.failed'));
		return false;
	}
	// When the GM hands loot out, the loot pile itself speaks.
	if (game.user.isGM) await announce(action, { ...result.data, byGM: true }, lootActor);
	else await announce(action, result.data, speaker);
	return true;
}

export async function takeItem(lootActor, item) {
	const recipient = await chooseRecipient();
	if (!recipient) return false;

	const quantity = await promptQuantity(visibleName(item, game.user.isGM), Math.max(1, getQuantity(item)));
	if (!quantity) return false;

	return perform(
		'takeItem',
		lootActor,
		{ itemId: item.id, quantity, recipientUuid: recipient.uuid },
		recipient,
	);
}

export async function takeCoins(lootActor) {
	const purse = readPurse(lootActor);
	if (!hasCoins(purse)) return false;

	const recipient = await chooseRecipient();
	if (!recipient) return false;

	const coins = await promptCoins(purse);
	if (!coins || !hasCoins(coins)) return false;

	return perform('takeCoins', lootActor, { recipientUuid: recipient.uuid, coins }, recipient);
}

export async function splitCoins(lootActor) {
	const purse = readPurse(lootActor);
	if (!hasCoins(purse)) return false;

	const recipientUuids = await promptSplit(purse);
	if (!recipientUuids) return false;

	return perform('splitCoins', lootActor, { recipientUuids }, game.user.character);
}

export async function moveItemToParty(lootActor, item) {
	const quantity = await promptQuantity(
		visibleName(item, game.user.isGM),
		Math.max(1, getQuantity(item)),
		'party',
	);
	if (!quantity) return false;

	return perform('partyItem', lootActor, { itemId: item.id, quantity }, game.user.character);
}

export async function moveCoinsToParty(lootActor) {
	if (!hasCoins(readPurse(lootActor))) return false;
	return perform('partyCoins', lootActor, {}, game.user.character);
}
