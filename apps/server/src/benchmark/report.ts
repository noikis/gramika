import type { HistoryRequest } from '@gramota/contracts'
import type { BenchmarkRun } from './run'

export function benchmarkSummary(run: BenchmarkRun, requests: Record<string, HistoryRequest>) {
  return run.variants.map((variant) => {
    const attempts = run.attempts.filter((attempt) => attempt.variantId === variant.id)
    const sent = attempts.filter((attempt) => attempt.status !== 'not-run')
    const costs = sent.map((attempt) =>
      attempt.requestId ? (requests[attempt.requestId]?.costUsd ?? null) : null,
    )
    const known = costs.filter((cost): cost is number => cost !== null)
    return {
      ...variant,
      succeeded: attempts.filter((attempt) => attempt.status === 'succeeded').length,
      failed: attempts.filter((attempt) => attempt.status === 'failed').length,
      notRun: attempts.filter((attempt) => attempt.status === 'not-run').length,
      knownCostUsd: known.length ? known.reduce((sum, cost) => sum + cost, 0) : null,
      unknownCostCount: costs.length - known.length,
    }
  })
}

export function renderBenchmarkReport(run: BenchmarkRun, requests: Record<string, HistoryRequest>) {
  const data = JSON.stringify({ run, requests, summary: benchmarkSummary(run, requests) })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Gramota benchmark comparison</title>
<style>
:root { color-scheme: dark; font: 16px/1.6 system-ui, sans-serif; background: #0b141a; color: #e9edef; }
* { box-sizing: border-box; }
body { max-width: 1200px; margin: auto; padding: 24px; }
h1 { font-size: 24px; } h2 { font-size: 18px; } h3 { font-size: 16px; }
h1,h2,h3 { font-weight: 600; } p { margin-block: 8px; }
small, dt, .muted { color: #aebac1; } label { display: grid; gap: 6px; }
select { width: 100%; min-width: 0; min-height: 46px; padding: 8px; border: 1px solid #2a3942; border-radius: 6px; background: #111b21; color: inherit; font: inherit; }
select:focus { outline: none; border-color: #00d477; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; border: 1px solid #2a3942; border-radius: 8px; padding: 16px; margin: 8px 0; }
pre:focus-visible { outline: 2px solid #00d477; outline-offset: -2px; }
.compare { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-top: 24px; }
.compare > section { min-width: 0; }
dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; font-size: 14px; }
dd { margin: 0; overflow-wrap: anywhere; }
.summary { overflow-x: auto; margin-block: 24px; }
table { width: 100%; border-collapse: collapse; text-align: left; font-size: 14px; }
th,td { padding: 12px; border-bottom: 1px solid #2a3942; vertical-align: top; }
.failed { color: #ffb8bc; } .not-run { color: #aebac1; }
@media(max-width:720px) { body { padding: 16px; } .compare { grid-template-columns: minmax(0,1fr); } }
</style></head><body>
<h1>Model and mode benchmark</h1><p id="run-status" role="status"></p>
<p class="muted">Manual quality review. These are single observations, not automatic quality scores.</p>
<div class="summary"><table><caption>Results by model and mode</caption><thead><tr><th>Model / mode</th><th>Succeeded</th><th>Failed</th><th>Not run</th><th>Reported cost</th></tr></thead><tbody id="summary"></tbody></table></div>
<label for="sentence">Sentence<select id="sentence"></select></label>
<h2>Original</h2><pre id="original" lang="ru" tabindex="0"></pre>
<div class="compare">
<section aria-label="Left model and mode comparison"><label for="left">First model / mode<select id="left"></select></label><div id="left-result"></div></section>
<section aria-label="Right model and mode comparison"><label for="right">Second model / mode<select id="right"></select></label><div id="right-result"></div></section>
</div>
<noscript>Enable JavaScript to use this offline comparison. Records are also saved in the adjacent SQLite database and run manifest.</noscript>
<script id="benchmark-data" type="application/json">${data}</script>
<script>
const { run, requests, summary } = JSON.parse(document.getElementById('benchmark-data').textContent);
const sentence = document.getElementById('sentence');
const left = document.getElementById('left');
const right = document.getElementById('right');
const statusNames = { succeeded: 'Succeeded', failed: 'Failed', 'not-run': 'Not run' };
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
function number(value, suffix = '') { return value == null ? 'Unavailable' : Number(value).toLocaleString('en-US', { maximumSignificantDigits: 12 }) + suffix; }
document.getElementById('run-status').textContent = Object.values(run.prompts).map(prompt => prompt.version).join(', ') + ' · ' + run.status + ' · Started ' + run.startedAt + (run.endedAt ? ' · Ended ' + run.endedAt : '') + (run.errorCode ? ' · ' + run.errorCode : '');
for (const model of summary) {
  const row = document.createElement('tr');
  const cost = number(model.knownCostUsd, ' USD known') + (model.unknownCostCount ? ' (' + model.unknownCostCount + ' cost unavailable)' : '');
  for (const value of [model.name, model.succeeded, model.failed, model.notRun, cost]) row.append(element('td', String(value)));
  document.getElementById('summary').append(row);
}
run.cases.forEach((item, index) => { const option = element('option', (index + 1) + ' · ' + item.id); option.value = item.id; sentence.append(option); });
for (const select of [left, right]) for (const model of run.variants) { const option = element('option', model.name); option.value = model.id; select.append(option); }
right.selectedIndex = Math.min(1, run.variants.length - 1);
function panel(target, variantId) {
  const container = document.getElementById(target);
  container.replaceChildren();
  const attempt = run.attempts.find(item => item.caseId === sentence.value && item.variantId === variantId);
  const request = attempt.requestId ? requests[attempt.requestId] : null;
  const status = element('p', statusNames[attempt.status]); status.className = attempt.status; container.append(status);
  const output = element('pre', attempt.status === 'succeeded' && request ? request.correctedText : attempt.status === 'not-run' ? 'This comparison was not run.' : 'No successful result available.');
  output.lang = 'ru'; output.tabIndex = 0; container.append(output);
  if (attempt.errorCode) container.append(element('p', attempt.errorCode));
  if (request && request.errorMessage) container.append(element('p', request.errorMessage));
  const facts = [
    ['Mode', attempt.mode === 'strict' ? 'Strict' : 'Gentle rewrite'],
    ['Prompt version', run.prompts[attempt.mode].version],
    ['Returned model', request ? request.returnedModel ?? 'Unavailable' : 'Unavailable'],
    ['Provider', request ? request.provider ?? 'Unavailable' : 'Unavailable'],
    ['Generation time', number(request?.generationTimeMs, ' ms')],
    ['App request time', number(request?.appRequestTimeMs, ' ms')],
    ['Input tokens', number(request?.inputTokens)], ['Output tokens', number(request?.outputTokens)],
    ['Total tokens', number(request?.totalTokens)], ['Reasoning tokens', number(request?.reasoningTokens)],
    ['Cost', number(request?.costUsd, ' USD')],
    ['Finish reason', request ? request.finishReason ?? 'Unavailable' : 'Unavailable'],
  ];
  const metrics = document.createElement('dl');
  for (const [label, value] of facts) { const pair = document.createElement('div'); pair.append(element('dt', label), element('dd', value)); metrics.append(pair); }
  container.append(metrics);
}
function render() {
  document.getElementById('original').textContent = run.cases.find(item => item.id === sentence.value).text;
  panel('left-result', left.value); panel('right-result', right.value);
}
for (const select of [sentence, left, right]) select.addEventListener('change', render);
render();
</script></body></html>`
}
