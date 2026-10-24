import { OBJECT_SIZE_TYPES, OBJECT_TYPE_ORDER, STACKING_SIZE_TYPES } from '../constants.js';

export function getQuantity(item) {
	const n = Math.floor(Number(item?.system?.quantity));
	return Number.isFinite(n) ? Math.max(0, n) : 1;
}

export function isStacking(itemOrSource) {
	return STACKING_SIZE_TYPES.has(itemOrSource?.system?.objectSizeType);
}

/** The name a viewer should see, hiding the real name of unidentified objects from players. */
export function visibleName(item, isGM) {
	if (isGM || item?.system?.identified !== false) return item?.name ?? '';
	return item?.system?.unidentifiedName || 'Unidentified Object';
}

/**
 * Strip what only makes sense on the actor an object came from, so the source
 * can be created on another actor: its id, the container it sat in there, and
 * whether that character had it equipped.
 */
export function cleanObjectSource(source) {
	delete source._id;
	delete source.folder;
	delete source.sort;
	delete source.ownership;
	const sys = source.system;
	if (sys) {
		sys.containerId = '';
		sys.equipped = false;
		if (!OBJECT_SIZE_TYPES.includes(sys.objectSizeType)) sys.objectSizeType = 'slots';
	}
	return source;
}

/**
 * The loose stack on `items` that an incoming object folds into. Nimble merges
 * stackable and small objects of the same name that sit outside any container.
 */
export function findMergeTarget(items, source) {
	if (!isStacking(source)) return null;
	for (const item of items) {
		if (item.type !== 'object') continue;
		if (item.name !== source.name) continue;
		if (!isStacking(item)) continue;
		if (item.system?.containerId) continue;
		return item;
	}
	return null;
}

/** Group objects by their object type, in the character sheet's heading order. */
export function groupByObjectType(items) {
	const groups = new Map();
	for (const item of items) {
		const key = item.system?.objectType || 'misc';
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key).push(item);
	}
	const rank = (key) => {
		const i = OBJECT_TYPE_ORDER.indexOf(key);
		return i === -1 ? OBJECT_TYPE_ORDER.length : i;
	};
	return [...groups.entries()]
		.sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
		.map(([key, list]) => ({
			key,
			items: list.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name)),
		}));
}
