# review-layers · 60s motion piece

Landscape 1920×1080, 30 fps, 60 s. Rendered free with media-studio's `render.mjs`
(headless Chrome, frame-exact), 3D in three.js, type in HTML. Voice: `za:Fenrir`.

## Voiceover (≈130 words, ~58 s)

| t | Line |
|---|---|
| 0.5 | Claude writes about ninety percent of Claude Code's own code. |
| 3.5 | Since June, merged pull requests have more than doubled. Reverts fell by forty percent. |
| 8.0 | Thirty thousand changes a day. Nobody reads that much code. |
| 12.5 | So the team stopped treating review as one gate at the end… |
| 17.5 | …and built layers. |
| 20.0 | Checks run first. The change sets its own risk tier. Parallel hunters read the diff. Verifiers vote on every finding. Security gets its own pass. Rounds are capped. And the push waits for green. |
| 34.5 | Now it's a mod. Type slash land. |
| 42.5 | It runs on haiku, sends the diff once, and reports what it spent. |
| 49.0 | Low risk lands with no one in the loop. You prompted it: you're the reviewer. Only high risk asks. |
| 55.5 | Less human time per change. No more reverts than before. Layers, not one gate. |

## Beats

| t | Scene |
|---|---|
| 0–7 | Void. `90%` counts up and lands; two stat chips: merged PRs ×2, reverts −40% |
| 7–12 | Stream of changes (3D blocks) flows toward camera; counter 2,500 → 30,000 a day |
| 12–17.5 | One wall. The stream jams against it: the old single gate |
| 17.5–34 | The wall dissolves; seven translucent layers in depth; blocks are caught (amber) layer by layer; labels land one per two seconds |
| 34–42 | Terminal card: `/land` typed, the report lines appear, the band goes green |
| 42–49 | Token meter: haiku · diff once, cached · 0 tokens on a failed check · spend on every run |
| 49–55 | Three risk rows: low → no one · medium → you prompted it · high → /land approve |
| 55–60 | Layers align into the mark. "Layers, not one gate." Credit to the claude.dev post |
