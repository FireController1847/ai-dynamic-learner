import { computed, defineComponent, h, ref, onBeforeUnmount, type PropType } from 'vue';
import { inputValue } from '../../core/dom.ts';
import { parseAiImportJson } from '../../core/ai-json.ts';
import { registeredSolvers } from '../../core/parameterized/solvers.ts';
import { sameSolverPackage, validateSolverPackage, type SolverPackage } from '../../core/parameterized/solver-package.ts';
import type { GenerationRules } from '../../core/parameterized/template.ts';

export const SolverEditor = defineComponent({
  props: { rules: { type: Object as PropType<GenerationRules>, required: true },
    packages: { type: Array as PropType<SolverPackage[]>, default: () => [] } },
  emits: { upload: (_pkg: SolverPackage) => true },
  setup(props, { emit }) {
    const message = ref('');
    let active = true;
    onBeforeUnmount(() => { active = false; });
    const reading = ref(false);
    const packages = computed(() => {
      const result = [...props.packages];
      const current = props.rules.solver?.package;
      if (current && !result.some(pkg => pkg.id === current.id && pkg.solverVersion === current.solverVersion)) result.push(current);
      return result;
    });
    function attach(pkg: SolverPackage) {
      props.rules.solver = { id: pkg.id, version: pkg.solverVersion, parameters: {}, package: JSON.parse(JSON.stringify(pkg)) as SolverPackage };
    }
    async function upload(event: Event) {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0]; if (!file) return;
      reading.value = true; message.value = '';
      try {
        if (file.size > 128 * 1024) throw new Error('Solver packages must be at most 128 KiB.');
        const text = await file.text(); if (!active) return;
        const value: unknown = parseAiImportJson(text); validateSolverPackage(value);
        const existing = packages.value.find(pkg => pkg.id === value.id && pkg.solverVersion === value.solverVersion);
        if (existing && !sameSolverPackage(existing, value)) throw new Error('This solver ID/version already has different code. Give the new package a new version.');
        emit('upload', value); attach(value);
        message.value = `Uploaded ${value.label}. Map its inputs below, then choose solver output keys for your answers.`;
      } catch (error) { message.value = error instanceof Error ? error.message : String(error); }
      finally { reading.value = false; input.value = ''; }
    }
    function select(event: Event) {
      const key = inputValue(event);
      const builtin = registeredSolvers().find(solver => `builtin:${solver.id}:${solver.version}` === key);
      const pkg = packages.value.find(pkg => `uploaded:${pkg.id}:${pkg.solverVersion}` === key);
      if (pkg) attach(pkg);
      else if (builtin) props.rules.solver = { id: builtin.id, version: builtin.version, parameters: {} };
      else delete props.rules.solver;
    }
    function rename(oldName: string, nextName: string) {
      if (!props.rules.solver || nextName === oldName) return;
      if (Object.hasOwn(props.rules.solver.parameters, nextName)) { message.value = 'That input name already exists. Choose a unique input name.'; return; }
      const entries = Object.entries(props.rules.solver.parameters).map(([name, source]) => [name === oldName ? nextName : name, source]);
      props.rules.solver.parameters = Object.fromEntries(entries);
    }
    return () => {
      const solver = props.rules.solver;
      const selected = solver ? `${solver.package ? 'uploaded' : 'builtin'}:${solver.id}:${solver.version}` : '';
      return h('details', { open: Boolean(solver) }, [h('summary', 'Registered solver (optional)'),
        h('p', { class: 'knowledge-muted' }, 'Upload a JavaScript solver JSON package, or select a solver already used in this set. Uploaded code runs in an isolated background runner.'),
        h('label', { class: 'knowledge-field' }, ['Upload solver (.json)', h('input', { type: 'file', accept: '.json,application/json', disabled: reading.value, onChange: upload })]),
        message.value ? h('p', { class: 'knowledge-message', role: 'status' }, message.value) : null,
        h('label', { class: 'knowledge-field' }, ['Solver', h('select', { value: selected, onChange: select }, [
          h('option', { value: '' }, 'Expressions only'),
          ...registeredSolvers().map(entry => h('option', { value: `builtin:${entry.id}:${entry.version}` }, `${entry.label} (${entry.version})`)),
          ...packages.value.map(pkg => h('option', { value: `uploaded:${pkg.id}:${pkg.solverVersion}` }, `${pkg.label} (${pkg.solverVersion}) · Uploaded`)),
        ])]),
        solver ? [h('p', { class: 'knowledge-muted' }, 'Map each solver input to a variable or expression. Output names must differ from variable and answer keys.'),
          ...Object.entries(solver.parameters).map(([name, source]) => h('div', { class: 'knowledge-parameter-row', key: name }, [
            h('label', { class: 'knowledge-field' }, ['Input name', h('input', { value: name, maxlength: 64, onChange: (event: Event) => rename(name, inputValue(event)) })]),
            h('label', { class: 'knowledge-field' }, ['Value expression', h('input', { value: source, maxlength: 2000,
              onInput: (event: Event) => { solver.parameters[name] = inputValue(event); } })]),
            h('button', { type: 'button', class: 'quiet-button', onClick: () => { delete solver.parameters[name]; } }, 'Remove input'),
          ])),
          h('button', { type: 'button', class: 'quiet-button', disabled: Object.keys(solver.parameters).length >= 32, onClick: () => {
            let index = 1; while (Object.hasOwn(solver.parameters, `input${index}`)) index++;
            solver.parameters[`input${index}`] = props.rules.variables[0]?.name ?? '';
          } }, 'Add input'),
          solver.package ? h('details', [h('summary', 'View uploaded source'), h('pre', solver.package.source)]) : null,
        ] : null,
      ]);
    };
  },
});
