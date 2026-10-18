#!/usr/bin/env bash
cd "$(dirname "$0")/.."
run() { printf '$ %s\n' "$*"; "$@"; printf '[exit %s]\n\n' "$?"; }
echo "# A report whose every gate has an explicit verdict from an eligible judge"
run node scripts/check-verdicts.mjs tests/fixtures/good.md --config tests/gates.example.json
echo "# A report with a long, enthusiastic section and no verdict line: silence is FAIL"
run node scripts/check-verdicts.mjs tests/fixtures/prose_only.md --config tests/gates.example.json
echo "# The designer graded their own work"
run node scripts/check-verdicts.mjs tests/fixtures/author_judges.md --config tests/gates.example.json
echo "# An empty file is not a pass"
run node scripts/check-verdicts.mjs tests/fixtures/empty.md --config tests/gates.example.json
