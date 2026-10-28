import type { AtlasStructure } from './atlas-model.ts';

export type MuscleSurface = 'front' | 'back';
type MuscleGroup = 'Face & scalp' | 'Neck' | 'Chest' | 'Shoulder' | 'Back' |
  'Abdomen' | 'Upper arm' | 'Forearm' | 'Hip & thigh' | 'Gluteal region' | 'Lower leg';
interface MuscleSpec {
  id: string;
  name: string;
  group: MuscleGroup;
  region: string;
  surfaces: readonly MuscleSurface[];
  action: string;
  extraRegions?: readonly string[];
  unpaired?: boolean;
}
const front = ['front'] as const;
const back = ['back'] as const;
const both = ['front', 'back'] as const;

// Curated *superficial* reference muscles, not a claim to map all skeletal
// muscles. Deep and overlapping muscle groups need separate cutaway plates.
// Naming and gross position checked against OpenStax A&P 2e ch. 11.
export const muscleSpecs: readonly MuscleSpec[] = [
  { id: 'frontal-belly', name: 'Frontal belly (occipitofrontalis)', group: 'Face & scalp', region: 'head-neck', surfaces: front, action: 'Elevates the eyebrows and wrinkles the forehead.' },
  { id: 'occipital-belly', name: 'Occipital belly (occipitofrontalis)', group: 'Face & scalp', region: 'head-neck', surfaces: back, action: 'Retracts the scalp.' },
  { id: 'temporalis', name: 'Temporalis', group: 'Face & scalp', region: 'head-neck', surfaces: front, action: 'Elevates and retracts the mandible during chewing.' },
  { id: 'orbicularis-oculi', name: 'Orbicularis oculi', group: 'Face & scalp', region: 'head-neck', surfaces: front, action: 'Closes the eyelids.' },
  { id: 'masseter', name: 'Masseter', group: 'Face & scalp', region: 'head-neck', surfaces: front, action: 'Elevates the mandible for chewing.' },
  { id: 'zygomaticus-major', name: 'Zygomaticus major', group: 'Face & scalp', region: 'head-neck', surfaces: front, action: 'Draws the corners of the mouth upward and laterally.' },
  { id: 'orbicularis-oris', name: 'Orbicularis oris', group: 'Face & scalp', region: 'head-neck', surfaces: front, unpaired: true, action: 'Closes and purses the lips.' },
  { id: 'sternocleidomastoid', name: 'Sternocleidomastoid', group: 'Neck', region: 'head-neck', surfaces: front, action: 'Flexes the neck bilaterally and rotates the head to the opposite side unilaterally.' },
  { id: 'splenius-capitis', name: 'Splenius capitis', group: 'Neck', region: 'head-neck', surfaces: back, action: 'Extends the head and rotates it toward the same side.' },
  { id: 'trapezius', name: 'Trapezius', group: 'Back', region: 'back', extraRegions: ['head-neck', 'thorax'], surfaces: both, action: 'Moves and stabilizes the scapula and helps extend the neck.' },
  { id: 'deltoid', name: 'Deltoid', group: 'Shoulder', region: 'upper-limb', extraRegions: ['thorax'], surfaces: both, action: 'Abducts the arm; anterior and posterior fibers also aid flexion and extension.' },
  { id: 'pectoralis-major', name: 'Pectoralis major', group: 'Chest', region: 'thorax', surfaces: front, action: 'Adducts and medially rotates the arm; helps flex the shoulder.' },
  { id: 'serratus-anterior', name: 'Serratus anterior', group: 'Chest', region: 'thorax', surfaces: front, action: 'Protracts and upwardly rotates the scapula, holding it against the rib cage.' },
  { id: 'infraspinatus', name: 'Infraspinatus', group: 'Back', region: 'back', extraRegions: ['thorax'], surfaces: back, action: 'Laterally rotates the arm and stabilizes the shoulder joint.' },
  { id: 'teres-major', name: 'Teres major', group: 'Back', region: 'back', extraRegions: ['thorax'], surfaces: back, action: 'Extends, adducts, and medially rotates the arm.' },
  { id: 'latissimus-dorsi', name: 'Latissimus dorsi', group: 'Back', region: 'back', extraRegions: ['thorax', 'abdomen'], surfaces: back, action: 'Extends, adducts, and medially rotates the arm.' },
  { id: 'erector-spinae', name: 'Erector spinae (superficial columns)', group: 'Back', region: 'back', extraRegions: ['abdomen'], surfaces: back, action: 'Extends and laterally flexes the vertebral column; the name denotes a muscle group.' },
  { id: 'rectus-abdominis', name: 'Rectus abdominis', group: 'Abdomen', region: 'abdomen', surfaces: front, action: 'Flexes the trunk and compresses the abdominal contents.' },
  { id: 'external-oblique', name: 'External abdominal oblique', group: 'Abdomen', region: 'abdomen', surfaces: both, action: 'Compresses the abdomen and assists trunk rotation and flexion.' },
  { id: 'biceps-brachii', name: 'Biceps brachii', group: 'Upper arm', region: 'upper-limb', surfaces: front, action: 'Supinates the forearm and flexes the elbow.' },
  { id: 'brachialis', name: 'Brachialis', group: 'Upper arm', region: 'upper-limb', surfaces: front, action: 'Flexes the forearm at the elbow.' },
  { id: 'triceps-brachii', name: 'Triceps brachii', group: 'Upper arm', region: 'upper-limb', surfaces: back, action: 'Extends the elbow; the long head also helps extend and adduct the arm.' },
  { id: 'brachioradialis', name: 'Brachioradialis', group: 'Forearm', region: 'upper-limb', surfaces: both, action: 'Flexes the elbow most effectively with the forearm in a neutral position.' },
  { id: 'pronator-teres', name: 'Pronator teres', group: 'Forearm', region: 'upper-limb', surfaces: front, action: 'Pronates the forearm and assists elbow flexion.' },
  { id: 'flexor-carpi-radialis', name: 'Flexor carpi radialis', group: 'Forearm', region: 'upper-limb', surfaces: front, action: 'Flexes and abducts the wrist.' },
  { id: 'flexor-carpi-ulnaris', name: 'Flexor carpi ulnaris', group: 'Forearm', region: 'upper-limb', surfaces: front, action: 'Flexes and adducts the wrist.' },
  { id: 'extensor-carpi-radialis-longus', name: 'Extensor carpi radialis longus', group: 'Forearm', region: 'upper-limb', surfaces: back, action: 'Extends and abducts the wrist.' },
  { id: 'extensor-digitorum', name: 'Extensor digitorum', group: 'Forearm', region: 'upper-limb', surfaces: back, action: 'Extends digits two through five and assists wrist extension.' },
  { id: 'extensor-carpi-ulnaris', name: 'Extensor carpi ulnaris', group: 'Forearm', region: 'upper-limb', surfaces: back, action: 'Extends and adducts the wrist.' },
  { id: 'tensor-fasciae-latae', name: 'Tensor fasciae latae', group: 'Hip & thigh', region: 'lower-limb', extraRegions: ['pelvis'], surfaces: front, action: 'Tenses the iliotibial tract; assists hip flexion, abduction, and medial rotation.' },
  { id: 'sartorius', name: 'Sartorius', group: 'Hip & thigh', region: 'lower-limb', surfaces: front, action: 'Flexes, abducts, and laterally rotates the thigh; flexes the knee.' },
  { id: 'adductor-longus', name: 'Adductor longus', group: 'Hip & thigh', region: 'lower-limb', surfaces: front, action: 'Adducts the thigh and assists hip flexion.' },
  { id: 'gracilis', name: 'Gracilis', group: 'Hip & thigh', region: 'lower-limb', surfaces: front, action: 'Adducts the thigh and assists knee flexion.' },
  { id: 'rectus-femoris', name: 'Rectus femoris', group: 'Hip & thigh', region: 'lower-limb', surfaces: front, action: 'Extends the knee and flexes the hip; part of the quadriceps.' },
  { id: 'vastus-lateralis', name: 'Vastus lateralis', group: 'Hip & thigh', region: 'lower-limb', surfaces: front, action: 'Extends the knee; the lateral quadriceps muscle.' },
  { id: 'vastus-medialis', name: 'Vastus medialis', group: 'Hip & thigh', region: 'lower-limb', surfaces: front, action: 'Extends the knee and helps stabilize the patella medially.' },
  { id: 'gluteus-medius', name: 'Gluteus medius', group: 'Gluteal region', region: 'pelvis', extraRegions: ['lower-limb'], surfaces: back, action: 'Abducts the hip and stabilizes the pelvis during walking.' },
  { id: 'gluteus-maximus', name: 'Gluteus maximus', group: 'Gluteal region', region: 'pelvis', extraRegions: ['lower-limb'], surfaces: back, action: 'Extends and laterally rotates the hip.' },
  { id: 'biceps-femoris', name: 'Biceps femoris', group: 'Hip & thigh', region: 'lower-limb', surfaces: back, action: 'Flexes the knee and laterally rotates the flexed leg; long head also extends the hip.' },
  { id: 'semitendinosus', name: 'Semitendinosus', group: 'Hip & thigh', region: 'lower-limb', surfaces: back, action: 'Extends the hip, flexes the knee, and medially rotates the flexed leg.' },
  { id: 'semimembranosus', name: 'Semimembranosus', group: 'Hip & thigh', region: 'lower-limb', surfaces: back, action: 'Extends the hip, flexes the knee, and medially rotates the flexed leg.' },
  { id: 'tibialis-anterior', name: 'Tibialis anterior', group: 'Lower leg', region: 'lower-limb', surfaces: front, action: 'Dorsiflexes and inverts the foot.' },
  { id: 'extensor-digitorum-longus', name: 'Extensor digitorum longus', group: 'Lower leg', region: 'lower-limb', surfaces: front, action: 'Extends toes two through five and dorsiflexes the foot.' },
  { id: 'fibularis-longus', name: 'Fibularis longus', group: 'Lower leg', region: 'lower-limb', surfaces: both, action: 'Everts and plantarflexes the foot and supports its arches.' },
  { id: 'gastrocnemius', name: 'Gastrocnemius', group: 'Lower leg', region: 'lower-limb', surfaces: back, action: 'Plantarflexes the foot and assists knee flexion.' },
  { id: 'soleus', name: 'Soleus', group: 'Lower leg', region: 'lower-limb', surfaces: back, action: 'Plantarflexes the foot and helps maintain upright posture.' },
];

export const muscleSurfaces: ReadonlyMap<string, readonly MuscleSurface[]> =
  new Map(muscleSpecs.map(spec => [spec.id, spec.surfaces]));

export const muscularStructures: readonly AtlasStructure[] = muscleSpecs.flatMap(spec =>
  (spec.unpaired ? [null] : ['left', 'right'] as const).map(side => ({
    id: 'muscular.' + (side ? side + '.' : '') + spec.id,
    systemId: 'muscular' as const,
    name: (side === 'left' ? 'Left ' : side === 'right' ? 'Right ' : '') + spec.name,
    classification: 'Skeletal muscle · ' + spec.group,
    regionIds: [spec.region, ...(spec.extraRegions ?? [])],
    description: spec.action,
    sourceIds: ['openstax-ap2e-muscles'],
  })),
);
if (new Set(muscularStructures.map(item => item.id)).size !== muscularStructures.length) {
  throw new Error('Duplicate muscular atlas structure ID.');
}
