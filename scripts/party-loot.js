/** Bridge to the Nimble Party Loot module, through its public API (version 1 or later). */

const PARTY_LOOT_ID = 'nimble-party-loot';

function api() {
	const mod = game.modules.get(PARTY_LOOT_ID);
	if (!mod?.active) return null;
	const partyApi = mod.api;
	if (!(partyApi?.version >= 1) || typeof partyApi.addItem !== 'function') return null;
	return partyApi;
}

export function isPartyLootActive() {
	return !!api();
}

/** Add `quantity` of `item` to the party stash. GM client only. */
export async function addItemToPartyLoot(item, quantity, depositedBy) {
	const result = await api()?.addItem(item, { quantity, depositedBy });
	if (!result?.ok) console.warn(`nimble-loot-actor | Party Loot refused the item: ${result?.error}`);
	return !!result?.ok;
}

/** Add coins to the party stash. GM client only. */
export async function addCoinsToPartyLoot(coins) {
	const result = await api()?.addCoins(coins);
	if (!result?.ok) console.warn(`nimble-loot-actor | Party Loot refused the coins: ${result?.error}`);
	return !!result?.ok;
}
