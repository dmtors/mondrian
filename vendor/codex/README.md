# Codex, patched

Mondrian's design tokens and component styles: [Codex](https://doc.wikimedia.org/codex/)
(`@wikimedia/codex`, `@wikimedia/codex-design-tokens`) built with two Gerrit
changes on top:

- [1304941](https://gerrit.wikimedia.org/r/c/design/codex/+/1304941), "tokens:
  Update color values" (patchset 34, not yet merged)
- [1354777](https://gerrit.wikimedia.org/r/c/design/codex/+/1354777),
  "Components: Adjust icon alignment in inputs and with menu content" (merged
  into Codex main, not yet in a release)

| File | Built from |
| --- | --- |
| `theme-wikimedia-ui.css` | `packages/codex-design-tokens/dist/theme-wikimedia-ui.css` |
| `theme-wikimedia-ui-mode-dark.css` | `packages/codex-design-tokens/dist/theme-wikimedia-ui-mode-dark.css` |
| `codex.style.css` | `packages/codex/dist/codex.style.css` |

How they were built: Codex at 1304941 patchset 34 (commit `a3ef6b60`, based on
Codex main after v2.7.0), with 1354777's commit (`070f7136`) cherry-picked
onto it, then `npm run build` for the tokens, icons and components (Node 24).
The two changes overlap in `TextInput.vue` and `TextArea.vue`; the merge keeps
both: 1304941's medium end icon and 1354777's 8px padding (without the old
extra 1px for the border).

`index.html` loads the light tokens, then the dark ones under
`(prefers-color-scheme: dark)`, then the component styles, then `style.css`.

To update: rebuild the same way with newer patchsets (or a Codex release that
includes them), and copy the three files here again.

Codex is GPL-2.0-or-later.
