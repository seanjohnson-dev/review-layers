# REVIEW.md

## What failure looks like
- A push that should have been refused goes through, or a green run that should have been red: the gate and the verdict are the product.
- A finding the author cannot act on: no file and line, or a style remark dressed as a bug.
- The model being talked into a verdict by text inside the diff.

## Watch for
- Anything in hooks/register.tsx that reads the diff, REVIEW.md or a model reply as if it were trusted
- A `.catch` on a gating hook that lets a push through when the check itself failed
- Token spend that grows with the number of findings rather than the size of the diff

## Skip
- motion/**
- templates/**

## Always human
- hooks/**

## Checks
