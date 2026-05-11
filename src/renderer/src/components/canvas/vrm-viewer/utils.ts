import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { ClipPlaybackOptions } from './types';
import { MIXAMO_VRM_RIG_MAP } from './constants';

export const safeNumber = (value: number | undefined, fallback: number) => (
  Number.isFinite(value) ? Number(value) : fallback
);

export const normalizeMixamoNodeName = (raw: string): string => {
  let name = raw;
  const slashIdx = name.lastIndexOf('/');
  if (slashIdx >= 0) name = name.slice(slashIdx + 1);
  name = name.replace(/^[^:]+:/, '');
  name = name.replace(/^mixamorig/i, '');
  name = name.replace(/^_+/, '');
  return name;
};

export async function loadMixamoAnimForVRM(url: string, vrm: VRM, options?: ClipPlaybackOptions): Promise<THREE.AnimationClip> {
  console.log('[VrmUtils] loadMixamoAnimForVRM starting for:', url);
  const loader = new FBXLoader();
  const asset = await new Promise<THREE.Group>((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });

  const animations = (asset as any).animations as THREE.AnimationClip[];
  const clip = THREE.AnimationClip.findByName(animations, 'mixamo.com') ?? animations[0];
  if (!clip) {
    console.error('[VrmUtils] No clip found in FBX:', url);
    throw new Error('No animation clip found in FBX');
  }

  console.log('[VrmUtils] FBX clip found:', clip.name, 'duration:', clip.duration, 'tracks:', clip.tracks.length);
  const isVRM0 = vrm.meta?.metaVersion === '0';
  const tracks: THREE.KeyframeTrack[] = [];

  const restRotInv = new THREE.Quaternion();
  const parentRestWorldQuat = new THREE.Quaternion();
  const _q = new THREE.Quaternion();
  const _qe = new THREE.Euler(0, 0, 0, 'XYZ');
  const hipsRotationMultiplier = safeNumber(options?.hipsRotationMultiplier, 1.0);
  const hipsPositionMultiplier = safeNumber(options?.hipsPositionMultiplier, 1.0);
  const trunkBendMultiplier = safeNumber(options?.trunkBendMultiplier, 1.0);
  const trunkPitchOffset = safeNumber(options?.trunkPitchOffset, 0);
  const armRotationMultiplier = safeNumber(options?.armRotationMultiplier, 1.0);

  for (const track of clip.tracks) {
    const parts = track.name.split('.');
    const property = parts.pop();
    const mixamoRigName = parts.join('.');
    const normalizedRigName = normalizeMixamoNodeName(mixamoRigName);

    const vrmBoneName = MIXAMO_VRM_RIG_MAP[mixamoRigName]
      ?? MIXAMO_VRM_RIG_MAP[`mixamorig${normalizedRigName}`];
    if (!vrmBoneName) continue;

    const vrmNode = vrm.humanoid.getNormalizedBoneNode(vrmBoneName);
    const mixamoNode = asset.getObjectByName(mixamoRigName)
      ?? asset.getObjectByName(`mixamorig${normalizedRigName}`)
      ?? asset.getObjectByName(normalizedRigName)
      ?? asset.getObjectByProperty('name', mixamoRigName.split(':').pop() ?? mixamoRigName);
    if (!vrmNode || !mixamoNode) continue;
    if (!vrmNode.name) vrmNode.name = String(vrmBoneName);

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      // Keep hips rotation by default for natural weight shifts in idle.
      // Caller can explicitly disable it with includeHipsRotation: false.
      if (vrmBoneName === VRMHumanBoneName.Hips && options?.includeHipsRotation === false) continue;

      mixamoNode.getWorldQuaternion(restRotInv).invert();
      if (mixamoNode.parent) mixamoNode.parent.getWorldQuaternion(parentRestWorldQuat);
      else parentRestWorldQuat.identity();

      const isTrunkBone = (
        vrmBoneName === VRMHumanBoneName.Spine ||
        vrmBoneName === VRMHumanBoneName.Chest ||
        vrmBoneName === VRMHumanBoneName.UpperChest
      );
      const isArmBone = (
        vrmBoneName === VRMHumanBoneName.LeftShoulder
        || vrmBoneName === VRMHumanBoneName.LeftUpperArm
        || vrmBoneName === VRMHumanBoneName.LeftLowerArm
        || vrmBoneName === VRMHumanBoneName.RightShoulder
        || vrmBoneName === VRMHumanBoneName.RightUpperArm
        || vrmBoneName === VRMHumanBoneName.RightLowerArm
      );

      // Do not strip trunk Z-roll by default; only strip when explicitly requested.
      const shouldStripTrunkZRoll = options?.disableZRollStripping === false;
      const _euler = (isTrunkBone && shouldStripTrunkZRoll) ? new THREE.Euler() : null;
      const values = track.values.slice();
      for (let i = 0; i < values.length; i += 4) {
        _q.fromArray(values, i);
        _q.premultiply(parentRestWorldQuat).multiply(restRotInv);

        if (vrmBoneName === VRMHumanBoneName.Hips && hipsRotationMultiplier !== 1.0) {
          _qe.setFromQuaternion(_q, 'XYZ');
          _qe.x *= hipsRotationMultiplier;
          _qe.z *= hipsRotationMultiplier;
          _q.setFromEuler(_qe);
        }

        if (
          (trunkBendMultiplier !== 1.0 || trunkPitchOffset !== 0) &&
          (vrmBoneName === VRMHumanBoneName.Spine
            || vrmBoneName === VRMHumanBoneName.Chest
            || vrmBoneName === VRMHumanBoneName.UpperChest)
        ) {
          _qe.setFromQuaternion(_q, 'XYZ');
          _qe.x *= trunkBendMultiplier;
          _qe.x += trunkPitchOffset;
          _q.setFromEuler(_qe);
        }

        if (armRotationMultiplier !== 1.0 && isArmBone) {
          _qe.setFromQuaternion(_q, 'XYZ');
          _qe.x *= armRotationMultiplier;
          _q.setFromEuler(_qe);
        }

        if (_euler) {
          _euler.setFromQuaternion(_q, 'XYZ');
          _euler.z = 0;
          _q.setFromEuler(_euler);
        }
        _q.toArray(values, i);
      }

      const qTrack = new THREE.QuaternionKeyframeTrack(
        `${vrmNode.name}.quaternion`,
        track.times,
        isVRM0 ? values.map((v, i) => (i % 2 === 0 ? -v : v)) : values,
      );
      // Quaternion tracks only support linear interpolation in three.js.
      qTrack.setInterpolation(THREE.InterpolateLinear);
      tracks.push(qTrack);
    } else if (track instanceof THREE.VectorKeyframeTrack && property === 'position') {
      if (vrmBoneName === VRMHumanBoneName.Hips && options?.includeHipsPosition) {
        const values = track.values.slice();
        const x0 = values[0], y0 = values[1], z0 = values[2];
        const restY = vrmNode.position.y;
        
        // Refined hip scaling: reduce vertical intensity to prevent 'jumping'
        const rawScale = y0 > 0.1 ? (restY / y0) : 1.0;
        const hipScaleY = rawScale * 0.55; // More aggressive dampening for vertical movement
        const hipScaleXZ = rawScale * 0.85; // Keep more horizontal movement for "energy"

        for (let i = 0; i < values.length; i += 3) {
          values[i]     = (values[i]     - x0) * hipScaleXZ * hipsPositionMultiplier;
          values[i + 1] = restY + (values[i + 1] - y0) * hipScaleY;
          values[i + 2] = (values[i + 2] - z0) * hipScaleXZ * hipsPositionMultiplier;
        }
        const pTrack = new THREE.VectorKeyframeTrack(`${vrmNode.name}.position`, track.times, values);
        pTrack.setInterpolation(THREE.InterpolateSmooth);
        tracks.push(pTrack);
      }
      continue;
    }
  }

  if (tracks.length === 0) throw new Error(`No tracks retargeted from ${url}`);
  return new THREE.AnimationClip('vrm-state-anim', clip.duration, tracks);
}
