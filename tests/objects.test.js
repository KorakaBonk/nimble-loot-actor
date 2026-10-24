import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	cleanObjectSource,
	findMergeTarget,
	getQuantity,
	groupByObjectType,
	visibleName,
} from '../scripts/lib/objects.js';

const object = (name, system = {}, extra = {}) => ({
	type: 'object',
	name,
	sort: 0,
	system: { objectSizeType: 'slots', containerId: '', quantity: 1, ...system },
	...extra,
});

test('visibleName hides unidentified names from players only', () => {
	const ring = object('Ring of Fire', { identified: false, unidentifiedName: 'Plain Ring' });
	assert.equal(visibleName(ring, false), 'Plain Ring');
	assert.equal(visibleName(ring, true), 'Ring of Fire');
	assert.equal(visibleName(object('Rope'), false), 'Rope');
});

test('cleanObjectSource drops what belonged to the old actor', () => {
	const source = cleanObjectSource({
		_id: 'abc',
		sort: 100,
		system: { containerId: 'bag', equipped: true, objectSizeType: 'weird' },
	});
	assert.equal(source._id, undefined);
	assert.equal(source.sort, undefined);
	assert.deepEqual(source.system, { containerId: '', equipped: false, objectSizeType: 'slots' });
});

test('findMergeTarget folds stackables into a loose stack of the same name', () => {
	const arrows = object('Arrows', { objectSizeType: 'stackable', quantity: 12 });
	const bagged = object('Arrows', { objectSizeType: 'stackable', containerId: 'quiver' });
	const sword = object('Sword');
	assert.equal(findMergeTarget([bagged, sword, arrows], object('Arrows', { objectSizeType: 'stackable' })), arrows);
	assert.equal(findMergeTarget([bagged], object('Arrows', { objectSizeType: 'stackable' })), null);
	assert.equal(findMergeTarget([sword], object('Sword')), null);
});

test('getQuantity treats a missing quantity as one', () => {
	assert.equal(getQuantity({ system: {} }), 1);
	assert.equal(getQuantity({ system: { quantity: 4 } }), 4);
	assert.equal(getQuantity({ system: { quantity: -1 } }), 0);
});

test('groupByObjectType follows the character sheet order', () => {
	const groups = groupByObjectType([
		object('Potion', { objectType: 'consumable' }),
		object('Axe', { objectType: 'weapon' }),
		object('Odd', { objectType: '' }),
		object('Bow', { objectType: 'weapon' }),
	]);
	assert.deepEqual(groups.map((g) => g.key), ['weapon', 'consumable', 'misc']);
	assert.deepEqual(groups[0].items.map((i) => i.name), ['Axe', 'Bow']);
});
