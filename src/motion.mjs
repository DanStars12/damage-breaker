// Respect both the player's explicit choice and the OS accessibility preference.
// A reduced-motion system should never silently select "skip".
export const motionChoices=Object.freeze(['full','calm','fast','off']);
export function resolveMotionMode(preference,reducedMotion=false) {
  if(motionChoices.includes(preference)) return preference;
  return reducedMotion?'calm':'full';
}
export const motionSettings=[
  ['full','通常（フル演出）'],
  ['calm','穏やか（動きを抑えて演出）'],
  ['fast','高速・軽量'],
  ['off','スキップ']
];
