import { isRecord } from '../validation.ts';
import type { Scalar } from './expression.ts';
import type { SolverResult } from './solvers.ts';
import { validateSolverPackage, validateSolverResult, type SolverPackage } from './solver-package.ts';

// Only this trusted bootstrap runs in the frame. Uploaded source is sent as data
// and compiled exclusively as a worker script under the frame's restrictive CSP.
const BOOTSTRAP = `
let worker, url, used = false;
addEventListener('message', event => {
  if (event.source !== parent) return;
  if (event.data?.cancel) { worker?.terminate(); return; }
  if (used) return;
  used = true;
  const finish = data => {
    worker?.terminate(); if (url) URL.revokeObjectURL(url);
    parent.postMessage(data, '*');
  };
  try {
    url = URL.createObjectURL(new Blob([event.data.script], { type: 'text/javascript' }));
    worker = new Worker(url);
    worker.onmessage = event => finish(event.data);
    worker.onerror = event => { event.preventDefault(); finish({ error: String(event.message).slice(0, 2000) }); };
    worker.postMessage(event.data.parameters);
  } catch (error) { finish({ error: String(error).slice(0, 2000) }); }
});
parent.postMessage({ ready: true }, '*');
`;
const FRAME = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; worker-src blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><script>${BOOTSTRAP}</script>`;
const MAX_RESULT_TEXT = 512 * 1024;
function workerScript(source: string): string {
  return `"use strict";
const send = self.postMessage.bind(self);
for (const name of ['Worker','SharedWorker']) Object.defineProperty(self, name, { value: undefined, writable: false, configurable: false });
self.onmessage = async event => {
  try {
    const solve = (${source}\n);
    if (typeof solve !== 'function') throw new Error('Source must be one JavaScript function expression.');
    const result = await solve(Object.freeze(event.data));
    const text = JSON.stringify(result);
    if (!text || text.length > ${MAX_RESULT_TEXT}) throw new Error('Solver result exceeds the size limit.');
    send({ result: text });
  } catch (error) { send({ error: String(error).slice(0, 2000) }); }
};`;
}
export function runUploadedSolver(pkg: SolverPackage, parameters: Readonly<Record<string, Scalar>>, signal?: AbortSignal): Promise<SolverResult> {
  validateSolverPackage(pkg);
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('Solver execution canceled.')); return; }
    const frame = document.createElement('iframe');
    frame.hidden = true; frame.setAttribute('sandbox', 'allow-scripts'); frame.setAttribute('aria-hidden', 'true');
    frame.srcdoc = FRAME;
    let finished = false;
    const stop = () => {
      frame.contentWindow?.postMessage({ cancel: true }, '*');
      window.clearTimeout(timer); window.removeEventListener('message', receive);
      signal?.removeEventListener('abort', abort);
      // Let the trusted frame process termination before removing its owner document.
      window.setTimeout(() => frame.remove(), 50);
    };
    const fail = (message: string) => { if (finished) return; finished = true; stop(); reject(new Error(message)); };
    const abort = () => fail('Solver execution canceled.');
    const timer = window.setTimeout(() => fail('Solver exceeded its 3-second execution limit or the browser blocked its isolated runner.'), 3000);
    function receive(event: MessageEvent<unknown>) {
      if (finished || event.source !== frame.contentWindow || !isRecord(event.data)) return;
      const data = event.data;
      if (data.ready === true) {
        frame.contentWindow?.postMessage({ script: workerScript(pkg.source), parameters }, '*'); return;
      }
      if (typeof data.error === 'string') { fail(`Solver error: ${data.error.slice(0, 2000)}`); return; }
      try {
        if (typeof data.result !== 'string' || data.result.length > MAX_RESULT_TEXT) throw new Error('Solver returned an invalid response.');
        const result: unknown = JSON.parse(data.result); validateSolverResult(result, pkg.outputs);
        finished = true; stop(); resolve(result);
      } catch (error) { fail(error instanceof Error ? error.message : String(error)); }
    }
    window.addEventListener('message', receive); signal?.addEventListener('abort', abort, { once: true });
    document.body.append(frame);
  });
}
