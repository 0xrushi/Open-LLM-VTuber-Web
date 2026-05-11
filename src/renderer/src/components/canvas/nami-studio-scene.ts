import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { namiAuthoredEnvironmentConfig } from './nami-authored-environment-config';

export type SceneVec3 = [number, number, number];

export interface SceneObjectRegistryEntry {
  id: string;
  humanName: string;
  type: string;
  zone: string;
  position: SceneVec3;
  rotation: SceneVec3;
  scale: SceneVec3;
  boundingBox: {
    min: SceneVec3;
    max: SceneVec3;
  };
  interactionPoints: Record<string, SceneVec3>;
  facingDirection: SceneVec3;
  actions: string[];
}

export interface AiSceneRegistry {
  sceneId: string;
  displayName: string;
  units: 'meters';
  navmesh: {
    walkableAreas: Array<{ id: string; polygon: SceneVec3[] }>;
    blockedObjectIds: string[];
  };
  objects: SceneObjectRegistryEntry[];
}

type BuildableObject = {
  id: string;
  humanName: string;
  type: string;
  zone: string;
  position: SceneVec3;
  size: SceneVec3;
  color: number;
  rotation?: SceneVec3;
  actions?: string[];
  interactionPoints?: Record<string, SceneVec3>;
  facingDirection?: SceneVec3;
  shape?: 'box' | 'sphere' | 'cylinder';
  transparent?: boolean;
  opacity?: number;
  blueprintAsset?: {
    url: string;
    scale: number;
    offset?: SceneVec3;
    rotation?: SceneVec3;
  };
};

export interface BlueprintSceneAsset {
  objectId: string;
  url: string;
  scale: number;
  offset: SceneVec3;
  rotation: SceneVec3;
}

type AuthoredEnvironmentObject = typeof namiAuthoredEnvironmentConfig.objects[number];

const namiDeskSitCalibration = {
  rootPosition: [-3.288, 0.42737534252080384, -2.54] as SceneVec3,
  hipsPosition: [0.17, 0.48, -0.54] as SceneVec3,
};

const namiDeskSitPelvisY = Number((
  namiDeskSitCalibration.rootPosition[1] + namiDeskSitCalibration.hipsPosition[1]
).toFixed(3));

const authoredVisualOverrides: Record<string, Partial<SceneObjectRegistryEntry>> = {
  treadmill: {
    position: [1.749, 0, 2.123],
    scale: [0.895, 1.331, 2.08],
    boundingBox: {
      min: [1.302, 0, 1.083],
      max: [2.197, 1.331, 3.163],
    },
    interactionPoints: {
      approach: [1.749, 0, 2.123],
      run: [1.749, 0, 2.123],
      lookAt: [1.749, 0.95, 3.1],
    },
    facingDirection: [0, 0, 1],
  },
};

const defaultActionsByType: Record<string, string[]> = {
  bed: ['inspect', 'moveTo', 'sit', 'lieDown', 'sleep'],
  chair: ['inspect', 'sit', 'moveTo'],
  sofa: ['inspect', 'sit', 'moveTo'],
  cupboard: ['inspect', 'open', 'close', 'moveTo'],
  drawer: ['inspect', 'open', 'close', 'moveTo'],
  prop: ['inspect', 'pickUp', 'moveTo'],
  appliance: ['inspect', 'use', 'moveTo'],
  treadmill: ['inspect', 'walkOn', 'runOn', 'moveTo'],
  desk: ['inspect', 'moveTo', 'sit'],
  table: ['inspect', 'moveTo'],
  window: ['inspect', 'lookOut', 'moveTo'],
};

const inferAuthoredType = (object: AuthoredEnvironmentObject): string => {
  const key = `${object.id} ${object.assetName} ${object.humanName}`.toLowerCase();
  if (key.includes('bed')) return 'bed';
  if (key.includes('armchair') || key.includes('chair')) return 'chair';
  if (key.includes('treadmill')) return 'treadmill';
  if (key.includes('kitchen') || key.includes('cabinet') || key.includes('storage')) return 'cupboard';
  if (key.includes('dining') || key.includes('table')) return 'table';
  if (key.includes('desk') || key.includes('drawer-6')) return 'desk';
  return object.type || 'prop';
};

const authoredApproachFor = (position: readonly number[], type: string): SceneVec3 => {
  const distance = type === 'bed' ? 1.05 : 0.85;
  return [
    Number(position[0].toFixed(3)),
    0,
    Number((position[2] + distance).toFixed(3)),
  ];
};

const createAuthoredEntry = (object: AuthoredEnvironmentObject): SceneObjectRegistryEntry => {
  const type = inferAuthoredType(object);
  const override = authoredVisualOverrides[object.id];
  const position = (override?.position ?? object.position) as SceneVec3;
  const scale = (override?.scale ?? object.scale) as SceneVec3;
  const rotation = object.rotation as unknown as SceneVec3;
  const half = v(scale).multiplyScalar(0.5);
  const min = v(position).sub(half);
  const max = v(position).add(half);
  const approach = authoredApproachFor(position, type);
  const lookAt: SceneVec3 = [
    Number(position[0].toFixed(3)),
    Number((position[1] + 0.85).toFixed(3)),
    Number(position[2].toFixed(3)),
  ];
  const interactionPoints: Record<string, SceneVec3> = {
    approach,
    lookAt,
  };
  if (type === 'chair') {
    interactionPoints.sit = [
      Number(position[0].toFixed(3)),
      Number((position[1] + 0.58).toFixed(3)),
      Number(position[2].toFixed(3)),
    ];
  }
  if (type === 'desk') {
    interactionPoints.sit = [
      namiDeskSitCalibration.rootPosition[0],
      namiDeskSitPelvisY,
      namiDeskSitCalibration.rootPosition[2],
    ];
    interactionPoints.approach = [
      Number(position[0].toFixed(3)),
      0,
      Number((position[2] - 0.95).toFixed(3)),
    ];
    interactionPoints.lookAt = [
      Number(position[0].toFixed(3)),
      Number((position[1] + 0.85).toFixed(3)),
      Number(position[2].toFixed(3)),
    ];
  }
  if (type === 'bed') {
    interactionPoints.sit = [
      Number(position[0].toFixed(3)),
      Number((position[1] + 0.58).toFixed(3)),
      Number(position[2].toFixed(3)),
    ];
    interactionPoints.sleep = [
      Number(position[0].toFixed(3)),
      Number((position[1] + 0.62).toFixed(3)),
      Number(position[2].toFixed(3)),
    ];
  }

  return {
    id: object.id,
    humanName: object.humanName,
    type,
    zone: object.zone || 'Room',
    position,
    rotation,
    scale,
    boundingBox: override?.boundingBox ?? { min: toVec3(min), max: toVec3(max) },
    interactionPoints: {
      ...interactionPoints,
      ...override?.interactionPoints,
    },
    facingDirection: (override?.facingDirection as SceneVec3 | undefined) ?? [0, 0, 1],
    actions: defaultActionsByType[type] ?? object.actions ?? ['inspect', 'moveTo'],
  };
};

export const createNamiAuthoredEnvironmentRegistry = (): AiSceneRegistry => {
  const objects = namiAuthoredEnvironmentConfig.objects.map(createAuthoredEntry);
  return {
    sceneId: 'nami_studio_apartment',
    displayName: 'Nami Authored Studio',
    units: 'meters',
    navmesh: {
      walkableAreas: [
        {
          id: 'NAV_Authored_Room_Main_01',
          polygon: [[-4, 0, -3], [4, 0, -3], [4, 0, 3], [-4, 0, 3]],
        },
      ],
      blockedObjectIds: objects
        .filter((entry) => !['floor', 'zone', 'rug', 'wall', 'window', 'curtain'].includes(entry.type))
        .map((entry) => entry.id),
    },
    objects,
  };
};

const v = (value: SceneVec3) => new THREE.Vector3(...value);

const toVec3 = (value: THREE.Vector3): SceneVec3 => [
  Number(value.x.toFixed(3)),
  Number(value.y.toFixed(3)),
  Number(value.z.toFixed(3)),
];

const inferApproach = (position: SceneVec3, facing: SceneVec3, distance = 0.85): SceneVec3 => [
  Number((position[0] - facing[0] * distance).toFixed(3)),
  0,
  Number((position[2] - facing[2] * distance).toFixed(3)),
];

const createEntry = (obj: BuildableObject): SceneObjectRegistryEntry => {
  const position = v(obj.position);
  const half = v(obj.size).multiplyScalar(0.5);
  const min = position.clone().sub(half);
  const max = position.clone().add(half);
  const facing = obj.facingDirection ?? [0, 0, 1];
  const lookAt: SceneVec3 = [obj.position[0], Number((obj.position[1] + obj.size[1] * 0.25).toFixed(3)), obj.position[2]];

  return {
    id: obj.id,
    humanName: obj.humanName,
    type: obj.type,
    zone: obj.zone,
    position: obj.position,
    rotation: obj.rotation ?? [0, 0, 0],
    scale: obj.size,
    boundingBox: { min: toVec3(min), max: toVec3(max) },
    interactionPoints: {
      approach: inferApproach(obj.position, facing),
      lookAt,
      ...obj.interactionPoints,
    },
    facingDirection: facing,
    actions: obj.actions ?? defaultActionsByType[obj.type] ?? ['inspect', 'moveTo'],
  };
};

const textureCache = new Map<string, THREE.Texture>();

const createProceduralTexture = (
  key: string,
  painter: (ctx: CanvasRenderingContext2D, size: number) => void,
) => {
  const cached = textureCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  painter(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  textureCache.set(key, texture);
  return texture;
};

const hexToCss = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

const makeWoodMaterial = (base: number) => {
  const map = createProceduralTexture(`wood-${base}`, (ctx, size) => {
    ctx.fillStyle = hexToCss(base);
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 8) {
      const alpha = 0.08 + Math.random() * 0.12;
      ctx.strokeStyle = `rgba(40, 20, 8, ${alpha})`;
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(0, y + Math.sin(y * 0.08) * 3);
      for (let x = 0; x <= size; x += 16) {
        ctx.lineTo(x, y + Math.sin((x + y) * 0.05) * 5);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 12; i += 1) {
      ctx.strokeStyle = 'rgba(255, 210, 140, 0.08)';
      ctx.beginPath();
      const y = Math.random() * size;
      ctx.ellipse(Math.random() * size, y, 22, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  if (map) {
    map.repeat.set(2.5, 1);
  }
  return new THREE.MeshStandardMaterial({
    color: base,
    map: map ?? undefined,
    roughness: 0.62,
    metalness: 0.03,
  });
};

const makeFabricMaterial = (base: number) => {
  const map = createProceduralTexture(`fabric-${base}`, (ctx, size) => {
    ctx.fillStyle = hexToCss(base);
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < size; i += 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(i, 0, 1, size);
      ctx.fillStyle = 'rgba(0,0,0,0.04)';
      ctx.fillRect(0, i, size, 1);
    }
  });
  if (map) {
    map.repeat.set(3, 3);
  }
  return new THREE.MeshStandardMaterial({
    color: base,
    map: map ?? undefined,
    roughness: 0.9,
    metalness: 0,
  });
};

const makeParchmentMaterial = () => {
  const map = createProceduralTexture('parchment', (ctx, size) => {
    ctx.fillStyle = '#e8d19b';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 800; i += 1) {
      const shade = Math.random() > 0.5 ? 60 : 255;
      ctx.fillStyle = `rgba(${shade}, ${shade * 0.72}, ${shade * 0.38}, 0.045)`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
    }
    ctx.strokeStyle = 'rgba(72, 42, 18, 0.28)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, size - 16, size - 16);
    ctx.strokeStyle = 'rgba(20, 95, 105, 0.32)';
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      const y = 45 + i * 22;
      ctx.moveTo(32, y);
      ctx.bezierCurveTo(80, y - 25, 120, y + 30, 210, y - 6);
      ctx.stroke();
    }
  });
  if (map) {
    map.repeat.set(1.4, 0.7);
  }
  return new THREE.MeshStandardMaterial({
    color: 0xf1deb0,
    map: map ?? undefined,
    roughness: 0.86,
    metalness: 0,
  });
};

const materialFor = (color: number, transparent = false, opacity = 1, kind?: 'wood' | 'fabric' | 'metal' | 'glass' | 'parchment') => {
  if (kind === 'wood') return makeWoodMaterial(color);
  if (kind === 'fabric') return makeFabricMaterial(color);
  if (kind === 'parchment') return makeParchmentMaterial();
  if (kind === 'metal') {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.28,
      metalness: 0.85,
    });
  }
  if (kind === 'glass') {
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity,
      transmission: 0.25,
      thickness: 0.08,
    });
  }
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.72,
    metalness: color === 0xd8a23a ? 0.55 : 0.08,
    transparent,
    opacity,
  });
};

const makeMaterial = (color: number, transparent = false, opacity = 1) => (
  materialFor(color, transparent, opacity)
);

const addBoxPart = (
  group: THREE.Group,
  name: string,
  size: SceneVec3,
  position: SceneVec3,
  color: number,
  transparent = false,
  opacity = 1,
  kind?: 'wood' | 'fabric' | 'metal' | 'glass' | 'parchment',
  radius?: number,
) => {
  const minSize = Math.min(...size);
  const geometry = radius === 0
    ? new THREE.BoxGeometry(...size)
    : new RoundedBoxGeometry(size[0], size[1], size[2], 4, Math.min(radius ?? minSize * 0.12, minSize * 0.45));
  const mesh = new THREE.Mesh(geometry, materialFor(color, transparent, opacity, kind));
  mesh.name = `${group.name}_${name}`;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
};

const addCylinderPart = (
  group: THREE.Group,
  name: string,
  radius: number,
  height: number,
  position: SceneVec3,
  color: number,
  rotation: SceneVec3 = [0, 0, 0],
  kind?: 'wood' | 'fabric' | 'metal' | 'glass' | 'parchment',
) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32), materialFor(color, false, 1, kind));
  mesh.name = `${group.name}_${name}`;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
};

const addSpherePart = (
  group: THREE.Group,
  name: string,
  radius: number,
  position: SceneVec3,
  color: number,
  scale: SceneVec3 = [1, 1, 1],
  kind?: 'wood' | 'fabric' | 'metal' | 'glass' | 'parchment',
) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 18), materialFor(color, false, 1, kind));
  mesh.name = `${group.name}_${name}`;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
};

const addTorusPart = (
  group: THREE.Group,
  name: string,
  radius: number,
  tube: number,
  position: SceneVec3,
  color: number,
  rotation: SceneVec3 = [0, 0, 0],
  kind?: 'wood' | 'fabric' | 'metal' | 'glass' | 'parchment',
) => {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 16, 64), materialFor(color, false, 1, kind));
  mesh.name = `${group.name}_${name}`;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
};

const addTorusArcPart = (
  group: THREE.Group,
  name: string,
  radius: number,
  tube: number,
  arc: number,
  position: SceneVec3,
  color: number,
  rotation: SceneVec3 = [0, 0, 0],
  kind?: 'wood' | 'fabric' | 'metal' | 'glass' | 'parchment',
) => {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 16, 64, arc), materialFor(color, false, 1, kind));
  mesh.name = `${group.name}_${name}`;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
};

const createDetailedGroup = (obj: BuildableObject): THREE.Group => {
  const group = new THREE.Group();
  group.name = obj.id;
  group.position.set(...obj.position);
  group.rotation.set(...(obj.rotation ?? [0, 0, 0]));

  const [sx, sy, sz] = obj.size;
  const wood = 0x7b4a26;
  const darkWood = 0x4d2d18;
  const cream = 0xffe7bd;
  const brass = 0xd8a23a;
  const teal = 0x1f8f93;
  const orange = 0xf47b20;

  switch (obj.id) {
    case 'BED_Main_01':
      addBoxPart(group, 'WoodFrame', [sx, 0.18, sz], [0, -0.18, 0], darkWood, false, 1, 'wood');
      addBoxPart(group, 'Mattress_Cream', [sx * 0.92, 0.22, sz * 0.88], [0, 0.02, 0], cream, false, 1, 'fabric');
      addBoxPart(group, 'Blanket_Orange', [sx * 0.78, 0.12, sz * 0.55], [0, 0.22, 0.18], obj.color, false, 1, 'fabric');
      addBoxPart(group, 'Pillow_Left', [sx * 0.34, 0.14, sz * 0.2], [-sx * 0.22, 0.25, -sz * 0.3], 0xfff1d1, false, 1, 'fabric');
      addBoxPart(group, 'Pillow_Right', [sx * 0.34, 0.14, sz * 0.2], [sx * 0.22, 0.25, -sz * 0.3], 0x6bc7d5, false, 1, 'fabric');
      break;
    case 'SOFA_Living_01':
      addBoxPart(group, 'Seat', [sx, sy * 0.35, sz * 0.78], [0, -sy * 0.22, 0], teal, false, 1, 'fabric');
      addBoxPart(group, 'Back', [sx, sy * 0.72, sz * 0.18], [0, sy * 0.02, sz * 0.32], 0x146b70, false, 1, 'fabric');
      addBoxPart(group, 'Arm_Left', [sx * 0.12, sy * 0.52, sz], [-sx * 0.55, -sy * 0.03, 0], 0x167a7f, false, 1, 'fabric');
      addBoxPart(group, 'Arm_Right', [sx * 0.12, sy * 0.52, sz], [sx * 0.55, -sy * 0.03, 0], 0x167a7f, false, 1, 'fabric');
      addBoxPart(group, 'Cushion_A', [sx * 0.38, sy * 0.18, sz * 0.32], [-sx * 0.22, sy * 0.05, -sz * 0.12], orange, false, 1, 'fabric');
      addBoxPart(group, 'Cushion_B', [sx * 0.38, sy * 0.18, sz * 0.32], [sx * 0.22, sy * 0.05, -sz * 0.12], cream, false, 1, 'fabric');
      break;
    case 'CHAIR_Desk_01':
    case 'CHAIR_Living_01':
      addBoxPart(group, 'Seat', [sx * 0.85, sy * 0.16, sz * 0.85], [0, -sy * 0.12, 0], obj.color, false, 1, obj.id === 'CHAIR_Desk_01' ? 'wood' : 'fabric');
      addBoxPart(group, 'Back', [sx * 0.82, sy * 0.62, sz * 0.12], [0, sy * 0.23, sz * 0.36], obj.id === 'CHAIR_Desk_01' ? 0xa35426 : 0xb88424, false, 1, obj.id === 'CHAIR_Desk_01' ? 'wood' : 'fabric');
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z], index) => {
        addCylinderPart(group, `Leg_${index + 1}`, sx * 0.045, sy * 0.42, [x * sx * 0.32, -sy * 0.42, z * sz * 0.32], darkWood, [0, 0, 0], 'wood');
      });
      break;
    case 'TABLE_Coffee_01':
      addCylinderPart(group, 'Top', sx * 0.5, sy * 0.12, [0, sy * 0.24, 0], obj.color, [0, 0, 0], 'wood');
      addCylinderPart(group, 'Pedestal', sx * 0.11, sy * 0.62, [0, -sy * 0.06, 0], darkWood, [0, 0, 0], 'wood');
      addCylinderPart(group, 'Base', sx * 0.32, sy * 0.08, [0, -sy * 0.38, 0], wood, [0, 0, 0], 'wood');
      break;
    case 'DESK_Navigation_01':
      addBoxPart(group, 'Top', [sx, sy * 0.12, sz], [0, sy * 0.28, 0], wood, false, 1, 'wood');
      addBoxPart(group, 'DrawerBank_Left', [sx * 0.25, sy * 0.56, sz * 0.85], [-sx * 0.34, -sy * 0.02, 0], darkWood, false, 1, 'wood');
      addBoxPart(group, 'DrawerBank_Right', [sx * 0.25, sy * 0.56, sz * 0.85], [sx * 0.34, -sy * 0.02, 0], darkWood, false, 1, 'wood');
      addBoxPart(group, 'OpenKneeSpace', [sx * 0.32, sy * 0.08, sz * 0.1], [0, sy * 0.05, -sz * 0.42], 0xc48a4a, false, 1, 'wood');
      [-0.42, 0, 0.42].forEach((x, index) => addCylinderPart(group, `BrassPull_${index + 1}`, 0.035, 0.08, [x * sx, sy * 0.12, -sz * 0.46], brass, [Math.PI / 2, 0, 0], 'metal'));
      break;
    case 'CUPBOARD_Kitchen_Upper_01':
    case 'CUPBOARD_Kitchen_Lower_01':
      addBoxPart(group, 'CabinetBox', [sx, sy, sz], [0, 0, 0], obj.color, false, 1, 'wood');
      addBoxPart(group, 'Door_Left', [sx * 0.47, sy * 0.92, sz * 0.08], [-sx * 0.25, 0, -sz * 0.52], 0xf0c889, false, 1, 'wood');
      addBoxPart(group, 'Door_Right', [sx * 0.47, sy * 0.92, sz * 0.08], [sx * 0.25, 0, -sz * 0.52], 0xf0c889, false, 1, 'wood');
      addCylinderPart(group, 'Handle_Left', 0.025, sy * 0.42, [-sx * 0.06, 0, -sz * 0.6], brass, [0, 0, 0], 'metal');
      addCylinderPart(group, 'Handle_Right', 0.025, sy * 0.42, [sx * 0.06, 0, -sz * 0.6], brass, [0, 0, 0], 'metal');
      break;
    case 'DRAWER_Kitchen_01':
    case 'DRAWER_Kitchen_02':
      addBoxPart(group, 'DrawerFace', [sx, sy, sz], [0, 0, 0], obj.color, false, 1, 'wood');
      addCylinderPart(group, 'BrassHandle', 0.025, sx * 0.52, [0, 0, -sz * 0.72], brass, [0, 0, Math.PI / 2], 'metal');
      break;
    case 'WARDROBE_Clothes_01':
      addBoxPart(group, 'WardrobeCase', [sx, sy, sz], [0, 0, 0], obj.color, false, 1, 'wood');
      addBoxPart(group, 'DoorPanel_Left', [sx * 0.45, sy * 0.9, sz * 0.06], [-sx * 0.24, 0, -sz * 0.52], 0xb0723c, false, 1, 'wood');
      addBoxPart(group, 'DoorPanel_Right', [sx * 0.45, sy * 0.9, sz * 0.06], [sx * 0.24, 0, -sz * 0.52], 0xb0723c, false, 1, 'wood');
      addCylinderPart(group, 'HangerRod', 0.025, sx * 0.74, [0, sy * 0.25, -sz * 0.58], brass, [0, 0, Math.PI / 2], 'metal');
      addBoxPart(group, 'HangingClothes_Orange', [sx * 0.18, sy * 0.4, 0.04], [-sx * 0.18, sy * 0.02, -sz * 0.62], orange, false, 1, 'fabric');
      addBoxPart(group, 'HangingClothes_Teal', [sx * 0.18, sy * 0.34, 0.04], [sx * 0.1, sy * 0.0, -sz * 0.62], teal, false, 1, 'fabric');
      break;
    case 'SHELF_Map_01':
      addBoxPart(group, 'BackPanel', [sx, sy, sz], [0, 0, 0], obj.color, false, 1, 'wood');
      [-0.32, 0, 0.32].forEach((y, index) => addBoxPart(group, `ShelfBoard_${index + 1}`, [sx * 1.25, 0.05, sz], [0, y * sy, 0], darkWood, false, 1, 'wood'));
      [-0.35, -0.18, 0.05, 0.24].forEach((z, index) => addBoxPart(group, `Book_${index + 1}`, [sx * 0.42, sy * 0.18, sz * 0.08], [-sx * 0.08, sy * 0.2, z * sz], [0xe36d2e, 0x2c8c8e, 0xf2c15f, 0xffe7bd][index], false, 1, 'fabric'));
      break;
    case 'ROOM_Window_Ocean_01':
      addBoxPart(group, 'Glass', [sx, sy, sz], [0, 0, 0], obj.color, true, obj.opacity ?? 0.58, 'glass', 0.02);
      addBoxPart(group, 'Frame_Top', [sx * 1.08, 0.08, 0.08], [0, sy * 0.52, 0.02], darkWood, false, 1, 'wood');
      addBoxPart(group, 'Frame_Bottom', [sx * 1.08, 0.08, 0.08], [0, -sy * 0.52, 0.02], darkWood, false, 1, 'wood');
      addBoxPart(group, 'Frame_Left', [0.08, sy * 1.08, 0.08], [-sx * 0.52, 0, 0.02], darkWood, false, 1, 'wood');
      addBoxPart(group, 'Frame_Right', [0.08, sy * 1.08, 0.08], [sx * 0.52, 0, 0.02], darkWood, false, 1, 'wood');
      addBoxPart(group, 'Mullion', [0.06, sy, 0.08], [0, 0, 0.03], darkWood, false, 1, 'wood');
      addTorusPart(group, 'BrassPortholeRing', sx * 0.35, 0.035, [0, 0, 0.08], brass, [0, 0, 0], 'metal');
      [-0.22, 0.22].forEach((x, index) => addCylinderPart(group, `BrassBolt_${index + 1}`, 0.028, 0.03, [x * sx, sy * 0.42, 0.12], brass, [Math.PI / 2, 0, 0], 'metal'));
      break;
    default:
      if (obj.id === 'PROP_Map_World_01') {
        addBoxPart(group, 'Parchment', [sx, sy, sz], [0, 0, 0], obj.color, false, 1, 'parchment', 0.015);
        addCylinderPart(group, 'TopRoll', 0.025, sx * 0.98, [0, 0.04, -sz * 0.47], darkWood, [0, 0, Math.PI / 2], 'wood');
        addCylinderPart(group, 'BottomRoll', 0.025, sx * 0.98, [0, 0.04, sz * 0.47], darkWood, [0, 0, Math.PI / 2], 'wood');
        [-0.25, 0.05, 0.28].forEach((x, index) => addBoxPart(group, `MapLine_${index + 1}`, [0.02, 0.012, sz * 0.7], [x * sx, 0.035, 0], 0x2c8c8e, false, 1, undefined, 0));
      } else if (obj.id === 'PROP_Telescope_01') {
        addCylinderPart(group, 'Tube', sx * 0.35, sz, [0, 0, 0], brass, [Math.PI / 2, 0, 0], 'metal');
        addCylinderPart(group, 'EyePiece', sx * 0.24, sz * 0.22, [0, 0, -sz * 0.58], darkWood, [Math.PI / 2, 0, 0], 'wood');
        addCylinderPart(group, 'Lens', sx * 0.42, sz * 0.12, [0, 0, sz * 0.58], 0x6bc7d5, [Math.PI / 2, 0, 0], 'glass');
      } else if (obj.id === 'PROP_Compass_01') {
        addCylinderPart(group, 'Base', sx * 0.5, sy, [0, 0, 0], brass, [0, 0, 0], 'metal');
        addCylinderPart(group, 'Glass', sx * 0.42, sy * 0.18, [0, sy * 0.58, 0], 0xadd8e6, [0, 0, 0], 'glass');
        addBoxPart(group, 'Needle', [sx * 0.85, sy * 0.25, sz * 0.08], [0, sy * 0.75, 0], 0xe36d2e, false, 1, 'metal');
        addTorusPart(group, 'CompassRim', sx * 0.46, 0.012, [0, sy * 0.66, 0], brass, [Math.PI / 2, 0, 0], 'metal');
      } else if (obj.id === 'PROP_Sextant_01') {
        addTorusArcPart(group, 'GraduatedArc', sx * 0.48, sx * 0.035, Math.PI * 1.25, [0, sy * 0.05, 0], brass, [Math.PI / 2, 0, Math.PI * 0.86], 'metal');
        addCylinderPart(group, 'IndexArm', sx * 0.025, sz * 0.95, [0, sy * 0.1, 0], brass, [Math.PI / 2, 0, -0.55], 'metal');
        addCylinderPart(group, 'SightTube', sx * 0.09, sz * 0.58, [sx * 0.22, sy * 0.18, -sz * 0.02], 0x5b371f, [Math.PI / 2, 0, 0.32], 'wood');
        addBoxPart(group, 'Mirror', [sx * 0.22, sy * 0.1, sz * 0.04], [-sx * 0.18, sy * 0.32, sz * 0.14], 0xbfe8ee, true, 0.62, 'glass', 0.01);
        [-0.28, -0.08, 0.12, 0.3].forEach((x, index) => addCylinderPart(group, `Tick_${index + 1}`, sx * 0.012, sy * 0.22, [x * sx, sy * 0.16, -sz * 0.24], brass, [0, 0, 0.25], 'metal'));
      } else if (obj.id === 'PROP_TangerineBowl_01') {
        addCylinderPart(group, 'Bowl', sx * 0.55, sy * 0.55, [0, -sy * 0.1, 0], 0xffe7bd);
        [-0.18, 0, 0.18].forEach((x, index) => addSpherePart(group, `Tangerine_${index + 1}`, sx * 0.22, [x * sx, sy * 0.35, (index - 1) * sz * 0.08], orange, [1, 0.9, 1]));
      } else if (obj.id === 'PROP_TreasureChest_01') {
        addBoxPart(group, 'ChestBase', [sx, sy * 0.62, sz], [0, -sy * 0.16, 0], 0x7b3f1f, false, 1, 'wood');
        addCylinderPart(group, 'RoundedLid', sx * 0.48, sz, [0, sy * 0.18, 0], 0x9b542a, [Math.PI / 2, 0, 0], 'wood');
        addBoxPart(group, 'BrassBand', [sx * 1.05, sy * 0.08, sz * 0.12], [0, sy * 0.1, -sz * 0.52], brass, false, 1, 'metal');
        addBoxPart(group, 'LockPlate', [sx * 0.18, sy * 0.2, sz * 0.05], [0, -sy * 0.05, -sz * 0.57], brass, false, 1, 'metal');
        [-0.32, 0.32].forEach((x, index) => addCylinderPart(group, `CornerStud_${index + 1}`, sx * 0.035, sz * 0.08, [x * sx, sy * 0.16, -sz * 0.57], brass, [Math.PI / 2, 0, 0], 'metal'));
      } else if (obj.id === 'PROP_DenDenMushi_01') {
        addSpherePart(group, 'Shell', sx * 0.45, [0, 0, 0], 0xf2b68f, [1.2, 0.75, 1]);
        addSpherePart(group, 'Head', sx * 0.28, [0, sy * 0.28, -sz * 0.32], 0xf7d0a7);
        addSpherePart(group, 'Eye_Left', sx * 0.06, [-sx * 0.14, sy * 0.43, -sz * 0.48], 0x111111);
        addSpherePart(group, 'Eye_Right', sx * 0.06, [sx * 0.14, sy * 0.43, -sz * 0.48], 0x111111);
        addCylinderPart(group, 'PhoneReceiver', sx * 0.12, sx * 0.9, [0, sy * 0.52, 0], 0x2c8c8e, [0, 0, Math.PI / 2], 'wood');
      } else if (obj.id === 'PROP_GoldCoinJar_01') {
        addCylinderPart(group, 'GlassJar', sx * 0.44, sy * 0.82, [0, 0, 0], 0xc8f4ff, [0, 0, 0], 'glass');
        addCylinderPart(group, 'BrassLid', sx * 0.48, sy * 0.12, [0, sy * 0.48, 0], brass, [0, 0, 0], 'metal');
        addCylinderPart(group, 'CoinStack', sx * 0.32, sy * 0.42, [0, -sy * 0.18, 0], brass, [0, 0, 0], 'metal');
        [-0.18, 0.05, 0.2].forEach((x, index) => addCylinderPart(group, `LooseCoin_${index + 1}`, sx * 0.12, sy * 0.035, [x * sx, sy * (0.02 + index * 0.08), (index - 1) * sz * 0.12], brass, [Math.PI / 2, 0, index * 0.5], 'metal'));
      } else if (obj.id === 'PROP_WeatherBook_01') {
        addBoxPart(group, 'PageBlock', [sx * 0.96, sy * 0.42, sz * 0.9], [0, -sy * 0.02, 0], 0xffefc6, false, 1, 'parchment', 0.01);
        addBoxPart(group, 'TealCover', [sx, sy * 0.2, sz], [0, sy * 0.22, 0], obj.color, false, 1, 'fabric', 0.012);
        addBoxPart(group, 'Spine', [sx * 0.12, sy * 0.32, sz * 1.04], [-sx * 0.5, sy * 0.12, 0], 0x174f58, false, 1, 'fabric', 0.01);
        addBoxPart(group, 'GoldTitlePlate', [sx * 0.38, sy * 0.05, sz * 0.24], [sx * 0.08, sy * 0.36, -sz * 0.14], brass, false, 1, 'metal', 0.006);
        [-0.22, 0, 0.22].forEach((z, index) => addBoxPart(group, `PageLine_${index + 1}`, [sx * 0.72, sy * 0.025, sz * 0.018], [sx * 0.08, sy * 0.34, z * sz], 0x5b756d, false, 1, undefined, 0));
      } else if (obj.id === 'PROP_TangerineTree_01') {
        addCylinderPart(group, 'Pot', sx * 0.32, sy * 0.28, [0, -sy * 0.36, 0], 0xb05a2a);
        addCylinderPart(group, 'Trunk', sx * 0.08, sy * 0.62, [0, -sy * 0.05, 0], darkWood, [0, 0, 0], 'wood');
        addSpherePart(group, 'Canopy', sx * 0.46, [0, sy * 0.28, 0], 0x2f8b4c, [1.15, 0.8, 1.1]);
        addSpherePart(group, 'Fruit_A', sx * 0.07, [-sx * 0.16, sy * 0.36, sz * 0.12], orange);
        addSpherePart(group, 'Fruit_B', sx * 0.07, [sx * 0.18, sy * 0.24, -sz * 0.08], orange);
      } else if (obj.id === 'PROP_Lantern_01') {
        addCylinderPart(group, 'Glass', sx * 0.36, sy * 0.65, [0, 0, 0], 0xffd577, [0, 0, 0], 'glass');
        addCylinderPart(group, 'Top', sx * 0.5, sy * 0.12, [0, sy * 0.42, 0], brass, [0, 0, 0], 'metal');
        addCylinderPart(group, 'Base', sx * 0.5, sy * 0.12, [0, -sy * 0.42, 0], brass, [0, 0, 0], 'metal');
        addCylinderPart(group, 'Handle', sx * 0.045, sy * 0.7, [0, sy * 0.66, 0], brass, [Math.PI / 2, 0, 0], 'metal');
      } else if (obj.id === 'PROP_KitchenUtensils_01') {
        addCylinderPart(group, 'CeramicCup', sx * 0.42, sy * 0.58, [0, -sy * 0.1, 0], 0xfff1d1);
        [-0.2, -0.06, 0.08, 0.22].forEach((x, index) => {
          const utensil = addCylinderPart(group, `Utensil_${index + 1}`, sx * 0.025, sy * 0.9, [x * sx, sy * 0.36, (index % 2 ? 0.08 : -0.08) * sz], index % 2 ? 0xc9d6d8 : brass, [0.18 * index, 0, 0.1 * index], index % 2 ? 'metal' : 'wood');
          addBoxPart(group, `${utensil.name}_Head`, [sx * 0.08, sy * 0.16, sz * 0.05], [x * sx, sy * 0.85, (index % 2 ? 0.08 : -0.08) * sz], index % 2 ? 0xc9d6d8 : brass, false, 1, 'metal', 0.006);
        });
      } else if (obj.id === 'PROP_CupsPlates_01') {
        [-0.18, 0.02].forEach((x, index) => addCylinderPart(group, `Plate_${index + 1}`, sx * 0.26, sy * 0.12, [x * sx, -sy * 0.05 + index * sy * 0.11, 0], 0xfff1d1));
        addCylinderPart(group, 'CupBody', sx * 0.18, sy * 0.75, [sx * 0.32, sy * 0.12, 0], 0x6bc7d5);
        addTorusPart(group, 'CupHandle', sx * 0.1, sx * 0.018, [sx * 0.47, sy * 0.1, 0], 0x6bc7d5, [0, Math.PI / 2, 0]);
      } else if (obj.id === 'PROP_Bottles_01') {
        [-0.25, 0, 0.24].forEach((x, index) => {
          const bottleColor = [0x2e8c92, 0xf47b20, 0x8bc6dd][index];
          addCylinderPart(group, `BottleBody_${index + 1}`, sx * (0.16 + index * 0.02), sy * (0.72 - index * 0.08), [x * sx, -sy * 0.04, 0], bottleColor, [0, 0, 0], 'glass');
          addCylinderPart(group, `BottleNeck_${index + 1}`, sx * 0.07, sy * 0.32, [x * sx, sy * 0.34, 0], bottleColor, [0, 0, 0], 'glass');
          addCylinderPart(group, `BottleCork_${index + 1}`, sx * 0.065, sy * 0.08, [x * sx, sy * 0.55, 0], 0x8a5529, [0, 0, 0], 'wood');
        });
      } else if (obj.type === 'prop' || obj.type === 'cushion') {
        addBoxPart(group, 'Body', [sx, sy, sz], [0, 0, 0], obj.color, obj.transparent, obj.opacity ?? 1, obj.type === 'cushion' ? 'fabric' : undefined);
      } else {
        addBoxPart(group, 'Body', [sx, sy, sz], [0, 0, 0], obj.color, obj.transparent, obj.opacity ?? 1);
      }
  }

  group.userData.aiScene = createEntry(obj);
  group.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    (child as THREE.Mesh).castShadow = obj.type !== 'floor' && obj.type !== 'wall' && obj.type !== 'zone';
    (child as THREE.Mesh).receiveShadow = true;
  });
  return group;
};

const createPrimitive = (obj: BuildableObject): THREE.Object3D => {
  if (obj.blueprintAsset) {
    const group = new THREE.Group();
    group.name = obj.id;
    group.position.set(...obj.position);
    group.rotation.set(...(obj.rotation ?? [0, 0, 0]));
    group.userData.aiScene = createEntry(obj);
    group.userData.blueprintAsset = {
      objectId: obj.id,
      url: obj.blueprintAsset.url,
      scale: obj.blueprintAsset.scale,
      offset: obj.blueprintAsset.offset ?? [0, 0, 0],
      rotation: obj.blueprintAsset.rotation ?? [0, 0, 0],
    } satisfies BlueprintSceneAsset;
    return group;
  }

  if (!['floor', 'wall', 'zone', 'rug', 'curtain'].includes(obj.type)) {
    return createDetailedGroup(obj);
  }

  let geometry: THREE.BufferGeometry;
  if (obj.shape === 'sphere') {
    geometry = new THREE.SphereGeometry(obj.size[0] * 0.5, 24, 16);
  } else if (obj.shape === 'cylinder') {
    geometry = new THREE.CylinderGeometry(obj.size[0] * 0.5, obj.size[0] * 0.5, obj.size[1], 24);
  } else {
    geometry = new THREE.BoxGeometry(...obj.size);
  }

  const primitiveKind = obj.type === 'floor' ? 'wood' : obj.type === 'rug' || obj.type === 'curtain' ? 'fabric' : undefined;
  const mesh = new THREE.Mesh(geometry, materialFor(obj.color, obj.transparent, obj.opacity, primitiveKind));
  mesh.name = obj.id;
  mesh.position.set(...obj.position);
  mesh.rotation.set(...(obj.rotation ?? [0, 0, 0]));
  mesh.castShadow = obj.type !== 'floor' && obj.type !== 'wall';
  mesh.receiveShadow = true;
  mesh.userData.aiScene = createEntry(obj);
  return mesh;
};

const add = (root: THREE.Group, registry: SceneObjectRegistryEntry[], obj: BuildableObject): THREE.Object3D => {
  const mesh = createPrimitive(obj);
  root.add(mesh);
  registry.push(mesh.userData.aiScene as SceneObjectRegistryEntry);
  return mesh;
};

const objects: BuildableObject[] = [
  { id: 'ROOM_Floor_Main', humanName: 'expanded blueprint-inspired teak floor', type: 'floor', zone: 'Room', position: [0, -0.05, 0], size: [11.2, 0.1, 8.2], color: 0xa96f3f, actions: ['walkOn', 'inspect'] },
  { id: 'ROOM_Window_Ocean_01', humanName: 'arched brass ocean window', type: 'window', zone: 'LivingRoom', position: [0.05, 1.68, -4.13], size: [3.1, 1.48, 0.06], color: 0x7dd7dc, transparent: true, opacity: 0.55, actions: ['inspect', 'lookOut', 'moveTo'], interactionPoints: { approach: [0.05, 0, -2.9], lookAt: [0.05, 1.72, -4.2] }, facingDirection: [0, 0, -1] },
  { id: 'ZONE_LivingRoom', humanName: 'living room location marker', type: 'zone', zone: 'LivingRoom', position: [0.75, 0.01, 1.05], size: [3.6, 0.02, 2.75], color: 0xffa64d, transparent: true, opacity: 0.08, actions: ['moveTo'], interactionPoints: { approach: [0.75, 0, 1.05], lookAt: [0.75, 0.9, 1.05] } },
  { id: 'ZONE_Kitchen', humanName: 'kitchen location marker', type: 'zone', zone: 'Kitchen', position: [3.72, 0.02, -2.35], size: [3.15, 0.02, 2.95], color: 0x34b8bd, transparent: true, opacity: 0.08, actions: ['moveTo'], interactionPoints: { approach: [3.72, 0, -1.18], lookAt: [3.72, 1.0, -2.5] } },
  { id: 'ZONE_Bedroom', humanName: 'bedroom location marker', type: 'zone', zone: 'Bedroom', position: [-3.48, 0.02, 1.58], size: [3.05, 0.02, 3.0], color: 0xf7d36b, transparent: true, opacity: 0.08, actions: ['moveTo'], interactionPoints: { approach: [-3.48, 0, 1.58], lookAt: [-3.48, 0.9, 1.58] } },
  { id: 'ZONE_NavigationDesk', humanName: 'navigation desk location marker', type: 'zone', zone: 'NavigationDesk', position: [-3.6, 0.02, -2.0], size: [3.0, 0.02, 2.7], color: 0xe36d2e, transparent: true, opacity: 0.08, actions: ['moveTo'], interactionPoints: { approach: [-3.6, 0, -1.45], lookAt: [-3.6, 0.9, -2.0] } },
  { id: 'ZONE_Fitness', humanName: 'treadmill fitness location marker', type: 'zone', zone: 'Fitness', position: [3.78, 0.02, 2.38], size: [2.35, 0.02, 2.25], color: 0x6bc7d5, transparent: true, opacity: 0.08, actions: ['moveTo'], interactionPoints: { approach: [3.78, 0, 2.38], lookAt: [3.78, 0.9, 2.38] } },
  { id: 'BED_Main_01', humanName: 'Blueprint3D modern upholstered bed', type: 'bed', zone: 'Bedroom', position: [-2.78, 0, 1.58], rotation: [0, Math.PI, 0], size: [1.95, 0.76, 1.62], color: 0xf47b20, interactionPoints: { sit: [-2.78, 0.58, 0.88], sleep: [-2.78, 0.62, 1.5], approach: [-2.78, 0, 0.42], lookAt: [-2.78, 0.95, 1.35] }, facingDirection: [0, 0, 1], blueprintAsset: { url: '/blueprint3d-assets/bed-1.glb', scale: 1.0 } },
  { id: 'SOFA_Living_01', humanName: 'Blueprint3D modern two-seater sofa', type: 'sofa', zone: 'LivingRoom', position: [1.23, 0, 1.72], rotation: [0, Math.PI, 0], size: [1.95, 0.86, 0.86], color: 0x167f86, interactionPoints: { sit: [1.23, 0.62, 1.46], approach: [1.23, 0, 0.66], lookAt: [1.23, 0.92, 1.95] }, facingDirection: [0, 0, 1], blueprintAsset: { url: '/blueprint3d-assets/sofa-10.glb', scale: 1.0 } },
  { id: 'TABLE_Coffee_01', humanName: 'GLB coffee table with dining furniture', type: 'table', zone: 'LivingRoom', position: [0.35, 0, 0.34], size: [1.5, 1.12, 2.2], color: 0x8f5a2c, shape: 'cylinder', interactionPoints: { approach: [0.35, 0, -0.92], lookAt: [0.35, 0.78, 0.34] }, blueprintAsset: { url: '/models/house-assets/dining-furniture.glb', scale: 0.63, offset: [0, -0.03, 0] } },
  { id: 'PROP_CoffeeCup_01', humanName: 'coffee cup on the coffee table', type: 'prop', zone: 'LivingRoom', position: [0.1, 0.78, -0.22], size: [0.18, 0.22, 0.18], color: 0x6bc7d5, actions: ['inspect', 'pickUp', 'moveTo'], interactionPoints: { approach: [0.35, 0, -0.92], lookAt: [0.1, 0.98, -0.22] } },
  { id: 'RUG_Tangerine_01', humanName: 'layered tangerine and teal rug', type: 'rug', zone: 'LivingRoom', position: [1.26, 0.015, 0.76], size: [2.55, 0.03, 1.9], color: 0xf2c15f, actions: ['inspect', 'moveTo'] },
  { id: 'DESK_Navigation_01', humanName: 'Blueprint3D oak writing desk', type: 'desk', zone: 'NavigationDesk', position: [-2.7, 0, -1.92], rotation: [0, Math.PI, 0], size: [1.85, 1.12, 0.74], color: 0x7b4a26, actions: ['inspect', 'moveTo', 'sit'], interactionPoints: { sit: [-2.7, 1.0, -1.92], approach: [-2.7, 0, -0.92], lookAt: [-2.7, 0.98, -1.92] }, facingDirection: [0, 0, 1], blueprintAsset: { url: '/blueprint3d-assets/drawer-6.glb', scale: 1.0 } },
  { id: 'CHAIR_Desk_01', humanName: 'Blueprint3D upholstered desk chair', type: 'chair', zone: 'NavigationDesk', position: [-2.7, 0, -1.15], rotation: [0, Math.PI, 0], size: [0.68, 0.92, 0.68], color: 0xd27839, interactionPoints: { sit: [-2.7, 0.62, -1.15], approach: [-2.7, 0, -0.4], lookAt: [-2.7, 0.98, -0.2] }, facingDirection: [0, 0, 1], blueprintAsset: { url: '/blueprint3d-assets/chair-2.glb', scale: 0.85 } },
  { id: 'CHAIR_Living_01', humanName: 'Blueprint3D orange corduroy lounge chair', type: 'chair', zone: 'LivingRoom', position: [2.82, 0, 0.32], rotation: [0, -Math.PI / 2, 0], size: [0.74, 0.9, 0.74], color: 0xd8a23a, interactionPoints: { sit: [2.82, 0.58, 0.32], approach: [2.18, 0, 0.32], lookAt: [2.82, 0.9, 0.32] }, facingDirection: [1, 0, 0], blueprintAsset: { url: '/blueprint3d-assets/armchair-19.glb', scale: 0.82 } },
  { id: 'KITCHEN_CornerUnit_01', humanName: 'GLB corner kitchen unit', type: 'cupboard', zone: 'Kitchen', position: [3.82, 0, -3.45], rotation: [0, Math.PI, 0], size: [2.55, 1.7, 1.15], color: 0xf3d7a4, actions: ['inspect', 'open', 'close', 'moveTo', 'use'], interactionPoints: { approach: [3.82, 0, -1.82], lookAt: [3.82, 1.18, -3.45] }, facingDirection: [0, 0, 1], blueprintAsset: { url: '/models/house-assets/corner-kitchen-unit.glb', scale: 0.72 } },
  { id: 'APPLIANCE_CoffeeMachine_01', humanName: 'coffee machine table in the kitchen', type: 'appliance', zone: 'Kitchen', position: [4.55, 0.02, -1.72], rotation: [0, Math.PI, 0], size: [0.65, 1.02, 1.8], color: 0x2f3236, actions: ['inspect', 'use', 'moveTo'], interactionPoints: { approach: [4.55, 0, -0.62], lookAt: [4.55, 1.02, -1.72] }, facingDirection: [0, 0, 1], blueprintAsset: { url: '/models/house-assets/coffee-machine.glb', scale: 0.45 } },
  { id: 'CUPBOARD_Kitchen_Upper_01', humanName: 'Blueprint3D sage display cupboard', type: 'cupboard', zone: 'Kitchen', position: [2.28, 1.58, -3.92], size: [1.4, 0.74, 0.42], color: 0xf3d7a4, interactionPoints: { approach: [2.28, 0, -2.9], lookAt: [2.28, 1.58, -3.92] }, facingDirection: [0, 0, -1], blueprintAsset: { url: '/blueprint3d-assets/storage-1.glb', scale: 0.52, offset: [0, -0.58, 0] } },
  { id: 'DRAWER_Kitchen_01', humanName: 'Blueprint3D left kitchen drawer unit', type: 'drawer', zone: 'Kitchen', position: [2.08, 0, -3.92], size: [0.62, 0.24, 0.09], color: 0x2cabb1, interactionPoints: { approach: [2.08, 0, -2.9], lookAt: [2.08, 0.85, -3.92] }, facingDirection: [0, 0, -1], blueprintAsset: { url: '/blueprint3d-assets/drawer-2.glb', scale: 0.32 } },
  { id: 'DRAWER_Kitchen_02', humanName: 'Blueprint3D right kitchen drawer unit', type: 'drawer', zone: 'Kitchen', position: [2.86, 0, -3.92], size: [0.62, 0.24, 0.09], color: 0x2cabb1, interactionPoints: { approach: [2.86, 0, -2.9], lookAt: [2.86, 0.85, -3.92] }, facingDirection: [0, 0, -1], blueprintAsset: { url: '/blueprint3d-assets/drawer-2.glb', scale: 0.32 } },
  { id: 'TREADMILL_Fitness_01', humanName: 'GLB treadmill', type: 'treadmill', zone: 'Fitness', position: [3.78, 0, 2.52], rotation: [0, Math.PI, 0], size: [0.9, 1.35, 2.1], color: 0x2f3236, actions: ['inspect', 'walkOn', 'runOn', 'moveTo'], interactionPoints: { approach: [3.78, 0, 2.52], lookAt: [3.78, 0.95, 1.8], run: [3.78, 0, 2.52] }, facingDirection: [0, 0, -1], blueprintAsset: { url: '/models/house-assets/treadmill.glb', scale: 0.009 } },
  { id: 'WARDROBE_Clothes_01', humanName: 'Blueprint3D modular open wardrobe', type: 'wardrobe', zone: 'Bedroom', position: [-5.02, 0, 1.2], rotation: [0, -Math.PI / 2, 0], size: [0.75, 2.0, 0.9], color: 0x9b6333, actions: ['inspect', 'open', 'close', 'moveTo'], interactionPoints: { approach: [-4.25, 0, 1.2], lookAt: [-5.02, 1.15, 1.2] }, facingDirection: [1, 0, 0], blueprintAsset: { url: '/blueprint3d-assets/wardrobe-2.glb', scale: 0.86 } },
  { id: 'SHELF_Map_01', humanName: 'Blueprint3D sage map and book display cabinet', type: 'shelf', zone: 'NavigationDesk', position: [-5.02, 0, -1.25], rotation: [0, -Math.PI / 2, 0], size: [0.28, 1.1, 1.45], color: 0x7a4b2a, actions: ['inspect', 'moveTo'], interactionPoints: { approach: [-4.25, 0, -1.25], lookAt: [-5.02, 0.9, -1.25] }, facingDirection: [1, 0, 0], blueprintAsset: { url: '/blueprint3d-assets/storage-1.glb', scale: 0.68 } },
  { id: 'PROP_Lantern_01', humanName: 'Blueprint3D wooden tripod floor lamp', type: 'lantern', zone: 'LivingRoom', position: [3.42, 0, -0.22], size: [0.55, 1.6, 0.55], color: 0xf2bd58, shape: 'cylinder', actions: ['inspect', 'toggleLight', 'moveTo'], interactionPoints: { approach: [2.72, 0, -0.22], lookAt: [3.42, 1.2, -0.22] }, blueprintAsset: { url: '/blueprint3d-assets/light-3.glb', scale: 0.85 } },
];

const activeNamiStudioObjectIds = new Set([
  'ROOM_Floor_Main',
  'ROOM_Window_Ocean_01',
  'ZONE_LivingRoom',
  'ZONE_Kitchen',
  'ZONE_Bedroom',
  'ZONE_NavigationDesk',
  'ZONE_Fitness',
  'BED_Main_01',
  'SOFA_Living_01',
  'TABLE_Coffee_01',
  'PROP_CoffeeCup_01',
  'RUG_Tangerine_01',
  'DESK_Navigation_01',
  'CHAIR_Desk_01',
  'CHAIR_Living_01',
  'CUPBOARD_Kitchen_Upper_01',
  'KITCHEN_CornerUnit_01',
  'APPLIANCE_CoffeeMachine_01',
  'DRAWER_Kitchen_01',
  'DRAWER_Kitchen_02',
  'TREADMILL_Fitness_01',
  'WARDROBE_Clothes_01',
  'SHELF_Map_01',
  'PROP_Lantern_01',
]);

export const createNamiStudioApartmentScene = (): { root: THREE.Group; registry: AiSceneRegistry } => {
  const root = new THREE.Group();
  root.name = 'SCENE_Nami_BlueprintStudio_AIReadable';
  const registryObjects: SceneObjectRegistryEntry[] = [];

  objects
    .filter((obj) => activeNamiStudioObjectIds.has(obj.id))
    .forEach((obj) => add(root, registryObjects, obj));

  for (let i = 0; i < 17; i += 1) {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(11.05, 0.012, 0.014),
      makeWoodMaterial(i % 2 === 0 ? 0x9d6538 : 0xb87947),
    );
    plank.name = `ROOM_Blueprint_Floor_Plank_${String(i + 1).padStart(2, '0')}`;
    plank.position.set(0, 0.012, -3.95 + i * 0.49);
    plank.receiveShadow = true;
    root.add(plank);
  }

  [
    ['ROOM_Blueprint_Trim_Back_Base', [11.05, 0.12, 0.08], [0, 0.08, -3.94]],
    ['ROOM_Blueprint_Trim_Left_Base', [0.08, 0.12, 8.1], [-5.34, 0.08, 0]],
    ['ROOM_Blueprint_Trim_Right_Base', [0.08, 0.12, 6.6], [5.34, 0.08, -0.75]],
    ['ROOM_Blueprint_Trim_Back_Top', [11.05, 0.1, 0.08], [0, 3.03, -3.94]],
  ].forEach(([name, size, position]) => {
    const trim = new THREE.Mesh(
      new RoundedBoxGeometry((size as number[])[0], (size as number[])[1], (size as number[])[2], 3, 0.025),
      makeWoodMaterial(0x684021),
    );
    trim.name = name as string;
    trim.position.set(...(position as SceneVec3));
    trim.castShadow = true;
    trim.receiveShadow = true;
    root.add(trim);
  });

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 2.7),
    new THREE.MeshBasicMaterial({
      color: 0x42b6c8,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
    }),
  );
  ocean.name = 'BG_BlueprintStudio_Ocean_View_01';
  ocean.position.set(0.05, 1.42, -4.23);
  root.add(ocean);

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 32, 16),
    new THREE.MeshBasicMaterial({ color: 0xff9a4f, transparent: true, opacity: 0.9 }),
  );
  sun.name = 'BG_BlueprintStudio_Sunset_Sun_01';
  sun.position.set(1.15, 1.96, -4.29);
  root.add(sun);

  const point = new THREE.PointLight(0xffbd68, 1.2, 5);
  point.name = 'LIGHT_Lantern_Warm_01';
  point.position.set(3.42, 1.3, -0.22);
  root.add(point);

  const sunsetKey = new THREE.DirectionalLight(0xff9d5f, 1.6);
  sunsetKey.name = 'LIGHT_BlueprintStudio_Sunset_Key_01';
  sunsetKey.position.set(2.5, 2.8, -3.7);
  sunsetKey.castShadow = true;
  root.add(sunsetKey);

  root.userData.aiSceneRegistry = {
    sceneId: 'nami_studio_apartment',
    displayName: 'Nami Blueprint3D Studio',
    units: 'meters',
    navmesh: {
      walkableAreas: [
        {
          id: 'NAV_Walkable_Main_01',
          polygon: [[-1.7, 0, -0.65], [1.8, 0, -0.65], [1.8, 0, 2.7], [-1.7, 0, 2.7]],
        },
        {
          id: 'NAV_Walkable_Kitchen_01',
          polygon: [[1.45, 0, -3.45], [4.95, 0, -3.45], [4.95, 0, -0.75], [1.45, 0, -0.75]],
        },
        {
          id: 'NAV_Walkable_Desk_01',
          polygon: [[-4.65, 0, -3.05], [-1.25, 0, -3.05], [-1.25, 0, -0.15], [-4.65, 0, -0.15]],
        },
        {
          id: 'NAV_Walkable_Fitness_01',
          polygon: [[2.55, 0, 1.2], [4.95, 0, 1.2], [4.95, 0, 3.55], [2.55, 0, 3.55]],
        },
      ],
      blockedObjectIds: registryObjects
        .filter((entry) => !['floor', 'zone', 'rug', 'wall', 'window', 'curtain'].includes(entry.type))
        .map((entry) => entry.id),
    },
    objects: registryObjects,
  } satisfies AiSceneRegistry;

  return { root, registry: root.userData.aiSceneRegistry as AiSceneRegistry };

};
