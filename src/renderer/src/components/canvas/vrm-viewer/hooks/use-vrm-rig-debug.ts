import React, { useCallback } from 'react';
import * as THREE from 'three';
import { Vec3 } from '../types';

export const useVrmRigDebug = (
  vrmRef: React.MutableRefObject<any>,
  glbModelRef: React.MutableRefObject<any>,
  glbBonesRef: React.MutableRefObject<Map<string, THREE.Bone>>,
  initialBoneTransformsRef: React.MutableRefObject<Map<string, { q: THREE.Quaternion; p: THREE.Vector3 }>>,
  setRigRotDeg: (val: Vec3) => void,
  setRigPos: (val: Vec3) => void,
) => {
  const getBoneNode = useCallback((boneKey: string): THREE.Object3D | null => {
    if (vrmRef.current?.humanoid) {
      return vrmRef.current.humanoid.getNormalizedBoneNode(boneKey) ?? null;
    }
    return glbBonesRef.current.get(boneKey) ?? null;
  }, [vrmRef, glbBonesRef]);

  const updateRigStateFromBone = useCallback((boneKey: string) => {
    const node = getBoneNode(boneKey);
    if (!node) return;
    setRigRotDeg({
      x: THREE.MathUtils.radToDeg(node.rotation.x),
      y: THREE.MathUtils.radToDeg(node.rotation.y),
      z: THREE.MathUtils.radToDeg(node.rotation.z),
    });
    setRigPos({
      x: node.position.x,
      y: node.position.y,
      z: node.position.z,
    });
  }, [getBoneNode, setRigRotDeg, setRigPos]);

  const applyRigToBone = useCallback((boneKey: string, rot: Vec3, pos: Vec3) => {
    const node = getBoneNode(boneKey);
    if (!node) return;
    node.rotation.set(
      THREE.MathUtils.degToRad(rot.x),
      THREE.MathUtils.degToRad(rot.y),
      THREE.MathUtils.degToRad(rot.z),
    );
    node.position.set(pos.x, pos.y, pos.z);
    node.updateMatrixWorld(true);
  }, [getBoneNode]);

  const resetBone = useCallback((boneKey: string) => {
    const node = getBoneNode(boneKey);
    const initial = initialBoneTransformsRef.current.get(boneKey);
    if (!node || !initial) return;
    node.quaternion.copy(initial.q);
    node.position.copy(initial.p);
    node.updateMatrixWorld(true);
    updateRigStateFromBone(boneKey);
  }, [getBoneNode, initialBoneTransformsRef, updateRigStateFromBone]);

  const resetAllBones = useCallback(() => {
    for (const [boneKey, initial] of initialBoneTransformsRef.current.entries()) {
      const node = getBoneNode(boneKey);
      if (!node) continue;
      node.quaternion.copy(initial.q);
      node.position.copy(initial.p);
      node.updateMatrixWorld(true);
    }
  }, [getBoneNode, initialBoneTransformsRef]);

  return {
    getBoneNode,
    updateRigStateFromBone,
    applyRigToBone,
    resetBone,
    resetAllBones,
  };
};
