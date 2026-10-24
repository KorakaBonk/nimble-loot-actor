import { DENOMINATIONS } from './constants.js';

const { DialogV2 } = foundry.applications.api;

const esc = (value) => foundry.utils.escapeHTML(String(value ?? ''));
const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

/** Characters the user may receive loot into. For a GM that is every character. */
export function ownedCharacters(user = game.user) {
	return (game.actors?.contents ?? []).filter(
		(actor) => actor.type === 'character' && actor.testUserPermission(user, 'OWNER'),
	);
}

/**
 * The character loot goes to: the player's assigned character, else a character
 * token they have selected, else their only character. Anything else is a choice
 * for them to make.
 */
export async function chooseRecipient(user = game.user) {
	if (!user.isGM && user.character?.type === 'character') return user.character;

	const controlled = canvas?.tokens?.controlled
		?.map((token) => token.actor)
		.filter((actor) => actor?.type === 'character' && actor.testUserPermission(user, 'OWNER'));
	if (controlled?.length === 1) return controlled[0];

	const owned = ownedCharacters(user);
	if (owned.length === 0) {
		ui.notifications.warn(t('NIMBLE_LOOT.errors.noCharacter'));
		return null;
	}
	if (owned.length === 1) return owned[0];

	const options = owned
		.sort((a, b) => a.name.localeCompare(b.name))
		.map((actor) => `<option value="${esc(actor.uuid)}">${esc(actor.name)}</option>`)
		.join('');

	const uuid = await DialogV2.prompt({
		window: { title: t('NIMBLE_LOOT.dialogs.recipient.title'), icon: 'fa-solid fa-user' },
		classes: ['nimble-loot-dialog'],
		content: `<p>${esc(t('NIMBLE_LOOT.dialogs.recipient.prompt'))}</p>
			<select name="recipient" autofocus>${options}</select>`,
		ok: {
			label: t('NIMBLE_LOOT.dialogs.recipient.confirm'),
			callback: (_event, button) => button.form.elements.recipient.value,
		},
		rejectClose: false,
		modal: true,
	});
	return uuid ? fromUuid(uuid) : null;
}

/** How many of a stack to take. Resolves to null when cancelled. */
export async function promptQuantity(itemName, max, mode = 'take') {
	if (max <= 1) return 1;

	const key = mode === 'party' ? 'NIMBLE_LOOT.dialogs.partyQuantity' : 'NIMBLE_LOOT.dialogs.quantity';
	const value = await DialogV2.prompt({
		window: {
			title: t(`${key}.title`),
			icon: mode === 'party' ? 'fa-solid fa-box-archive' : 'fa-solid fa-hand-holding',
		},
		classes: ['nimble-loot-dialog'],
		content: `<p>${t(`${key}.prompt`, { item: `<strong>${esc(itemName)}</strong>` })}</p>
			<div class="nlo-dialog-row">
				<input type="number" name="quantity" value="${max}" min="1" max="${max}" step="1" autofocus />
				<span class="nlo-dialog-row__max">/ ${max}</span>
			</div>`,
		ok: {
			label: t(`${key}.confirm`),
			callback: (_event, button) => button.form.elements.quantity.valueAsNumber,
		},
		rejectClose: false,
		modal: true,
	});
	if (!Number.isFinite(value)) return null;
	return Math.max(1, Math.min(max, Math.floor(value)));
}

/** Which coins to take, each denomination capped at the pile. */
export async function promptCoins(purse) {
	const rows = DENOMINATIONS.filter((d) => purse[d] > 0)
		.map(
			(d) => `<label class="nlo-dialog-coin">
				<span class="nlo-coin nlo-coin--${d}"></span>
				<span class="nlo-dialog-coin__label">${esc(t(`NIMBLE.currencyAbbreviations.${d}`))}</span>
				<input type="number" name="${d}" value="${purse[d]}" min="0" max="${purse[d]}" step="1" />
				<span class="nlo-dialog-row__max">/ ${purse[d]}</span>
			</label>`,
		)
		.join('');

	const coins = await DialogV2.prompt({
		window: { title: t('NIMBLE_LOOT.dialogs.coins.title'), icon: 'fa-solid fa-coins' },
		classes: ['nimble-loot-dialog'],
		content: `<p>${esc(t('NIMBLE_LOOT.dialogs.coins.prompt'))}</p>${rows}`,
		ok: {
			label: t('NIMBLE_LOOT.dialogs.coins.confirm'),
			callback: (_event, button) =>
				Object.fromEntries(
					DENOMINATIONS.map((d) => [d, button.form.elements[d]?.valueAsNumber || 0]),
				),
		},
		rejectClose: false,
		modal: true,
	});
	return coins ?? null;
}

/**
 * The player characters a split could go to. Characters of players who are
 * online start ticked; if nobody is online, every player character is.
 */
export function splitCandidates() {
	const byId = new Map();
	for (const user of game.users ?? []) {
		if (user.isGM) continue;
		const actor = user.character;
		if (actor?.type !== 'character') continue;
		const entry = byId.get(actor.id) ?? { actor, online: false };
		entry.online ||= user.active;
		byId.set(actor.id, entry);
	}
	if (byId.size === 0) {
		for (const actor of game.actors ?? []) {
			if (actor.type === 'character' && actor.hasPlayerOwner) byId.set(actor.id, { actor, online: true });
		}
	}

	const candidates = [...byId.values()].sort((a, b) => a.actor.name.localeCompare(b.actor.name));
	if (!candidates.some((c) => c.online)) candidates.forEach((c) => (c.online = true));
	return candidates;
}

/** Pick who shares the coins. Resolves to a list of actor uuids, or null. */
export async function promptSplit(purse) {
	const candidates = splitCandidates();
	if (candidates.length === 0) {
		ui.notifications.warn(t('NIMBLE_LOOT.errors.noRecipients'));
		return null;
	}

	const total = DENOMINATIONS.filter((d) => purse[d] > 0)
		.map((d) => `<span class="nlo-dialog-total"><span class="nlo-coin nlo-coin--${d}"></span>${purse[d]} ${esc(t(`NIMBLE.currencyAbbreviations.${d}`))}</span>`)
		.join('');

	const list = candidates
		.map(
			({ actor, online }) => `<label class="nlo-dialog-recipient">
				<input type="checkbox" name="recipient" value="${esc(actor.uuid)}" ${online ? 'checked' : ''} />
				<img src="${esc(actor.img)}" alt="" />
				<span>${esc(actor.name)}</span>
			</label>`,
		)
		.join('');

	const uuids = await DialogV2.prompt({
		window: { title: t('NIMBLE_LOOT.dialogs.split.title'), icon: 'fa-solid fa-scale-balanced' },
		classes: ['nimble-loot-dialog'],
		content: `<div class="nlo-dialog-totals">${total}</div>
			<p>${esc(t('NIMBLE_LOOT.dialogs.split.prompt'))}</p>
			<div class="nlo-dialog-recipients">${list}</div>
			<p class="nlo-dialog-hint">${esc(t('NIMBLE_LOOT.dialogs.split.hint'))}</p>`,
		ok: {
			label: t('NIMBLE_LOOT.dialogs.split.confirm'),
			callback: (_event, button) =>
				[...button.form.querySelectorAll('input[name="recipient"]:checked')].map((el) => el.value),
		},
		rejectClose: false,
		modal: true,
	});
	if (!uuids) return null;
	if (uuids.length === 0) {
		ui.notifications.warn(t('NIMBLE_LOOT.errors.noRecipients'));
		return null;
	}
	return uuids;
}
