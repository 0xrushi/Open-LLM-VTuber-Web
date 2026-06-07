import React, { useCallback } from 'react';
import * as THREE from 'three';
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { toaster } from '@/components/ui/toaster';
import {
  AiSceneRegistry,
  SceneObjectRegistryEntry,
} from '../../nami-studio-scene';
import {
  SeatedContactTarget,
  WalkTarget,
  SleepPoseTarget,
  ClipPlaybackOptions,
  LogicalBone
} from '../types';
import {
  SITTING_TALKING_FBX_URL,
  SITTING_TALKING_VRMA_URL,
  SLEEPING_FBX_URL,
  SLEEPING_VRMA_URL,
  KISS_FBX_URL,
  KISS_VRMA_URL,
  WALKING_FBX_URL,
  WALKING_VRMA_URL,
  DANCE_FBX_ANIMATIONS,
  DANCE_VRMA_ANIMATIONS,
  ANIMATION_HIERARCHY,
} from '../constants';
import { ACTION_GRAPH, AnimationLayer } from '../action-graph';

export const useVrmSceneActions = (
  vrmRef: React.MutableRefObject<VRM | null>,
  glbModelRef: React.MutableRefObject<THREE.Object3D | null>,
  roomModelRef: React.MutableRefObject<THREE.Object3D | null>,
  sceneRef: React.MutableRefObject<THREE.Scene | null>,
  controlsRef: React.MutableRefObject<any>,
  modelBasePositionRef: React.MutableRefObject<THREE.Vector3 | null>,
  seatedContactRef: React.MutableRefObject<SeatedContactTarget | null>,
  walkTargetRef: React.MutableRefObject<WalkTarget | null>,
  sleepTargetRef: React.MutableRefObject<SleepPoseTarget | null>,
  isSleepingRef: React.MutableRefObject<boolean>,
  isDancingRef: React.MutableRefObject<boolean>,
  isSpecialActionRef: React.MutableRefObject<boolean>,
  specialActionNameRef: React.MutableRefObject<string | null>,
  danceAudioRef: React.MutableRefObject<HTMLAudioElement | null>,
  kissAudioRef: React.MutableRefObject<HTMLAudioElement | null>,
  sceneObjectBaseTransformRef: React.MutableRefObject<Map<string, any>>,
  lanternLitRef: React.MutableRefObject<boolean>,
  stopPoseIdle: () => void,
  stopProcedural: () => void,
  stopAllAnimations: () => void,
  disposeSeatedRapier: () => void,
  ensureRapierReady: () => Promise<void>,
  createSeatedRapierHarness: (point: [number, number, number]) => void,
  playVrmRetargetedFbxFromUrl: (url: string, options?: ClipPlaybackOptions) => boolean,
  playMixamoFbxFromUrl: (url: string, options?: ClipPlaybackOptions) => void,
  playVrmaFromUrl: (url: string, options?: ClipPlaybackOptions, layer?: AnimationLayer) => Promise<void>,
  resetAllBones: () => void,
  playStateAnimFbx: (url: string) => void,
  startPoseIdle: (bones: LogicalBone[]) => void,
  avatarCalibrationKey?: string,
) => {
  const CALIBRATION_STORAGE_KEY = 'nami_pose_calibration_v1';
  const SLEEP_YAW_ALIGNMENT_OFFSET = -Math.PI / 2;

  type SitCalibration = {
    xOffset?: number;
    zOffset?: number;
    pelvisYOffset?: number;
  };

  type SleepCalibration = {
    xOffset?: number;
    zOffset?: number;
    surfaceYOffset?: number;
    hipsAboveSurfaceOffset?: number;
    yawOffset?: number;
    rootYOffset?: number;
  };

  type ObjectCalibration = {
    sit?: SitCalibration;
    sleep?: SleepCalibration;
  };

  type CalibrationProfile = {
    sceneId: string;
    avatarKey: string;
    objects: Record<string, ObjectCalibration>;
  };

  type CalibrationStore = {
    version: 1;
    profiles: Record<string, CalibrationProfile>;
  };

  type CalibratableObject = {
    id: string;
    humanName: string;
    hasSit: boolean;
    hasSleep: boolean;
  };

  const getSceneId = useCallback(() => {
    const registry = (window as any).__AI_SCENE_REGISTRY__ as AiSceneRegistry | undefined;
    return registry?.sceneId ?? 'default_scene';
  }, []);

  const getAvatarKey = useCallback(() => {
    const key = (avatarCalibrationKey ?? '').trim();
    if (key) return key;
    return vrmRef.current?.meta?.name ?? 'default_avatar';
  }, [avatarCalibrationKey, vrmRef]);

  const getProfileStorageKey = useCallback(() => (
    `${getSceneId()}::${getAvatarKey()}`
  ), [getSceneId, getAvatarKey]);

  const loadCalibrationStore = useCallback((): CalibrationStore => {
    try {
      const raw = localStorage.getItem(CALIBRATION_STORAGE_KEY);
      if (!raw) return { version: 1, profiles: {} };
      const parsed = JSON.parse(raw) as CalibrationStore;
      if (!parsed || typeof parsed !== 'object' || !parsed.profiles) {
        return { version: 1, profiles: {} };
      }
      return parsed;
    } catch {
      return { version: 1, profiles: {} };
    }
  }, []);

  const saveCalibrationStore = useCallback((store: CalibrationStore) => {
    localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(store));
  }, []);

  const getCurrentProfile = useCallback((): CalibrationProfile => {
    const store = loadCalibrationStore();
    const key = getProfileStorageKey();
    return store.profiles[key] ?? {
      sceneId: getSceneId(),
      avatarKey: getAvatarKey(),
      objects: {},
    };
  }, [loadCalibrationStore, getProfileStorageKey, getSceneId, getAvatarKey]);

  const setObjectCalibration = useCallback((objectId: string, calibration: ObjectCalibration) => {
    const store = loadCalibrationStore();
    const key = getProfileStorageKey();
    const current = store.profiles[key] ?? {
      sceneId: getSceneId(),
      avatarKey: getAvatarKey(),
      objects: {},
    };
    current.objects[objectId] = {
      ...(current.objects[objectId] ?? {}),
      ...calibration,
    };
    store.profiles[key] = current;
    saveCalibrationStore(store);
  }, [loadCalibrationStore, saveCalibrationStore, getProfileStorageKey, getSceneId, getAvatarKey]);

  const getObjectCalibration = useCallback((objectId: string): ObjectCalibration | null => {
    const profile = getCurrentProfile();
    return profile.objects[objectId] ?? null;
  }, [getCurrentProfile]);

  const listCalibratableObjects = useCallback((): CalibratableObject[] => {
    const registry = (window as any).__AI_SCENE_REGISTRY__ as AiSceneRegistry | undefined;
    if (!registry?.objects) return [];
    return registry.objects
      .filter((entry) => Boolean(entry.interactionPoints.sit || entry.interactionPoints.sleep))
      .map((entry) => ({
        id: entry.id,
        humanName: entry.humanName,
        hasSit: Boolean(entry.interactionPoints.sit),
        hasSleep: Boolean(entry.interactionPoints.sleep),
      }));
  }, []);

  const ACTION_CATEGORY_ALIASES: Record<string, string> = {
    sit_animation: 'sit',
    sitting: 'sit',
    talking_animation: 'talking',
    taunting: 'taunt',
    thinking_animation: 'thinking',
    fist_pump: 'fistpump',
    fistpump_animation: 'fistpump',
    stretch_yawn_shoulder: 'stretch',
    stretch_animation: 'stretch',
    dance_animation: 'dance',
  };

  const getCurrentModelRoot = useCallback(() => (
    vrmRef.current?.scene ?? glbModelRef.current
  ), [vrmRef, glbModelRef]);

  const getAiSceneObject = useCallback((objectId: string): SceneObjectRegistryEntry | null => {
    const registry = (window as any).__AI_SCENE_REGISTRY__ as AiSceneRegistry | undefined;
    return registry?.objects.find((entry) => entry.id === objectId) ?? null;
  }, []);

  const getSceneObject3D = useCallback((objectId: string): THREE.Object3D | null => {
    const object = roomModelRef.current?.getObjectByName(objectId)
      ?? sceneRef.current?.getObjectByName(objectId)
      ?? null;
    if (object && !sceneObjectBaseTransformRef.current.has(objectId)) {
      sceneObjectBaseTransformRef.current.set(objectId, {
        position: object.position.clone(),
        rotation: object.rotation.clone(),
        visible: object.visible,
      });
    }
    return object;
  }, [roomModelRef, sceneRef, sceneObjectBaseTransformRef]);

  const saveSitCalibration = useCallback((objectId: string, calibration: SitCalibration) => {
    const entry = getAiSceneObject(objectId);
    setObjectCalibration(objectId, { sit: calibration });
    toaster.create({
      title: 'Calibration saved',
      description: `Sit calibration saved for ${entry?.humanName ?? objectId}.`,
      type: 'success',
      duration: 2000,
    });
  }, [getAiSceneObject, setObjectCalibration]);

  const saveSleepCalibration = useCallback((objectId: string, calibration: SleepCalibration) => {
    const entry = getAiSceneObject(objectId);
    setObjectCalibration(objectId, { sleep: calibration });
    toaster.create({
      title: 'Calibration saved',
      description: `Sleep calibration saved for ${entry?.humanName ?? objectId}.`,
      type: 'success',
      duration: 2000,
    });
  }, [getAiSceneObject, setObjectCalibration]);

  const captureSitCalibrationFromCurrentPose = useCallback(() => {
    const seated = seatedContactRef.current;
    const root = getCurrentModelRoot();
    if (!seated || !root) {
      toaster.create({
        title: 'No active sit pose',
        description: 'Run a sit action first, then capture calibration.',
        type: 'error',
        duration: 2200,
      });
      return false;
    }
    const entry = getAiSceneObject(seated.objectId);
    const baseSit = entry?.interactionPoints?.sit;
    if (!entry || !baseSit) {
      toaster.create({
        title: 'Sit target unavailable',
        description: 'Could not find sit target calibration point.',
        type: 'error',
        duration: 2200,
      });
      return false;
    }
    const calibration: SitCalibration = {
      xOffset: Number((root.position.x - baseSit[0]).toFixed(3)),
      zOffset: Number((root.position.z - baseSit[2]).toFixed(3)),
      pelvisYOffset: Number((seated.targetPelvisY - baseSit[1]).toFixed(3)),
    };
    saveSitCalibration(seated.objectId, calibration);
    return true;
  }, [seatedContactRef, getCurrentModelRoot, getAiSceneObject, saveSitCalibration]);

  const captureSleepCalibrationFromCurrentPose = useCallback(() => {
    const sleeping = sleepTargetRef.current;
    const root = getCurrentModelRoot();
    if (!sleeping || !root) {
      toaster.create({
        title: 'No active sleep pose',
        description: 'Run a sleep action first, then capture calibration.',
        type: 'error',
        duration: 2200,
      });
      return false;
    }
    const entry = getAiSceneObject(sleeping.objectId);
    const baseSleep = entry?.interactionPoints?.sleep ?? entry?.interactionPoints?.sit;
    if (!entry || !baseSleep) {
      toaster.create({
        title: 'Sleep target unavailable',
        description: 'Could not find sleep target calibration point.',
        type: 'error',
        duration: 2200,
      });
      return false;
    }
    const defaultYaw = (vrmRef.current?.meta?.metaVersion === '0' ? Math.PI : 0)
      + entry.rotation[1]
      + SLEEP_YAW_ALIGNMENT_OFFSET;
    const calibration: SleepCalibration = {
      xOffset: Number((sleeping.rootX - baseSleep[0]).toFixed(3)),
      zOffset: Number((sleeping.rootZ - baseSleep[2]).toFixed(3)),
      surfaceYOffset: Number((sleeping.surfaceY - baseSleep[1]).toFixed(3)),
      rootYOffset: Number((sleeping.rootY - sleeping.surfaceY).toFixed(3)),
      yawOffset: Number((sleeping.rootYaw - defaultYaw).toFixed(3)),
    };
    saveSleepCalibration(sleeping.objectId, calibration);
    return true;
  }, [sleepTargetRef, getCurrentModelRoot, getAiSceneObject, vrmRef, saveSleepCalibration]);

  const exportCurrentCalibrationProfile = useCallback(async () => {
    const profile = getCurrentProfile();
    try {
      await navigator.clipboard.writeText(JSON.stringify(profile, null, 2));
      toaster.create({
        title: 'Calibration exported',
        description: 'Copied current scene/avatar calibration JSON.',
        type: 'success',
        duration: 2200,
      });
    } catch {
      toaster.create({
        title: 'Export failed',
        description: 'Could not copy calibration JSON to clipboard.',
        type: 'error',
        duration: 2200,
      });
    }
  }, [getCurrentProfile]);

  const focusCameraOnSceneObject = useCallback((entry: SceneObjectRegistryEntry) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const lookAt = entry.interactionPoints.lookAt ?? entry.position;
    controls.target.set(lookAt[0], lookAt[1], lookAt[2]);
    const camera = controls.object as THREE.Camera;
    camera.position.set(lookAt[0] + 1.8, lookAt[1] + 0.8, lookAt[2] + 2.2);
    camera.updateProjectionMatrix();
    controls.update();
  }, [controlsRef]);

  const moveAvatarToSceneObject = useCallback((entry: SceneObjectRegistryEntry) => {
    const root = getCurrentModelRoot();
    if (!root) return false;
    const point = entry.interactionPoints.approach ?? entry.position;
    const lookAt = entry.interactionPoints.lookAt ?? entry.position;
    seatedContactRef.current = null;
    disposeSeatedRapier();
    root.position.set(point[0], point[1], point[2]);
    const baseRotY = vrmRef.current?.meta?.metaVersion === '0' ? Math.PI : 0;
    root.rotation.y = baseRotY + Math.atan2(lookAt[0] - point[0], lookAt[2] - point[2]);
    root.updateMatrixWorld(true);
    modelBasePositionRef.current = root.position.clone();
    return true;
  }, [getCurrentModelRoot, vrmRef, seatedContactRef, disposeSeatedRapier, modelBasePositionRef]);

  const sitOnSceneObject = useCallback((objectId: string) => {
    console.log('[VrmViewer] Attempting to sit on:', objectId);
    const target = getAiSceneObject(objectId);
    const root = getCurrentModelRoot();
    const sitPoint = target?.interactionPoints?.sit;

    if (!target || !sitPoint || !root || !target.actions.includes('sit')) {
      console.warn('[VrmViewer] Cannot sit:', { target, sitPoint, root, actions: target?.actions });
      toaster.create({
        title: 'Cannot sit there',
        description: target ? `${target.humanName} has no sit point.` : `Object ${objectId} was not found.`,
        type: 'error',
        duration: 2500,
      });
      return;
    }

    const sitCalibration = getObjectCalibration(objectId)?.sit;
    const adjustedSitPoint: [number, number, number] = [
      sitPoint[0] + (sitCalibration?.xOffset ?? 0),
      sitPoint[1] + (sitCalibration?.pelvisYOffset ?? 0),
      sitPoint[2] + (sitCalibration?.zOffset ?? 0),
    ];

    console.log('[VrmViewer] Sitting point found:', adjustedSitPoint);
    const baseRotY = vrmRef.current?.meta?.metaVersion === '0' ? Math.PI : 0;
    const [fx, , fz] = target.facingDirection;
    const facingYaw = Math.atan2(fx, fz);
    const seatedYaw = baseRotY + facingYaw;
    const rootStart = root.position.clone();
    const startYaw = root.rotation.y;
    const shouldBlendIntoSeat = rootStart.distanceTo(new THREE.Vector3(adjustedSitPoint[0], rootStart.y, adjustedSitPoint[2])) < 1.25;
    if (!shouldBlendIntoSeat) {
      root.position.set(adjustedSitPoint[0], rootStart.y, adjustedSitPoint[2]);
      root.rotation.y = seatedYaw;
    }
    root.updateMatrixWorld(true);
    if (modelBasePositionRef.current) {
      modelBasePositionRef.current.copy(root.position);
    }

    stopPoseIdle();
    stopProcedural();
    isSleepingRef.current = false;
    if (danceAudioRef.current) {
      danceAudioRef.current.pause();
      danceAudioRef.current.currentTime = 0;
    }
    disposeSeatedRapier();
    seatedContactRef.current = {
      objectId,
      targetPelvisY: adjustedSitPoint[1],
      standPosition: target.interactionPoints.approach ?? [adjustedSitPoint[0], 0, adjustedSitPoint[2] + 0.7],
      rootStartX: shouldBlendIntoSeat ? rootStart.x : adjustedSitPoint[0],
      rootStartZ: shouldBlendIntoSeat ? rootStart.z : adjustedSitPoint[2],
      rootStartYaw: shouldBlendIntoSeat ? startYaw : seatedYaw,
      rootX: adjustedSitPoint[0],
      rootZ: adjustedSitPoint[2],
      rootYaw: seatedYaw,
      settleStartTime: performance.now() / 1000,
      settleDuration: shouldBlendIntoSeat ? 0.75 : 0.2,
    };

    ensureRapierReady().then(() => {
      if (seatedContactRef.current?.objectId !== objectId) return;
      console.log('[VrmViewer] Creating Rapier harness for sitting');
      createSeatedRapierHarness(adjustedSitPoint);
    });

    const startSeatedIdle = () => {
      if (seatedContactRef.current?.objectId !== objectId) return;
      startPoseIdle([
        'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
        'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
        'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
      ]);
    };

    const sittingPlayback: ClipPlaybackOptions = {
      loopOnce: true,
      clampWhenFinished: true,
      includeHipsRotation: true,
      disableZRollStripping: true,
      onSettled: startSeatedIdle,
    };
    const sitCategory = ANIMATION_HIERARCHY.sit;
    const sitVrmaPool = sitCategory?.vrma?.length ? sitCategory.vrma : [SITTING_TALKING_VRMA_URL];
    const sitFbxPool = sitCategory?.fbx?.length ? sitCategory.fbx : [SITTING_TALKING_FBX_URL];

    if (vrmRef.current) {
      const randomSitVrma = sitVrmaPool[Math.floor(Math.random() * sitVrmaPool.length)];
      void playVrmaFromUrl(randomSitVrma);
    } else {
      const randomSitFbx = sitFbxPool[Math.floor(Math.random() * sitFbxPool.length)];
      const didUseVrmRetarget = playVrmRetargetedFbxFromUrl(randomSitFbx, sittingPlayback);
      if (!didUseVrmRetarget) {
        playMixamoFbxFromUrl(randomSitFbx, sittingPlayback);
      }
    }

    toaster.create({
      title: 'Scene action',
      description: `Sitting on ${target.humanName}.`,
      type: 'success',
      duration: 1800,
    });
  }, [getAiSceneObject, getCurrentModelRoot, vrmRef, modelBasePositionRef, stopPoseIdle, stopProcedural, isSleepingRef, disposeSeatedRapier, seatedContactRef, ensureRapierReady, createSeatedRapierHarness, playVrmRetargetedFbxFromUrl, playMixamoFbxFromUrl, playVrmaFromUrl, startPoseIdle, danceAudioRef, getObjectCalibration]);

  const sleepOnSceneObject = useCallback((objectId: string) => {
    const target = getAiSceneObject(objectId);
    const root = getCurrentModelRoot();
    const sleepPoint = target?.interactionPoints?.sleep ?? target?.interactionPoints?.sit;

    if (!target || !sleepPoint || !root || !target.actions.includes('sleep')) {
      toaster.create({
        title: 'Cannot sleep there',
        description: target ? `${target.humanName} has no sleep point.` : `Object ${objectId} was not found.`,
        type: 'error',
        duration: 2500,
      });
      return;
    }

    stopPoseIdle();
    stopProcedural();
    disposeSeatedRapier();
    seatedContactRef.current = null;
    sleepTargetRef.current = null;
    isSleepingRef.current = true;
    if (danceAudioRef.current) {
      danceAudioRef.current.pause();
      danceAudioRef.current.currentTime = 0;
    }

    const sleepCalibration = getObjectCalibration(objectId)?.sleep;
    const adjustedSleepPoint: [number, number, number] = [
      sleepPoint[0] + (sleepCalibration?.xOffset ?? 0),
      sleepPoint[1] + (sleepCalibration?.surfaceYOffset ?? 0),
      sleepPoint[2] + (sleepCalibration?.zOffset ?? 0),
    ];
    const baseRotY = vrmRef.current?.meta?.metaVersion === '0' ? Math.PI : 0;
    const sleepYaw = baseRotY + target.rotation[1] + SLEEP_YAW_ALIGNMENT_OFFSET + (sleepCalibration?.yawOffset ?? 0);

    // Start at surface level and let hips alignment settle refine exact root Y.
    const SLEEP_ROOT_TO_SURFACE_OFFSET = sleepCalibration?.rootYOffset ?? 0;
    const sleepRootY = adjustedSleepPoint[1] + SLEEP_ROOT_TO_SURFACE_OFFSET;
    root.position.set(adjustedSleepPoint[0], sleepRootY, adjustedSleepPoint[2]);
    root.rotation.y = sleepYaw;
    root.updateMatrixWorld(true);
    modelBasePositionRef.current = root.position.clone();

    sleepTargetRef.current = {
      objectId,
      rootX: adjustedSleepPoint[0],
      rootY: sleepRootY,
      rootZ: adjustedSleepPoint[2],
      rootYaw: sleepYaw,
      surfaceY: adjustedSleepPoint[1],
      hipsAboveSurfaceOffset: sleepCalibration?.hipsAboveSurfaceOffset ?? 0.1,
      standPosition: target.interactionPoints.approach ?? [adjustedSleepPoint[0], 0, adjustedSleepPoint[2] + 0.7],
    };

    const SLEEP_HIPS_ABOVE_SURFACE = sleepCalibration?.hipsAboveSurfaceOffset ?? 0.1;
    const sleepingPlayback: ClipPlaybackOptions = {
      loopOnce: true,
      clampWhenFinished: true,
      includeHipsRotation: true,
      hipsRotationMultiplier: 0.82,
      trunkBendMultiplier: 0.55,
      trunkPitchOffset: -0.65,
      holdFirstFrame: true,
      onSettled: () => {
        if (!isSleepingRef.current) return;
        const vrm = vrmRef.current;
        const pinnedRoot = getCurrentModelRoot();
        const sleepTarget = sleepTargetRef.current;
        if (!vrm || !pinnedRoot || !sleepTarget) return;

        // Correct root Y so the lying-pose hips lands on the bed surface.
        const hipsNode = vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Hips);
        if (hipsNode) {
          pinnedRoot.updateMatrixWorld(true);
          const hipsWorld = new THREE.Vector3();
          hipsNode.getWorldPosition(hipsWorld);
          const adjust = (adjustedSleepPoint[1] + SLEEP_HIPS_ABOVE_SURFACE) - hipsWorld.y;
          pinnedRoot.position.y += adjust;
          pinnedRoot.updateMatrixWorld(true);
          sleepTarget.rootY = pinnedRoot.position.y;
          if (modelBasePositionRef.current) modelBasePositionRef.current.copy(pinnedRoot.position);
        }

        // Reset spring bone simulation so arms/sleeves start from the posed position.
        vrm.springBoneManager?.reset();
      },
    };
    if (vrmRef.current) {
      void playVrmaFromUrl(SLEEPING_VRMA_URL, sleepingPlayback);
    } else {
      toaster.create({
        title: 'Sleep requires VRM',
        description: 'Sleep uses the VRMA animation and is only available for VRM avatars.',
        type: 'error',
        duration: 3000,
      });
    }

    toaster.create({
      title: 'Scene action',
      description: `Sleeping on ${target.humanName}.`,
      type: 'success',
      duration: 1800,
    });
  }, [getAiSceneObject, getCurrentModelRoot, vrmRef, stopPoseIdle, stopProcedural, disposeSeatedRapier, seatedContactRef, sleepTargetRef, isSleepingRef, modelBasePositionRef, playVrmaFromUrl, danceAudioRef, getObjectCalibration]);

  const startWalkingToSceneObject = useCallback((entry: SceneObjectRegistryEntry, onArrive?: () => boolean | void) => {
    const root = getCurrentModelRoot();
    if (!root) return false;
    const currentSeated = seatedContactRef.current;
    const currentSleep = sleepTargetRef.current;
    const standPosition = currentSeated?.standPosition ?? currentSleep?.standPosition ?? null;
    if (standPosition) {
      root.position.set(standPosition[0], standPosition[1], standPosition[2]);
      root.updateMatrixWorld(true);
      if (modelBasePositionRef.current) modelBasePositionRef.current.copy(root.position);
    }

    const point = entry.interactionPoints.approach ?? entry.position;
    const lookAt = entry.interactionPoints.lookAt ?? entry.position;
    const target = new THREE.Vector3(point[0], point[1], point[2]);
    const lookAtTarget = new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2]);

    seatedContactRef.current = null;
    isSleepingRef.current = false;
    stopPoseIdle();
    disposeSeatedRapier();
    walkTargetRef.current = {
      objectId: entry.id,
      position: target,
      lookAt: lookAtTarget,
      onArrive,
    };
    sleepTargetRef.current = null;

    const baseRotY = vrmRef.current?.meta?.metaVersion === '0' ? Math.PI : 0;
    root.rotation.y = baseRotY + Math.atan2(target.x - root.position.x, target.z - root.position.z);
    root.updateMatrixWorld(true);

    if (vrmRef.current) {
      playVrmaFromUrl(WALKING_VRMA_URL, { includeHipsPosition: false });
    } else {
      const didUseVrmRetarget = playVrmRetargetedFbxFromUrl(WALKING_FBX_URL);
      if (!didUseVrmRetarget) {
        playMixamoFbxFromUrl(WALKING_FBX_URL);
      }
    }
    return true;
  }, [getCurrentModelRoot, seatedContactRef, isSleepingRef, stopPoseIdle, disposeSeatedRapier, walkTargetRef, sleepTargetRef, vrmRef, playVrmRetargetedFbxFromUrl, playMixamoFbxFromUrl, playVrmaFromUrl]);

  const standFromSceneObject = useCallback(() => {
    const root = getCurrentModelRoot();
    const seatedContact = seatedContactRef.current;
    const sleepTarget = sleepTargetRef.current;
    const standPosition = seatedContact?.standPosition ?? sleepTarget?.standPosition ?? null;

    seatedContactRef.current = null;
    isSleepingRef.current = false;
    sleepTargetRef.current = null;
    disposeSeatedRapier();
    isDancingRef.current = false;
    if (danceAudioRef.current) {
      danceAudioRef.current.pause();
      danceAudioRef.current.currentTime = 0;
    }
    stopPoseIdle();
    stopProcedural();
    stopAllAnimations();
    resetAllBones();

    if (root) {
      if (standPosition) {
        root.position.set(standPosition[0], standPosition[1], standPosition[2]);
      } else if (modelBasePositionRef.current) {
        root.position.copy(modelBasePositionRef.current);
      } else {
        root.position.y = 0;
      }
      const baseRotY = vrmRef.current?.meta?.metaVersion === '0' ? Math.PI : 0;
      root.rotation.y = baseRotY;
      root.updateMatrixWorld(true);
      modelBasePositionRef.current = root.position.clone();
    }

    if (vrmRef.current?.humanoid) {
      playStateAnimFbx('/models/animations/Idle.fbx');
    }

    toaster.create({
      title: 'Scene action',
      description: 'Standing up.',
      type: 'success',
      duration: 1800,
    });
  }, [getCurrentModelRoot, seatedContactRef, sleepTargetRef, disposeSeatedRapier, isDancingRef, stopPoseIdle, stopProcedural, stopAllAnimations, resetAllBones, modelBasePositionRef, vrmRef, playStateAnimFbx, isSleepingRef, danceAudioRef]);

  const playRandomAnimation = useCallback((actionId: string, options?: ClipPlaybackOptions) => {
    const node = ACTION_GRAPH[actionId] || ACTION_GRAPH[ACTION_CATEGORY_ALIASES[actionId]];
    const resolvedCategory = node?.category ?? actionId;
    const layer = node?.layer ?? 'body';

    const cat = ANIMATION_HIERARCHY[resolvedCategory];
    if (!cat) {
      console.warn(`[VrmViewer] Animation category "${resolvedCategory}" not found.`);
      return;
    }

    const hasVrma = cat.vrma && cat.vrma.length > 0;
    const hasFbx = cat.fbx && cat.fbx.length > 0;

    if (!hasVrma && !hasFbx) {
      console.warn(`[VrmViewer] Animation category "${resolvedCategory}" has no animations.`);
      return;
    }

    const finalOptions = { ...options };
    if (node?.autoTrigger) {
      const originalSettled = options?.onSettled;
      finalOptions.onSettled = () => {
        originalSettled?.();
        console.log(`[VrmViewer] Auto-triggering ${node.autoTrigger} after ${actionId}`);
        // Small delay to ensure previous action cleanup
        setTimeout(() => {
          if (node.autoTrigger === 'idle') {
            playStateAnimFbx('/models/animations/Idle.fbx');
          } else {
            playRandomAnimation(node.autoTrigger!);
          }
        }, 50);
      };
    }

    if (vrmRef.current && hasVrma) {
      const url = cat.vrma![Math.floor(Math.random() * cat.vrma!.length)];
      void playVrmaFromUrl(url, finalOptions, (layer as AnimationLayer));
    } else if (hasFbx) {
      const url = cat.fbx![Math.floor(Math.random() * cat.fbx!.length)];
      if (vrmRef.current) {
        const didUseVrmRetarget = playVrmRetargetedFbxFromUrl(url, finalOptions);
        if (!didUseVrmRetarget) throw new Error(`[VrmViewer] Retargeted FBX unavailable for ${url}`);
      } else {
        playMixamoFbxFromUrl(url, finalOptions);
      }
    }
  }, [vrmRef, playVrmaFromUrl, playVrmRetargetedFbxFromUrl, playMixamoFbxFromUrl, playStateAnimFbx]);

  const playRandomDance = useCallback(() => {
    stopPoseIdle();
    stopProcedural();
    disposeSeatedRapier();
    seatedContactRef.current = null;
    sleepTargetRef.current = null;
    isSleepingRef.current = false;
    isDancingRef.current = true;

    if (danceAudioRef.current) {
      danceAudioRef.current.currentTime = 0;
      danceAudioRef.current.play().catch((e) => console.warn('[VrmViewer] Audio play failed:', e));
    }

    const playback: ClipPlaybackOptions = {
      loopOnce: false,
      includeHipsRotation: true,
      includeHipsPosition: true,
      disableZRollStripping: true,
      hipsRotationMultiplier: 1.0,
      hipsPositionMultiplier: 1.0,
      trunkBendMultiplier: 1.35,
    };

    playRandomAnimation('dance', playback);

    toaster.create({
      title: 'Dance',
      description: 'Dancing!',
      type: 'success',
      duration: 1800,
    });
  }, [stopPoseIdle, stopProcedural, disposeSeatedRapier, seatedContactRef, sleepTargetRef, isSleepingRef, isDancingRef, playRandomAnimation, danceAudioRef]);

  const playKiss = useCallback(() => {
    stopAllAnimations();
    stopPoseIdle();
    stopProcedural();
    disposeSeatedRapier();
    seatedContactRef.current = null;
    sleepTargetRef.current = null;
    isSleepingRef.current = false;
    isDancingRef.current = false;
    if (danceAudioRef.current) {
      danceAudioRef.current.pause();
      danceAudioRef.current.currentTime = 0;
    }
    if (kissAudioRef.current) {
      kissAudioRef.current.pause();
      kissAudioRef.current.currentTime = 0;
    }
    isSpecialActionRef.current = true;
    specialActionNameRef.current = 'kiss';

    if (kissAudioRef.current) {
      kissAudioRef.current.currentTime = 0;
      kissAudioRef.current.play().catch((e) => console.warn('[VrmViewer] Kiss audio play failed:', e));
    }

    const onSettled = () => {
      isSpecialActionRef.current = false;
      specialActionNameRef.current = null;
      startPoseIdle([
        'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
        'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
        'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
      ]);
    };

    const playback: ClipPlaybackOptions = {
      loopOnce: true,
      clampWhenFinished: true,
      includeHipsRotation: true,
      onSettled,
    };

    playRandomAnimation('kiss', playback);

    // For VRMA, we still need a timer because VRMA loader currently doesn't have an onSettled callback in some versions,
    // but the playRandomAnimation handles the URL selection. 
    // If it's VRM, we'll set a safety timeout to clear the special action state.
    if (vrmRef.current) {
      window.setTimeout(onSettled, 2400);
    }

    toaster.create({
      title: 'Scene action',
      description: 'Blowing a kiss.',
      type: 'success',
      duration: 1800,
    });
  }, [vrmRef, stopAllAnimations, stopPoseIdle, stopProcedural, disposeSeatedRapier, seatedContactRef, sleepTargetRef, isSleepingRef, isDancingRef, isSpecialActionRef, specialActionNameRef, playRandomAnimation, startPoseIdle, danceAudioRef, kissAudioRef]);

  const animateSceneObjectOpenState = useCallback((entry: SceneObjectRegistryEntry, open: boolean) => {
    const object = getSceneObject3D(entry.id);
    if (!object) return false;
    const base = sceneObjectBaseTransformRef.current.get(entry.id);
    if (!base) return false;

    object.visible = base.visible;
    object.position.copy(base.position);
    object.rotation.copy(base.rotation);

    const openAmount = open ? 1 : 0;
    if (entry.type === 'drawer') {
      object.position.z = base.position.z + (entry.facingDirection[2] || -1) * 0.38 * openAmount;
    } else if (entry.type === 'cupboard' || entry.type === 'wardrobe') {
      let animatedPanels = false;
      object.traverse((child: THREE.Object3D) => {
        if (child === object || !(child as THREE.Mesh).isMesh) return;
        const baseTransform = child.userData.openCloseBase ?? {
          position: child.position.clone(),
          rotation: child.rotation.clone(),
        };
        child.userData.openCloseBase = baseTransform;
        child.position.copy(baseTransform.position);
        child.rotation.copy(baseTransform.rotation);

        const name = child.name.toLowerCase();
        const isLeftPanel = name.includes('door_left') || name.includes('doorpanel_left');
        const isRightPanel = name.includes('door_right') || name.includes('doorpanel_right');
        if (!isLeftPanel && !isRightPanel) return;

        animatedPanels = true;
        const swing = (isLeftPanel ? -0.92 : 0.92) * openAmount;
        child.rotation.y = baseTransform.rotation.y + swing;
        child.position.x = baseTransform.position.x + (isLeftPanel ? -0.08 : 0.08) * openAmount;
        child.position.z = baseTransform.position.z - 0.06 * openAmount;
      });
      if (!animatedPanels) object.rotation.y = base.rotation.y + 0.85 * openAmount;
    } else if (entry.id === 'PROP_TreasureChest_01') {
      let animatedLid = false;
      object.traverse((child: THREE.Object3D) => {
        if (child === object || !(child as THREE.Mesh).isMesh || !child.name.toLowerCase().includes('roundedlid')) return;
        const baseTransform = child.userData.openCloseBase ?? {
          position: child.position.clone(),
          rotation: child.rotation.clone(),
        };
        child.userData.openCloseBase = baseTransform;
        child.position.copy(baseTransform.position);
        child.rotation.copy(baseTransform.rotation);
        child.rotation.x = baseTransform.rotation.x - 0.85 * openAmount;
        child.position.y = baseTransform.position.y + 0.08 * openAmount;
        child.position.z = baseTransform.position.z + 0.12 * openAmount;
        animatedLid = true;
      });
      if (!animatedLid) object.rotation.x = base.rotation.x - 0.75 * openAmount;
    } else {
      object.rotation.y = base.rotation.y + 0.55 * openAmount;
    }
    object.updateMatrixWorld(true);
    return true;
  }, [getSceneObject3D, sceneObjectBaseTransformRef]);

  const executeSceneObjectAction = useCallback((action: string, objectId: string) => {
    const entry = getAiSceneObject(objectId);
    if (!entry) {
      toaster.create({
        title: 'Scene action failed',
        description: `Object ${objectId} was not found.`,
        type: 'error',
        duration: 2500,
      });
      return;
    }

    const actionLabel = action === 'moveTo' ? 'Moving to' : action;
    const perform = () => {
      switch (action) {
        case 'moveTo':
          focusCameraOnSceneObject(entry);
          return false;
        case 'sit':
          sitOnSceneObject(entry.id);
          focusCameraOnSceneObject(entry);
          return true;
        case 'sleep':
        case 'lieDown':
          sleepOnSceneObject(entry.id);
          focusCameraOnSceneObject(entry);
          return true;
        case 'inspect':
        case 'read':
        case 'lookOut':
        case 'lookThrough':
        case 'use':
          focusCameraOnSceneObject(entry);
          return false;
        case 'walkOn':
        case 'runOn': {
          stopPoseIdle();
          stopProcedural();
          disposeSeatedRapier();
          seatedContactRef.current = null;
          sleepTargetRef.current = null;
          isSleepingRef.current = false;
          isDancingRef.current = false;
          if (danceAudioRef.current) {
            danceAudioRef.current.pause();
            danceAudioRef.current.currentTime = 0;
          }
          focusCameraOnSceneObject(entry);
          if (vrmRef.current) {
            void playVrmaFromUrl(WALKING_VRMA_URL, { includeHipsPosition: false });
          } else {
            const didUseVrmRetarget = playVrmRetargetedFbxFromUrl(WALKING_FBX_URL);
            if (!didUseVrmRetarget) {
              playMixamoFbxFromUrl(WALKING_FBX_URL);
            }
          }
          return true;
        }
        case 'open':
          animateSceneObjectOpenState(entry, true);
          focusCameraOnSceneObject(entry);
          return false;
        case 'close':
          animateSceneObjectOpenState(entry, false);
          focusCameraOnSceneObject(entry);
          return false;
        case 'pickUp': {
          const object = getSceneObject3D(entry.id);
          if (object) object.visible = false;
          return false;
        }
        case 'toggleLight': {
          lanternLitRef.current = !lanternLitRef.current;
          const object = getSceneObject3D(entry.id);
          const light = sceneRef.current?.getObjectByName('LIGHT_Lantern_Warm_01') as THREE.PointLight | undefined;
          if (light?.isPointLight) light.intensity = lanternLitRef.current ? 1.3 : 0.15;
          if (object && (object as THREE.Mesh).isMesh) {
            const mesh = object as THREE.Mesh;
            const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            if (material && 'emissive' in material) {
              (material as THREE.MeshStandardMaterial).emissive.setHex(lanternLitRef.current ? 0xf2bd58 : 0x000000);
            }
          }
          return false;
        }
        case 'call':
          focusCameraOnSceneObject(entry);
          return false;
        default:
          focusCameraOnSceneObject(entry);
          return false;
      }
    };

    const startedWalk = startWalkingToSceneObject(entry, perform);
    if (!startedWalk) {
      moveAvatarToSceneObject(entry);
      perform();
    }

    toaster.create({
      title: 'Scene action',
      description: `${actionLabel} ${entry.humanName}.`,
      type: 'success',
      duration: 1800,
    });
  }, [getAiSceneObject, focusCameraOnSceneObject, sitOnSceneObject, sleepOnSceneObject, stopPoseIdle, stopProcedural, disposeSeatedRapier, seatedContactRef, sleepTargetRef, isSleepingRef, isDancingRef, vrmRef, playVrmaFromUrl, playVrmRetargetedFbxFromUrl, playMixamoFbxFromUrl, animateSceneObjectOpenState, getSceneObject3D, lanternLitRef, sceneRef, startWalkingToSceneObject, moveAvatarToSceneObject, danceAudioRef]);

  return {
    getCurrentModelRoot,
    getAiSceneObject,
    getSceneObject3D,
    focusCameraOnSceneObject,
    moveAvatarToSceneObject,
    sitOnSceneObject,
    sleepOnSceneObject,
    startWalkingToSceneObject,
    bottomStand: standFromSceneObject,
    standFromSceneObject,
    playRandomAnimation,
    playRandomDance,
    playKiss,
    animateSceneObjectOpenState,
    executeSceneObjectAction,
    listCalibratableObjects,
    getObjectCalibration,
    saveSitCalibration,
    saveSleepCalibration,
    captureSitCalibrationFromCurrentPose,
    captureSleepCalibrationFromCurrentPose,
    exportCurrentCalibrationProfile,
    getActiveSitObjectId: () => seatedContactRef.current?.objectId ?? null,
    getActiveSleepObjectId: () => sleepTargetRef.current?.objectId ?? null,
  };
};
