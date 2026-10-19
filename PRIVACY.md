# Privacy policy: review-layers

Effective 19 October 2026. Applies to review-layers 0.1.3 and later.

review-layers is a free, open-source mod for Claude Code. It runs entirely inside your own Claude Code session, on your own computer. This page says what data it touches, where that data goes, how long it is kept and how to delete it.

## The short version

- The author of review-layers collects nothing. There is no server, no analytics, no telemetry, no account and no tracking in the mod.
- The only data that leaves your computer is what a code review needs: the changes under review go to the AI model through Claude Code's own model call, on your Claude account. Anthropic's terms and privacy policy cover that call, exactly as they cover the rest of your Claude Code session.
- What the mod keeps stays on your computer, and you can delete it at any time.

## What it reads

- **Your code changes.** The git diff of the changes that would be pushed, including new files that are not yet committed. Lockfiles, minified files and generated files are left out.
- **REVIEW.md**, if your project has one: the review notes you write for the reviewer.
- **Check output.** The output of your project's own checks (for example `npm test`).
- **Two environment variables:** `SHELL`, to run checks in your usual shell, and `CLAUDE`, to find the Claude Code program. It reads no keys, tokens, passwords or other secrets.

## Where data goes

- **To the AI model, through Claude Code.** The diff (in up to three parts), the lines a finding points at, REVIEW.md, a list of changed file names with line counts, and check output are sent to the review model (Haiku by default, or the model you choose) using Claude Code's built-in model call. That call runs on your Claude account and is handled by Anthropic under the terms that already apply to your use of Claude Code. See [Anthropic's privacy policy](https://www.anthropic.com/legal/privacy).
- **Nowhere else.** The mod makes no network requests of its own. It sends nothing to the author or to any third party.

## What it stores, and for how long

- **In Claude Code's plugin store, on your computer** (`~/.claude/plugins/store/`): for each project, the last review verdict, review rounds per branch, the findings of the last run, simple counts (runs, approvals, tokens used) and a fingerprint of the REVIEW.md rules you allowed with `/land trust`. It keeps the 12 most recently used projects and drops older ones automatically.
- **In your project, only when you ask:** `REVIEW.md` (`/land init` creates it, `/land learn` adds a line) and `.review-layers/incidents.json` (`/land incident`). These are ordinary files in your project. You decide whether to commit them.
- Nothing is stored anywhere else.

## How to delete it

- `/land reset` forgets the current branch's rounds and verdict.
- Uninstalling the mod (`/plugin uninstall review-layers`) stops it reading or sending anything. Its saved records are one file in Claude Code's plugin store, `~/.claude/plugins/store/`, whose name starts with `review-layers`. Delete that file to remove them all.
- Delete `REVIEW.md` or `.review-layers/` from your project like any other file.

## What it does on its own

With the default settings, a failed review sends one prompt to Claude in your session asking it to fix the findings. You can turn this off with the `autoFix` option. When the push gate is on, the mod refuses `git push` and `gh pr create` or `gh pr merge` until the review is green. It never pushes, posts or sends anything itself.

## Children

The mod is a developer tool and is not aimed at children. It collects no personal information from anyone.

## Changes

Changes to this policy are made in this file and are visible in the repository's history. The effective date at the top changes when the policy does.

## Contact

Questions or concerns: open an issue at [github.com/seanjohnson-dev/review-layers/issues](https://github.com/seanjohnson-dev/review-layers/issues).
