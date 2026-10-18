---
name: verdict-gate
description: Make qualitative quality gates (fun, design, UX, "does it look right") impossible to pass by silence. Use when building or fixing a review/QA gate that AI agents or humans fill in, when a gate "always passes", when a QA report has prose but no PASS/FAIL line, or when you need to machine-check that every required review section has an explicit verdict, an eligible judge, and a bounded number of rounds.
---

# verdict-gate

A qualitative gate whose pass condition is "the section exists" **cannot fail**. This skill
replaces that with a machine-parsed verdict line, and treats everything else as FAIL.

Measured in a real 12-cycle pipeline: the most common way a "fun" gate was bypassed was not
rebuttal, it was **leaving the verdict field empty and moving on**. Zero gates ever forced a
redesign once code existed. The four bypass patterns are in `references/bypass-patterns.md`.

## Rules the checker enforces

1. **Missing verdict = FAIL.** A section with prose but no `Verdict: PASS|FAIL` line is a failure,
   not a pass. Free-text verdicts ("looks good", "PASS with caveats") are also FAIL.
2. **Last round wins.** A gate may have several round sections (round 1 FAIL -> fix -> round 2 PASS).
   Read the *last* section. Reading the first freezes round 1's FAIL forever, and the easiest way
   out becomes editing history.
3. **Anchor the heading match.** A loose regex like `/6-0/` matches the date `2026-08-12` and reads
   the wrong section -> a *false PASS*. Headings are anchored right after the `#` marker.
4. **Judge must be eligible.** `Judge:` must name an allowed independent role. The author of the
   artifact (designer, art director, copywriter) is on a deny-list: nobody grades their own work.
   NOTE: this line is self-reported. It stops "forgot", not "lied". Output says so.
5. **Closure count.** If a section says "N new consensus findings remain" and N>0, a PASS is
   rejected.
6. **Round cap.** More than K rounds means you stop iterating and pick an exit (shrink scope, cut,
   kill) instead of burning budget. A cap nobody counts is not a cap.

## Use

```bash
node scripts/check-verdicts.mjs path/to/QA_REPORT.md --config gates.json
# exit 0 = all required gates PASS with an eligible judge
# exit 1 = at least one missing / FAIL / ineligible judge / round cap exceeded
# exit 2 = file or config problem (NOT a pass)
```

`gates.json` (see `tests/gates.example.json`):

```json
{
  "roundCap": 3,
  "judges": { "allow": ["independent-judge", "blind-player"], "deny": ["designer", "art-director"] },
  "gates": [
    { "id": "greybox-fun",  "heading": "Greybox fun gate|6-0", "exemptable": false },
    { "id": "final-polish", "heading": "7-E", "closure": "new\\s+consensus\\s+findings?\\s*[:=]?\\s*(\\d+)" }
  ]
}
```

## Design guidance when you write the gate itself

- Default the verdict to FAIL. Make the template ship with `Verdict: FAIL` already written.
- Put the gate at the cheapest point to fail: before code exists (grey-box prototype), not after.
  The later it sits, the stronger the incentive to reclassify a failure as "intended".
- Ban in writing: rewriting the rubric mid-cycle so the score goes up (report before/after and
  take the lower), "the original did it too" as PASS evidence, splitting one defect across several
  rows to exempt each.
- Be as afraid of false FAIL as of false PASS: a linter that cries wolf gets switched off.

Run `tests/run.sh` to see every bypass pattern get caught.
