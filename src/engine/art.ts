import * as THREE from 'three';

// Generated textures (scripts/gen-art.mjs → public/art). Optional: without
// a manifest the engine keeps its procedural koi and moon.

export interface KoiSkin {
  name: string;
  texture: THREE.Texture;
  /** Half the image height over its length. */
  halfWidth: number;
  /** True when the head is on the left of the image. */
  flip: boolean;
}

export interface Art {
  koi: KoiSkin[];
  moon: THREE.Texture | null;
  /** 荷塘: leaves, flowers and a bud in one 3x2 atlas (see scripts/gen-art.mjs packLotus). */
  lotus: THREE.Texture | null;
  /** 近岸: begonia blossoms, bud, petal and a butterfly open and closed, one 3x2 atlas (packShore). */
  shore: THREE.Texture | null;
  /** 春风拂柳: one willow leaf (Codex, art-incoming/shore-v2/willow-leaf.png), upright, stalk down. */
  willowLeaf: THREE.Texture | null;
}

interface Manifest {
  version: number;
  koi?: { name: string; file: string; halfWidth: number; flip?: boolean }[];
  moon?: { file: string } | null;
  lotus?: { file: string } | null;
  shore?: { file: string } | null;
  willowLeaf?: { file: string } | null;
}

export async function loadArt(base = `${import.meta.env.BASE_URL}art/`): Promise<Art | null> {
  let manifest: Manifest;
  try {
    const res = await fetch(`${base}manifest.json`);
    if (!res.ok) return null;
    manifest = await res.json();
  } catch {
    return null;
  }
  if (manifest.version !== 1) return null;
  const loader = new THREE.TextureLoader();
  const load = (file: string): Promise<THREE.Texture> =>
    loader.loadAsync(`${base}${file}`).then((t) => {
      // Colours stay raw sRGB, like every other colour in the engine.
      t.colorSpace = THREE.NoColorSpace;
      t.anisotropy = 4;
      return t;
    });
  const koi = await Promise.all(
    (manifest.koi ?? [])
      .filter((k) => k.halfWidth > 0.05 && k.halfWidth < 1)
      .map(async (k): Promise<KoiSkin | null> => {
        try {
          return { name: k.name, texture: await load(k.file), halfWidth: k.halfWidth, flip: !!k.flip };
        } catch {
          return null;
        }
      }),
  );
  let moon: THREE.Texture | null = null;
  if (manifest.moon) moon = await load(manifest.moon.file).catch(() => null);
  let lotus: THREE.Texture | null = null;
  if (manifest.lotus) lotus = await load(manifest.lotus.file).catch(() => null);
  let shore: THREE.Texture | null = null;
  if (manifest.shore) shore = await load(manifest.shore.file).catch(() => null);
  let willowLeaf: THREE.Texture | null = null;
  if (manifest.willowLeaf) willowLeaf = await load(manifest.willowLeaf.file).catch(() => null);
  return { koi: koi.filter((k): k is KoiSkin => !!k), moon, lotus, shore, willowLeaf };
}
