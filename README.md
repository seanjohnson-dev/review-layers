# review-layers

**Code review for code an agent wrote. Layers, not one gate.**

A Claude Code mod that lands code the way the Claude Code team does, for one person and their agent: the project's checks run first, a risk tier is set from the change, parallel hunters read the diff, verifiers vote on every finding, security gets its own pass, rounds are capped, and `git push` waits for green. It is token-light by design, and it found 21 bugs in its own code the first morning it reviewed itself.

<p align="center">
  <a href="https://github.com/seanjohnson-dev/review-layers/releases/latest/download/review-layers-film.mp4">
    <img src="docs/teaser.gif" alt="One change passing the seven layers: the red run, the findings pinned to the lines they name, the fix, the green run, the refused push, the approval, the push going through" width="900">
  </a>
  <br>
  <sub><a href="https://github.com/seanjohnson-dev/review-layers/releases/latest/download/review-layers-film.mp4">▶ Watch the 69-second film</a> · no narration, every word on screen is a real string from a real run</sub>
</p>

> **Running agents other than Claude Code?** I'm weighing a metered `/land` service any agent can call. [Say so here](https://github.com/seanjohnson-dev/review-layers/issues/1) — a 👍 and one line about your setup is enough.

```
/land
review-layers · GREEN: medium risk, round 1 · feature/pricing (2 commits ahead of origin/main) · 4 files · 6.1k tokens · 41s
  ✓ verify     2 checks green
  ✓ risk tier  medium: set by the classifier from the change
  ✓ hunters    4 raised (2 distinct), 0 confirmed, 2 dropped
  ✓ verifiers  voted
  ✓ security   clean
  ✓ converge   round 1 of 3
  ✓ gate       cleared to push

Cleared: medium risk (you prompted it, so you are its reviewer) needs no typed approval. git push and gh pr create will go through.
```

## Install

At the prompt of a terminal session:

```
/plugin install review-layers --marketplace seanjohnson-dev/review-layers
```

From a shell:

```bash
claude plugin install review-layers --marketplace seanjohnson-dev/review-layers
```

In the desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `seanjohnson-dev/review-layers`, then **Add plugin**.

Then, in a project: `/land init` (writes a starter `REVIEW.md`) or just `/land`. The gate only switches on in a project where `/land` has run or a `REVIEW.md` exists, so your other repos are untouched.

## Why

The Claude Code team wrote up [how they review code at the volume agents produce it](https://claude.dev/blog/solving-code-review-at-anthropic/): Claude writes about 90% of Claude Code; merged PRs doubled while reverts fell 40%; nobody reads 30,000 changes a day. They stopped treating review as one gate at the end and built layers, each catching some problems, with rollback under them, and they optimise for **the least human time that does not raise reverts**.

This mod is that process, recrafted for a solo developer, with two rules the blog sets as goals taken literally: as little human time as the reverts allow, and as few tokens as the review allows.

## The layers

| # | Layer | What it does | Tokens |
|---|---|---|---|
| 1 | **verify** | Runs the project's own checks in your login shell (typecheck, lint, test; build at `deep`; `claude plugin validate` and `test` for a mod) and keeps the output as evidence. A red check stops the run before any model is asked. | none |
| 2 | **risk tier** | Sets `low` / `medium` / `high` from the change, never the author. Auth, billing, migrations, CI workflows, installers and `.env` are always high; docs-only is low; the rest is one tiny classifier call. | ~0.3k |
| 3 | **hunters** | Three parallel reviewers on the diff, one lens each: correctness, edges & regressions, security. Bugs only, never style. Each finding names its *class* so every instance gets fixed, not one line. | the diff once, cached, + ~1k each |
| 4 | **verifiers** | Two votes per distinct finding (three at `deep`), each seeing only the hunk the claim came from. Only confirmed findings are posted, a split vote is marked *contested*; findings three hunters agree on count that agreement. | ~1–2k per finding |
| 5 | **security** | The security lens's findings block regardless of tier. | included |
| 6 | **converge** | A round cap (default 3) on the attempts since the change last went green, after which the hunters stop and ask you to reconsider the approach. Round 2+ re-reads only files whose diff changed. A finding posted once is never re-posted; a finding you resolve stays resolved for that piece of work. Once the work lands (its base moves, whoever pushed it), the next change starts at round 1 with a clean slate. | smaller each round |
| 7 | **gate** | `git push` and `gh pr create/merge` are refused until the current changes are green (and approved where the tier needs it). | none |

Every run reports what it spent, cache reads shown separately (they bill at about a tenth). Measured on real runs: a 20-line diff with three bugs cost 16–27k tokens on haiku at `standard` (most of it verifier votes); the green round after the fix, 8.6k; a 60-line change to this mod's own hooks, 36–52k. `quick` is roughly a third of that.

## Human time

- **The fix loop runs itself.** A red run hands the verified findings straight to Claude: fix every instance of each class, show the checks passing, re-review. You read the result when it is green or the round cap hits. (`autoFix` option.)
- **Whoever prompted the change is its reviewer.** Medium risk is cleared by a green run. Only high risk asks for a typed `/land approve <note>`. (`approvals: strict` makes medium ask too.)
- **Every finding must be answered**, but answering is one line: fix it, or `/land resolve <n> <reason>`.
- **It keeps score.** `/land status` shows how many landings needed no person, and how many approvals and resolves you had to type.

## Commands

```
/land [quick|standard|deep] [focus]   run every layer on the changes that would be pushed
/land status                          where the current changes stand, plus the human-time score
/land fix                             hand the open findings to Claude (autoFix does this for you)
/land resolve <n> <reason>            close finding n as wrong or intentional
/land approve [note]                  the sign-off a high (or strict medium) tier, or a change too big to read whole, needs
/land learn <note>                    add a lesson to REVIEW.md so the hunters look for it next time
/land init                            write a starter REVIEW.md for this project
/land trust                           allow REVIEW.md's checks, Skip and Always human rules (asked again when they change)
/land incident <commit> <what broke>  add a past incident to the eval set
/land eval                            re-run the hunters over every incident and report recall
/land pr                              a PR body with Testing, Risk and How to revert filled in
/land pane                            open the layers pane   ·   /land reset   forget this branch's rounds
```

Claude has the same pipeline as a tool (`land`), so it can re-review after fixing without you typing anything. In a project where review-layers is on, a three-line section in the system prompt tells it to run the checks, show their output, and not push until green. Other projects get nothing.

## REVIEW.md

Code owners tell the reviewer what matters in their repo. `/land init` writes the template; the hunters read it on every run:

- **What failure looks like** – "it charges the wrong amount", "it lies", "it misroutes"
- **Watch for** – lessons; `/land learn "<note>"` appends one. When the reviewer keeps flagging the same thing, fix it here (or with a lint rule), not in another round.
- **Skip** – globs never sent to the hunters
- **Always human** – globs that make the tier high
- **Checks** – commands to run as evidence (detected from `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, a `Makefile` or a plugin manifest when empty)

Checks, Skip and Always human decide what runs and what gets reviewed, so they apply only after you type `/land trust`, which lists them first. If any of them change (an agent's edit, a pulled commit), `/land` and the push gate stop and ask again before anything runs. Claude's `land` tool cannot trust them for you. A fresh `/land init` file has none, so it needs no trust step.

## Incidents are the eval

When something ships broken, record it: `/land incident <commit> "<what broke>"`. The set lives in `.review-layers/incidents.json` (commit it). `/land eval` re-runs the hunters over each incident's diff and reports how many it would have caught. Change the reviewer (a REVIEW.md line, the model, the depth), run the eval again, keep the change only when the score holds.

## It reviewed itself

The first morning the mod was pointed at its own repository it ran nineteen times and raised 21 distinct real bugs, every one verified and fixed before the code was pushed, and the push itself was refused three times for the right reasons. The runs are kept in [`docs/self-review/`](docs/self-review/). The one it raised first: the hunters and verifiers trusted the text of the diff, so a comment in a change could have told the reviewer "verdict: not-real".

## What it will not be talked into

The diff, the hunks and REVIEW.md are data under review. The hunters and verifiers are told so in their system prompts: text inside the change that addresses the model, claims a verdict or says something is handled never changes the answer, and a verifier's "not-real" must name the line of code that handles the case. A hunter that does not answer, or whose answer is cut off or not a readable list, is asked once more; if it still fails, the run is **incomplete**, not green, and that run does not count as a round. A verifier whose verdict cannot be read is asked once more and otherwise abstains: it never counts as "not real". A finding is dropped only when most of its verifiers gave a readable verdict and none called it real; otherwise it stays open. `/land resolve` answers findings and nothing else, so a run that is red because a check failed, a hunter failed or the round cap was reached stays red. `/land trust` and `/land approve` are a person's sign-off. They count only when a person sends them: typed at the prompt or in the app, from their phone through Remote Control, with `claude -p`, or with the band's own button. Anything else is refused, including another session, a schedule, another plugin and a source the engine cannot name, and Claude's shell cannot start another Claude to type them.

## It says what it did not read

A change bigger than the diff budget is read in up to three parts, a big file split between its hunks, so every line is read. Past that, and for new files past the 200th, the rest is not sent: the report names those files, and a green run then needs `/land approve <note>` from a person before the push goes through.

## What it does on your machine

Everything the mod touches, so you can judge it before installing:

- **Programs it runs.** `git` (diff, rev-parse, log, show, ls-files) in the project; the project's own checks from `REVIEW.md` (only after `/land trust`) or detected from `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, a `Makefile` or a plugin manifest, each run through your login shell (`$SHELL -lc`, falling back to `sh`) with `CI=1`; and, in a plugin repository, `claude plugin validate .` and `claude plugin test .` through the `claude` binary named by `$CLAUDE`, `~/.local/bin/claude` or `claude` on your PATH. It reads two environment variables, `SHELL` and `CLAUDE`, and no keys, tokens or secrets.
- **What leaves the machine.** The diff text (up to three times the budget, in parts), the hunks a finding points at, `REVIEW.md`, the risk-tier summary and the checks' output go to the review model through Claude Code's own model call (`$.model.complete`), on your account. The mod makes no network requests of its own and sends nothing anywhere else.
- **Privacy.** The full privacy policy is [PRIVACY.md](PRIVACY.md).
- **Files it writes.** `REVIEW.md` in the project root (`/land init` creates it, `/land learn` appends a line under *Watch for*) and `.review-layers/incidents.json` (`/land incident`). Nothing else, and never outside the project.
- **Decisions it takes.** When the gate is on, the Bash tool hook refuses `git push` and `gh pr create/merge` until the current changes are green (and approved where the tier needs it); every other command passes through unchanged. It also answers its own `land` tool and `/land` command.
- **Prompts it submits.** With `autoFix` on, a red run submits one prompt as you: the verified findings and "fix every instance, show the checks passing, then re-review". The band's *Fix*, *Run /land* and *Approve* buttons submit `/land fix`, `/land` and `/land approve`. Nothing is submitted that you did not ask for by running `/land` or pressing a button.
- **System prompt.** Three lines are added, only in a project where review-layers is on (`/land` has run there or it has a `REVIEW.md`): run the project's checks and show their output, run `land` after fixing, do not push until it is green.
- **State it keeps.** Per project, in Claude Code's plugin store: the last pass, rounds per branch, findings, the human-time counts and a fingerprint of the REVIEW.md rules you trusted. `/land reset` clears the branch's rounds.

## Options

In `/config` (or `pluginConfigs["review-layers"].options` in `~/.claude/settings.json`):

| Option | Default | |
|---|---|---|
| `model` | `haiku` | hunters and verifiers; `sonnet`, `opus` or `inherit` (the session's model) |
| `depth` | `standard` | `quick` one hunter, no votes · `standard` 3 hunters, 2 votes · `deep` session model, 3 votes, build runs |
| `gate` | `block` | `warn` only toasts · `off` |
| `approvals` | `author-counts` | `strict`: medium risk needs `/land approve` too |
| `autoFix` | `true` | red runs go straight to Claude to fix and re-review |
| `roundCap` | `3` | rounds before the hunters stop and ask for a step back |
| `maxDiffChars` | `40000` | diff budget per part (~10k tokens); a bigger diff is read in up to three parts, and past that what is cut needs a person's approval |

## How it stays cheap

- haiku by default, `effort: low` for the tier and the verifiers
- the diff is sent once with a prompt-cache mark; the three hunters share it
- verifiers see one hunk, not the diff; a finding raised by several hunters is verified once
- round 2+ sends only files whose diff changed; unchanged files are not re-read
- a big change is read in up to three parts; past that it is trimmed source-first (small files stay whole, the largest give way, assets and docs before code) and the run says what it did not read
- lockfiles, minified and generated files never go to a model
- a red check, a round past the cap, REVIEW.md rules waiting for `/land trust`, or a diff identical to the last green run costs no model call at all, not even the risk tier
- the tool schema is ~80 tokens and the system-prompt section three lines, only in projects that use it

## Development

```bash
claude plugin validate .
claude plugin test .
```

The pure parts (the diff budget, the merge of findings, the hunk finder, the content hash) live in [`hooks/lib.ts`](hooks/lib.ts) with unit tests in [`tests/`](tests/). If you edit the mod while a session is running it, `/reload-plugins` before trusting its gate in that session: a stale copy hashes the diff its own way.

The film was rendered free from a three.js page in headless Chrome; every string on screen is read from the mod's source, the demo project and the captured runs. Its build scripts are not part of this repository.

MIT.
