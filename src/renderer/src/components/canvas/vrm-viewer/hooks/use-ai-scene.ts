import React, { useCallback, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { 
  SeatedContactTarget, 
  SeatedRapierHarness, 
  WalkTarget, 
  SleepPoseTarget 
} from '../types';

export const useAiScene = (
  vrmRef: React.MutableRefObject<VRM | null>,
  glbBonesNormalizedRef: React.MutableRefObject<Map<string, THREE.Bone>>,
) => {
  const seatedContactRef = useRef<SeatedContactTarget | null>(null);
  const rapierModuleRef = useRef<any | null>(null);
  const rapierReadyRef = useRef(false);
  const rapierInitPromiseRef = useRef<Promise<void> | null>(null);
  const seatedRapierRef = useRef<SeatedRapierHarness | null>(null);
  const walkTargetRef = useRef<WalkTarget | null>(null);
  const sleepTargetRef = useRef<SleepPoseTarget | null>(null);
  
  const sceneObjectBaseTransformRef = useRef<Map<string, {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    visible: boolean;
  }>>(new Map());
  
  const lanternLitRef = useRef(true);
  const [isSleeping, setIsSleeping] = useState(false);
  const [isDancing, setIsDancing] = useState(false);
  const isSleepingRef = useRef(false);
  const isDancingRef = useRef(false);
  const isSpecialActionRef = useRef(false);
  const specialActionNameRef = useRef<string | null>(null);

  const ensureRapierReady = useCallback(() => {
    if (rapierReadyRef.current) return Promise.resolve();
    if (!rapierInitPromiseRef.current) {
      rapierInitPromiseRef.current = import('@dimforge/rapier3d-compat').then(async (mod) => {
        const rapier = (mod as any).default ?? mod;
        await rapier.init();
        rapierModuleRef.current = rapier;
        rapierReadyRef.current = true;
      });
    }
    return rapierInitPromiseRef.current;
  }, []);

  const createSeatedRapierHarness = useCallback((sitPoint: [number, number, number]) => {
    const rapier = rapierModuleRef.current;
    if (!rapier) return;
    const vrm = vrmRef.current;
    
    // Support both VRM and GLB hips
    const hips = vrm?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Hips)
      ?? glbBonesNormalizedRef.current.get('hips');
    
    if (!hips) return;

    const world = new rapier.World({ x: 0, y: -9.81, z: 0 });
    const pelvisDesc = rapier.RigidBodyDesc.dynamic().setTranslation(hips.position.x, sitPoint[1], hips.position.z);
    const pelvisBody = world.createRigidBody(pelvisDesc);
    const pelvisColliderDesc = rapier.ColliderDesc.ball(0.15);
    const pelvisCollider = world.createCollider(pelvisColliderDesc, pelvisBody);

    const seatColliderDesc = rapier.ColliderDesc.cuboid(0.5, 0.05, 0.5).setTranslation(sitPoint[0], sitPoint[1] - 0.05, sitPoint[2]);
    const seatCollider = world.createCollider(seatColliderDesc);

    const floorColliderDesc = rapier.ColliderDesc.cuboid(10, 0.05, 10).setTranslation(0, -0.05, 0);
    const floorCollider = world.createCollider(floorColliderDesc);

    seatedRapierRef.current = {
      world,
      pelvisBody,
      pelvisCollider,
      seatCollider,
      floorCollider,
      desiredPelvis: new THREE.Vector3(hips.position.x, sitPoint[1], hips.position.z),
    };
  }, [vrmRef, glbBonesNormalizedRef]);

  const disposeSeatedRapier = useCallback(() => {
    seatedRapierRef.current = null;
  }, []);

  return useMemo(() => ({
    seatedContactRef,
    rapierModuleRef,
    rapierReadyRef,
    seatedRapierRef,
    walkTargetRef,
    sleepTargetRef,
    sceneObjectBaseTransformRef,
    lanternLitRef,
    isSleeping, setIsSleeping,
    isDancing, setIsDancing,
    isSleepingRef,
    isDancingRef,
    isSpecialActionRef,
    specialActionNameRef,
    ensureRapierReady,
    createSeatedRapierHarness,
    disposeSeatedRapier,
  }), [
    isSleeping,
    isDancing,
    ensureRapierReady,
    createSeatedRapierHarness,
    disposeSeatedRapier
  ]);
};
