# Nimble Loot Actor

A Foundry VTT module that adds a **Loot** actor type to the [Nimble](https://github.com/Nimble-Co/FoundryVTT-Nimble) system (0.10.0 or newer, Foundry v14). A loot actor is nothing but an inventory and a purse: the GM fills it with objects and coins, places it on a scene, and the players help themselves.

## Installation

In Foundry's *Add-on Modules* tab, click *Install Module* and paste this manifest URL:

```
https://github.com/KorakaBonk/nimble-loot-actor/releases/latest/download/module.json
```

Then enable **Nimble Loot Actor** in your Nimble world.

## For the GM

1. **Create a loot actor.** In the Actors directory, click *Create Actor* and pick **Loot** next to Character, NPC, Solo Monster and Minion.
2. **Fill it.** Drag objects onto the sheet from the Items directory, a compendium, or a character sheet. Stackable objects of the same name merge into one stack, just like on a character. Set gold, silver and copper in the purse at the top. Quantities can be edited on each row; the pencil and bin icons edit or delete an object.
3. **Place it.** Drag the actor onto a scene. New loot actors use a chest image and a linked token, so the sidebar always shows what is left. Players can loot a pile as soon as its token is on a scene and not hidden. Hide the token to keep it out of reach.

Loot actors are not shown in the players' Actors directory, and players never need ownership of them. If you want players to be able to open a pile from the sidebar too, give them Limited or Observer permission on it.

As GM, the hand icon on a row gives that object to a character of your choice, and the coin buttons work for you as well.

## For players

- **Click a loot token** to open its inventory (or double-click, if the GM turned single-click off).
- **Take an object** with the hand icon next to it. For a stack you choose how many.
- **Take coins** moves the gold, silver and copper you choose into your character's purse.
- **Split among party** shares the coins evenly between the player characters you tick. The list holds every character that is assigned to a player in *User Configuration*, and the characters of players who are online start ticked. If no player has an assigned character, every character a player owns is listed. Each coin type is divided on its own, and coins that do not divide evenly stay in the loot.

If the [Nimble Party Loot](https://github.com/KorakaBonk/nimble-party-loot) module (1.0 or newer) is active, two more buttons appear: the box icon on a row moves that object (or part of a stack) into the party loot, and **Move all coins to party loot** moves the whole purse there.

Loot goes to your assigned character. If you have none, it goes to the character token you have selected, or you are asked which of your characters should receive it.

Unidentified objects show their unidentified name and description to players, including in chat.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| Announce looting in chat | On | Posts a chat card whenever someone takes an object or coins, or splits the coins. |
| Open loot with a single click | On | Players open loot tokens with one click. When off, they double-click. |

## How it works

The loot type is a module sub-type (`nimble-loot-actor.loot`) registered with Nimble's actor proxy, so it is a real Nimble actor whose items are ordinary Nimble objects.

Players do not own loot actors, so a player's take or split is sent over the module socket to the **active GM**, whose client checks it and moves the items and coins. Requests are handled one at a time, so two players cannot take the same object. **A GM must be online** for players to take loot.

If the module is disabled, Foundry cannot load loot actors, so keep it enabled in any world that has them.

## Development

There is no build step: the module is plain ES modules, Handlebars templates and CSS.

```sh
npm test        # unit tests for the coin and object helpers
npm run check   # syntax check of every script
```

To release, set the new version in `module.json` and `package.json`, add it to `CHANGELOG.md`, and push a tag such as `v1.0.1`. The workflow in `.github/workflows/release.yml` runs the tests, checks that the tag matches `module.json`, and creates the GitHub release with `module.json` and `module.zip` attached. Publishing a release from the GitHub page for a new tag works too, and so does running the *Release* workflow by hand on `main`, which tags the version in `module.json`.

## License

[MIT](LICENSE)
