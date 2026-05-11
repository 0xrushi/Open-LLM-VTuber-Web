import { useCallback, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { normalizeMixamoNodeName } from '../utils';

export const useVrmModel = () => {
  const vrmRef = useRef<VRM | null>(null);
  const glbModelRef = useRef<THREE.Object3D | null>(null);
  const roomModelRef = useRef<THREE.Object3D | null>(null);
  
  const glbBonesRef = useRef<Map<string, THREE.Bone>>(new Map());
  const glbBonesNormalizedRef = useRef<Map<string, THREE.Bone>>(new Map());
  const glbSkinnedMeshesRef = useRef<THREE.SkinnedMesh[]>([]);
  const modelBasePositionRef = useRef<THREE.Vector3 | null>(null);
  const rootOffsetRef = useRef<THREE.Vector3 | null>(null);
  
  const initialBoneTransformsRef = useRef<Map<string, { q: THREE.Quaternion; p: THREE.Vector3 }>>(new Map());
  const [rigBones, setRigBones] = useState<string[]>([]);
  const [rigModelStamp, setRigModelStamp] = useState(0);

  const rebuildGlbBoneIndices = useCallback((root: THREE.Object3D) => {
    const bonesByName = new Map<string, THREE.Bone>();
    const bonesByNorm = new Map<string, THREE.Bone>();
    const skinnedMeshes: THREE.SkinnedMesh[] = [];

    root.traverse((obj: THREE.Object3D) => {
      // @ts-ignore
      if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMeshes.push(obj as THREE.SkinnedMesh);
      }
    });

    const addBone = (bone: THREE.Bone) => {
      if (!bone?.name) return;
      if (!bonesByName.has(bone.name)) bonesByName.set(bone.name, bone);
      const norm = normalizeMixamoNodeName(bone.name).toLowerCase();
      if (!bonesByNorm.has(norm)) bonesByNorm.set(norm, bone);
    };

    let added = 0;
    for (const mesh of skinnedMeshes) {
      const skeleton = mesh.skeleton;
      if (!skeleton?.bones) continue;
      for (const bone of skeleton.bones) {
        addBone(bone);
        added += 1;
      }
    }

    if (added === 0) {
      root.traverse((obj: THREE.Object3D) => {
        if ((obj as THREE.Bone).isBone) addBone(obj as THREE.Bone);
      });
    }

    glbSkinnedMeshesRef.current = skinnedMeshes;
    glbBonesRef.current.clear();
    glbBonesNormalizedRef.current.clear();
    for (const [k, v] of bonesByName.entries()) glbBonesRef.current.set(k, v);
    for (const [k, v] of bonesByNorm.entries()) glbBonesNormalizedRef.current.set(k, v);
  }, []);

  const disposeObject = useCallback((obj: THREE.Object3D) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material: THREE.Material) => material.dispose());
      } else if (mesh.material) {
        mesh.material.dispose();
      }
    }
  }, []);

  const cleanupModels = useCallback((scene: THREE.Scene | null) => {
    if (!scene) return;
    
    if (vrmRef.current) {
      scene.remove(vrmRef.current.scene);
      vrmRef.current.scene.traverse(disposeObject);
      vrmRef.current = null;
    }
    
    if (glbModelRef.current) {
      scene.remove(glbModelRef.current);
      glbModelRef.current.traverse(disposeObject);
      glbModelRef.current = null;
    }

    if (roomModelRef.current) {
      scene.remove(roomModelRef.current);
      roomModelRef.current.traverse(disposeObject);
      roomModelRef.current = null;
    }

    glbBonesRef.current.clear();
    glbBonesNormalizedRef.current.clear();
    glbSkinnedMeshesRef.current = [];
    initialBoneTransformsRef.current.clear();
    setRigBones([]);
  }, [disposeObject]);

  return useMemo(() => ({
    vrmRef,
    glbModelRef,
    roomModelRef,
    glbBonesRef,
    glbBonesNormalizedRef,
    glbSkinnedMeshesRef,
    modelBasePositionRef,
    rootOffsetRef,
    initialBoneTransformsRef,
    rigBones,
    setRigBones,
    rigModelStamp,
    setRigModelStamp,
    rebuildGlbBoneIndices,
    cleanupModels,
    disposeObject,
  }), [
    rigBones,
    rigModelStamp,
    rebuildGlbBoneIndices,
    cleanupModels,
    disposeObject
  ]);
};
