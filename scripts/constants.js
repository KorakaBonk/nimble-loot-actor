export const MODULE_ID = 'nimble-loot-actor';

export const SYSTEM_ID = 'nimble';

/** Module sub-types are namespaced by Foundry as `<module id>.<type>`. */
export const LOOT_TYPE = `${MODULE_ID}.loot`;

export const SOCKET_NAME = `module.${MODULE_ID}`;

/** The Nimble item type for physical inventory. */
export const OBJECT_ITEM_TYPE = 'object';

/** Largest first, the order coins are shown in. */
export const DENOMINATIONS = ['gp', 'sp', 'cp'];

/** Nimble object size types whose copies merge into one stack. */
export const STACKING_SIZE_TYPES = new Set(['stackable', 'smallSized']);

/** The `objectSizeType` values Nimble 0.10 accepts. */
export const OBJECT_SIZE_TYPES = ['slots', 'stackable', 'smallSized'];

/** Inventory grouping order, as on the Nimble character sheet. */
export const OBJECT_TYPE_ORDER = ['weapon', 'armor', 'shield', 'consumable', 'misc'];

export const SETTINGS = {
	announce: 'announceInteractions',
	singleClick: 'openOnSingleClick',
};

export const TEMPLATE_PATH = `modules/${MODULE_ID}/templates`;

export const DEFAULT_IMAGE = 'icons/svg/chest.svg';

export const BANNER_IMAGE = `modules/${MODULE_ID}/assets/loot-banner.svg`;
