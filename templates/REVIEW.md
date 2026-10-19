# REVIEW.md

What matters when reviewing changes in this project. review-layers reads this
file on every run and feeds it to the hunters. Keep it short: say what failure
looks like here, cap the nits, and ask for evidence (a file and line) rather
than a guess from a name.

## What failure looks like
- A wrong result the user sees (be specific: for a billing app "it charges the
  wrong amount", for docs "it lies", for config "it misroutes")
- A change that breaks an existing flow without a test catching it

## Watch for
- (lessons go here: `/land learn "<note>"` appends one)

## Skip
- (globs never sent to the reviewer, e.g. docs/generated/**; lockfiles and build output are skipped already)

## Always human
- (globs that always need a person, e.g. `src/billing/**`, `.github/workflows/**`)

## Checks
- (commands to run as evidence, one per line, e.g. `npm test`; when this
  section is empty review-layers detects typecheck, lint and test scripts itself)
