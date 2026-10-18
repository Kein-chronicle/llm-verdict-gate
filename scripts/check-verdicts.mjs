#!/usr/bin/env node
// verdict-gate: machine-check that qualitative review sections carry an explicit PASS/FAIL verdict.
// usage: node check-verdicts.mjs <report.md> --config gates.json
// exit 0 = all gates PASS, 1 = a gate failed, 2 = input problem (never a pass)
import { readFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const ci = args.indexOf('--config');
const cfgPath = ci >= 0 ? args[ci + 1] : null;
const file = args.find((a, i) => !a.startsWith('--') && i !== ci + 1);        // the config path is not the report
if (!file || !cfgPath) { console.error('usage: check-verdicts.mjs <report.md> --config gates.json'); process.exit(2); }
if (!existsSync(file)) { console.error(`missing report: ${file}`); process.exit(2); }
if (!existsSync(cfgPath)) { console.error(`missing config: ${cfgPath}`); process.exit(2); }

const text = readFileSync(file, 'utf8');
let cfg;
try { cfg = JSON.parse(readFileSync(cfgPath, 'utf8')); } catch (e) { console.error(`config is not valid JSON: ${e.message}`); process.exit(2); }
const gates = cfg?.gates ?? [];
if (!gates.length) { console.error('config has no gates - an empty gate list would pass vacuously'); process.exit(2); }

// A section runs from its heading to the next heading of the same or higher level.
// Sub-headings belong to it (verdicts are often written under "### round 2").
function sectionsOf(src, headingRe) {
  const out = []; let cur = null, lvl = 0;
  for (const line of src.split('\n')) {
    const h = line.match(/^(#{1,6})\s/);
    if (h) {
      const l = h[1].length;
      if (headingRe.test(line)) { if (cur) out.push(cur); cur = { heading: line, body: [] }; lvl = l; continue; }
      if (cur && l <= lvl) { out.push(cur); cur = null; continue; }
    }
    if (cur) cur.body.push(line);
  }
  if (cur) out.push(cur);
  return out;
}
// heading text is anchored right after the # marker: "6-0" must not match inside "2026-08-12"
const headingRe = (h) => new RegExp(`^#{1,6}\\s*\\**\\s*(?:${h})\\b`, 'i');
if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.gates)) { console.error('config must be an object with a "gates" array'); process.exit(2); }
for (const g of gates) {
  if (!g || typeof g.id !== 'string' || typeof g.heading !== 'string' || !g.heading) { console.error('every gate needs a string "id" and "heading"'); process.exit(2); }
  try { headingRe(g.heading); } catch (e) { console.error(`gate ${g.id}: invalid heading regex: ${e.message}`); process.exit(2); }
  if (g.closure) { let re; try { re = new RegExp(g.closure, 'i'); } catch (e) { console.error(`gate ${g.id}: invalid closure regex: ${e.message}`); process.exit(2); }
    if (new RegExp(re.source + '|').exec('').length < 2) { console.error(`gate ${g.id}: the closure regex needs one capture group for the open-findings count`); process.exit(2); } }
}


// Only a line that STARTS with the field counts, and only PASS/FAIL are accepted values.
const VERDICT = /^\s*[-*]*\s*\**\s*(?:final\s+)?verdict\s*\**\s*[:—-]+\s*\**\s*(PASS|FAIL)\b/i;
// The LAST verdict line in a section wins: a later "### Round 2" FAIL must not be hidden by an earlier PASS (and a PASS after a FAIL is a real re-review).
const verdictOf = (body) => { let v = null; for (const l of body) { const m = l.match(VERDICT); if (m) v = m[1].toUpperCase(); } return v; };
const JUDGE = /^\s*[-*]*\s*\**\s*judge\s*\**\s*[:—-]+\s*\**\s*(.+)$/i;
const judgeOf = (body) => { let j = null; for (const l of body) { const m = l.match(JUDGE); if (m) j = m[1].trim(); } return j; };

const allow = new Set((cfg.judges?.allow ?? []).map((s) => s.toLowerCase()));
const deny = new Set((cfg.judges?.deny ?? []).map((s) => s.toLowerCase()));
const checkJudges = allow.size > 0 || deny.size > 0;
let fail = 0;
const say = (st, msg) => console.log(`  [${st}] ${msg}`);

console.log(`${file}: verdict check\n`);
for (const g of gates) {
  const secs = sectionsOf(text, headingRe(g.heading));
  if (!secs.length) { say('FAIL(no section)', `${g.id}: section not found - absence is not a pass`); fail = 1; continue; }
  const last = secs[secs.length - 1];
  const v = verdictOf(last.body);
  if (v === null) { say('FAIL(no verdict)', `${g.id}: last round has no "Verdict: PASS|FAIL" line (prose does not count)`); fail = 1; continue; }
  if (v === 'FAIL') { say('FAIL', `${g.id}: verdict FAIL${g.exemptable === false ? ' (no exemption path)' : ''}`); fail = 1; continue; }

  if (g.closure) {
    const ms = [...last.body.join('\n').matchAll(new RegExp(g.closure, 'gi'))];
    if (!ms.length) { say('FAIL(no closure line)', `${g.id}: this gate requires a closure count line (regex ${g.closure}) and none was found`); fail = 1; continue; }
    const m = ms[ms.length - 1];                               // the last count wins, like the last verdict
    if (!Number.isFinite(Number(m[1])) || Number(m[1]) > 0) { say('FAIL(closure)', `${g.id}: PASS written while ${m[1]} finding(s) remain open`); fail = 1; continue; }
  }
  if (checkJudges) {
    const raw = judgeOf(last.body);
    if (!raw) { say('FAIL(no judge)', `${g.id}: no "Judge:" line (self-reported - stops forgetting, not lying)`); fail = 1; continue; }
    const name = raw.toLowerCase().replace(/[`*]/g, '').trim();
    if ([...deny].some((d) => name.includes(d))) { say('FAIL(judge=author)', `${g.id}: "${raw}" authored the artifact - cannot judge it`); fail = 1; continue; }
    if (allow.size && ![...allow].some((a) => new RegExp(`(^|[^a-z0-9_-])${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z0-9_-])`).test(name))) { say('FAIL(judge not eligible)', `${g.id}: "${raw}" is not on the allow-list`); fail = 1; continue; }
  }
  say('PASS', `${g.id}`);
}

// Round cap: "round N" in any heading of a gate; N above the cap => choose an exit, do not keep looping.
if (cfg.roundCap) {
  for (const g of gates) {
    let max = 0;
    for (const s of sectionsOf(text, headingRe(g.heading))) {
      const m = s.heading.match(/round\s*(\d+)/i); if (m) max = Math.max(max, Number(m[1]));
    }
    if (max > cfg.roundCap) {
      say('FAIL(round cap)', `${g.id}: round ${max} > cap ${cfg.roundCap} - stop iterating; pick an exit (shrink scope / cut / kill)`);
      fail = 1;
    }
  }
}

console.log(fail ? '\nNOT PASSED. An empty verdict is not a pass.' : '\nAll required gates PASS.');
process.exit(fail ? 1 : 0);
