#!/usr/bin/env bash
# Forgery test: every bypass must be caught (exit 1), the honest report must pass (exit 0).
set -u
here="$(cd "$(dirname "$0")" && pwd)"
chk="node $here/../scripts/check-verdicts.mjs"
cfg="$here/gates.example.json"
bad=0
expect() { # name expected_exit file [expected FAIL tag: a crash also exits 1, so a rejection must fail for the RIGHT reason]
  out="$($chk "$here/fixtures/$3" --config "$cfg" 2>&1)"; got=$?
  if [ "$got" != "$2" ]; then echo "FAIL $1: expected $2 got $got"; bad=1
  elif [ -n "${4:-}" ] && ! echo "$out" | grep -qF "$4"; then echo "FAIL $1: exit $got but output lacks '$4'"; echo "$out" | sed 's/^/     /'; bad=1
  else echo "ok   $1 (exit $got${4:+, $4})"; fi
}
expect "honest report passes"               0 good.md
expect "last round PASS after round1 FAIL" 0 last_round_wins.md
expect "prose without verdict"             1 prose_only.md "FAIL(no verdict)"
expect "date in heading must not match"    1 date_trap.md "FAIL(no section)"
expect "PASS with open findings"           1 closure_open.md "FAIL(closure)"
expect "author judges own work"            1 author_judges.md "FAIL(judge=author)"
expect "round cap exceeded"                1 round_cap.md "round"
expect "empty report is not a pass"        1 empty.md "FAIL(no section)"
t="$(mktemp -d)"; printf '{bad' > "$t/bad.json"
$chk "$here/fixtures/good.md" --config "$t/bad.json" >/dev/null 2>&1; rc=$?; [ $rc = 2 ] && echo "ok   malformed config is exit 2 (not a pass, not a crash)" || { echo "FAIL malformed config: exit $rc"; bad=1; }
printf '{"gates":[{"id":"g","heading":"6-0","closure":"("}]}' > "$t/re.json"
$chk "$here/fixtures/good.md" --config "$t/re.json" >/dev/null 2>&1; rc=$?; [ $rc = 2 ] && echo "ok   invalid closure regex is exit 2" || { echo "FAIL bad regex: exit $rc"; bad=1; }
printf '{"judges":{"allow":["independent-judge"],"deny":[]},"gates":[{"id":"greybox-fun","heading":"Greybox fun gate|6-0"}]}' > "$t/allow.json"
sed 's/Judge: independent-judge/Judge: not-independent-judge/' "$here/fixtures/good.md" > "$t/lookalike.md"
out="$($chk "$t/lookalike.md" --config "$t/allow.json" 2>&1)"; rc=$?; { [ $rc = 1 ] && echo "$out" | grep -qF "judge not eligible"; } && echo "ok   look-alike judge name is not on the allow-list" || { echo "FAIL look-alike judge: exit $rc"; bad=1; }
$chk --config "$cfg" "$here/fixtures/good.md" >/dev/null 2>&1; rc=$?; [ $rc = 0 ] && echo "ok   --config may come before the report path" || { echo "FAIL arg order: exit $rc"; bad=1; }
# --- regression cases found in review (each used to print PASS)
sec7='## 7-E Polish\nJudge: blind-player\nnew consensus findings: 0\nVerdict: PASS\n'
printf '## 6-0 Greybox fun gate\n### Round 1\nJudge: independent-judge\nVerdict: PASS\n### Round 2\nVerdict: FAIL\n%b' "$sec7" > "$t/sub.md"
out="$($chk "$t/sub.md" --config "$cfg" 2>&1)"; rc=$?; { [ $rc = 1 ] && echo "$out" | grep -qF "verdict FAIL"; } && echo "ok   a later sub-round FAIL beats an earlier PASS" || { echo "FAIL sub-round: $rc"; bad=1; }
printf '## 6-0 Greybox fun gate\nJudge: independent-judge\nVerdict: PASS\n## 7-E Polish\nJudge: blind-player\nnew consensus findings: 0\nnew consensus findings: 4\nVerdict: PASS\n' > "$t/clo.md"
out="$($chk "$t/clo.md" --config "$cfg" 2>&1)"; rc=$?; { [ $rc = 1 ] && echo "$out" | grep -qF "FAIL(closure)"; } && echo "ok   the last closure count wins" || { echo "FAIL closure last: $rc"; bad=1; }
printf '## 6-0 Greybox fun gate\nJudge: independent-judge\nVerdict: PASS\n## 7-E Polish\nJudge: blind-player\nVerdict: PASS\n' > "$t/noclo.md"
out="$($chk "$t/noclo.md" --config "$cfg" 2>&1)"; rc=$?; { [ $rc = 1 ] && echo "$out" | grep -qF "no closure line"; } && echo "ok   a missing closure line is a FAIL, not a pass" || { echo "FAIL missing closure: $rc"; bad=1; }
printf 'null' > "$t/null.json"; $chk "$here/fixtures/good.md" --config "$t/null.json" >/dev/null 2>&1; [ $? = 2 ] && echo "ok   config null is exit 2" || { echo "FAIL null config"; bad=1; }
printf '{"gates":[{"id":"g","heading":"("}]}' > "$t/h.json"; $chk "$here/fixtures/good.md" --config "$t/h.json" >/dev/null 2>&1; [ $? = 2 ] && echo "ok   an invalid heading regex is exit 2" || { echo "FAIL heading regex"; bad=1; }
printf '{"gates":[{"id":"g","heading":"7-E","closure":"findings: \\d+"}]}' > "$t/ng.json"; $chk "$here/fixtures/good.md" --config "$t/ng.json" >/dev/null 2>&1; [ $? = 2 ] && echo "ok   a closure regex without a capture group is exit 2" || { echo "FAIL capture group"; bad=1; }
rm -rf "$t"
exit $bad
