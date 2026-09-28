// Canonical appearance contract; independent of Vue and browser APIs.
export const DISPLAY_FIELDS = [
  { key: 'font', label: 'Letter font', default: 'mono', choices: [
    { value: 'mono', label: 'Monospace', css: "ui-monospace, Consolas, monospace" },
    { value: 'sans', label: 'Sans', css: "'Segoe UI', Arial, sans-serif" },
    { value: 'serif', label: 'Serif', css: "Georgia, 'Times New Roman', serif" },
  ] },
  { key: 'textSize', label: 'Letter size', default: 100, min: 85, max: 125, step: 5, unit: '%' },
  { key: 'cellSize', label: 'Preferred cell size', default: 36, min: 28, max: 48, step: 2, unit: 'px' },
  { key: 'fit', label: 'Grid sizing', default: 'screen', choices: [
    { value: 'screen', label: 'Fit available space' },
    { value: 'preferred', label: 'Use preferred cell size' },
  ] },
  { key: 'highlight', label: 'Highlight color', default: 'blue', choices: [
    { value: 'blue', label: 'Blue', css: '#0f6cbd' },
    { value: 'green', label: 'Green', css: '#167044' },
    { value: 'purple', label: 'Purple', css: '#7443a8' },
  ] },
  { key: 'motion', label: 'Highlight movement', default: 'smooth', choices: [
    { value: 'smooth', label: 'Smooth' }, { value: 'none', label: 'Instant' },
  ] },
];

export function defaultDisplayOptions() {
  return Object.fromEntries(DISPLAY_FIELDS.map((field) => [field.key, field.default]));
}

export function validateDisplayOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options) ||
      Object.keys(options).some((key) => !DISPLAY_FIELDS.some((field) => field.key === key))) {
    throw new Error('Word Search display settings are invalid.');
  }
  for (const field of DISPLAY_FIELDS) {
    const value = options[field.key];
    if (!(field.choices ? field.choices.some((choice) => choice.value === value)
      : Number.isInteger(value) && value >= field.min && value <= field.max && (value - field.min) % field.step === 0)) {
      throw new Error(`Word Search display setting “${field.label}” is invalid.`);
    }
  }
}

export function displayStyles(options) {
  const choice = (key) => DISPLAY_FIELDS.find((field) => field.key === key).choices
    .find((entry) => entry.value === options[key]).css;
  return {
    '--search-letter-font': choice('font'),
    '--search-letter-size': `${16 * options.textSize / 100}px`,
    '--search-highlight': choice('highlight'),
  };
}
