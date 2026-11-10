# Codex, patched

Mondrian's design tokens and component styles: [Codex](https://doc.wikimedia.org/codex/)
2.7.0 (`@wikimedia/codex`, `@wikimedia/codex-design-tokens`) with Gerrit change
[1304941](https://gerrit.wikimedia.org/r/c/design/codex/+/1304941), "tokens:
Update color values", applied.

| File | From |
| --- | --- |
| `theme-wikimedia-ui.css` | `@wikimedia/codex-design-tokens/dist/theme-wikimedia-ui.css` |
| `theme-wikimedia-ui-mode-dark.css` | `@wikimedia/codex-design-tokens/dist/theme-wikimedia-ui-mode-dark.css` |
| `codex.style.css` | `@wikimedia/codex/dist/codex.style.css` |

They are copied, unedited, from ProtoWiki's patched install (`npm run
codex:use-patch`, patchset 31). Patchsets 32–34 change only a test snapshot,
so the CSS is the same as the latest patchset.

`index.html` loads the light tokens, then the dark ones under
`(prefers-color-scheme: dark)`, then the component styles, then `style.css`.

To update: in ProtoWiki, `npm run codex:patch -- <change>` (or
`codex:use-stock` for published Codex), then copy the three files here again.

Codex is GPL-2.0-or-later.
