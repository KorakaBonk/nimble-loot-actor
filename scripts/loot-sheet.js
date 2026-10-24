import { DENOMINATIONS, OBJECT_ITEM_TYPE, TEMPLATE_PATH } from './constants.js';
import { moveCoinsToParty, moveItemToParty, splitCoins, takeCoins, takeItem } from './actions.js';
import { canUserLoot } from './loot-actor.js';
import { isPartyLootActive } from './party-loot.js';
import { hasCoins, readPurse } from './lib/coins.js';
import {
	cleanObjectSource,
	findMergeTarget,
	getQuantity,
	groupByObjectType,
	visibleName,
} from './lib/objects.js';

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

export class LootSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
	static DEFAULT_OPTIONS = {
		classes: ['nimble-sheet', 'nimble-sheet--npc', 'nimble-loot-sheet'],
		position: { width: 420, height: 600 },
		window: { icon: 'fa-solid fa-sack-dollar', resizable: true },
		// Players see loot through its token, not through actor permissions;
		// _canRender decides who may open the sheet.
		viewPermission: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE,
		form: { submitOnChange: true },
		actions: {
			takeItem: LootSheet.#onTakeItem,
			takeCoins: LootSheet.#onTakeCoins,
			splitCoins: LootSheet.#onSplitCoins,
			partyItem: LootSheet.#onPartyItem,
			partyCoins: LootSheet.#onPartyCoins,
			editLootItem: LootSheet.#onEditItem,
			deleteLootItem: LootSheet.#onDeleteItem,
			editLootImage: LootSheet.#onEditImage,
		},
	};

	static PARTS = {
		header: { template: `${TEMPLATE_PATH}/loot-header.hbs` },
		coins: { template: `${TEMPLATE_PATH}/loot-coins.hbs` },
		items: { template: `${TEMPLATE_PATH}/loot-items.hbs`, scrollable: [''] },
		footer: { template: `${TEMPLATE_PATH}/loot-footer.hbs` },
	};

	#busy = false;

	_canRender(options) {
		if (!game.user.isGM && !canUserLoot(this.document, game.user)) {
			if (options?.force) ui.notifications.warn(game.i18n.localize('NIMBLE_LOOT.errors.cannotLoot'));
			return false;
		}
		return super._canRender(options);
	}

	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		const actor = this.document;
		const isGM = game.user.isGM;
		const purse = readPurse(actor);
		const objects = actor.items.filter((item) => item.type === OBJECT_ITEM_TYPE);
		const headings = CONFIG.NIMBLE?.objectTypeHeadings ?? {};

		const groups = [];
		for (const group of groupByObjectType(objects)) {
			groups.push({
				key: group.key,
				label: game.i18n.localize(headings[group.key] ?? group.key),
				items: await Promise.all(group.items.map((item) => this.#prepareItem(item, isGM))),
			});
		}

		const character = isGM ? null : game.user.character;

		return {
			...context,
			actor,
			isGM,
			editable: this.isEditable,
			canLoot: isGM || canUserLoot(actor, game.user),
			gmOnline: !!game.users.activeGM,
			partyLoot: isPartyLootActive(),
			lootingAs: character?.type === 'character' ? character.name : null,
			groups,
			itemCount: objects.reduce((sum, item) => sum + Math.max(1, getQuantity(item)), 0),
			hasCoins: hasCoins(purse),
			coins: DENOMINATIONS.map((d) => ({
				key: d,
				label: game.i18n.localize(`NIMBLE.currencyAbbreviations.${d}`),
				value: purse[d],
				field: `system.currency.${d}.value`,
			})),
		};
	}

	async #prepareItem(item, isGM) {
		const unidentified = item.system?.identified === false;
		const description = unidentified && !isGM
			? item.system?.description?.unidentified
			: item.system?.description?.public;
		const name = visibleName(item, isGM);
		let tooltip = `<h3 class="nlo-tooltip__name">${foundry.utils.escapeHTML(name)}</h3>`;
		if (description) {
			tooltip += await foundry.applications.ux.TextEditor.implementation.enrichHTML(description, {
				secrets: isGM,
				relativeTo: item,
			});
		}

		return {
			id: item.id,
			name,
			img: item.img,
			quantity: Math.max(1, getQuantity(item)),
			rawQuantity: getQuantity(item),
			unidentified,
			showUnidentifiedFlag: unidentified && isGM,
			tooltip,
		};
	}

	async _onRender(context, options) {
		await super._onRender(context, options);

		for (const input of this.element.querySelectorAll('input[data-item-quantity]')) {
			input.addEventListener('change', this.#onQuantityChange.bind(this));
		}
		this.#enablePlayerActions();
	}

	/** Players cannot edit the loot, but they still need its take buttons. */
	_toggleDisabled(disabled) {
		super._toggleDisabled(disabled);
		this.#enablePlayerActions();
	}

	#enablePlayerActions() {
		for (const el of this.element?.querySelectorAll('[data-loot-action]') ?? []) {
			el.disabled = this.#busy || el.dataset.lootDisabled === 'true';
		}
	}

	async #onQuantityChange(event) {
		// Keeps the change from reaching the form, which only holds actor fields.
		event.stopPropagation();
		const item = this.document.items.get(event.currentTarget.closest('[data-item-id]')?.dataset.itemId);
		if (!item) return;
		const quantity = Math.max(0, Math.floor(event.currentTarget.valueAsNumber || 0));
		await item.update({ 'system.quantity': quantity });
	}

	async #runBusy(fn) {
		if (this.#busy) return;
		this.#busy = true;
		this.#enablePlayerActions();
		try {
			await fn();
		} finally {
			this.#busy = false;
			this.#enablePlayerActions();
		}
	}

	static async #onTakeItem(_event, target) {
		const item = this.document.items.get(target.closest('[data-item-id]')?.dataset.itemId);
		if (!item) return;
		await this.#runBusy(() => takeItem(this.document, item));
	}

	static async #onTakeCoins() {
		await this.#runBusy(() => takeCoins(this.document));
	}

	static async #onSplitCoins() {
		await this.#runBusy(() => splitCoins(this.document));
	}

	static async #onPartyItem(_event, target) {
		const item = this.document.items.get(target.closest('[data-item-id]')?.dataset.itemId);
		if (!item) return;
		await this.#runBusy(() => moveItemToParty(this.document, item));
	}

	static async #onPartyCoins() {
		await this.#runBusy(() => moveCoinsToParty(this.document));
	}

	static async #onEditItem(_event, target) {
		const item = this.document.items.get(target.closest('[data-item-id]')?.dataset.itemId);
		await item?.sheet?.render({ force: true });
	}

	static async #onDeleteItem(_event, target) {
		const item = this.document.items.get(target.closest('[data-item-id]')?.dataset.itemId);
		await item?.deleteDialog();
	}

	static async #onEditImage() {
		if (!this.isEditable) return;
		const FilePicker = foundry.applications.apps.FilePicker.implementation;
		await new FilePicker({
			type: 'image',
			current: this.document.img,
			callback: (path) => this.document.update({ img: path }),
		}).browse();
	}

	async _onDragStart(event) {
		const row = event.currentTarget.closest('[data-item-id]');
		const item = row ? this.document.items.get(row.dataset.itemId) : null;
		if (!item || !this.isEditable) return;
		event.dataTransfer.setData('text/plain', JSON.stringify(item.toDragData()));
	}

	async _onDropItem(event, dropped) {
		if (!this.isEditable) return null;
		const item = dropped instanceof Item ? dropped : await Item.implementation.fromDropData(dropped);
		if (!item || item.parent === this.document) return null;

		if (item.type !== OBJECT_ITEM_TYPE) {
			ui.notifications.warn(game.i18n.localize('NIMBLE_LOOT.errors.objectsOnly'));
			return null;
		}

		const source = cleanObjectSource(item.toObject());
		const stack = findMergeTarget(this.document.items, source);
		if (stack) {
			await stack.update({
				'system.quantity': getQuantity(stack) + Math.max(1, getQuantity(source)),
			});
			return stack;
		}
		const [created] = await this.document.createEmbeddedDocuments('Item', [source]);
		return created ?? null;
	}
}
