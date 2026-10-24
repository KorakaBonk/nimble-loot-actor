import { OBJECT_ITEM_TYPE } from './constants.js';
import { canUserLoot, isLootActor } from './loot-actor.js';
import {
	capCoins,
	clampInt,
	hasCoins,
	negate,
	purseUpdate,
	readPurse,
	splitCoins,
} from './lib/coins.js';
import { cleanObjectSource, findMergeTarget, getQuantity, visibleName } from './lib/objects.js';
import { addCoinsToPartyLoot, addItemToPartyLoot, isPartyLootActive } from './party-loot.js';

/*
 * These run on the active GM's client only: players cannot write to an actor
 * they do not own, so every transfer is checked and carried out here. Errors are
 * returned as localization keys so the requesting player reads them in their
 * own language.
 */

export async function execTakeItem(userId, { lootUuid, itemId, quantity, recipientUuid }) {
	const user = game.users.get(userId);
	const loot = await resolveLoot(lootUuid, user);
	if (!loot.ok) return loot;
	const recipient = await resolveRecipient(recipientUuid, user, loot.actor);
	if (!recipient.ok) return recipient;

	const item = loot.actor.items.get(itemId);
	if (!item || item.type !== OBJECT_ITEM_TYPE) return fail('NIMBLE_LOOT.errors.itemGone');

	const held = Math.max(1, getQuantity(item));
	const taken = clampInt(quantity, 1, held);

	const source = cleanObjectSource(item.toObject());
	source.system.quantity = taken;

	// Added before it is removed: a failure in between duplicates the object
	// rather than losing it.
	const stack = findMergeTarget(recipient.actor.items, source);
	if (stack) await stack.update({ 'system.quantity': getQuantity(stack) + taken });
	else await recipient.actor.createEmbeddedDocuments('Item', [source]);

	if (taken >= held) await loot.actor.deleteEmbeddedDocuments('Item', [item.id]);
	else await item.update({ 'system.quantity': held - taken });

	return ok({
		itemName: visibleName(item, false),
		img: item.img,
		quantity: taken,
		recipientName: recipient.actor.name,
		lootName: loot.actor.name,
	});
}

export async function execTakeCoins(userId, { lootUuid, recipientUuid, coins }) {
	const user = game.users.get(userId);
	const loot = await resolveLoot(lootUuid, user);
	if (!loot.ok) return loot;
	const recipient = await resolveRecipient(recipientUuid, user, loot.actor);
	if (!recipient.ok) return recipient;

	const lootPurse = readPurse(loot.actor);
	const moved = capCoins(coins, lootPurse);
	if (!hasCoins(moved)) return fail('NIMBLE_LOOT.errors.noCoins');

	await recipient.actor.update(purseUpdate(readPurse(recipient.actor), moved));
	await loot.actor.update(purseUpdate(lootPurse, negate(moved)));

	return ok({ coins: moved, recipientName: recipient.actor.name, lootName: loot.actor.name });
}

export async function execSplitCoins(userId, { lootUuid, recipientUuids }) {
	const user = game.users.get(userId);
	const loot = await resolveLoot(lootUuid, user);
	if (!loot.ok) return loot;

	const recipients = [];
	for (const uuid of new Set(recipientUuids ?? [])) {
		const actor = await fromUuid(uuid);
		if (!actor || actor.type !== 'character') continue;
		// Players may share only with characters that belong to players.
		if (!user.isGM && !actor.hasPlayerOwner) continue;
		recipients.push(actor);
	}
	if (recipients.length === 0) return fail('NIMBLE_LOOT.errors.noRecipients');

	const lootPurse = readPurse(loot.actor);
	const { share, remainder } = splitCoins(lootPurse, recipients.length);
	if (!hasCoins(share)) return fail('NIMBLE_LOOT.errors.tooFewToSplit');

	for (const actor of recipients) {
		await actor.update(purseUpdate(readPurse(actor), share));
	}
	await loot.actor.update(
		purseUpdate(lootPurse, {
			gp: remainder.gp - lootPurse.gp,
			sp: remainder.sp - lootPurse.sp,
			cp: remainder.cp - lootPurse.cp,
		}),
	);

	return ok({
		share,
		remainder,
		recipientNames: recipients.map((a) => a.name),
		lootName: loot.actor.name,
	});
}

export async function execPartyItem(userId, { lootUuid, itemId, quantity }) {
	if (!isPartyLootActive()) return fail('NIMBLE_LOOT.errors.partyLootMissing');
	const user = game.users.get(userId);
	const loot = await resolveLoot(lootUuid, user);
	if (!loot.ok) return loot;

	const item = loot.actor.items.get(itemId);
	if (!item || item.type !== OBJECT_ITEM_TYPE) return fail('NIMBLE_LOOT.errors.itemGone');

	const held = Math.max(1, getQuantity(item));
	const moved = clampInt(quantity, 1, held);

	if (!(await addItemToPartyLoot(item, moved, user.character?.name ?? user.name))) {
		return fail('NIMBLE_LOOT.errors.partyLootFailed');
	}
	if (moved >= held) await loot.actor.deleteEmbeddedDocuments('Item', [item.id]);
	else await item.update({ 'system.quantity': held - moved });

	return ok({
		itemName: visibleName(item, false),
		img: item.img,
		quantity: moved,
		actorName: user.character?.name ?? user.name,
		lootName: loot.actor.name,
	});
}

export async function execPartyCoins(userId, { lootUuid }) {
	if (!isPartyLootActive()) return fail('NIMBLE_LOOT.errors.partyLootMissing');
	const user = game.users.get(userId);
	const loot = await resolveLoot(lootUuid, user);
	if (!loot.ok) return loot;

	const moved = readPurse(loot.actor);
	if (!hasCoins(moved)) return fail('NIMBLE_LOOT.errors.noCoins');

	if (!(await addCoinsToPartyLoot(moved))) return fail('NIMBLE_LOOT.errors.partyLootFailed');
	await loot.actor.update(purseUpdate(moved, negate(moved)));

	return ok({ coins: moved, actorName: user.character?.name ?? user.name, lootName: loot.actor.name });
}

async function resolveLoot(uuid, user) {
	if (!user) return fail('NIMBLE_LOOT.errors.unknownUser');
	const actor = uuid ? await fromUuid(uuid) : null;
	if (!isLootActor(actor)) return fail('NIMBLE_LOOT.errors.lootGone');
	if (!canUserLoot(actor, user)) return fail('NIMBLE_LOOT.errors.cannotLoot');
	return { ok: true, actor };
}

async function resolveRecipient(uuid, user, lootActor) {
	const actor = uuid ? await fromUuid(uuid) : null;
	if (!actor || actor.type !== 'character' || actor === lootActor) {
		return fail('NIMBLE_LOOT.errors.badRecipient');
	}
	if (!actor.testUserPermission(user, 'OWNER')) return fail('NIMBLE_LOOT.errors.notYourCharacter');
	return { ok: true, actor };
}

function ok(data) {
	return { ok: true, data };
}

function fail(error) {
	return { ok: false, error };
}
