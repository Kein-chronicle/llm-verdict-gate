# llm-verdict-gate

**Make AI and human review gates impossible to pass by silence: machine-parsed PASS/FAIL, missing verdict = FAIL.**

[![test](https://github.com/Kein-chronicle/llm-verdict-gate/actions/workflows/test.yml/badge.svg)](https://github.com/Kein-chronicle/llm-verdict-gate/actions/workflows/test.yml) ![license](https://img.shields.io/badge/license-MIT-blue.svg) ![dependencies](https://img.shields.io/badge/dependencies-none-brightgreen.svg)

## Why

A review gate whose pass condition is "the section exists" cannot fail. In the author's own 12-cycle agent pipeline (anecdotal, not a benchmark) the usual way a quality gate was bypassed was not an argument; it was an empty verdict field. This checker reads a QA report and treats everything except an explicit `Verdict: PASS` from an eligible judge as a failure.

## Install

**As a Claude Code skill** (Claude uses it when the task matches the skill description):

```sh
git clone https://github.com/Kein-chronicle/llm-verdict-gate.git ~/.claude/skills/verdict-gate
```

For a single project, clone into `<project>/.claude/skills/verdict-gate` instead, then start a new Claude Code session.

**As plain scripts:**

```sh
git clone https://github.com/Kein-chronicle/llm-verdict-gate.git
cd llm-verdict-gate
```

**Requires:** Node.js 22+.

## Quick start

Run it on four sample reports:

```console
$ bash examples/demo.sh
# A report whose every gate has an explicit verdict from an eligible judge
$ node scripts/check-verdicts.mjs tests/fixtures/good.md --config tests/gates.example.json
tests/fixtures/good.md: verdict check

  [PASS] greybox-fun
  [PASS] final-polish

All required gates PASS.
[exit 0]

# A report with a long, enthusiastic section and no verdict line: silence is FAIL
$ node scripts/check-verdicts.mjs tests/fixtures/prose_only.md --config tests/gates.example.json
tests/fixtures/prose_only.md: verdict check

  [FAIL(no verdict)] greybox-fun: last round has no "Verdict: PASS|FAIL" line (prose does not count)
  [FAIL(no closure line)] final-polish: this gate requires a closure count line (regex new\s+consensus\s+findings?\s*[:=]?\s*(\d+)) and none was found

NOT PASSED. An empty verdict is not a pass.
[exit 1]

# The designer graded their own work
$ node scripts/check-verdicts.mjs tests/fixtures/author_judges.md --config tests/gates.example.json
tests/fixtures/author_judges.md: verdict check

  [FAIL(judge=author)] greybox-fun: "designer" authored the artifact - cannot judge it
  [FAIL(no closure line)] final-polish: this gate requires a closure count line (regex new\s+consensus\s+findings?\s*[:=]?\s*(\d+)) and none was found

NOT PASSED. An empty verdict is not a pass.
[exit 1]

# An empty file is not a pass
$ node scripts/check-verdicts.mjs tests/fixtures/empty.md --config tests/gates.example.json
tests/fixtures/empty.md: verdict check

  [FAIL(no section)] greybox-fun: section not found - absence is not a pass
  [FAIL(no section)] final-polish: section not found - absence is not a pass

NOT PASSED. An empty verdict is not a pass.
[exit 1]
```

The output above is real: it is produced by the files in `examples/`.

## Use it on your own files

```sh
node scripts/check-verdicts.mjs path/to/QA_REPORT.md --config gates.json
```

Sample inputs for every file format are in `examples/` and `tests/`; the details are in [SKILL.md](SKILL.md).

## What it checks

- Missing or free-text verdict ("looks good", "PASS with caveats") is FAIL.
- The last round of a gate wins, so history cannot be edited to hide a failure.
- Heading matches are anchored, so a date like `2026-08-12` cannot be mistaken for a section id.
- `Judge:` must name an allow-listed role as a whole token (`not-independent-judge` does not match `independent-judge`); a deny-listed role matches anywhere in the name. Self-reported, so it stops forgetting, not lying.
- Open-findings counts and a round cap are enforced. Exit `0` pass, `1` fail, `2` file or config problem, including malformed config JSON or an invalid regex (never a pass). `--config` may come before or after the report path.

## Limits

- The judge name is self-reported text, not an authenticated identity.
- Config files are trusted input: a `closure` value is compiled as a regular expression.
- It checks that a verdict exists and is eligible, not that the review was any good.

## Related projects

These solve neighbouring problems; use them when they fit better.

- **promptfoo**: LLM evaluation assertions; this repo is about the gate wiring, not the eval itself
- **GitHub required status checks**: gate automated checks only

## More from the same collection

Small, tested tools that grew out of running AI agents and game/app pipelines for months:

- [**ci-gate-forgery-test**](https://github.com/Kein-chronicle/ci-gate-forgery-test): Prove your CI gates can actually fail: feed each gate forged-bad, empty and missing input and flag the ones that stay green.
- [**stale-verdict-guard**](https://github.com/Kein-chronicle/stale-verdict-guard): Bind a pass/fail verdict to a fingerprint of the source it judged, so an edit after review makes the verdict stale.
- [**agent-definition-of-done-gate**](https://github.com/Kein-chronicle/agent-definition-of-done-gate): A completion rule for AI agents: a human can't close a gate that has an automated measurement, and parking work needs evidence.

## Development

```sh
bash tests/run.sh
```

The tests include inputs that are supposed to be rejected, so a green run also shows the checks can fail. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).

If this saved you a debugging session, a star helps other people find it. Bug reports and failing test cases are even better.

<sub>Keywords: claude-code, claude-skills, agent-skills, llm-evaluation, quality-gates, code-review, qa, ci, ai-agents</sub>
