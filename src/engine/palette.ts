import * as THREE from 'three';

// Colours are passed to shaders as raw sRGB values (no colour management),
// so hex values here match docs/03-ux-ui-design.md exactly.
function rgb(hex: string): THREE.Vector3 {
  const n = parseInt(hex.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export interface Palette {
  zenith: THREE.Vector3;
  skyLow: THREE.Vector3;
  mountain: THREE.Vector3;
  water: THREE.Vector3;
  accent: THREE.Vector3;
  ink: THREE.Vector3;
  paper: THREE.Vector3;
  cinnabar: THREE.Vector3;
  brush: THREE.Vector3;
}

export const serene: Palette = {
  zenith: rgb('#0B111D'),
  skyLow: rgb('#22314A'),
  mountain: rgb('#1E2836'),
  water: rgb('#0A111A'),
  accent: rgb('#E9D9A6'),
  ink: rgb('#0A0D13'),
  paper: rgb('#EFE8D8'),
  cinnabar: rgb('#C8553D'),
  brush: rgb('#E6E0D2'),
};
