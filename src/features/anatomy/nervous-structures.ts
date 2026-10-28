import type { AtlasStructure } from './atlas-model.ts';

export type NeuralSurface = 'front' | 'back';
type Division = 'Central nervous system' | 'Peripheral nervous system' | 'Autonomic nervous system';
type NeuralSpec = {
  id: string;
  name: string;
  division: Division;
  region: string;
  description: string;
  surfaces: readonly NeuralSurface[];
  paired?: boolean;
  otherRegions?: readonly string[];
};
const front = ['front'] as const;
const back = ['back'] as const;
const both = ['front', 'back'] as const;

// Gross structures and major nerve courses only. The 2D model is a
// deliberately selective overview, not a complete neuroanatomical atlas.
// Terminology/territories: OpenStax A&P 2e §§13.2–13.4.
export const neuralSpecs: readonly NeuralSpec[] = [
  { id: 'cerebral-hemisphere', name: 'Cerebral hemisphere', division: 'Central nervous system', region: 'head-neck', surfaces: both, paired: true,
    description: 'One half of the cerebrum, involved in perception, voluntary movement, language, memory, and higher cognition.' },
  { id: 'cerebellar-hemisphere', name: 'Cerebellar hemisphere', division: 'Central nervous system', region: 'head-neck', surfaces: back, paired: true,
    description: 'Coordinates movement, posture, balance, and motor learning; located behind the brainstem.' },
  { id: 'midbrain', name: 'Midbrain', division: 'Central nervous system', region: 'head-neck', surfaces: both,
    description: 'Upper brainstem region involved in eye movements, motor pathways, and auditory/visual reflexes.' },
  { id: 'pons', name: 'Pons', division: 'Central nervous system', region: 'head-neck', surfaces: both,
    description: 'Brainstem relay connecting the cerebrum and cerebellum; contributes to respiratory control and cranial nerve functions.' },
  { id: 'medulla', name: 'Medulla oblongata', division: 'Central nervous system', region: 'head-neck', surfaces: both,
    description: 'Lower brainstem that links to the spinal cord and participates in vital autonomic reflexes.' },
  { id: 'cervical-cord', name: 'Cervical spinal cord', division: 'Central nervous system', region: 'head-neck', otherRegions: ['back'], surfaces: both,
    description: 'Upper spinal cord, carrying ascending and descending pathways and neurons associated with neck and upper-limb functions.' },
  { id: 'thoracic-cord', name: 'Thoracic spinal cord', division: 'Central nervous system', region: 'thorax', otherRegions: ['back'], surfaces: both,
    description: 'Spinal cord segments associated with the thorax and trunk. Spinal cord levels do not coincide exactly with vertebral levels.' },
  { id: 'lumbosacral-cord', name: 'Lumbosacral cord and conus', division: 'Central nervous system', region: 'abdomen', otherRegions: ['back'], surfaces: both,
    description: 'Inferior spinal cord segments and the conus medullaris; the adult spinal cord typically ends near the L1–L2 vertebral level.' },
  { id: 'cauda-equina', name: 'Cauda equina', division: 'Peripheral nervous system', region: 'pelvis', otherRegions: ['back', 'abdomen'], surfaces: both,
    description: 'Bundle of lumbar, sacral and coccygeal nerve roots descending below the end of the spinal cord.' },

  { id: 'optic-nerve', name: 'Optic nerve (CN II)', division: 'Peripheral nervous system', region: 'head-neck', surfaces: front, paired: true,
    description: 'Carries visual information from the retina toward the optic chiasm and brain.' },
  { id: 'trigeminal-nerve', name: 'Trigeminal nerve (CN V)', division: 'Peripheral nervous system', region: 'head-neck', surfaces: front, paired: true,
    description: 'Main nerve for facial sensation; its mandibular division also supplies muscles of mastication.' },
  { id: 'facial-nerve', name: 'Facial nerve (CN VII)', division: 'Peripheral nervous system', region: 'head-neck', surfaces: front, paired: true,
    description: 'Supplies muscles of facial expression and carries taste and parasympathetic fibers through its branches.' },
  { id: 'vagus-nerve', name: 'Vagus nerve (CN X)', division: 'Peripheral nervous system', region: 'head-neck', otherRegions: ['thorax', 'abdomen'], surfaces: front, paired: true,
    description: 'Mixed cranial nerve with extensive parasympathetic connections to thoracic and abdominal organs.' },
  { id: 'accessory-nerve', name: 'Accessory nerve (CN XI)', division: 'Peripheral nervous system', region: 'head-neck', otherRegions: ['back'], surfaces: back, paired: true,
    description: 'Motor nerve supplying sternocleidomastoid and trapezius.' },

  { id: 'cervical-plexus', name: 'Cervical plexus', division: 'Peripheral nervous system', region: 'head-neck', surfaces: both, paired: true,
    description: 'Network of upper cervical spinal nerve anterior rami supplying parts of the neck and contributing to the phrenic nerve.' },
  { id: 'phrenic-nerve', name: 'Phrenic nerve', division: 'Peripheral nervous system', region: 'thorax', otherRegions: ['head-neck'], surfaces: front, paired: true,
    description: 'Motor supply to the diaphragm, derived mainly from C3–C5.' },
  { id: 'brachial-plexus', name: 'Brachial plexus', division: 'Peripheral nervous system', region: 'upper-limb', otherRegions: ['head-neck', 'thorax'], surfaces: both, paired: true,
    description: 'Network formed largely from C5–T1 anterior rami; gives rise to major nerves of the upper limb.' },
  { id: 'axillary-nerve', name: 'Axillary nerve', division: 'Peripheral nervous system', region: 'upper-limb', surfaces: both, paired: true,
    description: 'Supplies the deltoid and teres minor and provides sensation over part of the lateral shoulder.' },
  { id: 'musculocutaneous-nerve', name: 'Musculocutaneous nerve', division: 'Peripheral nervous system', region: 'upper-limb', surfaces: front, paired: true,
    description: 'Supplies anterior arm flexor muscles and continues as a sensory nerve of the lateral forearm.' },
  { id: 'median-nerve', name: 'Median nerve', division: 'Peripheral nervous system', region: 'upper-limb', surfaces: front, paired: true,
    description: 'Runs through the anterior forearm and carpal tunnel; supplies many forearm flexors and part of the hand.' },
  { id: 'ulnar-nerve', name: 'Ulnar nerve', division: 'Peripheral nervous system', region: 'upper-limb', surfaces: front, paired: true,
    description: 'Courses behind the medial elbow, then along the ulnar forearm to intrinsic hand muscles and sensation.' },
  { id: 'radial-nerve', name: 'Radial nerve', division: 'Peripheral nervous system', region: 'upper-limb', surfaces: back, paired: true,
    description: 'Courses posteriorly around the humerus and supplies many arm and forearm extensors.' },
  { id: 'intercostal-nerves', name: 'Intercostal nerves (T1–T11 group)', division: 'Peripheral nervous system', region: 'thorax', surfaces: both, paired: true,
    description: 'Anterior rami of thoracic spinal nerves that follow rib spaces to supply the thoracic wall; shown as a grouped overview.' },
  { id: 'sympathetic-trunk', name: 'Sympathetic trunk (chain)', division: 'Autonomic nervous system', region: 'thorax', otherRegions: ['head-neck', 'abdomen', 'pelvis', 'back'], surfaces: both, paired: true,
    description: 'Paired paravertebral chains of sympathetic ganglia extending from the neck into the pelvis.' },
  { id: 'lumbar-plexus', name: 'Lumbar plexus', division: 'Peripheral nervous system', region: 'abdomen', otherRegions: ['pelvis'], surfaces: front, paired: true,
    description: 'Network mainly from L1–L4 anterior rami, giving rise to nerves of the anterior and medial thigh.' },
  { id: 'femoral-nerve', name: 'Femoral nerve', division: 'Peripheral nervous system', region: 'lower-limb', otherRegions: ['pelvis'], surfaces: front, paired: true,
    description: 'Supplies anterior thigh muscles and conveys sensation from the anterior thigh and part of the medial leg.' },
  { id: 'obturator-nerve', name: 'Obturator nerve', division: 'Peripheral nervous system', region: 'lower-limb', otherRegions: ['pelvis'], surfaces: front, paired: true,
    description: 'Passes through the obturator canal to supply thigh adductors and medial thigh sensation.' },
  { id: 'saphenous-nerve', name: 'Saphenous nerve', division: 'Peripheral nervous system', region: 'lower-limb', surfaces: front, paired: true,
    description: 'Sensory branch of the femoral nerve running along the medial knee and lower leg.' },
  { id: 'sacral-plexus', name: 'Sacral plexus', division: 'Peripheral nervous system', region: 'pelvis', otherRegions: ['lower-limb', 'back'], surfaces: back, paired: true,
    description: 'Network from the lumbosacral region giving rise to major posterior lower-limb nerves, including the sciatic nerve.' },
  { id: 'sciatic-nerve', name: 'Sciatic nerve', division: 'Peripheral nervous system', region: 'lower-limb', otherRegions: ['pelvis'], surfaces: back, paired: true,
    description: 'Large nerve passing through the gluteal region and posterior thigh before branching near the knee.' },
  { id: 'tibial-nerve', name: 'Tibial nerve', division: 'Peripheral nervous system', region: 'lower-limb', surfaces: back, paired: true,
    description: 'Continuation of the sciatic nerve to the posterior lower leg and plantar foot.' },
  { id: 'common-fibular-nerve', name: 'Common fibular nerve', division: 'Peripheral nervous system', region: 'lower-limb', surfaces: back, paired: true,
    description: 'Sciatic branch winding around the fibular neck before dividing into superficial and deep fibular nerves.' },
  { id: 'deep-fibular-nerve', name: 'Deep fibular nerve', division: 'Peripheral nervous system', region: 'lower-limb', surfaces: front, paired: true,
    description: 'Supplies muscles of the anterior leg and sensation between the first and second toes.' },
  { id: 'superficial-fibular-nerve', name: 'Superficial fibular nerve', division: 'Peripheral nervous system', region: 'lower-limb', surfaces: front, paired: true,
    description: 'Supplies the lateral leg compartment and sensation over most of the dorsum of the foot.' },
  { id: 'sural-nerve', name: 'Sural nerve', division: 'Peripheral nervous system', region: 'lower-limb', surfaces: back, paired: true,
    description: 'Sensory nerve of the posterolateral calf and lateral foot.' },
];

export const nervousStructures: readonly AtlasStructure[] = neuralSpecs.flatMap(spec =>
  (spec.paired ? ['left', 'right'] as const : [null]).map(side => ({
    id: 'nervous.' + (side ? side + '.' : '') + spec.id,
    systemId: 'nervous' as const,
    name: (side ? (side === 'left' ? 'Left ' : 'Right ') : '') + spec.name,
    classification: spec.division,
    regionIds: [spec.region, ...(spec.otherRegions ?? [])],
    description: spec.description,
    sourceIds: ['openstax-ap2e-nervous'],
  })),
);
if (new Set(nervousStructures.map(item => item.id)).size !== nervousStructures.length) {
  throw new Error('Duplicate nervous atlas structure IDs.');
}
