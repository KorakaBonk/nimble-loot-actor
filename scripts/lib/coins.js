import { DENOMINATIONS } from '../constants.js';

/** Whole number between `min` and `max`; anything unparsable becomes `min`. */
export function clampInt(value, min, max) {
	const n = Math.floor(Number(value));
	if (!Number.isFinite(n)) return min;
	return Math.max(min, Math.min(max, n));
}

/** Read a `{ gp, sp, cp }` purse from an actor's `system.currency`. */
export function readPurse(actor) {
	const currency = actor?.system?.currency ?? {};
	return Object.fromEntries(
		DENOMINATIONS.map((d) => [d, Math.max(0, Math.floor(Number(currency[d]?.value) || 0))]),
	);
}

/** Cap every denomination of a request at what the source purse holds. */
export function capCoins(requested, available) {
	return Object.fromEntries(
		DENOMINATIONS.map((d) => [d, clampInt(requested?.[d], 0, available?.[d] ?? 0)]),
	);
}

export function hasCoins(coins) {
	return DENOMINATIONS.some((d) => (coins?.[d] ?? 0) > 0);
}

/**
 * Share a purse evenly between `count` recipients, one denomination at a time.
 * Coins that do not divide evenly stay behind in the remainder.
 */
export function splitCoins(purse, count) {
	const recipients = Math.floor(Number(count) || 0);
	if (recipients < 1) {
		return { share: emptyPurse(), remainder: { ...emptyPurse(), ...purse } };
	}
	const share = {};
	const remainder = {};
	for (const d of DENOMINATIONS) {
		const total = Math.max(0, Math.floor(Number(purse?.[d]) || 0));
		share[d] = Math.floor(total / recipients);
		remainder[d] = total - share[d] * recipients;
	}
	return { share, remainder };
}

export function emptyPurse() {
	return Object.fromEntries(DENOMINATIONS.map((d) => [d, 0]));
}

/** `{ gp: 3, sp: 0, cp: 5 }` → `"3 gp, 5 cp"`, using the given labels. */
export function formatCoins(coins, labels = {}) {
	return DENOMINATIONS.filter((d) => (coins?.[d] ?? 0) > 0)
		.map((d) => `${coins[d]} ${labels[d] ?? d}`)
		.join(', ');
}

/** The `system.currency.*.value` update that adds `delta` (may be negative) to a purse. */
export function purseUpdate(purse, delta) {
	const update = {};
	for (const d of DENOMINATIONS) {
		if (!delta?.[d]) continue;
		update[`system.currency.${d}.value`] = Math.max(0, (purse?.[d] ?? 0) + delta[d]);
	}
	return update;
}

export function negate(coins) {
	return Object.fromEntries(DENOMINATIONS.map((d) => [d, -(coins?.[d] ?? 0)]));
}
