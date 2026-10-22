import type { ExplanationBenchmarkRun } from './explain-run'
import { reportJson } from './report'

export function renderExplanationReport(run: ExplanationBenchmarkRun) {
  const data = reportJson(run)
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Gramota Explain benchmark</title>
<style>
:root { color-scheme: dark; font: 16px/1.6 system-ui,sans-serif; background: #0b141a; color: #e9edef; }
* { box-sizing: border-box; } body { max-width: 1100px; margin: auto; padding: 24px; }
h1 { font-size: 24px; } h2 { font-size: 20px; } h3 { font-size: 17px; }
label { display: grid; gap: 8px; } select { min-height: 48px; font: inherit; color: inherit; background: #111b21; padding: 8px; max-width: 100%; }
pre { font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; border: 1px solid #2a3942; border-radius: 8px; padding: 16px; }
.pair { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px; }
.pair > div { min-width: 0; } article { border-top: 1px solid #2a3942; margin-top: 24px; padding-top: 8px; }
.muted { color: #aebac1; } .failed { color: #ffb8bc; }
@media(max-width:720px) { body { padding: 16px; } .pair { grid-template-columns: minmax(0,1fr); } }
</style></head><body>
<h1>Explain benchmark</h1><p id="status" role="status"></p>
<p class="muted">Each detected change is explained separately. Missed errors are not evaluated. Judge accuracy, relevance, honesty and the five-sentence limit manually.</p>
<p id="summary"></p><label for="result">Correction result<select id="result"></select></label>
<section id="content"></section>
<script id="benchmark-data" type="application/json">${data}</script>
<script>
const run = JSON.parse(document.getElementById('benchmark-data').textContent);
const changes = run.results.flatMap(result => result.changes);
const sent = changes.filter(change => change.status !== 'not-run');
const known = sent.filter(change => change.details.costUsd != null);
const cost = known.length ? known.reduce((sum, change) => sum + change.details.costUsd, 0).toPrecision(8) + ' USD known' : 'Cost unavailable';
document.getElementById('status').textContent = run.mode + ' · ' + run.prompt.version + ' · ' + run.status + (run.errorCode ? ' · ' + run.errorCode : '');
document.getElementById('summary').textContent = changes.filter(change => change.status === 'succeeded').length + ' explained / ' + run.maxRequests + ' changes · ' + cost + ' · ' + (sent.length - known.length) + ' costs unavailable';
function element(tag, text) { const node = document.createElement(tag); node.textContent = text; return node; }
function passage(text) { const node = element('pre', text || '(Empty fragment)'); node.lang = 'ru'; node.tabIndex = 0; return node; }
const select = document.getElementById('result');
run.results.forEach((result,index) => { const option = element('option', result.caseId + ' · ' + result.modelId + ' · ' + result.mode); option.value = index; select.append(option); });
select.value = String(Math.max(0, run.results.findIndex(result => !result.skipped)));
function render() {
  const result = run.results[Number(select.value)];
  const content = document.getElementById('content'); content.replaceChildren();
  content.append(element('h2','Original'), passage(result.originalText));
  if (result.correctedText != null) content.append(element('h2','Corrected'), passage(result.correctedText));
  if (result.skipped || !result.changes.length) content.append(element('p',result.skipped || 'No changes. No explanation request needed.'));
  result.changes.forEach((change,index) => {
    const article = document.createElement('article'); article.append(element('h3','Change ' + (index+1) + ' / ' + result.changes.length));
    const pair = document.createElement('div'); pair.className = 'pair';
    for (const [label,text] of [['Original',change.original],['Corrected',change.corrected]]) { const column = document.createElement('div'); column.append(element('p',label),passage(text)); pair.append(column); }
    article.append(pair);
    const explanation = passage(change.status === 'succeeded' ? change.explanation : change.status === 'failed' ? 'Failed: ' + change.errorCode : 'Not run');
    if (change.status === 'failed') explanation.className = 'failed'; article.append(explanation);
    const details = change.details;
    article.append(element('p', 'Model: ' + result.modelId + ' · Returned model: ' + (details.returnedModel ?? 'Unavailable') + ' · Time: ' + (change.durationMs ?? 'Unavailable') + ' ms · Input tokens: ' + (details.inputTokens ?? 'Unavailable') + ' · Output tokens: ' + (details.outputTokens ?? 'Unavailable') + ' · Cost: ' + (details.costUsd == null ? 'Unavailable' : details.costUsd + ' USD')));
    content.append(article);
  });
}
select.addEventListener('change',render); render();
</script></body></html>`
}
