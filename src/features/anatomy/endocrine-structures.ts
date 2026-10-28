import type { AtlasStructure } from './atlas-model.ts';

export type EndocrineSurface = 'front' | 'back';
export type GonadView = 'ovaries' | 'testes' | 'none';
type EndocrineRegion = 'brain' | 'neck' | 'thorax' | 'abdomen' | 'pelvis';
interface EndocrineSpec {
  id: string;
  name: string;
  group: string;
  region: EndocrineRegion;
  description: string;
  surfaces: readonly EndocrineSurface[];
  paired?: boolean;
  gonad?: 'ovaries' | 'testes';
}
const front = ['front'] as const;
const back = ['back'] as const;
const both = ['front', 'back'] as const;

// Curated macroscopic endocrine anatomy, not every hormone-producing cell.
// Position/hormone summaries: OpenStax A&P 2e ch. 17 and MedlinePlus.
// Posterior glands are shown as educational transparent projections.
export const endocrineSpecs: readonly EndocrineSpec[] = [
  {
    id: 'hypothalamus', name: 'Hypothalamus', group: 'Neuroendocrine',
    region: 'brain', surfaces: both,
    description: 'Brain region above the pituitary that regulates endocrine signaling with releasing and inhibiting hormones; synthesizes oxytocin and ADH.',
  },
  {
    id: 'pituitary-stalk', name: 'Pituitary stalk (infundibulum)', group: 'Neuroendocrine',
    region: 'brain', surfaces: front,
    description: 'Connects the hypothalamus with the pituitary, containing nerve fibers and vessels involved in hypothalamic–pituitary signaling.',
  },
  {
    id: 'anterior-pituitary', name: 'Anterior pituitary (adenohypophysis)', group: 'Pituitary',
    region: 'brain', surfaces: front,
    description: 'Produces hormones including GH, TSH, ACTH, FSH, LH and prolactin; regulated by hypothalamic signals.',
  },
  {
    id: 'posterior-pituitary', name: 'Posterior pituitary (neurohypophysis)', group: 'Pituitary',
    region: 'brain', surfaces: both,
    description: 'Stores and releases oxytocin and antidiuretic hormone (ADH) synthesized in the hypothalamus; it does not synthesize these hormones.',
  },
  {
    id: 'pineal-gland', name: 'Pineal gland', group: 'Brain gland',
    region: 'brain', surfaces: back,
    description: 'Small gland near the posterior roof of the third ventricle that secretes melatonin involved in circadian timing.',
  },
  {
    id: 'thyroid-gland', name: 'Thyroid gland', group: 'Neck gland',
    region: 'neck', surfaces: both,
    description: 'Butterfly-shaped gland anterior to the trachea, with two lateral lobes joined by an isthmus; secretes T3, T4 and calcitonin.',
  },
  {
    id: 'parathyroid-superior', name: 'Superior parathyroid gland', group: 'Parathyroid',
    region: 'neck', surfaces: back, paired: true,
    description: 'Usually one of a pair of superior parathyroid glands on the posterior thyroid; secretes PTH to regulate blood calcium.',
  },
  {
    id: 'parathyroid-inferior', name: 'Inferior parathyroid gland', group: 'Parathyroid',
    region: 'neck', surfaces: back, paired: true,
    description: 'Usually one of a pair of inferior parathyroid glands near the posterior thyroid; secretes PTH. Number and position vary.',
  },
  {
    id: 'thymus', name: 'Thymus', group: 'Immune/endocrine tissue',
    region: 'thorax', surfaces: front,
    description: 'Lymphoid organ in the anterior superior mediastinum that supports T-cell maturation and produces thymic signaling factors; it normally involutes with age.',
  },
  {
    id: 'adrenal-cortex', name: 'Adrenal cortex', group: 'Adrenal gland',
    region: 'abdomen', surfaces: both, paired: true,
    description: 'Outer adrenal tissue atop the kidney; produces steroid hormones including cortisol, aldosterone and adrenal androgens.',
  },
  {
    id: 'adrenal-medulla', name: 'Adrenal medulla', group: 'Adrenal gland',
    region: 'abdomen', surfaces: both, paired: true,
    description: 'Inner adrenal tissue surrounded by cortex; secretes epinephrine and norepinephrine during sympathetic activation.',
  },
  {
    id: 'pancreatic-islets', name: 'Pancreatic islets (islets of Langerhans)', group: 'Endocrine pancreas',
    region: 'abdomen', surfaces: both,
    description: 'Microscopic endocrine cell clusters distributed throughout the pancreas that release insulin, glucagon and other hormones. Dots on the diagram mark their distribution, not individual islets.',
  },
  {
    id: 'ovary', name: 'Ovary', group: 'Gonad',
    region: 'pelvis', surfaces: both, paired: true, gonad: 'ovaries',
    description: 'Paired gonad in the pelvic cavity that produces oocytes and hormones including estrogens and progesterone.',
  },
  {
    id: 'testis', name: 'Testis', group: 'Gonad',
    region: 'pelvis', surfaces: both, paired: true, gonad: 'testes',
    description: 'Paired gonad normally within the scrotum that produces sperm and hormones, especially testosterone from Leydig cells.',
  },
];

export const endocrineStructures: readonly AtlasStructure[] = endocrineSpecs.flatMap(spec =>
  (spec.paired ? ['left', 'right'] as const : [null]).map(side => ({
    id: 'endocrine.' + (side ? side + '.' : '') + spec.id,
    systemId: 'endocrine' as const,
    name: (side ? side === 'left' ? 'Left ' : 'Right ' : '') + spec.name,
    classification: spec.group,
    regionIds: [spec.region],
    description: spec.description,
    sourceIds: ['openstax-ap2e-endocrine'],
  })),
);

const unique = new Set(endocrineStructures.map(item => item.id));
if (unique.size !== endocrineStructures.length) {
  throw new Error('Duplicate endocrine anatomical IDs');
}
