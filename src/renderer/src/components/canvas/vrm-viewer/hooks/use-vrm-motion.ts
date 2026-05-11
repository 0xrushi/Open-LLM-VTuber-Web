import React, { useCallback } from 'react';
import * as THREE from 'three';
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { VrmMotionMessage } from '../types';

export const useVrmMotion = (
  vrmRef: React.MutableRefObject<VRM | null>,
  glbModelRef: React.MutableRefObject<THREE.Object3D | null>,
  glbBonesRef: React.MutableRefObject<Map<string, THREE.Bone>>,
  rootOffsetRef: React.MutableRefObject<THREE.Vector3 | null>,
  flipHips: boolean,
  invertLegs: boolean,
  isVrmaPlaying: boolean,
) => {
  const applyMotionToAvatar = useCallback((motion: VrmMotionMessage) => {
    if (isVrmaPlaying) return;
    if (!motion?.bones || motion.bones.length === 0) return;
    
    const vrm = vrmRef.current;
    const glbModel = glbModelRef.current;
    const glbBones = glbBonesRef.current;

    const isVRM = vrm?.humanoid != null;
    const isGLB = glbModel != null && glbBones.size > 0;

    if (!isVRM && !isGLB) return;
    if (!isVRM && isGLB) return;

    if (isVRM && vrm.scene && !rootOffsetRef.current) {
      rootOffsetRef.current = vrm.scene.position.clone();
    } else if (isGLB && glbModel && !rootOffsetRef.current) {
      rootOffsetRef.current = glbModel.position.clone();
    }

    const isWorldQuat = motion.worldQuaternion === true;
    const parentWorldQuat = new THREE.Quaternion();
    const worldQuat = new THREE.Quaternion();
    const localQuat = new THREE.Quaternion();

    motion.bones.forEach((bone) => {
      if (!bone.name) return;
      
      let node: THREE.Object3D | null = null;
      let isHipsBone = false;
      let isLegBone = false;

      if (isVRM) {
        const normalizedName = bone.name.replace(/[\s_-]/g, '');
        const resolvedName =
          (VRMHumanBoneName as Record<string, VRMHumanBoneName>)[normalizedName as keyof typeof VRMHumanBoneName]
          || (bone.name as VRMHumanBoneName);
        node = vrm.humanoid?.getNormalizedBoneNode(resolvedName) || null;
        isHipsBone = resolvedName === VRMHumanBoneName.Hips;
        isLegBone = [
            VRMHumanBoneName.LeftUpperLeg, VRMHumanBoneName.LeftLowerLeg,
            VRMHumanBoneName.RightUpperLeg, VRMHumanBoneName.RightLowerLeg
        ].includes(resolvedName);
      } else if (isGLB) {
        const rpmName = bone.name;
        node = glbBones.get(rpmName) || null;
        isHipsBone = bone.name === 'hips';
        isLegBone = ['leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg'].includes(bone.name);
      }

      if (!node) return;

      if (bone.rotation) {
        let { x = 0, y = 0, z = 0, w } = bone.rotation;

        if (typeof w === 'number') {
            if ((flipHips && isHipsBone) || (invertLegs && isLegBone)) {
                const q = new THREE.Quaternion(x, y, z, w);
                const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
                if (flipHips && isHipsBone) {
                    e.y += Math.PI; e.x *= -1; e.z *= -1;
                }
                if (invertLegs && isLegBone) {
                    e.x *= -1;
                }
                q.setFromEuler(e);
                x = q.x; y = q.y; z = q.z; w = q.w;
            }
        }

        const targetQuat = new THREE.Quaternion();
        if (typeof w === 'number') {
          if (isWorldQuat && node.parent) {
            node.parent.getWorldQuaternion(parentWorldQuat);
            worldQuat.set(x, y, z, w).normalize();
            localQuat.copy(parentWorldQuat).invert().multiply(worldQuat);
            targetQuat.copy(localQuat);
          } else {
            targetQuat.set(x, y, z, w).normalize();
          }
        } else {
          const euler = new THREE.Euler(x, y, z, 'XYZ');
          targetQuat.setFromEuler(euler);
        }
        node.quaternion.slerp(targetQuat, 0.15);
      }

      if (bone.position) {
        const { x, y, z } = bone.position;
        const px = typeof x === 'number' ? x : 0;
        const py = typeof y === 'number' ? y : 0;
        const pz = typeof z === 'number' ? z : 0;

        if (isHipsBone && rootOffsetRef.current) {
          const base = rootOffsetRef.current;
          const rootObject = isVRM ? vrm.scene : glbModel;
          if (rootObject) {
            const targetPos = new THREE.Vector3(base.x + px, base.y + py, base.z + pz);
            rootObject.position.lerp(targetPos, 0.15);
          }
        } else {
           if (typeof x === 'number' || typeof y === 'number' || typeof z === 'number') {
               const targetPos = new THREE.Vector3(
                   typeof x === 'number' ? x : node.position.x,
                   typeof y === 'number' ? y : node.position.y,
                   typeof z === 'number' ? z : node.position.z
               );
               node.position.lerp(targetPos, 0.15);
           }
        }
      }
      node.updateMatrixWorld(true);
    });
  }, [flipHips, invertLegs, isVrmaPlaying, vrmRef, glbModelRef, glbBonesRef, rootOffsetRef]);

  return { applyMotionToAvatar };
};
