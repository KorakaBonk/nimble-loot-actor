import { DEFAULT_IMAGE, DENOMINATIONS, LOOT_TYPE, MODULE_ID } from './constants.js';

/** The loot actor's data: just a purse. Its inventory is its embedded items. */
export class LootData extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const fields = foundry.data.fields;
		const coin = (denomination) =>
			new fields.SchemaField({
				label: new fields.StringField({
					required: true,
					nullable: false,
					initial: `NIMBLE.currencyAbbreviations.${denomination}`,
				}),
				value: new fields.NumberField({
					required: true,
					nullable: false,
					integer: true,
					min: 0,
					initial: 0,
				}),
			});

		return {
			currency: new fields.SchemaField(
				Object.fromEntries(DENOMINATIONS.map((d) => [d, coin(d)])),
			),
		};
	}
}

/**
 * Build the loot actor document class on top of Nimble's base actor, so the
 * system's actor proxy can construct it like any of its own types.
 */
export function createLootActorClass(NimbleBaseActor) {
	return class NimbleLootActor extends NimbleBaseActor {
		// The base actor derives tags from hit points and size, which loot has neither of.
		_populateBaseTags() {}

		_populateDerivedTags() {}

		async _preCreate(data, options, user) {
			const allowed = await super._preCreate(data, options, user);
			if (allowed === false) return false;

			const changes = {};
			if (!data.img) changes.img = DEFAULT_IMAGE;
			// Nimble's creation dialog names every new actor "New Actor".
			if (!data.name || data.name === 'New Actor') {
				changes.name = game.i18n.localize('TYPES.Actor.nimble-loot-actor.loot');
				changes['prototypeToken.name'] = changes.name;
			}

			// Kept out of players' Actors directory: they reach loot through its token.
			if (data.ownership?.default === undefined) {
				changes['ownership.default'] = CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;
			}

			const token = data.prototypeToken ?? {};
			if (token.actorLink === undefined) changes['prototypeToken.actorLink'] = true;
			if (token.disposition === undefined) {
				changes['prototypeToken.disposition'] = CONST.TOKEN_DISPOSITIONS.NEUTRAL;
			}
			if (token.displayName === undefined) {
				changes['prototypeToken.displayName'] = CONST.TOKEN_DISPLAY_MODES.HOVER;
			}
			if (token.displayBars === undefined) {
				changes['prototypeToken.displayBars'] = CONST.TOKEN_DISPLAY_MODES.NONE;
			}
			if (token.sight?.enabled === undefined) changes['prototypeToken.sight.enabled'] = false;
			if (!token.texture?.src) changes['prototypeToken.texture.src'] = data.img || DEFAULT_IMAGE;

			this.updateSource(changes);
			return allowed;
		}
	};
}

export function isLootActor(actor) {
	return actor?.type === LOOT_TYPE;
}

/**
 * Whether `user` may loot `actor`: a GM always can, a player can when the loot
 * has been placed on a scene and is not hidden there, or when the GM has given
 * them at least limited permission on the actor.
 */
export function canUserLoot(actor, user) {
	if (!isLootActor(actor) || !user) return false;
	if (user.isGM) return true;
	if (actor.testUserPermission(user, 'LIMITED')) return true;

	if (actor.isToken) return !!actor.token && !actor.token.hidden;

	for (const scene of game.scenes ?? []) {
		for (const token of scene.tokens ?? []) {
			if (token.actorLink && token.actorId === actor.id && !token.hidden) return true;
		}
	}
	return false;
}

export function registerLootActorType() {
	const nimbleActors = CONFIG.NIMBLE?.Actor?.documentClasses;
	const NimbleBaseActor = nimbleActors?.base ?? CONFIG.Actor.documentClass?.prototype?.constructor;
	if (!nimbleActors || !NimbleBaseActor) {
		console.error(`${MODULE_ID} | Nimble's actor classes were not found; the Loot type is unavailable.`);
		return false;
	}

	CONFIG.Actor.dataModels[LOOT_TYPE] = LootData;
	nimbleActors[LOOT_TYPE] = createLootActorClass(NimbleBaseActor);
	return true;
}
