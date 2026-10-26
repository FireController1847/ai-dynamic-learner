# Parameterized Review questions

Choose **Parameterized** in the Review builder. The initial template is addition with two integer ranges and one numeric answer; change the prompt, variables, and expression to author a different question. Preview shows generated values, answers, explanation, trace, and seed without creating a review session.

The question's existing `prompt`, optional Markdown `context`, and `explanation` are canonical template strings. `{{name}}` inserts a value; `{{name:2}}` displays a numeric variable with two decimals. Computed answer placeholders always use that answer's configured formatting, so the displayed answer and grading agree. Fill-in-the-Blanks uses **`[[answerKey]]`** for computed answer slots, distinguishing hidden answers from visible variable placeholders.

## Rules and expressions

`parameters` contains `presentation`, `rules`, and optional dropdown `rows`. Presentations are `fields`, `multiple-choice`, `true-false`, `fill-in-the-blanks`, and `dropdown`. The saved question has `type: 'parameterized'`, empty `answer`/`choices`, and ordinary local ID. Generated multiple-choice, true/false, blanks, and dropdown instances reuse their native controls and grading; `fields` uses one or more labeled inputs in the same feedback/scoring pipeline. A question scores one point only when all its computed fields/rows/blanks are correct.

Version-1 rules contain:

- `variables`: named `integer`/`decimal` ranges (`min`, `max`, optional decimal `precision`); `choice` with scalar `values`; or `derived` with an `expression`.
- `constraints`: expressions that must evaluate to boolean `true`.
- `answers`: unique `key`, `label`, exactly one `expression` or `solverKey`, `matching: 'numeric' | 'exact'`, optional `precision`, `rounding: 'round' | 'floor' | 'ceil'`, `absoluteTolerance`, `relativeTolerance`.
- Optional `distractors`: calculated expressions, used for multiple-choice/dropdown presentations.
- Optional `solver`: registered `id`, pinned `version`, and a mapping of parameter names to expressions.

Identifiers start with a letter and contain letters, digits, or underscores; variable, answer, and solver-output names do not overlap. Derived values and answers are dependency-ordered, so definitions need not be manually sorted. Unresolved/circular references are rejected. Correct answer expressions must depend on generated values rather than consist solely of a fixed literal.

The restricted parser supports numeric/string/boolean literals, parentheses, `+ - * / % ^`, unary `+ - !`, `== != < > <= >=`, `&& ||`, and `abs`, `min`, `max`, `sqrt`, `pow`, `round`, `floor`, `ceil`, `trunc`, `sign`, `log`, `log10`, `exp`, `sin`, `cos`, `tan`. `^` is right-associative exponentiation. String addition concatenates two strings. There is no arbitrary JavaScript, property access, assignment, dynamic function lookup, or `eval`. Arithmetic requires finite numbers. Parsing limits length, tokens, nesting, and function argument counts.

Generation uses FNV-1a seed hashing and Mulberry32. Numeric ranges are inclusive; decimals are sampled on their configured precision lattice. Invalid arithmetic, failed constraints, and equivalent/duplicate multiple-choice distractors cause bounded retries (128 total). Failure is explicit, never a partially answerable instance. Variable definitions are limited to 32 and computed answers to 20. Expression function lists and output names are application-owned.

Numeric grading accepts decimal/scientific input and compares against the **rounded value shown in the answer key**, using the greater of absolute tolerance and relative tolerance times absolute expected value, plus a small floating-point allowance. Relative tolerance `0.01` means 1%. Exact grading compares trimmed text. Answer dependencies use the preceding answers' rounded values; use derived variables for calculations requiring unrounded intermediates. Numeric distractors use the correct answer's formatting and must fail its grader. Dropdown choices may be reused across rows.

## Examples

These are authoring examples, not executed checks. Use Advanced rules to apply a complete `parameters` object. Keep the outer question's prompt/explanation fields separate.

### Random addition and calculated multiple choice

Prompt: `What is {{a}} + {{b}}?`

Explanation: `{{a}} + {{b}} = {{result}}.`

```json
{
  "presentation": "fields",
  "rules": {
    "version": 1,
    "variables": [
      { "name": "a", "kind": "integer", "min": 1, "max": 10 },
      { "name": "b", "kind": "integer", "min": 1, "max": 10 }
    ],
    "constraints": [],
    "answers": [{ "key": "result", "label": "Your answer", "expression": "a + b", "matching": "numeric", "precision": 0 }]
  }
}
```

For multiple choice, change presentation to `multiple-choice` and add `"distractors": ["result + 1", "result - 1", "result + 2"]` inside rules. Options are calculated and optionally shuffled once per session.

### Derived values, constraints, and multiple fields

Prompt: `A rectangle is {{width}} by {{height}} units. Find its area and perimeter.`

```json
{
  "presentation": "fields",
  "rules": {
    "version": 1,
    "variables": [
      { "name": "width", "kind": "integer", "min": 2, "max": 12 },
      { "name": "height", "kind": "integer", "min": 2, "max": 12 },
      { "name": "surface", "kind": "derived", "expression": "width * height" }
    ],
    "constraints": ["width > height"],
    "answers": [
      { "key": "area", "label": "Area", "expression": "surface", "matching": "numeric", "precision": 0 },
      { "key": "perimeter", "label": "Perimeter", "expression": "2 * (width + height)", "matching": "numeric", "precision": 0 }
    ]
  }
}
```

For blanks, change presentation to `fill-in-the-blanks` and prompt to `A {{width}} by {{height}} rectangle has area [[area]] and perimeter [[perimeter]].` A repeated slot repeats the answer and must be answered each time.

For decimal sampling, use `{"name":"mass","kind":"decimal","min":1,"max":5,"precision":2}`. For a selection, use `{"name":"material","kind":"choice","values":["wood","metal","glass"]}` and an exact answer expression that references it. Markdown tables may contain variable placeholders like any other template text.

### Registered solver extension

Trusted TypeScript modules register algorithms at application initialization. Built-in registration is a code change. Users can also upload self-contained JavaScript solver JSON packages through the question editor, as described below. Uploaded packages never enter the trusted application registry. Solvers must be synchronous, deterministic for their input, bounded in work, and return finite scalar outputs. Change their version when algorithm/answer behavior changes. Keep canonical algorithm internals within the registered module. No subject-specific solvers ship with this capability.

An illustrative extension (not registered by the app):

```ts
import { registerParameterizedSolver } from '../src/core/parameterized/solvers.ts';

const unregister = registerParameterizedSolver({
  id: 'example-combine', version: '1', label: 'Example combine',
  outputs: ['computed', 'intermediate'],
  solve(parameters) {
    const left = parameters.left, right = parameters.right;
    if (typeof left !== 'number' || typeof right !== 'number') throw new Error('Numeric parameters required.');
    return {
      answers: { computed: left + right },
      intermediate: { intermediate: left * right },
      explanation: `${left} + ${right} = ${left + right}.`,
      trace: ['Read both inputs', 'Combine them'],
    };
  },
});
// unregister() removes only this registration.
```

Rules select `solver: {id:'example-combine',version:'1',parameters:{left:'a',right:'b'}}`; an answer uses `key:'result', solverKey:'computed'` instead of `expression`. Other answer expressions can reference declared outputs such as `intermediate`. Declared output names cover both answers and intermediate values. Do not collide with answer keys. Templates require the exact solver version to be registered; unknown/version-mismatched solvers cannot silently use a different algorithm.

## Stable variants and interrupted sessions

`generateVariant(template, seed)` supports trusted built-in solvers synchronously; `await generateVariantAsync(template, seed, signal)` also supports uploaded packages. Both reproduce the full variant from a template and seed; retries consume the same deterministic stream. Review stores the effective seed when avoiding repeats, rather than depending on a hidden exclusion list. Choice shuffling uses a separate seed stream. A question is generated on first presentation and cached, so revisiting, checking, hinting, or retrying does not reroll it. New sessions try up to eight fresh seeds to avoid repeating the same displayed question and expected answers; single-variant templates remain usable.

Sessions containing generated questions save local template copies, seeds, responses, attempts/feedback, settings, progress, and an absolute Test deadline. Use **Resume saved session** to restore; an elapsed Test deadline submits on resume. Completed results also restore without another submission statistic. Editing the library template does not alter a saved session's template copy. End explicitly discards local progress; starting a new session replaces it. Static-only sessions retain existing transient behavior. Local session snapshots are not workspace backups. Newly saved sessions also retain validated concrete instances and use those for resume/results, without rerunning code for previously generated questions. This preserves the exact observed answer keys even when an uploaded author violates the deterministic-code contract.

## Manual scenarios

After implementation, try addition across fresh sessions, revisit/retry a question without changing its values, resume an interrupted mixed session, and resume a timed Test after its deadline. Try numeric rounding/tolerance boundaries, each generated presentation, multiple fields, a zero-possibility constraint such as `a > 100` for `a` in 1–10, circular/unresolved dependencies, duplicate/equivalent calculated options, unknown solver versions, and malformed blank markers. Existing static question controls, attempts, Statements, result visibility, animations, and statistics should retain their behavior.

## Uploading a JavaScript solver

In a Parameterized question, open **Registered solver → Upload solver (.json)**. Start with `docs/examples/combine-values.solver.json`. The package is a version-1 `dynamic-learner-solver` object with `id`, `solverVersion`, `label`, `outputs`, and `source`. `source` is one JavaScript function expression, such as `function solve(parameters) { return { answers: { computedTotal: parameters.left + parameters.right } }; }`. Do not upload raw TypeScript, ESM imports/exports, or registration calls. A future source editor can author this same package contract.

After upload, map input names (for this example `left` and `right`) to variable expressions (`a` and `b`), choose **Solver output** for the answer, and use output key `computedTotal` with answer key `result`. Preview a variant. The solver selector lists packages already used in the same set; packages attached through Advanced rules are selectable for that question too. Uploading the same ID/version with different code is rejected; change solverVersion instead.

A referenced package is embedded in `rules.solver.package`, whose id/solverVersion must exactly match the reference id/version. Each saved question is self-contained and portable through workspace backup/restore. Uploads are draft changes until the knowledge set is saved. Only packages referenced by saved questions persist; there is no separate global executable-code registry. Built-in trusted solvers remain available separately.

Uploaded code runs only when explicitly previewing or presenting a variant. A trusted, sandboxed `srcdoc` frame with an opaque origin creates a Blob-backed Worker; uploaded source is passed as data and compiled only in the Worker. Its inherited CSP blocks network and external scripts, and the frame lacks same-origin, navigation, popup, form, or download permissions. The host sends only scalar solver inputs, validates returned JSON/output metadata (512 KiB maximum result), and terminates execution on errors, cancellation, or a 3-second timeout. A generation sequence also has a 10-second budget between solver calls. There is no fallback that evaluates uploaded code in the app context. Browsers that block the isolated runner produce an explicit error.

Platform references: [MDN worker CSP inheritance and termination](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), [MDN iframe sandbox permissions](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe).

## AI-created parameterized questions and solvers

The AI question mix now includes **Parameterized**, initially 0% so existing defaults remain unchanged. Enable it by assigning a positive percentage. Prompts include only types allocated at least one item: their counts, instructions, schemas, and examples. Parameterized/solver instructions and examples are completely omitted when its allocation is zero. Its allocation is independent of the template's presentation (a parameterized multiple-choice template counts as Parameterized). The prompt teaches variable/answer rules, safe expressions, all presentations, concise answer preferences, and the JavaScript solver interface. It requests realistic dynamic scenarios grounded in source content and complete deterministic algorithms when simple expressions are insufficient.

AI responses may include an optional top-level `solvers` array of at most 20 packages. A question references one by id/version/input expressions; import resolves the reference into the question's embedded package before canonical validation. Package identities must be unique, and conflicting inline/top-level definitions are rejected. Valid unused packages produce a preview warning and are omitted. Parsing/importing a response validates source as bounded text and does not execute it. Syntax/runtime errors and incorrect algorithms still need the author's Preview/manual review. Prompt allocations, zero-weight exclusions, equalization, and exact 100% balancing continue to apply. Imported valid JSON may differ from the requested count/type mix (even include disabled types): preview warnings explain those differences and a Create knowledge set anyway action accepts every supplied question. Malformed/unanswerable question or solver data and hard application limits remain blocking.

Manual upload checks: use the example package; preview and save/reopen it; reuse it in another question in the same set; export/import a workspace; resume a shown generated question without another solver execution; try malformed metadata, undeclared/non-finite outputs, invalid JavaScript, an endless loop, or a blocked network call. AI checks: enable Parameterized, import an expression-only template and a solver-backed template, inspect exact type counts, and reject missing/conflicting solver packages, and allow valid unused packages or count/mix differences with visible warnings.
