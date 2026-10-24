import { DENOMINATIONS, MODULE_ID, SETTINGS } from './constants.js';
import { getSetting } from './settings.js';

const esc = (value) => foundry.utils.escapeHTML(String(value ?? ''));
const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

function coinChips(coins) {
	return DENOMINATIONS.filter((d) => (coins?.[d] ?? 0) > 0)
		.map(
			(d) =>
				`<span class="nlo-chat-coin"><span class="nlo-coin nlo-coin--${d}"></span>${coins[d]} ${esc(
					t(`NIMBLE.currencyAbbreviations.${d}`),
				)}</span>`,
		)
		.join('');
}

/** The body of a Nimble chat card; the header is added when the message renders. */
function card({ image, icon, heading, subheading, sections }) {
	const art = image
		? `<img class="nimble-chat-card__image" src="${esc(image)}" alt="" />`
		: `<i class="nimble-chat-card__image nimble-chat-card__image--fa-icon ${icon}" inert></i>`;
	return `<article class="nimble-chat-card__body nlo-chat-body">
		<header class="nimble-chat-card__body-header">
			${art}
			<div class="nimble-chat-card__title-wrapper">
				<h3 class="nimble-chat-card__title">${heading}</h3>
				<h4 class="nimble-chat-card__meta">${subheading}</h4>
			</div>
		</header>
		${sections.filter(Boolean).map((html) => `<section class="nimble-card-section">${html}</section>`).join('')}
	</article>`;
}

const itemHeading = (data) =>
	data.quantity > 1 ? `${data.quantity}× ${esc(data.itemName)}` : esc(data.itemName);
const fromLoot = (data) => esc(t('NIMBLE_LOOT.chat.fromLoot', { loot: data.lootName }));
/** The GM gets wording of their own: they hand loot out rather than take it. */
const chatKey = (name, data) => `NIMBLE_LOOT.chat.${data.byGM ? 'gm.' : ''}${name}`;
const coinRow = (coins) => `<div class="nlo-chat-coins">${coinChips(coins)}</div>`;

const builders = {
	takeItem: (data) =>
		card({
			image: data.img,
			heading: itemHeading(data),
			subheading: fromLoot(data),
			sections: [
				`<p>${t(chatKey('tookItem', data), {
					character: `<strong>${esc(data.recipientName)}</strong>`,
					item: `<strong>${itemHeading(data)}</strong>`,
					loot: esc(data.lootName),
				})}</p>`,
			],
		}),

	takeCoins: (data) =>
		card({
			icon: 'fa-solid fa-coins',
			heading: esc(t(chatKey('coinsTitle', data))),
			subheading: fromLoot(data),
			sections: [
				`<p>${t(chatKey('tookCoins', data), {
					character: `<strong>${esc(data.recipientName)}</strong>`,
					loot: esc(data.lootName),
				})}</p>${coinRow(data.coins)}`,
			],
		}),

	splitCoins: (data) => {
		const leftover = DENOMINATIONS.some((d) => data.remainder?.[d] > 0);
		return card({
			icon: 'fa-solid fa-scale-balanced',
			heading: esc(t('NIMBLE_LOOT.chat.splitTitle')),
			subheading: fromLoot(data),
			sections: [
				`<p>${t(chatKey('splitCoins', data), {
					count: data.recipientNames.length,
					loot: esc(data.lootName),
				})}</p>${coinRow(data.share)}
				<p class="nlo-chat-hint">${data.recipientNames.map(esc).join(', ')}</p>`,
				leftover
					? `<p class="nlo-chat-hint">${esc(t('NIMBLE_LOOT.chat.splitLeftover'))}</p>${coinRow(data.remainder)}`
					: '',
			],
		});
	},

	partyItem: (data) =>
		card({
			image: data.img,
			heading: itemHeading(data),
			subheading: esc(t('NIMBLE_LOOT.chat.partyTitle')),
			sections: [
				`<p>${t(chatKey('partyItem', data), {
					character: `<strong>${esc(data.actorName)}</strong>`,
					item: `<strong>${itemHeading(data)}</strong>`,
					loot: esc(data.lootName),
				})}</p>`,
			],
		}),

	partyCoins: (data) =>
		card({
			icon: 'fa-solid fa-box-archive',
			heading: esc(t('NIMBLE_LOOT.chat.partyCoinsTitle')),
			subheading: fromLoot(data),
			sections: [
				`<p>${t(chatKey('partyCoins', data), {
					character: `<strong>${esc(data.actorName)}</strong>`,
					loot: esc(data.lootName),
				})}</p>${coinRow(data.coins)}`,
			],
		}),
};

/** Tell the table what was just taken from a loot pile, if the GM wants that. */
export async function announce(action, data, speakerActor) {
	if (!getSetting(SETTINGS.announce)) return;
	const build = builders[action];
	if (!build || !data) return;

	await ChatMessage.implementation.create({
		content: build(data),
		speaker: ChatMessage.implementation.getSpeaker({ actor: speakerActor ?? null }),
		flags: { [MODULE_ID]: { action, card: 2 } },
	});
}

/** Nimble picks header text that stays readable on the author's colour. */
function headerTextColor(color) {
	const { r = 0, g = 0, b = 0 } = color ?? {};
	return r * 0.2126 + g * 0.7152 + b * 0.0722 >= 0.6 ? 'hsl(50, 14%, 9%)' : 'hsl(38, 38%, 94%)';
}

/**
 * Give loot messages the frame Nimble's own chat cards have: a header in the
 * author's colour with the speaker, time and delete button, over a bordered body.
 */
export function renderLootMessage(message, html) {
	const element = html instanceof HTMLElement ? html : html?.[0];
	const flags = message?.flags?.[MODULE_ID];
	if (!element || !flags?.action) return;

	// Cards from pre-release builds keep their contents but get the same frame.
	if (flags.card !== 2) {
		const legacy = element.querySelector('.nlo-chat-card');
		if (!legacy) return;
		legacy.classList.add('nimble-chat-card__body');
	}

	const color = message.author?.color;
	element.classList.add('nimble-chat-card', 'nlo-chat-message');
	if (color) {
		element.style.setProperty('--nimble-user-background-color', color.css ?? String(color));
		element.style.setProperty('--nimble-user-text-color', headerTextColor(color));
	}

	const speaker = message.speaker?.alias || message.author?.name || '';
	const header = document.createElement('header');
	header.className = 'nimble-chat-card__header';
	header.innerHTML = `<span>${esc(speaker)}</span>
		<time class="message-timestamp">${esc(foundry.utils.timeSince(message.timestamp))}</time>`;

	if (message.canUserModify?.(game.user, 'delete')) {
		const remove = document.createElement('button');
		remove.type = 'button';
		remove.className = 'nimble-u-unstyled-button message-delete';
		remove.setAttribute('aria-label', game.i18n.localize('Delete'));
		remove.innerHTML = '<i class="fas fa-trash" inert></i>';
		remove.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			message.delete();
		});
		header.append(remove);
	}

	element.querySelector('.message-header')?.replaceWith(header);
}
