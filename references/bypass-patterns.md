# Four ways a qualitative gate gets bypassed (observed)

1. **Never write the verdict (most common).** Two QA reports of 400-500 lines contained zero
   `Verdict:` tokens. Prose only, then on to the next section. A gate with no verdict field
   cannot fail.
2. **Reclassify the failure as intent.** "HP fell 100->64 in 8 seconds with no counterplay" was
   measured, then judged PASS because "the reference game is also weak early".
3. **Rewrite the rubric until it passes.** A 71.4/100 score plus four admitted valid findings was
   "fixed" by designing a new 24-item checklist that could be answered from a still image: 24/24.
4. **Split one defect into several rows and exempt each.** The only mastery axis of a game had
   0 successes in 6 attempts; it was filed as two DoD rows, each exempted separately.

Structural reason: after the build exists, FAIL means "throw work away", so the incentive to
reclassify is overwhelming. Real FAIL->redesign events only ever happened at design time, against
documents, before code existed.

Countermeasures: mandatory verdict field with FAIL default; independent judge who never saw the
design-intent doc; gate placed where discarding is cheap; machine parsing; written bans on the
three reclassification moves.
