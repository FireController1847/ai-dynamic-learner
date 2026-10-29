import type { AtlasStructure } from './atlas-model.ts';

export type CardioSurface = 'front' | 'back';
export type VesselView = 'all' | 'arteries' | 'veins';
type CardioGroup = 'Heart chamber' | 'Systemic artery' | 'Pulmonary artery' |
  'Coronary artery' | 'Systemic vein' | 'Pulmonary vein' | 'Coronary vein';
type Region = 'head-neck' | 'thorax' | 'abdomen' | 'pelvis' | 'upper-limb' | 'lower-limb';
export interface CardioSpec {
  id: string; name: string; group: CardioGroup; region: Region;
  description: string; paired?: boolean;
  surfaces: readonly CardioSurface[];
  otherRegions?: readonly Region[];
}
const both = ['front', 'back'] as const;
const front = ['front'] as const;
const back = ['back'] as const;
const specs: CardioSpec[] = [];
const add = (id: string, name: string, group: CardioGroup, region: Region,
  description: string, paired = false, surfaces: readonly CardioSurface[] = both,
  otherRegions?: readonly Region[]) => {
  specs.push({ id, name, group, region, description, paired, surfaces, otherRegions });
};

// A learning atlas of the *major* pathways, not an inventory of every
// artery, vein or heart tissue. Heart chambers are schematic cutaways.
// Sources: OpenStax A&P 2e 19.1 (heart) and 20.5 (circulatory pathways).
add('right-atrium', 'Right atrium', 'Heart chamber', 'thorax',
  'Receives systemic venous blood from the superior and inferior venae cavae and coronary sinus.');
add('right-ventricle', 'Right ventricle', 'Heart chamber', 'thorax',
  'Pumps relatively oxygen-poor blood into the pulmonary trunk and pulmonary arteries.');
add('left-atrium', 'Left atrium', 'Heart chamber', 'thorax',
  'Receives oxygen-rich blood through pulmonary veins and sends it to the left ventricle.');
add('left-ventricle', 'Left ventricle', 'Heart chamber', 'thorax',
  'Thick-walled pumping chamber that sends oxygen-rich blood into the systemic aorta.');

add('ascending-aorta', 'Ascending aorta', 'Systemic artery', 'thorax',
  'Originates at the left ventricle, gives rise to coronary arteries, and leads to the aortic arch.');
add('aortic-arch', 'Aortic arch', 'Systemic artery', 'thorax',
  'Curved aortic segment whose main branches supply the head, neck and upper limbs.');
add('thoracic-aorta', 'Descending thoracic aorta', 'Systemic artery', 'thorax',
  'Descends through the posterior mediastinum, supplying structures of the chest.', false, back);
add('abdominal-aorta', 'Abdominal aorta', 'Systemic artery', 'abdomen',
  'Continuation of the descending aorta below the diaphragm; supplies abdominal organs and divides into common iliac arteries.');
add('brachiocephalic-trunk', 'Brachiocephalic trunk', 'Systemic artery', 'thorax',
  'First branch of the normal aortic arch; supplies the right common carotid and right subclavian arteries.', false, front);
add('common-carotid-artery', 'Common carotid artery', 'Systemic artery', 'head-neck',
  'Ascends in the neck and divides into internal and external carotid arteries.', true);
add('internal-carotid-artery', 'Internal carotid artery', 'Systemic artery', 'head-neck',
  'Enters the cranial cavity to help supply the brain and eyes.', true, front);
add('external-carotid-artery', 'External carotid artery', 'Systemic artery', 'head-neck',
  'Supplies much of the external head and neck, including face and scalp.', true, front);
add('subclavian-artery', 'Subclavian artery', 'Systemic artery', 'thorax',
  'Travels beneath the clavicle; becomes the axillary artery at the first rib.', true, both, ['upper-limb']);
add('axillary-artery', 'Axillary artery', 'Systemic artery', 'upper-limb',
  'Continuation of the subclavian artery in the axilla; becomes the brachial artery.', true, front);
add('brachial-artery', 'Brachial artery', 'Systemic artery', 'upper-limb',
  'Main arm artery; typically divides near the elbow into the radial and ulnar arteries.', true, front);
add('radial-artery', 'Radial artery', 'Systemic artery', 'upper-limb',
  'Runs along the thumb-side forearm and contributes to arterial supply of the hand.', true, front);
add('ulnar-artery', 'Ulnar artery', 'Systemic artery', 'upper-limb',
  'Runs along the little-finger side of the forearm and contributes to the palmar arches.', true, front);
add('posterior-intercostal-arteries', 'Posterior intercostal arteries (group)', 'Systemic artery', 'thorax',
  'Segmental branches running in the intercostal spaces to supply the thoracic wall; grouped here.', true, back);
add('celiac-trunk', 'Celiac trunk', 'Systemic artery', 'abdomen',
  'Short branch of abdominal aorta that supplies foregut structures through its branches.', false, front);
add('superior-mesenteric-artery', 'Superior mesenteric artery', 'Systemic artery', 'abdomen',
  'Supplies most of the small intestine and proximal large intestine.', false, front);
add('renal-artery', 'Renal artery', 'Systemic artery', 'abdomen',
  'Branches laterally from the abdominal aorta to supply each kidney.', true);
add('inferior-mesenteric-artery', 'Inferior mesenteric artery', 'Systemic artery', 'abdomen',
  'Supplies portions of the descending and sigmoid colon and upper rectum.', false, front);
add('common-iliac-artery', 'Common iliac artery', 'Systemic artery', 'pelvis',
  'Terminal aortic branch dividing into internal and external iliac arteries.', true);
add('external-iliac-artery', 'External iliac artery', 'Systemic artery', 'pelvis',
  'Continues toward the thigh and becomes the femoral artery below the inguinal ligament.', true, front, ['lower-limb']);
add('femoral-artery', 'Femoral artery', 'Systemic artery', 'lower-limb',
  'Principal artery of the anterior thigh, continuous with the external iliac artery.', true, front);
add('deep-femoral-artery', 'Deep femoral artery (profunda femoris)', 'Systemic artery', 'lower-limb',
  'Large branch of the femoral artery supplying deep thigh tissues.', true, front);
add('popliteal-artery', 'Popliteal artery', 'Systemic artery', 'lower-limb',
  'Continuation of the femoral artery behind the knee; branches into tibial arteries.', true, back);
add('anterior-tibial-artery', 'Anterior tibial artery', 'Systemic artery', 'lower-limb',
  'Travels in the anterior leg compartment and continues onto the foot as dorsalis pedis.', true, front);
add('posterior-tibial-artery', 'Posterior tibial artery', 'Systemic artery', 'lower-limb',
  'Runs in the posterior leg toward the medial ankle and plantar foot.', true, back);
add('dorsalis-pedis-artery', 'Dorsalis pedis artery', 'Systemic artery', 'lower-limb',
  'Continuation of the anterior tibial artery across the dorsum of the foot.', true, front);

add('pulmonary-trunk', 'Pulmonary trunk', 'Pulmonary artery', 'thorax',
  'Receives oxygen-poor blood from the right ventricle and divides into pulmonary arteries.', false, front);
add('pulmonary-artery', 'Pulmonary artery', 'Pulmonary artery', 'thorax',
  'Carries relatively oxygen-poor blood from the pulmonary trunk toward each lung.', true, front);
add('superior-pulmonary-vein', 'Superior pulmonary vein', 'Pulmonary vein', 'thorax',
  'Returns oxygen-rich blood from each lung to the left atrium.', true, both);
add('inferior-pulmonary-vein', 'Inferior pulmonary vein', 'Pulmonary vein', 'thorax',
  'Returns oxygen-rich blood from each lung to the left atrium.', true, both);

add('right-coronary-artery', 'Right coronary artery', 'Coronary artery', 'thorax',
  'Runs in the right atrioventricular groove and supplies portions of the heart.');
add('left-main-coronary-artery', 'Left main coronary artery', 'Coronary artery', 'thorax',
  'Short coronary trunk branching into the anterior interventricular and circumflex arteries.', false, front);
add('anterior-interventricular-artery', 'Anterior interventricular artery (LAD)', 'Coronary artery', 'thorax',
  'Descends in the anterior interventricular sulcus supplying much of the anterior myocardium.', false, front);
add('circumflex-artery', 'Circumflex artery', 'Coronary artery', 'thorax',
  'Courses around the left side of the atrioventricular groove to supply left-heart myocardium.', false, front);
add('posterior-interventricular-artery', 'Posterior interventricular artery', 'Coronary artery', 'thorax',
  'Descends on the posterior interventricular surface; most commonly arises from the right coronary artery.', false, back);
add('great-cardiac-vein', 'Great cardiac vein', 'Coronary vein', 'thorax',
  'Runs with the anterior interventricular artery and ultimately drains toward the coronary sinus.', false, front);
add('coronary-sinus', 'Coronary sinus', 'Coronary vein', 'thorax',
  'Large venous channel on the posterior heart that drains most coronary venous blood into the right atrium.', false, back);

add('superior-vena-cava', 'Superior vena cava', 'Systemic vein', 'thorax',
  'Returns venous blood from head, neck, upper limbs and thorax into the right atrium.');
add('inferior-vena-cava', 'Inferior vena cava', 'Systemic vein', 'abdomen',
  'Returns venous blood from lower body to the right atrium through the diaphragm.', false, both, ['thorax']);
add('brachiocephalic-vein', 'Brachiocephalic vein', 'Systemic vein', 'thorax',
  'Formed by the union of the internal jugular and subclavian veins; joins its counterpart to form the superior vena cava.', true, front);
add('internal-jugular-vein', 'Internal jugular vein', 'Systemic vein', 'head-neck',
  'Drains venous blood from the brain and deep structures of the face and neck.', true);
add('external-jugular-vein', 'External jugular vein', 'Systemic vein', 'head-neck',
  'Drains superficial scalp and face regions toward the subclavian vein.', true, front);
add('subclavian-vein', 'Subclavian vein', 'Systemic vein', 'thorax',
  'Drains the upper limb through its continuation from the axillary vein.', true, both, ['upper-limb']);
add('axillary-vein', 'Axillary vein', 'Systemic vein', 'upper-limb',
  'Receives blood from arm veins and continues as the subclavian vein.', true, front);
add('cephalic-vein', 'Cephalic vein', 'Systemic vein', 'upper-limb',
  'Superficial vein running along the lateral (thumb-side) arm toward the axillary vein.', true, front);
add('basilic-vein', 'Basilic vein', 'Systemic vein', 'upper-limb',
  'Superficial vein on the medial (little-finger-side) upper limb, contributing to deep venous return.', true, front);
add('median-cubital-vein', 'Median cubital vein', 'Systemic vein', 'upper-limb',
  'Superficial connection between cephalic and basilic veins at the elbow; common venipuncture site.', true, front);
add('hepatic-veins', 'Hepatic veins (group)', 'Systemic vein', 'abdomen',
  'Drain blood from the liver directly into the inferior vena cava.', false, front);
add('hepatic-portal-vein', 'Hepatic portal vein', 'Systemic vein', 'abdomen',
  'Carries nutrient-rich venous blood from digestive organs to the liver before systemic venous return.', false, front);
add('renal-vein', 'Renal vein', 'Systemic vein', 'abdomen',
  'Drains each kidney into the inferior vena cava.', true);
add('common-iliac-vein', 'Common iliac vein', 'Systemic vein', 'pelvis',
  'Major pelvic vein formed by external and internal iliac veins; the two sides unite into the inferior vena cava.', true);
add('external-iliac-vein', 'External iliac vein', 'Systemic vein', 'pelvis',
  'Venous continuation of the femoral vein toward the common iliac vein.', true, front, ['lower-limb']);
add('femoral-vein', 'Femoral vein', 'Systemic vein', 'lower-limb',
  'Main deep thigh vein receiving blood from the popliteal vein and continuing as the external iliac vein.', true, front);
add('great-saphenous-vein', 'Great saphenous vein', 'Systemic vein', 'lower-limb',
  'Long superficial vein along the medial leg and thigh draining to the femoral vein.', true, front);
add('popliteal-vein', 'Popliteal vein', 'Systemic vein', 'lower-limb',
  'Deep vein behind the knee draining into the femoral vein.', true, back);
add('small-saphenous-vein', 'Small saphenous vein', 'Systemic vein', 'lower-limb',
  'Superficial posterior calf vein commonly draining into the popliteal vein.', true, back);

export const cardiovascularSpecs: readonly CardioSpec[] = specs;
export const cardiovascularStructures: readonly AtlasStructure[] = specs.flatMap(spec =>
  (spec.paired ? ['left', 'right'] as const : [null]).map(side => ({
    id: 'cardiovascular.' + (side ? side + '.' : '') + spec.id,
    systemId: 'cardiovascular' as const,
    name: (side ? (side === 'left' ? 'Left ' : 'Right ') : '') + spec.name,
    classification: spec.group,
    regionIds: [spec.region, ...(spec.otherRegions ?? [])],
    description: spec.description,
    sourceIds: ['openstax-ap2e-heart', 'openstax-ap2e-vessels'],
  })),
);
if (new Set(cardiovascularStructures.map(item => item.id)).size !== cardiovascularStructures.length) {
  throw new Error('Duplicate cardiovascular atlas structure identifiers');
}
