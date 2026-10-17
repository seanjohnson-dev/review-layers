# review-layers

A Claude Code mod that lands code the way the Claude Code team does: **layers, not one gate**. It recreates the process from [How the Claude Code team does code review](https://claude.dev/blog/solving-code-review-at-anthropic/) for one person and their agent, with two rules the blog sets as goals: **as little human time as the reverts allow**, and **as few tokens as the review allows**.

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

## The layers

| # | Layer | What it does | Tokens |
|---|---|---|---|
| 1 | **verify** | Runs the project's own checks (typecheck, lint, test; build at `deep`) and keeps the output as evidence. A red check stops the run before any model is asked. | none |
| 2 | **risk tier** | Sets `low` / `medium` / `high` from the change, never the author. Auth, billing, migrations, CI workflows, installers and `.env` are always high; docs-only is low; the rest is one tiny classifier call. | ~0.3k |
| 3 | **hunters** | Three parallel reviewers on the diff, one lens each: correctness, edges & regressions, security. Bugs only, never style. Each finding names its *class* so every instance gets fixed, not one line. | the diff once, cached, + ~1k each |
| 4 | **verifiers** | Two votes per distinct finding (three at `deep`), each seeing only the hunk the claim came from. Only confirmed findings are posted; findings three hunters agree on count that agreement. | ~0.3k per finding |
| 5 | **security** | The security lens's findings block regardless of tier. | included |
| 6 | **converge** | A round cap (default 3) after which the hunters stop and ask you to reconsider the approach. Round 2+ re-reads only files whose diff changed. A finding posted once is never re-posted; a finding you resolve stays resolved. | smaller each round |
| 7 | **gate** | `git push` and `gh pr create/merge` are refused until the current changes are green (and approved where the tier needs it). | none |

Every run reports what it spent. A typical standard run on a 200-line diff is 5–10k tokens on haiku.

## Human time

The blog's goal is "the minimum human review time that doesn't raise reverts". So:

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
/land approve [note]                  the human sign-off a high (or strict medium) tier needs
/land learn <note>                    add a lesson to REVIEW.md so the hunters look for it next time
/land init                            write a starter REVIEW.md for this project
/land incident <commit> <what broke>  add a past incident to the eval set
/land eval                            re-run the hunters over every incident and report recall
/land pr                              a PR body with Testing, Risk and How to revert filled in
/land pane                            open the layers pane   ·   /land reset   forget this branch's rounds
```

Claude has the same pipeline as a tool (`land`), so it can re-review after fixing without you typing anything. A three-line section in the system prompt tells it to run the checks, show their output, and not push until green.

## REVIEW.md

Code owners tell the reviewer what matters in their repo. `/land init` writes the template; the hunters read it on every run:

- **What failure looks like** – "it charges the wrong amount", "it lies", "it misroutes"
- **Watch for** – lessons; `/land learn "<note>"` appends one. When the reviewer keeps flagging the same thing, fix it here (or with a lint rule), not in another round.
- **Skip** – globs never sent to the hunters
- **Always human** – globs that make the tier high
- **Checks** – commands to run as evidence (detected from `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml` or a `Makefile` when empty)

## Incidents are the eval

When something ships broken, record it: `/land incident <commit> "<what broke>"`. The set lives in `.review-layers/incidents.json` (commit it). `/land eval` re-runs the hunters over each incident's diff and reports how many it would have caught. Change the reviewer (a REVIEW.md line, the model, the depth), run the eval again, keep the change only when the score holds.

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

Then, in a project: `/land init` (or just `/land`). The gate only switches on in a project where `/land` has run or a `REVIEW.md` exists, so other repos are untouched.

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
| `maxDiffChars` | `40000` | diff budget per run (~10k tokens); bigger diffs are trimmed per file |

## How it stays cheap

- haiku by default, `effort: low` for the tier and the verifiers
- the diff is sent once with a prompt-cache mark; the three hunters share it
- verifiers see one hunk, not the diff; a finding raised by several hunters is verified once
- round 2+ sends only files whose diff changed; unchanged files are not re-read
- lockfiles, minified and generated files never go to a model
- a red check, a diff identical to the last green run, or a round past the cap costs no model call at all
- the tool schema is ~80 tokens and the system-prompt section three lines

## Development

```bash
claude plugin validate .
claude plugin test .
```

MIT.
