import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
	capCoins,
	clampInt,
	formatCoins,
	hasCoins,
	negate,
	purseUpdate,
	readPurse,
	splitCoins,
} from '../scripts/lib/coins.js';

test('clampInt keeps whole numbers inside the bounds', () => {
	assert.equal(clampInt(5.9, 1, 10), 5);
	assert.equal(clampInt(-3, 0, 10), 0);
	assert.equal(clampInt(99, 1, 10), 10);
	assert.equal(clampInt('abc', 1, 10), 1);
	assert.equal(clampInt(undefined, 0, 4), 0);
});

test('readPurse reads Nimble currency and ignores junk', () => {
	const actor = { system: { currency: { gp: { value: 3 }, sp: { value: '7' }, cp: { value: -2 } } } };
	assert.deepEqual(readPurse(actor), { gp: 3, sp: 7, cp: 0 });
	assert.deepEqual(readPurse({}), { gp: 0, sp: 0, cp: 0 });
});

test('capCoins never takes more than the pile holds', () => {
	assert.deepEqual(capCoins({ gp: 50, sp: 2, cp: -1 }, { gp: 10, sp: 5, cp: 4 }), { gp: 10, sp: 2, cp: 0 });
	assert.equal(hasCoins(capCoins({}, { gp: 1, sp: 1, cp: 1 })), false);
});

test('splitCoins shares each denomination and keeps the remainder', () => {
	const { share, remainder } = splitCoins({ gp: 10, sp: 7, cp: 2 }, 3);
	assert.deepEqual(share, { gp: 3, sp: 2, cp: 0 });
	assert.deepEqual(remainder, { gp: 1, sp: 1, cp: 2 });
});

test('splitCoins with nobody to share with leaves everything behind', () => {
	const { share, remainder } = splitCoins({ gp: 4, sp: 0, cp: 1 }, 0);
	assert.deepEqual(share, { gp: 0, sp: 0, cp: 0 });
	assert.deepEqual(remainder, { gp: 4, sp: 0, cp: 1 });
});

test('purseUpdate writes only the denominations that change', () => {
	assert.deepEqual(purseUpdate({ gp: 5, sp: 1, cp: 0 }, { gp: 2, sp: 0, cp: 3 }), {
		'system.currency.gp.value': 7,
		'system.currency.cp.value': 3,
	});
	assert.deepEqual(purseUpdate({ gp: 5, sp: 1, cp: 0 }, negate({ gp: 5, sp: 0, cp: 0 })), {
		'system.currency.gp.value': 0,
	});
});

test('formatCoins lists coins largest first', () => {
	assert.equal(formatCoins({ cp: 5, gp: 3, sp: 0 }), '3 gp, 5 cp');
});
