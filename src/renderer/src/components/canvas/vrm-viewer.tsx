import {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import * as THREE from 'three';
import { VRM, VRMUtils, VRMHumanBoneName, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

import { useLive2DConfig } from '@/context/live2d-config-context';
import { useAiState, AiStateEnum } from '@/context/ai-state-context';
import { toaster } from '@/components/ui/toaster';

import { VrmAnimationManager } from './vrm-viewer/vrm-animation-manager';
import { UiOverlay } from './vrm-viewer/components/ui-overlay';
import {
  useVrmScene,
  useVrmModel,
  useVrmAnimation,
  useVrmState,
  useProceduralMotion,
  useAiScene,
  useVrmRigDebug,
  useVrmLoadHandlers,
  useVrmSceneActions,
  useVrmMotion,
  useNamiStudioObjectDragSnap
} from './vrm-viewer/hooks';
import {
  FLOOR_SIT_CROSS_LEG_POSE_GLTF,
  WALKING_FBX_URL,
  WALKING_VRMA_URL,
  IDLE_VRMA_URL,
  THINKING_VRMA_URL,
  ANIMATION_HIERARCHY,
} from './vrm-viewer/constants';
import { ACTION_GRAPH } from './vrm-viewer/action-graph';
import {
  LogicalBone,
  Vec3,
} from './vrm-viewer/types';
import {
  createNamiAuthoredEnvironmentRegistry,
  createNamiStudioApartmentScene,
  BlueprintSceneAsset,
} from './nami-studio-scene';

const NAMI_AUTHORED_SCENE_GLB = '/models/environments/nami-authored-environment.glb';
const VRM_MOUTH_EXPRESSIONS = ['aa', 'ih', 'ou', 'ee', 'oh'];

const setVrmMouth = (vrm: VRM, aaValue: number) => {
  for (const expression of VRM_MOUTH_EXPRESSIONS) {
    vrm.expressionManager?.setValue(expression, expression === 'aa' ? aaValue : 0);
  }
};

interface VrmViewerProps {
  showControls?: boolean;
}

export const VrmViewer = memo(({ showControls = true }: VrmViewerProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<number>();
  const vrmAudioPlayingRef = useRef(false);
  const animationFrozenRef = useRef(false);
  const frozenRigOverridesRef = useRef<Map<string, { rotDeg: Vec3; pos: Vec3 }>>(new Map());
  const danceAudioRef = useRef<HTMLAudioElement | null>(null);
  const kissAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isAnimationFrozen, setIsAnimationFrozen] = useState(false);

  const { modelInfo } = useLive2DConfig();
  const { aiState } = useAiState();

  const normalizedConfig = useMemo(() => {
    if (!modelInfo) return null;
    const modelKey = `${modelInfo.name ?? ''} ${modelInfo.url ?? ''}`.toLowerCase();
    const isNamiModel = modelKey.includes('nami');
    const isVrmSceneModel = String(modelInfo.renderer ?? '').toLowerCase() === 'vrm'
      || /\.(vrm|glb|gltf)(\?|#|$)/i.test(modelInfo.url ?? '');
    const scenePreset = (modelInfo as any).scenePreset
      ?? (isNamiModel || isVrmSceneModel ? 'nami_studio_apartment' : undefined);
    const sceneGlb = (modelInfo as any).sceneGlb
      ?? (scenePreset === 'nami_studio_apartment' ? NAMI_AUTHORED_SCENE_GLB : undefined);
    return {
      url: modelInfo.url,
      scale: modelInfo.kScale ?? 1,
      x: modelInfo.initialXshift ?? 0,
      y: modelInfo.initialYshift ?? 0,
      cameraPosition: (modelInfo as any).cameraPosition ?? [0, 1.3, 3],
      cameraTarget: (modelInfo as any).cameraTarget ?? [0, 1.1, 0],
      autoRotate: (modelInfo as any).autoRotate ?? false,
      backgroundColor: (modelInfo as any).backgroundColor,
      sceneGlb,
      sceneGlbPosition: (modelInfo as any).sceneGlbPosition,
      sceneGlbRotation: (modelInfo as any).sceneGlbRotation,
      sceneGlbScale: (modelInfo as any).sceneGlbScale,
      scenePreset,
      vrmPosZ: (modelInfo as any).vrmPosZ ?? 0,
      vrmRotY: (modelInfo as any).vrmRotY ?? 0,
    };
  }, [modelInfo]);

  // Hooks
  const {
    sceneRef, rendererRef, cameraRef, controlsRef, setupScene, resize, cleanupScene
  } = useVrmScene();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          resize(width, height);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [resize]);

  useEffect(() => {
    danceAudioRef.current = new Audio('/audio/dance_music.wav');
    danceAudioRef.current.loop = true;
    kissAudioRef.current = new Audio('/audio/kiss.wav');
    return () => {
      if (danceAudioRef.current) {
        danceAudioRef.current.pause();
        danceAudioRef.current = null;
      }
      if (kissAudioRef.current) {
        kissAudioRef.current.pause();
        kissAudioRef.current = null;
      }
    };
  }, []);

  const {
    vrmRef, glbModelRef, roomModelRef, glbBonesRef, glbBonesNormalizedRef,
    glbSkinnedMeshesRef, modelBasePositionRef, rootOffsetRef, initialBoneTransformsRef,
    rigBones, setRigBones, setRigModelStamp, rebuildGlbBoneIndices, cleanupModels
  } = useVrmModel();

  const animationHooks = useVrmAnimation();
  const {
    mixerRef, animMgrRef, currentStateAnimUrlRef, isVrmaPlaying, setIsVrmaPlaying,
    isVrmaPlayingRef, setSelectedClipName, setClipNames, clipNames, selectedClipName,
    configureActionPlayback, playClipOnCurrentModel, stopAllAnimations, stopLayerAnimation,
    pauseAllAnimations, resumePausedAnimation,
    activeActionsRef, activeActionIdsRef, loadedClipsRef
  } = animationHooks;

  const stateHooks = useVrmState();
  const { flipHips, invertLegs } = stateHooks;

  const proceduralHooks = useProceduralMotion();
  const {
    proceduralActiveRef, proceduralStartRef, proceduralNodesRef, proceduralBaseQuatRef,
    poseIdleActiveRef, poseIdleStartRef, poseIdleNodesRef, poseIdleBaseQuatRef,
    stopPoseIdle, stopProcedural, setIsPoseIdleActive
  } = proceduralHooks;

  const {
    seatedContactRef, walkTargetRef, sleepTargetRef, isSleepingRef, isDancingRef, isSpecialActionRef, specialActionNameRef,
    sceneObjectBaseTransformRef, lanternLitRef, ensureRapierReady,
    createSeatedRapierHarness, disposeSeatedRapier, seatedRapierRef,
    setIsSleeping, setIsDancing
  } = useAiScene(vrmRef, glbBonesNormalizedRef);

  const {
    getBoneNode, updateRigStateFromBone, applyRigToBone, resetAllBones
  } = useVrmRigDebug(
    vrmRef, glbModelRef, glbBonesRef, initialBoneTransformsRef,
    stateHooks.setRigRotDeg, stateHooks.setRigPos
  );

  const loadHandlers = useVrmLoadHandlers(
    vrmRef, glbModelRef, glbBonesRef, glbBonesNormalizedRef, glbSkinnedMeshesRef,
    mixerRef, activeActionsRef, loadedClipsRef, setIsVrmaPlaying,
    setClipNames, setSelectedClipName, rebuildGlbBoneIndices, initialBoneTransformsRef,
    setRigBones, stateHooks.setSelectedBone, setRigModelStamp,
    configureActionPlayback, playClipOnCurrentModel
  );

  const {
    playVrmRetargetedFbxFromUrl, playMixamoFbxFromUrl, playVrmaFromUrl
  } = loadHandlers;

  const { applyMotionToAvatar } = useVrmMotion(
    vrmRef, glbModelRef, glbBonesRef, rootOffsetRef, flipHips, invertLegs, isVrmaPlaying
  );

  // Helper for state animations
  const playStateAnimFbx = useCallback((url: string) => {
    if (!vrmRef.current) return;
    animationFrozenRef.current = false;
    setIsAnimationFrozen(false);
    
    // Check if we are already playing this URL in any layer (though state anims are usually base)
    if (currentStateAnimUrlRef.current === url) return;
    
    currentStateAnimUrlRef.current = url;
    if (animMgrRef.current) animMgrRef.current.isMixamoPlaying = true;
    if (url.toLowerCase().endsWith('/idle.fbx')) {
      playVrmaFromUrl(IDLE_VRMA_URL, {}, 'base');
      return;
    }
    if (url.toLowerCase().endsWith('/thinking.fbx')) {
      playVrmaFromUrl(THINKING_VRMA_URL, {}, 'base');
      return;
    }
    if (url.toLowerCase().endsWith('/walkinganimation.fbx')) {
      playVrmaFromUrl(WALKING_VRMA_URL, { includeHipsPosition: false }, 'base');
      return;
    }
    const isIdle = url.toLowerCase().endsWith('/idle.fbx');
    playVrmRetargetedFbxFromUrl(url, isIdle ? {
      includeHipsRotation: true,
      includeHipsPosition: true,
      disableZRollStripping: true,
    } : undefined);
  }, [vrmRef, playVrmRetargetedFbxFromUrl, playVrmaFromUrl, currentStateAnimUrlRef, animMgrRef]);

  const startPoseIdleInternal = useCallback((keys: LogicalBone[]) => {
    stopPoseIdle();
    const nodes = new Map<LogicalBone, THREE.Object3D>();
    const bases = new Map<LogicalBone, THREE.Quaternion>();
    for (const key of keys) {
      const node = getBoneNode(key);
      if (!node) continue;
      nodes.set(key, node);
      bases.set(key, node.quaternion.clone());
    }
    if (nodes.size === 0) return;
    poseIdleNodesRef.current = nodes;
    poseIdleBaseQuatRef.current = bases;
    poseIdleStartRef.current = performance.now() / 1000;
    poseIdleActiveRef.current = true;
    setIsPoseIdleActive(true);
  }, [getBoneNode, stopPoseIdle, poseIdleNodesRef, poseIdleBaseQuatRef, poseIdleStartRef, poseIdleActiveRef, setIsPoseIdleActive]);

  const sceneActions = useVrmSceneActions(
    vrmRef, glbModelRef, roomModelRef, sceneRef, controlsRef, modelBasePositionRef,
    seatedContactRef, walkTargetRef, sleepTargetRef, isSleepingRef, isDancingRef, isSpecialActionRef, specialActionNameRef,
    danceAudioRef, kissAudioRef, sceneObjectBaseTransformRef, lanternLitRef, stopPoseIdle, stopProcedural, stopAllAnimations,
    disposeSeatedRapier, ensureRapierReady, createSeatedRapierHarness,
    playVrmRetargetedFbxFromUrl, playMixamoFbxFromUrl, playVrmaFromUrl, resetAllBones,
    playStateAnimFbx, startPoseIdleInternal
  );

  const { activateObjectDragSnap, refreshSnappableObjects } = useNamiStudioObjectDragSnap({
    roomModelRef,
    sceneRef,
    cameraRef,
    rendererRef,
    controlsRef,
    sceneObjectBaseTransformRef,
  });

  const applyPoseProfile = useCallback((profile: string) => {
    stateHooks.setActivePoseProfile(profile);
    resetAllBones();
    stopPoseIdle();

    if (profile === 'floor_sit_cross_leg') {
      const pose = FLOOR_SIT_CROSS_LEG_POSE_GLTF;
      const root = vrmRef.current?.scene ?? glbModelRef.current;
      if (root) {
        root.position.y = (normalizedConfig?.y ?? 0) + pose.rootYOffset;
        root.updateMatrixWorld(true);
      }
      for (const [boneName, quatArray] of Object.entries(pose.boneQuaternions)) {
        const node = getBoneNode(boneName);
        if (node) {
          node.quaternion.fromArray(quatArray);
          node.updateMatrixWorld(true);
        }
      }
      startPoseIdleInternal([
        'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
        'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
        'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
      ]);
    } else if (profile === 'chair_sit') {
      sceneActions.sitOnSceneObject('DESK_Navigation_01');
    } else {
      const root = vrmRef.current?.scene ?? glbModelRef.current;
      if (root) {
        root.position.y = normalizedConfig?.y ?? 0;
        root.updateMatrixWorld(true);
      }
    }
  }, [stateHooks, resetAllBones, stopPoseIdle, vrmRef, glbModelRef, normalizedConfig, getBoneNode, startPoseIdleInternal, sceneActions]);

  const copyPose = useCallback(async () => {
    const root = vrmRef.current?.scene ?? glbModelRef.current;
    if (!root) return;

    const bones: any[] = [];
    for (const boneKey of rigBones) {
      const node = getBoneNode(boneKey);
      if (!node) continue;
      bones.push({
        name: boneKey,
        quaternion: node.quaternion.toArray(),
        position: node.position.toArray(),
      });
    }

    const payload = {
      kind: 'vtuber_pose_v1',
      modelUrl: normalizedConfig?.url ?? '',
      activePoseProfile: stateHooks.activePoseProfile,
      root: {
        position: root.position.toArray(),
        rotationQuaternion: root.quaternion.toArray(),
      },
      bones,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toaster.create({ title: 'Pose copied', type: 'success' });
    } catch (e) {
      console.error('Copy pose failed', e);
    }
  }, [vrmRef, glbModelRef, rigBones, getBoneNode, normalizedConfig, stateHooks.activePoseProfile]);

  const keepWalkingAnimationActive = useCallback(() => {
    animationFrozenRef.current = false;
    setIsAnimationFrozen(false);
    const action = activeActionsRef.current.get('base');
    if (action) {
      configureActionPlayback(action);
      action.enabled = true;
      action.paused = false;
      const clipDuration = action.getClip().duration;
      const reachedClipEnd = Number.isFinite(clipDuration)
        && clipDuration > 0
        && action.time >= clipDuration - 0.02;
      if (!action.isRunning() || reachedClipEnd) {
        action.reset().play();
      }
      return;
    }

    currentStateAnimUrlRef.current = WALKING_FBX_URL;
    playVrmaFromUrl(WALKING_VRMA_URL, { includeHipsPosition: false }, 'base');
  }, [configureActionPlayback, playVrmaFromUrl, activeActionsRef, currentStateAnimUrlRef]);

  const handleStopVrma = useCallback(() => {
    animationFrozenRef.current = true;
    setIsAnimationFrozen(true);
    pauseAllAnimations();
    if (stateHooks.selectedBone) updateRigStateFromBone(stateHooks.selectedBone);

    // Clear AI/Scene targets to prevent auto-restarts while preserving the current pose.
    walkTargetRef.current = null;
    seatedContactRef.current = null;
    sleepTargetRef.current = null;
    isSleepingRef.current = false;
    isDancingRef.current = false;
    isSpecialActionRef.current = false;
    specialActionNameRef.current = null;
    setIsSleeping(false);
    setIsDancing(false);

    disposeSeatedRapier();
    stopPoseIdle(true);
    stopProcedural(true);
    if (danceAudioRef.current) {
      danceAudioRef.current.pause();
      danceAudioRef.current.currentTime = 0;
    }
    if (kissAudioRef.current) {
      kissAudioRef.current.pause();
      kissAudioRef.current.currentTime = 0;
    }
  }, [
    pauseAllAnimations,
    walkTargetRef, seatedContactRef, sleepTargetRef, isSleepingRef, isDancingRef,
    isSpecialActionRef, specialActionNameRef, setIsSleeping, setIsDancing,
    disposeSeatedRapier, stopPoseIdle, stopProcedural, stateHooks.selectedBone, updateRigStateFromBone, danceAudioRef, kissAudioRef
  ]);

  const handleResumeAnimation = useCallback(() => {
    animationFrozenRef.current = false;
    setIsAnimationFrozen(false);
    frozenRigOverridesRef.current.clear();
    resumePausedAnimation();
  }, [resumePausedAnimation]);

  const applyFrozenRigOverrides = useCallback(() => {
    for (const [boneKey, override] of frozenRigOverridesRef.current.entries()) {
      applyRigToBone(boneKey, override.rotDeg, override.pos);
    }
  }, [applyRigToBone]);

  const handleApplyRigToBone = useCallback((boneKey: string, rot: Vec3, pos: Vec3) => {
    if (animationFrozenRef.current) {
      frozenRigOverridesRef.current.set(boneKey, {
        rotDeg: { ...rot },
        pos: { ...pos },
      });
    }
    applyRigToBone(boneKey, rot, pos);
  }, [applyRigToBone]);

  useEffect(() => {
    if (!stateHooks.selectedBone) return;
    updateRigStateFromBone(stateHooks.selectedBone);
  }, [stateHooks.selectedBone, updateRigStateFromBone]);

  // Main Loop
  useEffect(() => {
    const clock = new THREE.Clock();
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const isAnimationFrozen = animationFrozenRef.current;

      if (!isAnimationFrozen && mixerRef.current) mixerRef.current.update(dt);

      const am = animMgrRef.current;
      if (am && !isAnimationFrozen) {
        am.isMixamoPlaying = isVrmaPlayingRef.current;
        am.isDancing = isDancingRef.current;
        am.isSleeping = isSleepingRef.current;
        am.isSpecialAction = isSpecialActionRef.current;
        am.isSpeaking = vrmAudioPlayingRef.current;

        // Determine if procedural motion should be suppressed
        let shouldSuppressProcedural = false;
        activeActionIdsRef.current.forEach((actionId) => {
          const node = ACTION_GRAPH[actionId];
          if (node?.disablesIdleProcedural) {
            shouldSuppressProcedural = true;
          }
        });
        am.setProceduralDisabled(shouldSuppressProcedural);

        am.update(dt);
      }

      const vrm = vrmRef.current;
      if (vrm) {
        if (!isAnimationFrozen) vrm.update(dt);
        // Lip sync only while the AI is actually speaking
        if (!isAnimationFrozen && vrmAudioPlayingRef.current) {
          const s = Math.sin(performance.now() / 1000 * 15);
          const open = (s + 1) * 0.35;
          setVrmMouth(vrm, open);
        } else if (!isAnimationFrozen) {
          setVrmMouth(vrm, 0);
        }

      }

      // Handle Walking
      if (walkTargetRef.current && modelBasePositionRef.current) {
        const target = walkTargetRef.current;
        const root = vrmRef.current?.scene ?? glbModelRef.current;
        if (root) {
          keepWalkingAnimationActive();
          const moveDist = 1.1 * dt;
          const currentPos = root.position;
          const distToTarget = currentPos.distanceTo(target.position);
          if (distToTarget < moveDist + 0.05) {
            root.position.copy(target.position);
            modelBasePositionRef.current.copy(target.position);

            // Y-locked rotation
            const baseRotY = vrmRef.current?.meta?.metaVersion === '0' ? Math.PI : 0;
            const dx = target.lookAt.x - root.position.x;
            const dz = target.lookAt.z - root.position.z;
            root.rotation.set(0, baseRotY + Math.atan2(dx, dz), 0);

            const onArrive = target.onArrive;
            walkTargetRef.current = null;

            // Stop walking animation and switch to idle
            if (mixerRef.current) {
              mixerRef.current.stopAllAction();
            }
            currentStateAnimUrlRef.current = '';

            const arrivalOwnsAnimation = onArrive?.() === true;
            if (!arrivalOwnsAnimation) {
              playStateAnimFbx('/models/animations/Idle.fbx');
              startPoseIdleInternal([
                'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
                'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
                'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
              ]);
            }
          } else {
            const dir = target.position.clone().sub(currentPos).normalize();
            root.position.add(dir.multiplyScalar(moveDist));
            modelBasePositionRef.current.copy(root.position);

            // Y-locked rotation while walking
            const baseRotY = vrmRef.current?.meta?.metaVersion === '0' ? Math.PI : 0;
            root.rotation.set(0, baseRotY + Math.atan2(dir.x, dir.z), 0);
          }
        }
      }

      // Keep sleep poses on top of the target surface after animation/root offsets apply.
      if (isSleepingRef.current && sleepTargetRef.current) {
        const sleepTarget = sleepTargetRef.current;
        const root = vrmRef.current?.scene ?? glbModelRef.current;
        if (root) {
          root.position.x = sleepTarget.rootX;
          root.position.y = sleepTarget.rootY;
          root.position.z = sleepTarget.rootZ;
          root.rotation.set(0, sleepTarget.rootYaw, 0);
          root.updateMatrixWorld(true);
          if (modelBasePositionRef.current) modelBasePositionRef.current.copy(root.position);
        }
      }

      // Handle Seated Physics (Rapier)
      if (seatedContactRef.current) {
        const seatedContact = seatedContactRef.current;
        const root = vrmRef.current?.scene ?? glbModelRef.current;
        const hipsNode = vrmRef.current?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Hips)
          ?? glbBonesNormalizedRef.current.get('hips');

        if (root && hipsNode) {
          const settleElapsed = performance.now() / 1000 - seatedContact.settleStartTime;
          const settleT = THREE.MathUtils.clamp(settleElapsed / seatedContact.settleDuration, 0, 1);
          const settleEase = 1 - Math.pow(1 - settleT, 3);

          if (settleT < 1) {
            root.position.x = THREE.MathUtils.lerp(seatedContact.rootStartX, seatedContact.rootX, settleEase);
            root.position.z = THREE.MathUtils.lerp(seatedContact.rootStartZ, seatedContact.rootZ, settleEase);
            root.rotation.set(
              0,
              THREE.MathUtils.lerp(seatedContact.rootStartYaw, seatedContact.rootYaw, settleEase),
              0,
            );
          } else {
            root.position.x = THREE.MathUtils.lerp(root.position.x, seatedContact.rootX, 0.35);
            root.position.z = THREE.MathUtils.lerp(root.position.z, seatedContact.rootZ, 0.35);
            root.rotation.set(0, seatedContact.rootYaw, 0);
          }

          const hipsWorld = new THREE.Vector3();
          hipsNode.getWorldPosition(hipsWorld);

          let targetPelvisY = seatedContact.targetPelvisY;
          const rapierHarness = seatedRapierRef.current;

          if (rapierHarness) {
            const bodyPos = rapierHarness.pelvisBody.translation();
            const desired = rapierHarness.desiredPelvis;
            const velocity = new THREE.Vector3(
              desired.x - bodyPos.x,
              desired.y - bodyPos.y,
              desired.z - bodyPos.z,
            ).multiplyScalar(10);
            velocity.clampLength(0, 2.2);
            rapierHarness.pelvisBody.setLinvel({ x: velocity.x, y: velocity.y, z: velocity.z }, true);
            rapierHarness.pelvisBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
            rapierHarness.world.step();
            const solved = rapierHarness.pelvisBody.translation();
            targetPelvisY = solved.y;
          }

          const deltaY = THREE.MathUtils.clamp(targetPelvisY - hipsWorld.y, -0.06, 0.06);
          if (Math.abs(deltaY) > 0.0005) {
            root.position.y += deltaY;
            root.updateMatrixWorld(true);
            if (modelBasePositionRef.current) modelBasePositionRef.current.copy(root.position);
          }
        }
      }

      // Handle Procedural Motion (e.g. Clapping)
      if (proceduralActiveRef.current && !isSleepingRef.current) {
        const time = performance.now() / 1000 - proceduralStartRef.current;
        for (const [key, node] of proceduralNodesRef.current.entries()) {
          const base = proceduralBaseQuatRef.current.get(key);
          if (!base) continue;
          const sway = Math.sin(time * 12) * 0.15;
          node.quaternion.copy(base);
          if (key.includes('Hand')) node.rotateX(sway);
          node.updateMatrixWorld(true);
        }
      }

      // Handle Pose Idle (e.g. Breathing & Swaying)
      if (poseIdleActiveRef.current && !isSpecialActionRef.current && !isSleepingRef.current) {
        const t = (performance.now() / 1000) - poseIdleStartRef.current;
        const breathe = Math.sin(t * 1.15);
        const sway = Math.sin(t * 0.65 + 0.5);
        const micro = Math.sin(t * 2.2);

        const applyIdle = (key: LogicalBone, euler: THREE.Euler) => {
          const node = getBoneNode(key);
          if (!node) return;
          const base = poseIdleBaseQuatRef.current.get(key);
          if (!base) return;
          const qOff = new THREE.Quaternion().setFromEuler(euler);
          node.quaternion.copy(base).multiply(qOff);
          node.updateMatrixWorld(true);
        };

        applyIdle('chest', new THREE.Euler(0.015 * breathe, 0.01 * sway, 0, 'XYZ'));
        applyIdle('spine', new THREE.Euler(0.010 * breathe, 0.015 * sway, 0, 'XYZ'));
        applyIdle('neck', new THREE.Euler(0.010 * micro, 0.010 * sway, 0, 'XYZ'));
        applyIdle('head', new THREE.Euler(0.015 * micro, 0.020 * sway, 0.005 * micro, 'XYZ'));

        // Tiny arm micro-adjustments
        applyIdle('leftUpperArm', new THREE.Euler(0.01 * breathe, 0, 0.015 * micro, 'XYZ'));
        applyIdle('rightUpperArm', new THREE.Euler(0.01 * breathe, 0, -0.015 * micro, 'XYZ'));
        applyIdle('leftHand', new THREE.Euler(0, 0, 0.01 * micro, 'XYZ'));
        applyIdle('rightHand', new THREE.Euler(0, 0, -0.01 * micro, 'XYZ'));
      }

      if (isAnimationFrozen) {
        applyFrozenRigOverrides();
        vrmRef.current?.humanoid?.update();
        (vrmRef.current?.scene ?? glbModelRef.current)?.updateMatrixWorld(true);
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        const glbModel = glbModelRef.current;
        if (glbModel?.userData?.needsAutoFrame && controlsRef.current && cameraRef.current) {
          const bbox = new THREE.Box3().setFromObject(glbModel);
          const center = bbox.getCenter(new THREE.Vector3());
          const size = bbox.getSize(new THREE.Vector3());
          const radius = Math.max(size.x, size.y, size.z, 0.5);
          const cam = cameraRef.current as THREE.PerspectiveCamera;
          cam.position.set(center.x, center.y + radius * 0.25, center.z + radius * 2.2);
          controlsRef.current.target.set(center.x, center.y + radius * 0.15, center.z);
          controlsRef.current.update();
          glbModel.userData.needsAutoFrame = false;
        }
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      if (controlsRef.current) controlsRef.current.update();
    };
    animate();
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [
    mixerRef, vrmRef, glbModelRef, animMgrRef, isVrmaPlayingRef, isDancingRef, isSpecialActionRef, specialActionNameRef,
    walkTargetRef, sleepTargetRef, isSleepingRef, activeActionsRef, activeActionIdsRef, modelBasePositionRef, playStateAnimFbx, proceduralActiveRef,
    proceduralStartRef, proceduralNodesRef, proceduralBaseQuatRef, poseIdleActiveRef,
    poseIdleStartRef, poseIdleNodesRef, poseIdleBaseQuatRef, rendererRef, sceneRef,
    cameraRef, controlsRef, keepWalkingAnimationActive, startPoseIdleInternal, getBoneNode, applyFrozenRigOverrides
  ]);

  useEffect(() => {
    const onAudioStart = () => {
      vrmAudioPlayingRef.current = true;
    };
    const onAudioStop = () => {
      vrmAudioPlayingRef.current = false;
      const vrm = vrmRef.current;
      if (vrm) setVrmMouth(vrm, 0);
    };

    window.addEventListener('vrm-audio-start', onAudioStart);
    window.addEventListener('vrm-audio-stop', onAudioStop);
    return () => {
      window.removeEventListener('vrm-audio-start', onAudioStart);
      window.removeEventListener('vrm-audio-stop', onAudioStop);
    };
  }, [vrmRef]);

  // Initial Scene Setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !normalizedConfig) return;

    const { scene } = setupScene({
      container,
      backgroundColor: normalizedConfig.backgroundColor,
      autoRotate: normalizedConfig.autoRotate,
      cameraPosition: normalizedConfig.cameraPosition,
      cameraTarget: normalizedConfig.cameraTarget,
      hasEnvironmentScene: Boolean(normalizedConfig.sceneGlb || normalizedConfig.scenePreset === 'nami_studio_apartment'),
      hasNamiStudioScene: normalizedConfig.scenePreset === 'nami_studio_apartment',
    });

    let disposed = false;
    let cleanupObjectDragSnap: (() => void) | undefined;

    if (normalizedConfig.scenePreset === 'nami_studio_apartment' && normalizedConfig.sceneGlb) {
      const registry = createNamiAuthoredEnvironmentRegistry();
      (window as any).__AI_SCENE_REGISTRY__ = registry;
    } else if (normalizedConfig.scenePreset === 'nami_studio_apartment') {
      const { root: apartment, registry } = createNamiStudioApartmentScene();
      apartment.position.set(0, 0, 0);
      scene.add(apartment);
      roomModelRef.current = apartment;
      (window as any).__AI_SCENE_REGISTRY__ = registry;
      refreshSnappableObjects();
      cleanupObjectDragSnap = activateObjectDragSnap();

      const blueprintLoader = new GLTFLoader();
      const blueprintDracoLoader = new DRACOLoader();
      blueprintDracoLoader.setDecoderPath('/draco/');
      blueprintLoader.setDRACOLoader(blueprintDracoLoader);

      apartment.traverse((anchor: THREE.Object3D) => {
        const asset = anchor.userData.blueprintAsset as BlueprintSceneAsset | undefined;
        if (!asset) return;

        blueprintLoader.load(
          asset.url,
          (gltf: GLTF) => {
            if (disposed) return;
            const model = gltf.scene;
            model.scale.setScalar(asset.scale);
            model.rotation.set(...asset.rotation);
            model.traverse((child: THREE.Object3D) => {
              if (!(child as THREE.Mesh).isMesh) return;
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            });
            model.updateMatrixWorld(true);
            const localBox = new THREE.Box3().setFromObject(model);
            const localCenter = new THREE.Vector3();
            localBox.getCenter(localCenter);
            model.position.set(
              asset.offset[0] - localCenter.x,
              asset.offset[1] - localBox.min.y,
              asset.offset[2] - localCenter.z,
            );
            anchor.add(model);
            anchor.updateMatrixWorld(true);
          },
          undefined,
          (err: unknown) => console.error(`[VrmViewer] Failed to load Blueprint3D asset ${asset.url}:`, err),
        );
      });
    }

    if (normalizedConfig.sceneGlb) {
      const roomLoader = new GLTFLoader();
      const roomDracoLoader = new DRACOLoader();
      roomDracoLoader.setDecoderPath('/draco/');
      roomLoader.setDRACOLoader(roomDracoLoader);

      roomLoader.load(
        normalizedConfig.sceneGlb,
        (gltf: GLTF) => {
          if (disposed) return;
          const room = gltf.scene;
          const [px, py, pz] = (normalizedConfig as any).sceneGlbPosition ?? [0, 0, 0];
          const [rx, ry, rz] = (normalizedConfig as any).sceneGlbRotation ?? [0, 0, 0];
          const rawScale = (normalizedConfig as any).sceneGlbScale ?? 1;
          const [sx, sy, sz] = Array.isArray(rawScale) ? rawScale : [rawScale, rawScale, rawScale];
          room.position.set(px, py, pz);
          room.rotation.set(rx, ry, rz);
          room.scale.set(sx, sy, sz);
          room.name = 'vrSceneRoom';
          room.traverse((child: THREE.Object3D) => {
            if (!(child as THREE.Mesh).isMesh) return;
            (child as THREE.Mesh).castShadow = false;
            (child as THREE.Mesh).receiveShadow = true;
          });
          scene.add(room);
          roomModelRef.current = room;
        },
        undefined,
        (err: unknown) => console.error('[VrmViewer] Failed to load scene GLB:', err),
      );
    }

    // Model Loading Logic
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    loader.setDRACOLoader(draco);
    loader.register((parser: any) => new VRMLoaderPlugin(parser));

    animationFrozenRef.current = false;
    setIsAnimationFrozen(false);
    currentStateAnimUrlRef.current = '';
    stopAllAnimations();

    loader.load(normalizedConfig.url, (gltf: any) => {
      const vrm = gltf.userData.vrm as VRM | undefined;
      if (vrm) {
        VRMUtils.combineSkeletons(vrm.scene);
        vrm.scene.traverse((obj: any) => { obj.frustumCulled = false; });
        scene.add(vrm.scene);
        vrmRef.current = vrm;
        vrm.scene.position.set(normalizedConfig.x, normalizedConfig.y, normalizedConfig.vrmPosZ);
        vrm.scene.rotation.y = THREE.MathUtils.degToRad(normalizedConfig.vrmRotY) + (vrm.meta?.metaVersion === '0' ? Math.PI : 0);
        modelBasePositionRef.current = vrm.scene.position.clone();

        animMgrRef.current = new VrmAnimationManager(vrm);

        const bones = Object.values(VRMHumanBoneName);
        bones.forEach(b => {
          const node = vrm.humanoid?.getNormalizedBoneNode(b);
          if (node) {
            initialBoneTransformsRef.current.set(b, { q: node.quaternion.clone(), p: node.position.clone() });
          }
        });
        setRigBones(bones);
        playStateAnimFbx('/models/animations/Idle.fbx');

        // Activate high-fidelity swaying by default.
        // Since we use multiplicative layering now, it won't look robotic.
        startPoseIdleInternal([
          'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
          'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
          'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
        ]);
      } else {
        // Plain GLB model (no VRM humanoid data)
        const model = gltf.scene;
        model.traverse((obj: THREE.Object3D) => { obj.frustumCulled = false; });
        rebuildGlbBoneIndices(model);

        const bboxRaw = new THREE.Box3().setFromObject(model);
        const rawHeight = bboxRaw.getSize(new THREE.Vector3()).y;
        let autoScale = normalizedConfig.scale;
        if (Number.isFinite(rawHeight) && rawHeight > 0.0001) {
          autoScale = 1.6 / rawHeight;
        }
        model.scale.setScalar(autoScale);

        const bbox = new THREE.Box3().setFromObject(model);
        const center = bbox.getCenter(new THREE.Vector3());
        const minY = bbox.min.y;
        const tx = normalizedConfig.x ?? 0;
        const ty = normalizedConfig.y ?? 0;
        const tz = normalizedConfig.vrmPosZ ?? 0;
        if (Number.isFinite(center.x) && Number.isFinite(minY)) {
          model.position.set(tx - center.x, ty - minY, tz - center.z);
        } else {
          model.position.set(tx, ty, tz);
        }

        scene.add(model);
        glbModelRef.current = model;
        console.log('[VrmViewer] GLB loaded:', normalizedConfig.url);

        const boneNames = Array.from(glbBonesRef.current.keys()).sort((a, b) => a.localeCompare(b));
        boneNames.forEach((boneName) => {
          const node = glbBonesRef.current.get(boneName);
          if (!node) return;
          initialBoneTransformsRef.current.set(boneName, {
            q: node.quaternion.clone(),
            p: node.position.clone(),
          });
        });
        setRigBones(boneNames);
        setRigModelStamp((v) => v + 1);

        const clip = gltf.animations[0];
        if (clip) {
          playClipOnCurrentModel(model, null, clip);
        }
      }
    }, undefined, (error: unknown) => {
      console.error('[VrmViewer] Failed to load model:', normalizedConfig.url, error);
      toaster.create({
        title: 'Model load failed',
        description: `Failed to load model. Check console for details.`,
        type: 'error',
        duration: 4000,
      });
    });

    return () => {
      cleanupObjectDragSnap?.();
      cleanupScene(container);
      cleanupModels(scene);
      if (animMgrRef.current) animMgrRef.current.destroy();
    };
  }, [normalizedConfig, setupScene, cleanupScene, cleanupModels, playStateAnimFbx, vrmRef, glbModelRef, glbBonesRef, roomModelRef, modelBasePositionRef, animMgrRef, initialBoneTransformsRef, setRigBones, setRigModelStamp, rebuildGlbBoneIndices, playClipOnCurrentModel, startPoseIdleInternal, refreshSnappableObjects, activateObjectDragSnap]);

  // Event Listeners
  useEffect(() => {
    const animationActionAliases = new Set([
      'sit_animation',
      'sitting',
      'talking_animation',
      'taunting',
      'thinking_animation',
      'fist_pump',
      'fistpump_animation',
      'stretch_yawn_shoulder',
      'stretch_animation',
      'dance_animation',
    ]);

    const onMotion = (e: Event) => applyMotionToAvatar((e as CustomEvent).detail);
    const onSceneAction = (e: Event) => {
      animationFrozenRef.current = false;
      setIsAnimationFrozen(false);
      const detail = (e as CustomEvent).detail;
      console.log('[VrmViewer] Scene action received:', detail.action, detail.objectId);
      if (detail.action === 'sit') {
        sceneActions.sitOnSceneObject(detail.objectId);
      } else if (detail.action === 'sleep' || detail.action === 'lieDown') {
        sceneActions.executeSceneObjectAction(detail.action, detail.objectId);
      } else if (detail.action === 'stand') {
        sceneActions.standFromSceneObject();
        startPoseIdleInternal([
          'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
          'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
          'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
        ]);
      } else if (detail.action === 'dance' || detail.action === 'random_dance') {
        sceneActions.playRandomDance();
      } else if (detail.action === 'kiss') {
        sceneActions.playKiss();
      } else if (ANIMATION_HIERARCHY[detail.action] || animationActionAliases.has(detail.action)) {
        sceneActions.playRandomAnimation(detail.action);
      } else {
        sceneActions.executeSceneObjectAction(detail.action, detail.objectId);
      }
    };

    window.addEventListener('vrm-motion', onMotion);
    window.addEventListener('ai-scene-action', onSceneAction);
    return () => {
      window.removeEventListener('vrm-motion', onMotion);
      window.removeEventListener('ai-scene-action', onSceneAction);
    };
  }, [applyMotionToAvatar, sceneActions, startPoseIdleInternal]);

  // AI State changes
  useEffect(() => {
    if (animationFrozenRef.current) return;
    if (isSpecialActionRef.current) return;
    if (walkTargetRef.current) return;
    if (isSleepingRef.current) return;
    if (isDancingRef.current) return;
    if (seatedContactRef.current) return;

    const am = animMgrRef.current;
    if (!am) return;
    switch (aiState) {
      case AiStateEnum.IDLE: am.setState('idle'); playStateAnimFbx('/models/animations/Idle.fbx'); break;
      case AiStateEnum.LISTENING: am.setState('listening'); playStateAnimFbx('/models/animations/Idle.fbx'); break;
      case AiStateEnum.THINKING_SPEAKING: am.setState('thinking'); playStateAnimFbx('/models/animations/Thinking.fbx'); break;
    }
  }, [aiState, playStateAnimFbx, animMgrRef, isSpecialActionRef, walkTargetRef, isSleepingRef, isDancingRef, seatedContactRef]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {showControls && (
        <UiOverlay
          {...stateHooks}
          rigBones={rigBones}
          onApplyPoseProfile={applyPoseProfile}
          onCopyPose={copyPose}
          clipNames={clipNames}
          selectedClipName={selectedClipName}
          onClipSelect={setSelectedClipName}
          isProceduralPlaying={proceduralHooks.isProceduralPlaying}
          onStartProcedural={() => {}}
          onStopProcedural={stopProcedural}
          isVrmaPlaying={isVrmaPlaying}
          isAnimationFrozen={isAnimationFrozen}
          onStopVrma={handleStopVrma}
          onResumeAnimation={handleResumeAnimation}
          setRigPos={stateHooks.setRigPos}
          onApplyRig={handleApplyRigToBone}
        />
      )}
    </div>
  );
});
