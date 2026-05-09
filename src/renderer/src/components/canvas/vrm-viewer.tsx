/* eslint-disable react-hooks/exhaustive-deps */
import {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import {
  GLTFLoader,
  GLTF,
  GLTFParser,
} from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  VRMLoaderPlugin,
  VRM,
  VRMUtils,
  VRMHumanBoneName,
} from '@pixiv/three-vrm';
import { useLive2DConfig } from '@/context/live2d-config-context';
import { useMode } from '@/context/mode-context';
import { useForceIgnoreMouse } from '@/hooks/utils/use-force-ignore-mouse';
import { useAiState, AiStateEnum } from '@/context/ai-state-context';
import { toaster } from '@/components/ui/toaster';
import {
  AiSceneRegistry,
  SceneObjectRegistryEntry,
  createNamiStudioApartmentScene,
} from './nami-studio-scene';

interface BoneRotation {
  x?: number;
  y?: number;
  z?: number;
  w?: number;
}

interface BonePosition {
  x?: number;
  y?: number;
  z?: number;
}

interface BonePose {
  name: string;
  rotation?: BoneRotation;
  position?: BonePosition;
}

interface VrmMotionMessage {
  bones?: BonePose[];
  worldQuaternion?: boolean;
}

interface AiSceneActionEventDetail {
  action: string;
  objectId?: string;
  sourceText?: string;
}

interface SeatedContactTarget {
  objectId: string;
  targetPelvisY: number;
  standPosition: [number, number, number];
  rootX: number;
  rootZ: number;
  rootYaw: number;
}

interface WalkTarget {
  objectId: string;
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  onArrive?: () => void;
}

interface ClipPlaybackOptions {
  loopOnce?: boolean;
  clampWhenFinished?: boolean;
}

interface SeatedRapierHarness {
  world: any;
  pelvisBody: any;
  pelvisCollider: any;
  seatCollider: any;
  floorCollider: any;
  desiredPelvis: THREE.Vector3;
}

type Vec3 = { x: number; y: number; z: number };

const safeNumber = (value: number | undefined, fallback: number) => (
  Number.isFinite(value) ? Number(value) : fallback
);

const SITTING_TALKING_FBX_URL = '/models/animations/SittingTalkingFromMixamo.fbx';
const WALKING_FBX_URL = '/models/animations/WalkingAnimation.fbx';

// Mapping from VRM 0.x standard bone names to Humanoid bone names
const VRM0_BONE_MAP: Record<string, VRMHumanBoneName> = {
    'J_Bip_C_Hips': 'hips',
    'J_Bip_C_Spine': 'spine',
    'J_Bip_C_Chest': 'chest',
    'J_Bip_C_UpperChest': 'upperChest',
    'J_Bip_C_Neck': 'neck',
    'J_Bip_C_Head': 'head',
    'J_Bip_L_Shoulder': 'leftShoulder',
    'J_Bip_L_UpperArm': 'leftUpperArm',
    'J_Bip_L_LowerArm': 'leftLowerArm',
    'J_Bip_L_Hand': 'leftHand',
    'J_Bip_R_Shoulder': 'rightShoulder',
    'J_Bip_R_UpperArm': 'rightUpperArm',
    'J_Bip_R_LowerArm': 'rightLowerArm',
    'J_Bip_R_Hand': 'rightHand',
    'J_Bip_L_UpperLeg': 'leftUpperLeg',
    'J_Bip_L_LowerLeg': 'leftLowerLeg',
    'J_Bip_L_Foot': 'leftFoot',
    'J_Bip_L_ToeBase': 'leftToes',
    'J_Bip_R_UpperLeg': 'rightUpperLeg',
    'J_Bip_R_LowerLeg': 'rightLowerLeg',
    'J_Bip_R_Foot': 'rightFoot',
    'J_Bip_R_ToeBase': 'rightToes',
    'J_Bip_L_Thumb1': 'leftThumbProximal', 'J_Bip_L_Thumb2': 'leftThumbIntermediate', 'J_Bip_L_Thumb3': 'leftThumbDistal',
    'J_Bip_L_Index1': 'leftIndexProximal', 'J_Bip_L_Index2': 'leftIndexIntermediate', 'J_Bip_L_Index3': 'leftIndexDistal',
    'J_Bip_L_Middle1': 'leftMiddleProximal', 'J_Bip_L_Middle2': 'leftMiddleIntermediate', 'J_Bip_L_Middle3': 'leftMiddleDistal',
    'J_Bip_L_Ring1': 'leftRingProximal', 'J_Bip_L_Ring2': 'leftRingIntermediate', 'J_Bip_L_Ring3': 'leftRingDistal',
    'J_Bip_L_Little1': 'leftLittleProximal', 'J_Bip_L_Little2': 'leftLittleIntermediate', 'J_Bip_L_Little3': 'leftLittleDistal',
    'J_Bip_R_Thumb1': 'rightThumbProximal', 'J_Bip_R_Thumb2': 'rightThumbIntermediate', 'J_Bip_R_Thumb3': 'rightThumbDistal',
    'J_Bip_R_Index1': 'rightIndexProximal', 'J_Bip_R_Index2': 'rightIndexIntermediate', 'J_Bip_R_Index3': 'rightIndexDistal',
    'J_Bip_R_Middle1': 'rightMiddleProximal', 'J_Bip_R_Middle2': 'rightMiddleIntermediate', 'J_Bip_R_Middle3': 'rightMiddleDistal',
    'J_Bip_R_Ring1': 'rightRingProximal', 'J_Bip_R_Ring2': 'rightRingIntermediate', 'J_Bip_R_Ring3': 'rightRingDistal',
    'J_Bip_R_Little1': 'rightLittleProximal', 'J_Bip_R_Little2': 'rightLittleIntermediate', 'J_Bip_R_Little3': 'rightLittleDistal',
};

// Mixamo (FBX) bone names to VRM humanoid bone names.
// Mixamo rigs commonly use these exact names (sometimes prefixed like "mixamorig:").
const MIXAMO_TO_VRM_BONE_MAP: Record<string, VRMHumanBoneName> = {
  Hips: 'hips',
  Spine: 'spine',
  Spine1: 'chest',
  Spine2: 'upperChest',
  Neck: 'neck',
  Head: 'head',
  LeftShoulder: 'leftShoulder',
  LeftArm: 'leftUpperArm',
  LeftForeArm: 'leftLowerArm',
  LeftHand: 'leftHand',
  RightShoulder: 'rightShoulder',
  RightArm: 'rightUpperArm',
  RightForeArm: 'rightLowerArm',
  RightHand: 'rightHand',
  LeftUpLeg: 'leftUpperLeg',
  LeftLeg: 'leftLowerLeg',
  LeftFoot: 'leftFoot',
  LeftToeBase: 'leftToes',
  RightUpLeg: 'rightUpperLeg',
  RightLeg: 'rightLowerLeg',
  RightFoot: 'rightFoot',
  RightToeBase: 'rightToes',
  LeftHandThumb1: 'leftThumbProximal',
  LeftHandThumb2: 'leftThumbIntermediate',
  LeftHandThumb3: 'leftThumbDistal',
  LeftHandIndex1: 'leftIndexProximal',
  LeftHandIndex2: 'leftIndexIntermediate',
  LeftHandIndex3: 'leftIndexDistal',
  LeftHandMiddle1: 'leftMiddleProximal',
  LeftHandMiddle2: 'leftMiddleIntermediate',
  LeftHandMiddle3: 'leftMiddleDistal',
  LeftHandRing1: 'leftRingProximal',
  LeftHandRing2: 'leftRingIntermediate',
  LeftHandRing3: 'leftRingDistal',
  LeftHandPinky1: 'leftLittleProximal',
  LeftHandPinky2: 'leftLittleIntermediate',
  LeftHandPinky3: 'leftLittleDistal',
  RightHandThumb1: 'rightThumbProximal',
  RightHandThumb2: 'rightThumbIntermediate',
  RightHandThumb3: 'rightThumbDistal',
  RightHandIndex1: 'rightIndexProximal',
  RightHandIndex2: 'rightIndexIntermediate',
  RightHandIndex3: 'rightIndexDistal',
  RightHandMiddle1: 'rightMiddleProximal',
  RightHandMiddle2: 'rightMiddleIntermediate',
  RightHandMiddle3: 'rightMiddleDistal',
  RightHandRing1: 'rightRingProximal',
  RightHandRing2: 'rightRingIntermediate',
  RightHandRing3: 'rightRingDistal',
  RightHandPinky1: 'rightLittleProximal',
  RightHandPinky2: 'rightLittleIntermediate',
  RightHandPinky3: 'rightLittleDistal',
};

const normalizeMixamoNodeName = (raw: string): string => {
  let name = raw;
  const slashIdx = name.lastIndexOf('/');
  if (slashIdx >= 0) name = name.slice(slashIdx + 1);
  name = name.replace(/^[^:]+:/, '');
  name = name.replace(/^mixamorig/i, '');
  name = name.replace(/^_+/, '');
  return name;
};

// Captured pose for Thanh.glb (gltf) "floor sit, crossed legs" preset.
// Quaternions are in local bone space and should match this specific avatar.
const FLOOR_SIT_CROSS_LEG_POSE_GLTF = {
  rootYOffset: -0.75,
  boneQuaternions: {
    Hips: [0.041219, -0.000026, 0, 0.99915],
    Spine: [-0.033148, -0.000869, 0.000031, 0.99945],
    Spine1: [-0.008788, -0.000597, 0.000005, 0.999961],
    Spine2: [0.047201, 0, 0, 0.998885],
    Neck: [0.180832, -0.000588, -0.000108, 0.983514],
    Head: [-0.181378, -0.001417, -0.001091, 0.983412],

    LeftShoulder: [0.540229, 0.44978, -0.526742, 0.477906],
    LeftArm: [0.636794, -0.047667, 0.026554, 0.769101],
    LeftForeArm: [0.115435, 0.212605, 0.462985, 0.852712],
    LeftHand: [0.072539, 0.03556, 0.017738, 0.996574],

    RightShoulder: [0.540225, -0.449783, 0.526739, 0.47791],
    RightArm: [0.636794, 0.047666, -0.026554, 0.769101],
    RightForeArm: [-0.257391, 0.100153, -0.237653, 0.931257],
    RightHand: [0.072541, -0.035556, -0.017738, 0.996574],

    LeftUpLeg: [0.168029, -0.525276, -0.808292, 0.206193],
    LeftLeg: [-0.194537, -0.366232, -0.803412, 0.427269],
    LeftFoot: [0.570692, -0.011798, 0.041342, 0.820038],
    LeftToeBase: [0.268229, -0.043741, 0.01855, 0.962183],

    RightUpLeg: [0.100137, 0.521137, 0.766817, 0.361081],
    RightLeg: [-0.170548, 0.351553, 0.831304, 0.395295],
    RightFoot: [0.570692, 0.0118, -0.041338, 0.820038],
    RightToeBase: [0.268229, 0.043735, -0.018559, 0.962183],
  } as Record<string, [number, number, number, number]>,
};

// ============================================================
// Mixamo→VRM animation retargeting (riko_project style, proper quaternion conversion)
// ============================================================
const MIXAMO_VRM_RIG_MAP: Partial<Record<string, VRMHumanBoneName>> = {
  mixamorigHips: VRMHumanBoneName.Hips,
  mixamorigSpine: VRMHumanBoneName.Spine,
  mixamorigSpine1: VRMHumanBoneName.Chest,
  mixamorigSpine2: VRMHumanBoneName.UpperChest,
  mixamorigNeck: VRMHumanBoneName.Neck,
  mixamorigHead: VRMHumanBoneName.Head,
  mixamorigLeftShoulder: VRMHumanBoneName.LeftShoulder,
  mixamorigLeftArm: VRMHumanBoneName.LeftUpperArm,
  mixamorigLeftForeArm: VRMHumanBoneName.LeftLowerArm,
  mixamorigLeftHand: VRMHumanBoneName.LeftHand,
  mixamorigLeftHandThumb1: VRMHumanBoneName.LeftThumbMetacarpal,
  mixamorigLeftHandThumb2: VRMHumanBoneName.LeftThumbProximal,
  mixamorigLeftHandThumb3: VRMHumanBoneName.LeftThumbDistal,
  mixamorigLeftHandIndex1: VRMHumanBoneName.LeftIndexProximal,
  mixamorigLeftHandIndex2: VRMHumanBoneName.LeftIndexIntermediate,
  mixamorigLeftHandIndex3: VRMHumanBoneName.LeftIndexDistal,
  mixamorigLeftHandMiddle1: VRMHumanBoneName.LeftMiddleProximal,
  mixamorigLeftHandMiddle2: VRMHumanBoneName.LeftMiddleIntermediate,
  mixamorigLeftHandMiddle3: VRMHumanBoneName.LeftMiddleDistal,
  mixamorigLeftHandRing1: VRMHumanBoneName.LeftRingProximal,
  mixamorigLeftHandRing2: VRMHumanBoneName.LeftRingIntermediate,
  mixamorigLeftHandRing3: VRMHumanBoneName.LeftRingDistal,
  mixamorigLeftHandPinky1: VRMHumanBoneName.LeftLittleProximal,
  mixamorigLeftHandPinky2: VRMHumanBoneName.LeftLittleIntermediate,
  mixamorigLeftHandPinky3: VRMHumanBoneName.LeftLittleDistal,
  mixamorigRightShoulder: VRMHumanBoneName.RightShoulder,
  mixamorigRightArm: VRMHumanBoneName.RightUpperArm,
  mixamorigRightForeArm: VRMHumanBoneName.RightLowerArm,
  mixamorigRightHand: VRMHumanBoneName.RightHand,
  mixamorigRightHandThumb1: VRMHumanBoneName.RightThumbMetacarpal,
  mixamorigRightHandThumb2: VRMHumanBoneName.RightThumbProximal,
  mixamorigRightHandThumb3: VRMHumanBoneName.RightThumbDistal,
  mixamorigRightHandIndex1: VRMHumanBoneName.RightIndexProximal,
  mixamorigRightHandIndex2: VRMHumanBoneName.RightIndexIntermediate,
  mixamorigRightHandIndex3: VRMHumanBoneName.RightIndexDistal,
  mixamorigRightHandMiddle1: VRMHumanBoneName.RightMiddleProximal,
  mixamorigRightHandMiddle2: VRMHumanBoneName.RightMiddleIntermediate,
  mixamorigRightHandMiddle3: VRMHumanBoneName.RightMiddleDistal,
  mixamorigRightHandRing1: VRMHumanBoneName.RightRingProximal,
  mixamorigRightHandRing2: VRMHumanBoneName.RightRingIntermediate,
  mixamorigRightHandRing3: VRMHumanBoneName.RightRingDistal,
  mixamorigRightHandPinky1: VRMHumanBoneName.RightLittleProximal,
  mixamorigRightHandPinky2: VRMHumanBoneName.RightLittleIntermediate,
  mixamorigRightHandPinky3: VRMHumanBoneName.RightLittleDistal,
  mixamorigLeftUpLeg: VRMHumanBoneName.LeftUpperLeg,
  mixamorigLeftLeg: VRMHumanBoneName.LeftLowerLeg,
  mixamorigLeftFoot: VRMHumanBoneName.LeftFoot,
  mixamorigLeftToeBase: VRMHumanBoneName.LeftToes,
  mixamorigRightUpLeg: VRMHumanBoneName.RightUpperLeg,
  mixamorigRightLeg: VRMHumanBoneName.RightLowerLeg,
  mixamorigRightFoot: VRMHumanBoneName.RightFoot,
  mixamorigRightToeBase: VRMHumanBoneName.RightToes,
};

async function loadMixamoAnimForVRM(url: string, vrm: VRM): Promise<THREE.AnimationClip> {
  const loader = new FBXLoader();
  const asset = await new Promise<THREE.Group>((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });

  const animations = (asset as any).animations as THREE.AnimationClip[];
  const clip = THREE.AnimationClip.findByName(animations, 'mixamo.com') ?? animations[0];
  if (!clip) throw new Error('No animation clip found in FBX');

  const isVRM0 = vrm.meta?.metaVersion === '0';
  const tracks: THREE.KeyframeTrack[] = [];

  const restRotInv = new THREE.Quaternion();
  const parentRestWorldQuat = new THREE.Quaternion();
  const _q = new THREE.Quaternion();


  for (const track of clip.tracks) {
    const parts = track.name.split('.');
    const property = parts.pop();
    const mixamoRigName = parts.join('.');

    const vrmBoneName = MIXAMO_VRM_RIG_MAP[mixamoRigName];
    if (!vrmBoneName) continue;

    const vrmNode = vrm.humanoid.getNormalizedBoneNode(vrmBoneName);
    const mixamoNode = asset.getObjectByName(mixamoRigName);
    if (!vrmNode || !mixamoNode) continue;
    if (!vrmNode.name) vrmNode.name = String(vrmBoneName);

    if (track instanceof THREE.QuaternionKeyframeTrack) {
      // Skip hips rotation — Mixamo animations often bake a yaw into the hips that
      // spins the whole character. The torso bones (spine upward) still animate fully.
      if (vrmBoneName === VRMHumanBoneName.Hips) continue;

      // Retarget: parentWorldRot * trackQuat * restWorldRotInv
      mixamoNode.getWorldQuaternion(restRotInv).invert();
      if (mixamoNode.parent) mixamoNode.parent.getWorldQuaternion(parentRestWorldQuat);
      else parentRestWorldQuat.identity();

      const isTrunkBone = (
        vrmBoneName === VRMHumanBoneName.Spine ||
        vrmBoneName === VRMHumanBoneName.Chest ||
        vrmBoneName === VRMHumanBoneName.UpperChest ||
        vrmBoneName === VRMHumanBoneName.LeftUpperLeg ||
        vrmBoneName === VRMHumanBoneName.RightUpperLeg
      );

      const _euler = isTrunkBone ? new THREE.Euler() : null;
      const values = track.values.slice();
      for (let i = 0; i < values.length; i += 4) {
        _q.fromArray(values, i);
        _q.premultiply(parentRestWorldQuat).multiply(restRotInv);
        // Strip lateral Z-roll from trunk bones — Mixamo idle weight-shifts bake a
        // sideways tilt into spine/chest that makes the character lean left.
        if (_euler) {
          _euler.setFromQuaternion(_q, 'XYZ');
          _euler.z = 0;
          _q.setFromEuler(_euler);
        }
        _q.toArray(values, i);
      }

      tracks.push(new THREE.QuaternionKeyframeTrack(
        `${vrmNode.name}.quaternion`,
        track.times,
        // VRM 0.x has a mirrored X axis — flip x and z components
        isVRM0 ? values.map((v, i) => (i % 2 === 0 ? -v : v)) : values,
      ));
    } else if (track instanceof THREE.VectorKeyframeTrack && property === 'position') {
      // Skip position tracks — keeping absolute hips Y causes drift when the VRM scene
      // has an initialYshift offset (hipsScale goes negative). Rotation tracks alone are
      // sufficient; the character stays where the user placed it.
      continue;
    }
  }

  if (tracks.length === 0) throw new Error(`No tracks retargeted from ${url}`);
  return new THREE.AnimationClip('vrm-state-anim', clip.duration, tracks);
}

// ============================================================
// VrmAnimationManager — procedural head/eye/blink state machine
// Ported from riko_project_feb13-2026/client/animationManager.js
// ============================================================
class VrmAnimationManager {
  private vrm: VRM;
  state: 'idle' | 'listening' | 'thinking' | 'talking' = 'idle';

  private stateTimer = 0;
  private isTransitioning = false;
  private transitionTimer = 0;
  private movementLocked = false;
  private movementLockTimer = 0;

  private headTgt = { x: 0, y: 0, z: 0 };
  private headCur = { x: 0, y: 0, z: 0 };
  private headVelocity = { x: 0, y: 0, z: 0 };
  private headTimer = 0;
  private eyeTimer = 0;
  private eyeLeadTimer = 0;
  private _pendingHeadTarget: { x: number; y: number; z: number } | null = null;

  eyeLookAtTarget: THREE.Object3D;
  private eyeTgtPos = new THREE.Vector3(0, 0, 5);

  private bodyTimer = 0;
  private bodyTgt = { x: 0 };
  private bodyCur = { x: 0 };

  private blinkTimer = 0;
  private nextBlink = 1.5;
  private blinkVal = 0;

  private idleLookingAtUser = false;
  private idleLookAtUserTimer = 0;
  private listeningSideLook = false;
  private listeningSideLookTimer = 0;
  private listeningSideDirection = 1;
  private talkingNodPhase = 0;
  private talkingCurrentNodFreq = 2.0;
  private talkingCurrentNodIntensity = 0.2;
  private talkingNextNodChange = 0;
  private thinkingLookingAtUser = false;
  private thinkingLookAtUserTimer = 0;

  isMixamoPlaying = false;
  isSpeaking = false;

  private readonly cfg = {
    headNod: 0.2,
    headTurn: 0.13,
    blinkMin: 0.5, blinkMax: 3.0, blinkSpeed: 8.0,
    transitionLockDuration: 0.5,
    transitionEaseSpeed: 0.08,
    headAcceleration: 0.001,
    headDamping: 0.85,
    stateAcceleration: { idle: 1.0, listening: 8.0, thinking: 2.0, talking: 10.0 } as Record<string, number>,
    stateConfig: {
      idle: {
        lookDuration: 3.0, lookChangeChance: 0.3,
        headRangeX: 0.25, headRangeY: 0.75, headRangeZ: 0.18,
        eyeRange: 7.0,
        lookAtUserChance: 0.35, lookAtUserDurationMin: 1.5, lookAtUserDurationMax: 3.5,
        lookAtUserEyeReset: true,
      },
      listening: {
        nodIntensity: 0.35, nodCount: 2,
        eyeRange: 5.0,
        sideLookChance: 0.15, sideLookDurationMin: 1.0, sideLookDurationMax: 3.0,
        sideLookHeadTurn: 0.15, sideLookEyeRange: 4.0,
        focusOnUser: true,
      },
      thinking: {
        lookDuration: 1.5, lookChangeChance: 0.35,
        headRangeX: 0.12, headRangeY: 0.25, headRangeZ: 0.12,
        eyeRange: 6.0, lookUpBias: 0.6,
        eyeLeadTime: 0.1, eyeLeadAmount: 1.1, eyeHeadSync: 0.8,
        lookAtUserChance: 0.3, lookAtUserDurationMin: 1.0, lookAtUserDurationMax: 2.0,
      },
      talking: {
        nodIntensity: 0.5, nodFrequency: 1.8, nodVariation: 0.6,
        occasionalTurn: 0.2, eyeRange: 6.0,
        nodIntensityVariation: 0.4, nodFrequencyVariation: 0.5, nodChangeInterval: 1.5,
        tiltChance: 0.25, tiltIntensity: 0.08,
      },
    },
  };

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.eyeLookAtTarget = new THREE.Object3D();
    this.eyeLookAtTarget.position.set(0, 0, 5);
    vrm.scene.add(this.eyeLookAtTarget);
    if (vrm.lookAt) vrm.lookAt.target = this.eyeLookAtTarget;
    this.nextBlink = this.rand(this.cfg.blinkMin, this.cfg.blinkMax);
  }

  setState(newState: 'idle' | 'listening' | 'thinking' | 'talking') {
    if (this.state === newState) return;
    this.state = newState;
    this.stateTimer = 0;
    this.isTransitioning = true;
    this.transitionTimer = 0;
    this.headTgt = { x: 0, y: 0, z: 0 };
    this.eyeTgtPos.set(0, 0, 5);
    this.headTimer = 0; this.eyeTimer = 0; this.eyeLeadTimer = 0;
    this.idleLookingAtUser = false; this.idleLookAtUserTimer = 0;
    this.listeningSideLook = false; this.listeningSideLookTimer = 0;
    this.talkingNextNodChange = 0;
    this.thinkingLookingAtUser = false; this.thinkingLookAtUserTimer = 0;
    this._pendingHeadTarget = null;
    this.movementLocked = false; this.movementLockTimer = 0;
  }

  private rand(min: number, max: number) { return min + Math.random() * (max - min); }

  private smoothEase(cur: number, tgt: number, vel: number, acc: number, damp: number, dt: number) {
    const nv = (vel + (tgt - cur) * acc) * damp;
    return { value: cur + nv * dt * 60, velocity: nv };
  }

  private updateHeadWithPhysics(dt: number) {
    const acc = this.cfg.headAcceleration * (this.cfg.stateAcceleration[this.state] ?? 1);
    const d = this.cfg.headDamping;
    const xr = this.smoothEase(this.headCur.x, this.headTgt.x, this.headVelocity.x, acc, d, dt);
    const yr = this.smoothEase(this.headCur.y, this.headTgt.y, this.headVelocity.y, acc, d, dt);
    const zr = this.smoothEase(this.headCur.z, this.headTgt.z, this.headVelocity.z, acc, d, dt);
    this.headCur.x = xr.value; this.headVelocity.x = xr.velocity;
    this.headCur.y = yr.value; this.headVelocity.y = yr.velocity;
    this.headCur.z = zr.value; this.headVelocity.z = zr.velocity;
  }

  private centerHead(ease = 0.04): boolean {
    this.headCur.x += (0 - this.headCur.x) * ease;
    this.headCur.y += (0 - this.headCur.y) * ease;
    this.headCur.z += (0 - this.headCur.z) * ease;
    this.headVelocity.x *= 0.9; this.headVelocity.y *= 0.9; this.headVelocity.z *= 0.9;
    this.eyeTgtPos.set(0, 0, 5);
    this.eyeLookAtTarget.position.lerp(this.eyeTgtPos, ease * 1.5);
    const t = 0.02;
    return Math.abs(this.headCur.x) < t && Math.abs(this.headCur.y) < t && Math.abs(this.headCur.z) < t;
  }

  private updateIdleState(dt: number, cfg: typeof this.cfg.stateConfig.idle) {
    this.headTimer += dt; this.eyeTimer += dt;
    if (this.idleLookingAtUser) {
      this.idleLookAtUserTimer -= dt;
      if (this.idleLookAtUserTimer <= 0) { this.idleLookingAtUser = false; this.headTimer = 0; }
    } else if (this.headTimer > cfg.lookDuration) {
      if (Math.random() < cfg.lookAtUserChance) {
        this.idleLookingAtUser = true;
        this.idleLookAtUserTimer = this.rand(cfg.lookAtUserDurationMin, cfg.lookAtUserDurationMax);
        this.headTgt = { x: 0, y: 0, z: 0 };
        if (cfg.lookAtUserEyeReset) this.eyeTgtPos.set(0, 0, 5);
        this.headTimer = 0;
      } else if (Math.random() < cfg.lookChangeChance) {
        const angle = Math.random() * Math.PI * 2;
        const rm = 0.6 + Math.random() * 0.4;
        this.headTgt.x = Math.sin(angle) * cfg.headRangeX * rm;
        this.headTgt.y = Math.cos(angle) * cfg.headRangeY * rm;
        this.headTgt.z = this.rand(-cfg.headRangeZ, cfg.headRangeZ) * rm;
        this.eyeTgtPos.x = Math.sin(angle) * cfg.eyeRange;
        this.eyeTgtPos.y = Math.cos(angle) * cfg.eyeRange * 0.4;
        this.eyeTgtPos.z = 5 + Math.cos(angle) * 1.5;
        this.headTimer = 0;
      }
    }
    this.updateHeadWithPhysics(dt);
    this.eyeLookAtTarget.position.lerp(this.eyeTgtPos, 0.025);
  }

  private updateListeningState(dt: number, cfg: typeof this.cfg.stateConfig.listening) {
    this.headTimer += dt; this.eyeTimer += dt;
    if (this.listeningSideLook) {
      this.listeningSideLookTimer -= dt;
      if (this.listeningSideLookTimer <= 0) {
        this.listeningSideLook = false;
        this.headTgt.y = 0;
        this.eyeTgtPos.set(0, 0, 5);
      }
    } else if (Math.random() < cfg.sideLookChance * dt) {
      this.listeningSideLook = true;
      this.listeningSideLookTimer = this.rand(cfg.sideLookDurationMin, cfg.sideLookDurationMax);
      this.listeningSideDirection = Math.random() < 0.5 ? -1 : 1;
      this.headTgt.y = cfg.sideLookHeadTurn * this.listeningSideDirection;
      this.eyeTgtPos.x = cfg.sideLookEyeRange * this.listeningSideDirection;
      this.eyeTgtPos.y = 0; this.eyeTgtPos.z = 5;
    }
    const nodCycle = 2.5;
    const cyclePhase = (this.stateTimer % nodCycle) / nodCycle;
    if (!this.listeningSideLook) {
      if (cyclePhase < 0.4) {
        const nodPhase = (cyclePhase / 0.4) * Math.PI * 2 * cfg.nodCount;
        this.headTgt.x = Math.sin(nodPhase) * this.cfg.headNod * cfg.nodIntensity;
      } else {
        this.headTgt.x *= 0.9;
      }
      if (cfg.focusOnUser && this.eyeTimer > 2.0) {
        this.eyeTgtPos.x = this.rand(-1, 1); this.eyeTgtPos.y = this.rand(-0.5, 0.5); this.eyeTgtPos.z = 5;
        this.eyeTimer = 0;
      }
    }
    this.updateHeadWithPhysics(dt);
    this.eyeLookAtTarget.position.lerp(this.eyeTgtPos, 0.03);
  }

  private updateThinkingState(dt: number, cfg: typeof this.cfg.stateConfig.thinking) {
    this.headTimer += dt; this.eyeTimer += dt; this.eyeLeadTimer += dt;
    if (this.thinkingLookingAtUser) {
      this.thinkingLookAtUserTimer -= dt;
      if (this.thinkingLookAtUserTimer <= 0) { this.thinkingLookingAtUser = false; this.headTimer = 0; }
    } else if (this.headTimer > cfg.lookDuration) {
      if (Math.random() < cfg.lookAtUserChance) {
        this.thinkingLookingAtUser = true;
        this.thinkingLookAtUserTimer = this.rand(cfg.lookAtUserDurationMin, cfg.lookAtUserDurationMax);
        this.eyeTgtPos.set(0, 0, 5);
        this._pendingHeadTarget = { x: 0, y: 0, z: 0 };
        this.eyeLeadTimer = 0; this.headTimer = 0;
      } else if (Math.random() < cfg.lookChangeChance) {
        const angle = (Math.random() * Math.PI * 1.6) - (Math.PI * 0.3);
        const upBias = cfg.lookUpBias * 0.25;
        const eyeSync = Math.random() < cfg.eyeHeadSync;
        if (eyeSync) {
          this.eyeTgtPos.x = Math.sin(angle) * cfg.eyeRange * cfg.eyeLeadAmount;
          this.eyeTgtPos.y = (cfg.eyeRange * 0.6 + upBias * 10) * cfg.eyeLeadAmount;
          this.eyeTgtPos.z = 4;
        } else {
          const da = Math.random() * Math.PI * 2;
          this.eyeTgtPos.x = Math.sin(da) * cfg.eyeRange * 0.6;
          this.eyeTgtPos.y = cfg.eyeRange * 0.4; this.eyeTgtPos.z = 5;
        }
        this._pendingHeadTarget = {
          x: Math.sin(angle) * cfg.headRangeX + upBias,
          y: Math.cos(angle) * cfg.headRangeY,
          z: this.rand(-cfg.headRangeZ, cfg.headRangeZ),
        };
        this.eyeLeadTimer = 0; this.headTimer = 0;
      }
    }
    if (this._pendingHeadTarget && this.eyeLeadTimer >= cfg.eyeLeadTime) {
      this.headTgt.x = this._pendingHeadTarget.x;
      this.headTgt.y = this._pendingHeadTarget.y;
      this.headTgt.z = this._pendingHeadTarget.z;
      this._pendingHeadTarget = null;
    }
    this.updateHeadWithPhysics(dt);
    this.eyeLookAtTarget.position.lerp(this.eyeTgtPos, 0.04);
  }

  private updateTalkingState(dt: number, cfg: typeof this.cfg.stateConfig.talking) {
    this.headTimer += dt; this.eyeTimer += dt; this.talkingNodPhase += dt;
    if (this.stateTimer > this.talkingNextNodChange) {
      this.talkingCurrentNodFreq = cfg.nodFrequency * (1 + (Math.random() * 2 - 1) * cfg.nodFrequencyVariation);
      this.talkingCurrentNodIntensity = cfg.nodIntensity * (1 + (Math.random() * 2 - 1) * cfg.nodIntensityVariation);
      this.talkingNextNodChange = this.stateTimer + cfg.nodChangeInterval * (0.7 + Math.random() * 0.6);
    }
    if (Math.random() > 0.15) {
      const nodPhase = (this.talkingNodPhase * this.talkingCurrentNodFreq * Math.PI * 2) % (Math.PI * 2);
      this.headTgt.x = Math.sin(nodPhase) * (0.7 + Math.random() * 0.3) * this.talkingCurrentNodIntensity * cfg.nodVariation * this.cfg.headNod;
    } else {
      this.headTgt.x *= 0.9;
    }
    if (Math.random() < cfg.tiltChance * dt) {
      this.headTgt.z = cfg.tiltIntensity * (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.4);
    }
    if (Math.random() < cfg.occasionalTurn * dt * 0.5) {
      this.headTgt.y = this.rand(-this.cfg.headTurn * 0.15, this.cfg.headTurn * 0.15);
    }
    this.headTgt.y *= 0.95; this.headTgt.z *= 0.94;
    if (this.eyeTimer > 2.5) {
      const s = Math.random() * 0.4 - 0.2;
      this.eyeTgtPos.x = Math.sin(s) * cfg.eyeRange * 0.3;
      this.eyeTgtPos.y = this.rand(-1, 1); this.eyeTgtPos.z = 5;
      this.eyeTimer = 0;
    }
    this.updateHeadWithPhysics(dt);
    this.eyeLookAtTarget.position.lerp(this.eyeTgtPos, 0.025);
  }

  update(dt: number) {
    if (!this.vrm?.expressionManager) return;

    // Blinking — always runs
    this.blinkTimer += dt;
    if (this.blinkTimer > this.nextBlink) {
      this.blinkTimer = 0;
      this.nextBlink = this.rand(this.cfg.blinkMin, this.cfg.blinkMax);
    }
    this.blinkVal += (this.blinkTimer < 0.1 ? dt : -dt) * this.cfg.blinkSpeed;
    this.blinkVal = Math.max(0, Math.min(1, this.blinkVal));
    this.vrm.expressionManager.setValue('blink', this.blinkVal);

    // Transition / lock phases
    if (this.isTransitioning) {
      this.transitionTimer += dt;
      const centered = this.centerHead(this.cfg.transitionEaseSpeed);
      if (centered && this.transitionTimer >= 0.4) {
        this.isTransitioning = false;
        this.movementLocked = true;
        this.movementLockTimer = 0;
        this.headVelocity = { x: 0, y: 0, z: 0 };
      }
    } else if (this.movementLocked) {
      this.movementLockTimer += dt;
      this.headTgt = { x: 0, y: 0, z: 0 };
      this.updateHeadWithPhysics(dt);
      this.eyeTgtPos.set(0, 0, 5);
      this.eyeLookAtTarget.position.lerp(this.eyeTgtPos, 0.05);
      if (this.movementLockTimer >= this.cfg.transitionLockDuration) this.movementLocked = false;
    } else {
      const sc = this.cfg.stateConfig as Record<string, any>;
      const stateCfg = sc[this.state];
      if (this.state === 'idle') this.updateIdleState(dt, stateCfg);
      else if (this.state === 'listening') this.updateListeningState(dt, stateCfg);
      else if (this.state === 'thinking') this.updateThinkingState(dt, stateCfg);
      else if (this.state === 'talking') this.updateTalkingState(dt, stateCfg);
    }
    this.stateTimer += dt;

    // Apply head/neck — always, even when Mixamo plays (overrides FBX head tracks)
    const neck = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Neck);
    if (neck) neck.rotation.set(this.headCur.x * 0.4, this.headCur.y * 0.5, this.headCur.z * 0.5);
    const head = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Head);
    if (head) head.rotation.set(this.headCur.x * 0.6, this.headCur.y * 0.5, this.headCur.z * 0.5);

    // Skip body/arms when FBX animation is handling them
    if (this.isMixamoPlaying) return;

    // Body sway
    this.bodyTimer += dt;
    if (this.bodyTimer > 2.8) { this.bodyTgt.x = this.rand(-0.05, 0.05); this.bodyTimer = 0; }
    this.bodyCur.x += (this.bodyTgt.x - this.bodyCur.x) * 0.01;
    const spine = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Spine);
    if (spine) spine.rotation.x = this.bodyCur.x;

    // Arms-down default
    const la = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm);
    const ra = this.vrm.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm);
    if (la) la.rotation.z = -1.2;
    if (ra) ra.rotation.z = 1.2;
  }

  destroy() {
    if (this.vrm.scene.children.includes(this.eyeLookAtTarget)) {
      this.vrm.scene.remove(this.eyeLookAtTarget);
    }
    if (this.vrm.lookAt) this.vrm.lookAt.target = undefined as any;
  }
}

export const VrmViewer = memo(() => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const requestRef = useRef<number>();
  const vrmRef = useRef<VRM | null>(null);
  const rootOffsetRef = useRef<THREE.Vector3 | null>(null);
  const modelBasePositionRef = useRef<THREE.Vector3 | null>(null);
  const glbModelRef = useRef<THREE.Object3D | null>(null);
  const roomModelRef = useRef<THREE.Object3D | null>(null);
  const vrButtonRef = useRef<HTMLElement | null>(null);
  const glbBonesRef = useRef<Map<string, THREE.Bone>>(new Map());
  // Index for "normalized" lookups (case-insensitive, strips common Mixamo prefixes).
  // This avoids situations where a model has bones named "mixamorig:Hips" while the
  // animation track references "Hips" (or vice versa).
  const glbBonesNormalizedRef = useRef<Map<string, THREE.Bone>>(new Map());
  // Used for debugging and to ensure we target the bones that actually drive the mesh.
  const glbSkinnedMeshesRef = useRef<THREE.SkinnedMesh[]>([]);
  const skeletonHelperRef = useRef<THREE.SkeletonHelper | null>(null);
  const initialBoneTransformsRef = useRef<Map<string, { q: THREE.Quaternion; p: THREE.Vector3 }>>(new Map());
  
  // Animation Refs
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const loadedClipsRef = useRef<THREE.AnimationClip[]>([]);
  const [clipNames, setClipNames] = useState<string[]>([]);
  const [selectedClipName, setSelectedClipName] = useState<string>('');
  const [isProceduralPlaying, setIsProceduralPlaying] = useState(false);
  const proceduralActiveRef = useRef(false);
  const proceduralStartRef = useRef(0);
  const proceduralBaseQuatRef = useRef<Map<string, THREE.Quaternion>>(new Map());
  const proceduralNodesRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const [activePoseProfile, setActivePoseProfile] = useState<string>('');

  // Animation Manager refs
  const animMgrRef = useRef<VrmAnimationManager | null>(null);
  const currentStateAnimUrlRef = useRef<string>('');
  const stateAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVrmaPlayingRef = useRef(false);
  const seatedContactRef = useRef<SeatedContactTarget | null>(null);
  const rapierModuleRef = useRef<any | null>(null);
  const rapierReadyRef = useRef(false);
  const rapierInitPromiseRef = useRef<Promise<void> | null>(null);
  const seatedRapierRef = useRef<SeatedRapierHarness | null>(null);
  const walkTargetRef = useRef<WalkTarget | null>(null);
  const sceneObjectBaseTransformRef = useRef<Map<string, {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    visible: boolean;
  }>>(new Map());
  const lanternLitRef = useRef(true);

  const { modelInfo } = useLive2DConfig();
  const { mode } = useMode();
  const { forceIgnoreMouse } = useForceIgnoreMouse();
  const { aiState } = useAiState();

  // --- Pose Fix States ---
  const [invertLegs, setInvertLegs] = useState(true);
  const [flipHips, setFlipHips] = useState(true);
  // This is used as a global "an animation is currently driving the rig"
  // flag (VRMA, embedded GLB clips, uploaded GLB clips).
  const [isVrmaPlaying, setIsVrmaPlaying] = useState(false);
  const isAnyAnimationPlaying = isVrmaPlaying || isProceduralPlaying;

  // --- Rig Debug UI (bone list + sliders) ---
  const [rigBones, setRigBones] = useState<string[]>([]);
  const [rigSearch, setRigSearch] = useState<string>('');
  const [selectedBone, setSelectedBone] = useState<string>('');
  const [rigRotDeg, setRigRotDeg] = useState<Vec3>({ x: 0, y: 0, z: 0 });
  const [rigPos, setRigPos] = useState<Vec3>({ x: 0, y: 0, z: 0 });
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [rigModelStamp, setRigModelStamp] = useState(0);

  // --- Transform UI ---
  const [vrmScale, setVrmScale] = useState(1.0);
  const [vrmPosX, setVrmPosX] = useState(0.0);
  const [vrmPosY, setVrmPosY] = useState(0.0);
  const [vrmPosZ, setVrmPosZ] = useState(0.0);
  const [vrmRotY, setVrmRotY] = useState(0.0);
  const [scenePos, setScenePos] = useState<Vec3>({ x: 0, y: 0, z: 0 });
  const [sceneRotDeg, setSceneRotDeg] = useState<Vec3>({ x: 0, y: 0, z: 0 });
  const [sceneScale, setSceneScale] = useState(1.0);

  const normalizedConfig = useMemo(() => {
    if (!modelInfo) return null;
    const zoom = safeNumber(modelInfo.vrmZoom as number | undefined, 0.4);
    const baseCameraPosition = (modelInfo.cameraPosition as [number, number, number] | undefined)
      ?? [0, 1.3, 1.2];
    
    const zoomedCameraPosition: [number, number, number] = [
      baseCameraPosition[0] * zoom,
      baseCameraPosition[1],
      baseCameraPosition[2] * zoom,
    ];

    return {
      url: modelInfo.url,
      scale: safeNumber(modelInfo.kScale as number | undefined, 0.88),
      x: safeNumber(modelInfo.initialXshift as number | undefined, 0),
      y: safeNumber(modelInfo.initialYshift as number | undefined, 0),
      autoRotate: (modelInfo.autoRotate as boolean | undefined) ?? false,
      cameraPosition: zoomedCameraPosition,
      cameraTarget: (modelInfo.cameraTarget as [number, number, number] | undefined)
        ?? [0, 1.3, 0],
      backgroundColor: modelInfo.backgroundColor as string | undefined,
      zoom,
      vrmRotY: safeNumber(modelInfo.vrmRotY as number | undefined, 0),
      vrmPosZ: safeNumber(modelInfo.vrmPosZ as number | undefined, 0),
      sceneGlb: modelInfo.sceneGlb as string | undefined,
      sceneGlbPosition: modelInfo.sceneGlbPosition as [number, number, number] | undefined,
      sceneGlbRotation: modelInfo.sceneGlbRotation as [number, number, number] | undefined,
      sceneGlbScale: modelInfo.sceneGlbScale as number | [number, number, number] | undefined,
      scenePreset: modelInfo.scenePreset as string | undefined,
    };
  }, [modelInfo]);

  const applyMotionToAvatar = useCallback((motion: VrmMotionMessage) => {
    if (isVrmaPlaying) return;
    if (!motion?.bones || motion.bones.length === 0) return;
    
    const vrm = vrmRef.current;
    const glbModel = glbModelRef.current;
    const glbBones = glbBonesRef.current;

    const isVRM = vrm?.humanoid != null;
    const isGLB = glbModel != null && glbBones.size > 0;

    if (!isVRM && !isGLB) return;
    // Disable GLB motion application for now; only VRM avatars are supported
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
        const boneNameMap: Record<string, string> = {
          'hips': 'Hips', 'spine': 'Spine', 'neck': 'Neck', 'head': 'Head',
          'leftUpperLeg': 'LeftUpLeg', 'leftLowerLeg': 'LeftLeg', 'leftFoot': 'LeftFoot',
          'rightUpperLeg': 'RightUpLeg', 'rightLowerLeg': 'RightLeg', 'rightFoot': 'RightFoot',
          'leftUpperArm': 'LeftArm', 'leftLowerArm': 'LeftForeArm',
          'rightUpperArm': 'RightArm', 'rightLowerArm': 'RightForeArm',
        };
        const rpmName = boneNameMap[bone.name] || bone.name;
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
  }, [flipHips, invertLegs, isVrmaPlaying]);

  const getCurrentModelRoot = useCallback(() => (
    vrmRef.current?.scene ?? glbModelRef.current
  ), []);

  type LogicalBone =
    | 'hips'
    | 'spine'
    | 'chest'
    | 'upperChest'
    | 'neck'
    | 'head'
    | 'leftShoulder'
    | 'leftUpperArm'
    | 'leftLowerArm'
    | 'leftHand'
    | 'rightShoulder'
    | 'rightUpperArm'
    | 'rightLowerArm'
    | 'rightHand'
    | 'leftUpperLeg'
    | 'leftLowerLeg'
    | 'leftFoot'
    | 'rightUpperLeg'
    | 'rightLowerLeg'
    | 'rightFoot';

  const getLogicalBoneNode = useCallback((key: LogicalBone): THREE.Object3D | null => {
    const vrm = vrmRef.current;
    if (vrm?.humanoid) {
      const map: Partial<Record<LogicalBone, VRMHumanBoneName>> = {
        hips: VRMHumanBoneName.Hips,
        spine: VRMHumanBoneName.Spine,
        chest: VRMHumanBoneName.Chest,
        upperChest: VRMHumanBoneName.UpperChest,
        neck: VRMHumanBoneName.Neck,
        head: VRMHumanBoneName.Head,
        leftShoulder: VRMHumanBoneName.LeftShoulder,
        leftUpperArm: VRMHumanBoneName.LeftUpperArm,
        leftLowerArm: VRMHumanBoneName.LeftLowerArm,
        leftHand: VRMHumanBoneName.LeftHand,
        rightShoulder: VRMHumanBoneName.RightShoulder,
        rightUpperArm: VRMHumanBoneName.RightUpperArm,
        rightLowerArm: VRMHumanBoneName.RightLowerArm,
        rightHand: VRMHumanBoneName.RightHand,
        leftUpperLeg: VRMHumanBoneName.LeftUpperLeg,
        leftLowerLeg: VRMHumanBoneName.LeftLowerLeg,
        leftFoot: VRMHumanBoneName.LeftFoot,
        rightUpperLeg: VRMHumanBoneName.RightUpperLeg,
        rightLowerLeg: VRMHumanBoneName.RightLowerLeg,
        rightFoot: VRMHumanBoneName.RightFoot,
      };
      const vrmKey = map[key];
      return vrmKey ? (vrm.humanoid.getNormalizedBoneNode(vrmKey) ?? null) : null;
    }

    // GLB: prefer Mixamo-style normalized names.
    const get = (name: string) => glbBonesNormalizedRef.current.get(name.toLowerCase()) ?? null;
    const glbMap: Partial<Record<LogicalBone, string>> = {
      hips: 'Hips',
      spine: 'Spine',
      chest: 'Spine1',
      upperChest: 'Spine2',
      neck: 'Neck',
      head: 'Head',
      leftShoulder: 'LeftShoulder',
      leftUpperArm: 'LeftArm',
      leftLowerArm: 'LeftForeArm',
      leftHand: 'LeftHand',
      rightShoulder: 'RightShoulder',
      rightUpperArm: 'RightArm',
      rightLowerArm: 'RightForeArm',
      rightHand: 'RightHand',
      leftUpperLeg: 'LeftUpLeg',
      leftLowerLeg: 'LeftLeg',
      leftFoot: 'LeftFoot',
      rightUpperLeg: 'RightUpLeg',
      rightLowerLeg: 'RightLeg',
      rightFoot: 'RightFoot',
    };
    const glbName = glbMap[key];
    return glbName ? get(glbName) : null;
  }, []);

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

  const disposeSeatedRapier = useCallback(() => {
    seatedRapierRef.current = null;
  }, []);

  const createSeatedRapierHarness = useCallback((sitPoint: [number, number, number]) => {
    const RAPIER = rapierModuleRef.current;
    if (!rapierReadyRef.current || !RAPIER) return null;

    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    world.timestep = 1 / 60;

    const floorBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.025, 0));
    const floorCollider = world.createCollider(RAPIER.ColliderDesc.cuboid(6, 0.025, 5), floorBody);

    const seatBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(sitPoint[0], sitPoint[1] - 0.19, sitPoint[2]));
    const seatCollider = world.createCollider(RAPIER.ColliderDesc.cuboid(0.34, 0.08, 0.34), seatBody);

    const pelvisBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(sitPoint[0], sitPoint[1] + 0.04, sitPoint[2])
        .setLinearDamping(14)
        .setAngularDamping(12)
        .setCanSleep(false),
    );
    const pelvisCollider = world.createCollider(
      RAPIER.ColliderDesc.ball(0.16)
        .setRestitution(0)
        .setFriction(1.2),
      pelvisBody,
    );

    seatedRapierRef.current = {
      world,
      pelvisBody,
      pelvisCollider,
      seatCollider,
      floorCollider,
      desiredPelvis: new THREE.Vector3(sitPoint[0], sitPoint[1], sitPoint[2]),
    };
    return seatedRapierRef.current;
  }, []);

  const getBoneNode = useCallback((boneKey: string): THREE.Object3D | null => {
    const vrm = vrmRef.current;
    if (vrm?.humanoid) {
      return vrm.humanoid.getNormalizedBoneNode(boneKey as VRMHumanBoneName) ?? null;
    }
    return glbBonesRef.current.get(boneKey) ?? null;
  }, []);

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
  }, [getBoneNode]);

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
  }, [getBoneNode, updateRigStateFromBone]);

  const resetAllBones = useCallback(() => {
    for (const [boneKey, initial] of initialBoneTransformsRef.current.entries()) {
      const node = getBoneNode(boneKey);
      if (!node) continue;
      node.quaternion.copy(initial.q);
      node.position.copy(initial.p);
      node.updateMatrixWorld(true);
    }
    if (selectedBone) updateRigStateFromBone(selectedBone);
  }, [getBoneNode, selectedBone, updateRigStateFromBone]);

  const resetModelRootPosition = useCallback(() => {
    const root = getCurrentModelRoot();
    if (!root || !modelBasePositionRef.current) return;
    root.position.copy(modelBasePositionRef.current);
    root.updateMatrixWorld(true);
  }, [getCurrentModelRoot]);

  const applyVrmTransform = useCallback((scale: number, posX: number, posY: number, posZ: number, rotYDeg: number) => {
    const root = getCurrentModelRoot();
    if (!root) return;
    root.scale.setScalar(scale);
    root.position.x = posX;
    root.position.y = posY;
    root.position.z = posZ;
    if (modelBasePositionRef.current) {
      modelBasePositionRef.current.x = posX;
      modelBasePositionRef.current.y = posY;
      modelBasePositionRef.current.z = posZ;
    }
    const baseRotY = vrmRef.current?.meta?.metaVersion === '0' ? Math.PI : 0;
    root.rotation.y = baseRotY + THREE.MathUtils.degToRad(rotYDeg);
  }, [getCurrentModelRoot]);

  const applySceneTransform = useCallback((pos: Vec3, rotDeg: Vec3, scale: number) => {
    const room = roomModelRef.current;
    if (!room) return;
    room.position.set(pos.x, pos.y, pos.z);
    room.rotation.set(
      THREE.MathUtils.degToRad(rotDeg.x),
      THREE.MathUtils.degToRad(rotDeg.y),
      THREE.MathUtils.degToRad(rotDeg.z),
    );
    room.scale.setScalar(scale);
  }, []);

  const copyTransformConfig = useCallback(async () => {
    const cfg: Record<string, unknown> = {
      kScale: parseFloat(vrmScale.toFixed(4)),
      initialXshift: parseFloat(vrmPosX.toFixed(4)),
      initialYshift: parseFloat(vrmPosY.toFixed(4)),
      vrmPosZ: parseFloat(vrmPosZ.toFixed(4)),
      vrmRotY: parseFloat(vrmRotY.toFixed(1)),
    };
    // Capture live camera state from OrbitControls
    const controls = controlsRef.current;
    if (controls) {
      const cam = controls.object;
      const tgt = controls.target;
      cfg.cameraPosition = [
        parseFloat(cam.position.x.toFixed(4)),
        parseFloat(cam.position.y.toFixed(4)),
        parseFloat(cam.position.z.toFixed(4)),
      ];
      cfg.cameraTarget = [
        parseFloat(tgt.x.toFixed(4)),
        parseFloat(tgt.y.toFixed(4)),
        parseFloat(tgt.z.toFixed(4)),
      ];
      cfg.vrmZoom = 1;
    }
    if (normalizedConfig?.sceneGlb) {
      cfg.sceneGlbPosition = [
        parseFloat(scenePos.x.toFixed(3)),
        parseFloat(scenePos.y.toFixed(3)),
        parseFloat(scenePos.z.toFixed(3)),
      ];
      cfg.sceneGlbRotation = [
        parseFloat(THREE.MathUtils.degToRad(sceneRotDeg.x).toFixed(4)),
        parseFloat(THREE.MathUtils.degToRad(sceneRotDeg.y).toFixed(4)),
        parseFloat(THREE.MathUtils.degToRad(sceneRotDeg.z).toFixed(4)),
      ];
      cfg.sceneGlbScale = parseFloat(sceneScale.toFixed(4));
    }
    const text = JSON.stringify(cfg, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      toaster.create({ title: 'Config copied', description: 'Paste into model_dict.json', type: 'success', duration: 2500 });
    } catch {
      toaster.create({ title: 'Copy failed', description: 'Check clipboard permissions', type: 'error', duration: 2500 });
    }
  }, [vrmScale, vrmPosX, vrmPosY, vrmPosZ, vrmRotY, scenePos, sceneRotDeg, sceneScale, normalizedConfig?.sceneGlb]);

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
  }, []);

  const focusCameraOnSceneObject = useCallback((entry: SceneObjectRegistryEntry) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const lookAt = entry.interactionPoints.lookAt ?? entry.position;
    controls.target.set(lookAt[0], lookAt[1], lookAt[2]);
    const camera = controls.object as THREE.Camera;
    camera.position.set(lookAt[0] + 1.8, lookAt[1] + 0.8, lookAt[2] + 2.2);
    camera.updateProjectionMatrix();
    controls.update();
  }, []);

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
  }, [disposeSeatedRapier, getCurrentModelRoot]);

  const copyCurrentPoseToClipboard = useCallback(async () => {
    const root = getCurrentModelRoot();
    if (!root) {
      toaster.create({
        title: 'No model loaded',
        description: 'Load a model before copying pose.',
        type: 'error',
        duration: 2500,
      });
      return;
    }

    const bones: Array<{
      name: string;
      quaternion: [number, number, number, number];
      position: [number, number, number];
    }> = [];

    // Use current rig list for stable ordering and to avoid dumping unrelated scene nodes.
    for (const boneKey of rigBones) {
      const node = getBoneNode(boneKey);
      if (!node) continue;
      bones.push({
        name: boneKey,
        quaternion: [
          Number(node.quaternion.x.toFixed(6)),
          Number(node.quaternion.y.toFixed(6)),
          Number(node.quaternion.z.toFixed(6)),
          Number(node.quaternion.w.toFixed(6)),
        ],
        position: [
          Number(node.position.x.toFixed(6)),
          Number(node.position.y.toFixed(6)),
          Number(node.position.z.toFixed(6)),
        ],
      });
    }

    const payload = {
      kind: 'vtuber_pose_v1',
      modelUrl: normalizedConfig?.url ?? modelInfo?.url ?? '',
      activePoseProfile,
      root: {
        position: [
          Number(root.position.x.toFixed(6)),
          Number(root.position.y.toFixed(6)),
          Number(root.position.z.toFixed(6)),
        ] as [number, number, number],
        rotationQuaternion: [
          Number(root.quaternion.x.toFixed(6)),
          Number(root.quaternion.y.toFixed(6)),
          Number(root.quaternion.z.toFixed(6)),
          Number(root.quaternion.w.toFixed(6)),
        ] as [number, number, number, number],
      },
      bones,
    };

    const text = JSON.stringify(payload, null, 2);

    try {
      await navigator.clipboard.writeText(text);
      toaster.create({
        title: 'Pose copied',
        description: `Copied ${bones.length} joints to clipboard.`,
        type: 'success',
        duration: 2500,
      });
    } catch (e) {
      // Fallback for environments where clipboard API is unavailable.
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('execCommand copy failed');
        toaster.create({
          title: 'Pose copied',
          description: `Copied ${bones.length} joints to clipboard.`,
          type: 'success',
          duration: 2500,
        });
      } catch (e2) {
        console.error('[VrmViewer] Copy pose failed:', e, e2);
        toaster.create({
          title: 'Copy failed',
          description: 'Clipboard access was blocked. Check browser permissions.',
          type: 'error',
          duration: 3500,
        });
      }
    }
  }, [activePoseProfile, getBoneNode, getCurrentModelRoot, modelInfo?.url, normalizedConfig?.url, rigBones]);

  const poseIdleActiveRef = useRef(false);
  const poseIdleStartRef = useRef(0);
  const poseIdleBaseQuatRef = useRef<Map<LogicalBone, THREE.Quaternion>>(new Map());
  const poseIdleNodesRef = useRef<Map<LogicalBone, THREE.Object3D>>(new Map());

  const stopPoseIdle = useCallback(() => {
    poseIdleActiveRef.current = false;
    // Restore base quaternions captured at pose-apply time.
    for (const [key, node] of poseIdleNodesRef.current.entries()) {
      const base = poseIdleBaseQuatRef.current.get(key);
      if (!base) continue;
      node.quaternion.copy(base);
      node.updateMatrixWorld(true);
    }
    poseIdleNodesRef.current.clear();
    poseIdleBaseQuatRef.current.clear();
  }, []);

  const startPoseIdle = useCallback((keys: LogicalBone[]) => {
    stopPoseIdle();
    const nodes = new Map<LogicalBone, THREE.Object3D>();
    const bases = new Map<LogicalBone, THREE.Quaternion>();
    for (const key of keys) {
      const node = getLogicalBoneNode(key);
      if (!node) continue;
      nodes.set(key, node);
      bases.set(key, node.quaternion.clone());
    }
    if (nodes.size === 0) return;
    poseIdleNodesRef.current = nodes;
    poseIdleBaseQuatRef.current = bases;
    poseIdleStartRef.current = performance.now() / 1000;
    poseIdleActiveRef.current = true;
  }, [getLogicalBoneNode, stopPoseIdle]);

  useEffect(() => {
    if (!selectedBone) return;
    updateRigStateFromBone(selectedBone);
  }, [selectedBone, rigModelStamp, updateRigStateFromBone]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (skeletonHelperRef.current) {
      scene.remove(skeletonHelperRef.current);
      skeletonHelperRef.current = null;
    }

    if (!showSkeleton) return;

    const root = getCurrentModelRoot();
    if (!root) return;

    const helper = new THREE.SkeletonHelper(root);
    scene.add(helper);
    skeletonHelperRef.current = helper;

    return () => {
      if (skeletonHelperRef.current) {
        scene.remove(skeletonHelperRef.current);
        skeletonHelperRef.current = null;
      }
    };
  }, [getCurrentModelRoot, rigModelStamp, showSkeleton]);

  useEffect(() => {
    const root = getCurrentModelRoot();
    if (!root) return;
    root.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const apply = (mat: THREE.Material) => {
        if ('wireframe' in mat) (mat as any).wireframe = wireframe;
      };
      if (Array.isArray(mesh.material)) mesh.material.forEach(apply);
      else if (mesh.material) apply(mesh.material);
    });
  }, [getCurrentModelRoot, rigModelStamp, wireframe]);

  // Sync transform UI sliders from config whenever model changes
  useEffect(() => {
    if (!normalizedConfig) return;
    setVrmScale(normalizedConfig.scale ?? 1);
    setVrmPosX(normalizedConfig.x ?? 0);
    setVrmPosY(normalizedConfig.y ?? 0);
    setVrmPosZ(normalizedConfig.vrmPosZ ?? 0);
    setVrmRotY(normalizedConfig.vrmRotY ?? 0);
    const pos = normalizedConfig.sceneGlbPosition ?? [0, 0, 0];
    const rot = normalizedConfig.sceneGlbRotation ?? [0, 0, 0];
    const rawS = normalizedConfig.sceneGlbScale ?? 1;
    const scaleUniform = Array.isArray(rawS) ? rawS[0] : rawS;
    setScenePos({ x: pos[0], y: pos[1], z: pos[2] });
    setSceneRotDeg({
      x: THREE.MathUtils.radToDeg(rot[0]),
      y: THREE.MathUtils.radToDeg(rot[1]),
      z: THREE.MathUtils.radToDeg(rot[2]),
    });
    setSceneScale(scaleUniform as number);
  }, [normalizedConfig]);

  const configureActionPlayback = useCallback((action: THREE.AnimationAction, options?: ClipPlaybackOptions) => {
    if (options?.loopOnce) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = options.clampWhenFinished ?? true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
    }
  }, []);

  const playClipOnCurrentModel = useCallback((clip: THREE.AnimationClip, options?: ClipPlaybackOptions) => {
    const vrmScene = vrmRef.current?.scene ?? null;
    const glbRoot = glbModelRef.current ?? null;

    // For GLBs, prefer a SkinnedMesh as the mixer root so `.bones[Name]` bindings work
    // even if bones are not parented under the scene graph in a straightforward way.
    const mixerRoot: THREE.Object3D | null = vrmScene
      ?? glbSkinnedMeshesRef.current[0]
      ?? glbRoot;

    if (!mixerRoot) return;
    if (mixerRef.current) mixerRef.current.stopAllAction();
    const mixer = new THREE.AnimationMixer(mixerRoot);
    mixerRef.current = mixer;
    const action = mixer.clipAction(clip);
    configureActionPlayback(action, options);
    action.reset().play();
    currentActionRef.current = action;
    setIsVrmaPlaying(true);
  }, [configureActionPlayback]);

  const rebuildGlbBoneIndices = useCallback((root: THREE.Object3D) => {
    const bonesByName = new Map<string, THREE.Bone>();
    const bonesByNorm = new Map<string, THREE.Bone>();
    const skinnedMeshes: THREE.SkinnedMesh[] = [];

    root.traverse((obj: THREE.Object3D) => {
      // @ts-ignore - runtime guard
      if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
        skinnedMeshes.push(obj as unknown as THREE.SkinnedMesh);
      }
    });

    const addBone = (bone: THREE.Bone) => {
      if (!bone?.name) return;
      if (!bonesByName.has(bone.name)) bonesByName.set(bone.name, bone);
      const norm = normalizeMixamoNodeName(bone.name).toLowerCase();
      if (!bonesByNorm.has(norm)) bonesByNorm.set(norm, bone);
    };

    // Prefer bones from actual SkinnedMesh skeletons. Traversing "all bones in the scene"
    // can pick up duplicates or unused armatures that don't drive the mesh.
    let added = 0;
    for (const mesh of skinnedMeshes) {
      const skeleton = (mesh as any).skeleton as THREE.Skeleton | undefined;
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

    if (skinnedMeshes.length === 0) {
      console.warn('[VrmViewer] This GLB has no SkinnedMesh. Bone animations may not affect the mesh (no skinning).');
    } else {
      console.log('[VrmViewer] GLB SkinnedMesh count:', skinnedMeshes.length, 'indexed bones:', bonesByName.size);
    }
  }, []);

  const retargetMixamoClipToCurrentModel = useCallback((clip: THREE.AnimationClip): THREE.AnimationClip | null => {
    const vrm = vrmRef.current;
    const isVRM = Boolean(vrm?.humanoid);
    const tracks: THREE.KeyframeTrack[] = [];

    for (const track of clip.tracks) {
      const parts = track.name.split('.');
      const property = parts.pop();
      if (!property) continue;
      const rawNode = parts.join('.');
      const nodeName = normalizeMixamoNodeName(rawNode);

      let targetNode: THREE.Object3D | null = null;
      if (isVRM) {
        const vrmBone = MIXAMO_TO_VRM_BONE_MAP[nodeName];
        if (vrmBone) {
          targetNode = vrm?.humanoid?.getNormalizedBoneNode(vrmBone) ?? null;
        }
      } else {
        const nodeNameLower = nodeName.toLowerCase();
        targetNode = glbBonesRef.current.get(nodeName)
          ?? glbBonesRef.current.get(`mixamorig:${nodeName}`)
          ?? glbBonesRef.current.get(`mixamorig${nodeName}`)
          ?? glbBonesNormalizedRef.current.get(nodeNameLower)
          ?? null;
      }

      if (!targetNode) continue;
      // For GLB skinned meshes, we bind via `.bones[BoneName].prop` so PropertyBinding uses `root.skeleton`.
      // This avoids subtle "found a Bone object but it's not the one driving the mesh" cases.
      const isGLB = !isVRM;
      const targetBoneName = (targetNode as any).isBone ? (targetNode as THREE.Bone).name : targetNode.name;
      if (!targetBoneName || targetBoneName.trim().length === 0) continue;
      const targetPathPrefix = isGLB
        ? `.bones[${targetBoneName}]`
        : (targetNode.uuid); // VRM: UUID binding is fine (bones are always in the VRM scene graph).

      // Only retarget transform tracks. Avoid material/morph/etc. tracks that can make the model disappear.
      // Also skip scale tracks (some FBX exports include non-1 scales that can collapse the mesh).
      if (property !== 'quaternion' && property !== 'rotation' && property !== 'position') {
        continue;
      }
      if (property === 'scale') {
        continue;
      }

      // Mixamo FBX can provide either quaternion tracks or Euler rotation tracks.
      if (property === 'rotation' && (track as any).ValueTypeName === 'vector') {
        const times = track.times;
        const values = track.values;
        const count = Math.floor(values.length / 3);
        const qValues = new Float32Array(count * 4);
        const euler = new THREE.Euler(0, 0, 0, 'XYZ');
        const q = new THREE.Quaternion();
        for (let i = 0; i < count; i += 1) {
          euler.set(values[i * 3], values[i * 3 + 1], values[i * 3 + 2], 'XYZ');
          q.setFromEuler(euler);
          qValues[i * 4] = q.x;
          qValues[i * 4 + 1] = q.y;
          qValues[i * 4 + 2] = q.z;
          qValues[i * 4 + 3] = q.w;
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(
          `${targetPathPrefix}.quaternion`,
          times,
          qValues,
        ));
        continue;
      }

      // Remove Mixamo "root motion" by default so the avatar doesn't walk out of frame.
      // Keep hip Y motion (bobbing), zero out hip X/Z translation relative to the first frame.
      if (property === 'position') {
        const isHipsTrack = normalizeMixamoNodeName(nodeName).toLowerCase() === 'hips'
          || normalizeMixamoNodeName(targetBoneName).toLowerCase() === 'hips'
          || /hips/i.test(targetBoneName);
        if (!isHipsTrack) continue;
        const values = track.values;
        const count = Math.floor(values.length / 3);
        if (count <= 0) continue;
        const baseX = values[0];
        const baseY = values[1];
        const baseZ = values[2];
        const posValues = new Float32Array(count * 3);
        for (let i = 0; i < count; i += 1) {
          const x = values[i * 3];
          const y = values[i * 3 + 1];
          const z = values[i * 3 + 2];
          posValues[i * 3] = x - baseX;
          posValues[i * 3 + 1] = y - baseY;
          posValues[i * 3 + 2] = z - baseZ;
        }
        tracks.push(new THREE.VectorKeyframeTrack(
          `${targetPathPrefix}.position`,
          track.times,
          posValues,
        ));
        continue;
      }

      // @ts-ignore - track type constructors are not nicely typed.
      const TypedTrack = track.constructor;
      const newTrack = new TypedTrack(
        `${targetPathPrefix}.${property}`,
        track.times,
        track.values,
      );
      tracks.push(newTrack);
    }

    if (tracks.length === 0) return null;
    return new THREE.AnimationClip(clip.name || 'mixamo', clip.duration, tracks);
  }, []);

  const playMixamoFbxFromUrl = useCallback((url: string, options?: ClipPlaybackOptions) => {
    const loader = new FBXLoader();
    loader.load(
      url,
      (fbx: THREE.Group) => {
        if (options?.loopOnce && currentStateAnimUrlRef.current !== url) return;
        const clip = (fbx as any).animations?.[0] as THREE.AnimationClip | undefined;
        if (!clip) {
          console.warn('[VrmViewer] No animation found in FBX');
          return;
        }
        const vrm = vrmRef.current;
        const isVRM = Boolean(vrm?.humanoid);

        // Prefer SkeletonUtils.retargetClip for GLB skinned meshes. This is the approach used in many Three.js demos
        // (including character-control examples) and avoids track-binding/name mismatch issues.
        if (!isVRM) {
          const targetMesh = glbSkinnedMeshesRef.current[0] ?? null;
          if (targetMesh?.skeleton) {
            try {
              // Build a source skeleton. Mixamo "without skin" FBX may not contain a SkinnedMesh, so we
              // fall back to collecting bones and constructing a Skeleton.
              let sourceSkeleton: THREE.Skeleton | null = null;
              fbx.traverse((obj: THREE.Object3D) => {
                // @ts-ignore
                if (sourceSkeleton) return;
                // @ts-ignore
                if ((obj as THREE.SkinnedMesh).isSkinnedMesh) {
                  const s = (obj as any).skeleton as THREE.Skeleton | undefined;
                  if (s?.bones?.length) sourceSkeleton = s;
                }
              });
              if (!sourceSkeleton) {
                const bones: THREE.Bone[] = [];
                fbx.traverse((obj: THREE.Object3D) => {
                  if ((obj as THREE.Bone).isBone) bones.push(obj as THREE.Bone);
                });
                if (bones.length > 0) sourceSkeleton = new THREE.Skeleton(bones);
              }
              if (!sourceSkeleton || !sourceSkeleton.bones?.length) {
                console.warn('[VrmViewer] No bones found in FBX; cannot retarget');
              } else {
                const sourceNormToRaw = new Map<string, string>();
                for (const b of sourceSkeleton.bones) {
                  const n = normalizeMixamoNodeName(b.name).toLowerCase();
                  if (!sourceNormToRaw.has(n)) sourceNormToRaw.set(n, b.name);
                }

                const names: Record<string, string> = {};
                for (const targetBone of targetMesh.skeleton.bones) {
                  const norm = normalizeMixamoNodeName(targetBone.name).toLowerCase();
                  const raw = sourceNormToRaw.get(norm);
                  if (raw) names[targetBone.name] = raw;
                }

                const hipRaw = sourceNormToRaw.get('hips') ?? 'Hips';
                let converted = retargetClip(targetMesh, sourceSkeleton, clip, {
                  hip: hipRaw,
                  names,
                  preservePosition: true,
                  preserveMatrix: true,
                });

                // Drop all position tracks except hip, and remove root motion.
                const cleaned: THREE.KeyframeTrack[] = [];
                for (const t of converted.tracks) {
                  if (t.name.endsWith('.position')) {
                    const isHip = /hips/i.test(t.name);
                    if (!isHip) continue;
                    const vt = t as unknown as THREE.VectorKeyframeTrack;
                    const values = vt.values as unknown as Float32Array;
                    const count = Math.floor(values.length / 3);
                    if (count <= 0) continue;
                    const baseY = values[1];
                    const posValues = new Float32Array(count * 3);
                    for (let i = 0; i < count; i += 1) {
                      posValues[i * 3] = 0; // lock X
                      posValues[i * 3 + 1] = values[i * 3 + 1] - baseY; // keep Y delta
                      posValues[i * 3 + 2] = 0; // lock Z
                    }
                    cleaned.push(new THREE.VectorKeyframeTrack(t.name, t.times, posValues));
                    continue;
                  }
                  if (t.name.endsWith('.scale')) continue;
                  if (t.name.includes('.material') || t.name.includes('.materials')) continue;
                  cleaned.push(t);
                }
                converted = new THREE.AnimationClip(clip.name || 'mixamo', clip.duration, cleaned);

                console.log('[VrmViewer] Playing FBX animation (retargetClip):', clip.name || '(unnamed)', 'tracks:', converted.tracks.length);
                console.log('[VrmViewer] Retargeted track samples:', converted.tracks.slice(0, 5).map((t) => t.name));
                playClipOnCurrentModel(converted, options);
                return;
              }
            } catch (e) {
              console.warn('[VrmViewer] retargetClip failed; falling back to manual retarget:', e);
            }
          }
        }

        const retargeted = retargetMixamoClipToCurrentModel(clip);
        if (!retargeted) {
          console.warn('[VrmViewer] Could not retarget any tracks from FBX animation');
          return;
        }
        console.log('[VrmViewer] Playing FBX animation (manual):', clip.name || '(unnamed)', 'tracks:', retargeted.tracks.length);
        console.log('[VrmViewer] Retargeted track samples:', retargeted.tracks.slice(0, 5).map((t) => t.name));
        playClipOnCurrentModel(retargeted, options);
      },
      undefined,
      (err: unknown) => {
        console.error('[VrmViewer] Failed to load FBX:', err);
        const msg = String((err as any)?.message ?? err ?? '');
        if (msg.includes('FBX version not supported') || msg.includes('FileVersion')) {
          toaster.create({
            title: 'FBX not supported',
            description: 'This FBX is an old format (e.g. 6100). Re-download from Mixamo as "FBX Binary" (7.4+) or re-export from Blender as FBX 7.4 binary.',
            type: 'error',
            duration: 6000,
          });
        }
      },
    );
  }, [playClipOnCurrentModel, retargetMixamoClipToCurrentModel]);

  const playVrmRetargetedFbxFromUrl = useCallback((url: string, options?: ClipPlaybackOptions) => {
    const vrm = vrmRef.current;
    if (!vrm?.humanoid) return false;

    loadMixamoAnimForVRM(url, vrm).then((clip) => {
      if (options?.loopOnce && currentStateAnimUrlRef.current !== url) return;
      if (!vrmRef.current?.scene) return;
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }
      const mixer = new THREE.AnimationMixer(vrm.scene);
      mixerRef.current = mixer;
      const action = mixer.clipAction(clip);
      configureActionPlayback(action, options);
      action.reset().play();
      currentActionRef.current = action;
      setIsVrmaPlaying(true);
      if (animMgrRef.current) {
        animMgrRef.current.isMixamoPlaying = true;
      }
    }).catch((err) => {
      console.error('[VrmViewer] Sitting FBX retarget failed:', err);
      toaster.create({
        title: 'Sit animation failed',
        description: 'Could not retarget the sitting Mixamo FBX to this VRM.',
        type: 'error',
        duration: 3500,
      });
    });

    return true;
  }, [configureActionPlayback]);

  const startWalkingToSceneObject = useCallback((entry: SceneObjectRegistryEntry, onArrive?: () => void) => {
    const root = getCurrentModelRoot();
    if (!root) return false;

    const point = entry.interactionPoints.approach ?? entry.position;
    const lookAt = entry.interactionPoints.lookAt ?? entry.position;
    const target = new THREE.Vector3(point[0], point[1], point[2]);
    const lookAtTarget = new THREE.Vector3(lookAt[0], lookAt[1], lookAt[2]);

    seatedContactRef.current = null;
    disposeSeatedRapier();
    walkTargetRef.current = {
      objectId: entry.id,
      position: target,
      lookAt: lookAtTarget,
      onArrive,
    };

    const baseRotY = vrmRef.current?.meta?.metaVersion === '0' ? Math.PI : 0;
    root.rotation.y = baseRotY + Math.atan2(target.x - root.position.x, target.z - root.position.z);
    root.updateMatrixWorld(true);

    currentStateAnimUrlRef.current = WALKING_FBX_URL;
    const didUseVrmRetarget = playVrmRetargetedFbxFromUrl(WALKING_FBX_URL);
    if (!didUseVrmRetarget) {
      playMixamoFbxFromUrl(WALKING_FBX_URL);
    }
    return true;
  }, [disposeSeatedRapier, getCurrentModelRoot, playMixamoFbxFromUrl, playVrmRetargetedFbxFromUrl]);

  const keepWalkingAnimationActive = useCallback(() => {
    const action = currentActionRef.current;
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
    const didUseVrmRetarget = playVrmRetargetedFbxFromUrl(WALKING_FBX_URL);
    if (!didUseVrmRetarget) {
      playMixamoFbxFromUrl(WALKING_FBX_URL);
    }
  }, [configureActionPlayback, playMixamoFbxFromUrl, playVrmRetargetedFbxFromUrl]);

  // Sync isVrmaPlaying state → ref so render-loop closure can read it
  useEffect(() => { isVrmaPlayingRef.current = isVrmaPlaying; }, [isVrmaPlaying]);

  const playStateAnimFbx = useCallback((url: string) => {
    if (walkTargetRef.current && url !== WALKING_FBX_URL) return;
    if (currentStateAnimUrlRef.current === url) return;
    currentStateAnimUrlRef.current = url;
    const vrm = vrmRef.current;
    if (!vrm?.humanoid) return;
    if (animMgrRef.current) animMgrRef.current.isMixamoPlaying = true;
    loadMixamoAnimForVRM(url, vrm).then((clip) => {
      // Reuse the mixer — crossfade to new clip instead of hard-stopping.
      if (!mixerRef.current) {
        mixerRef.current = new THREE.AnimationMixer(vrm.scene);
      }
      const mixer = mixerRef.current;
      const outgoing = currentActionRef.current;
      const incoming = mixer.clipAction(clip);
      configureActionPlayback(incoming);
      incoming.reset().play();
      if (outgoing && outgoing !== incoming) {
        outgoing.crossFadeTo(incoming, 0.25, false);
      }
      currentActionRef.current = incoming;
      setIsVrmaPlaying(true);
    }).catch((err) => {
      console.error('[VrmViewer] State animation failed:', err);
      currentStateAnimUrlRef.current = '';
    });
  }, [configureActionPlayback]);

  const playLoadedClipByName = useCallback((name: string) => {
    const modelRoot = vrmRef.current?.scene ?? glbModelRef.current;
    if (!modelRoot) return;
    const clip = loadedClipsRef.current.find((c) => c.name === name);
    if (!clip) return;

    if (mixerRef.current) mixerRef.current.stopAllAction();
    const mixer = new THREE.AnimationMixer(modelRoot);
    mixerRef.current = mixer;
    const action = mixer.clipAction(clip);
    action.reset().play();
    currentActionRef.current = action;
    setIsVrmaPlaying(true);
    console.log('[VrmViewer] Playing embedded clip:', clip.name || '(unnamed)');
  }, []);

  // VRMA Loading & Playback
  const playVrmaFromUrl = (url: string) => {
    const loader = new GLTFLoader();
    loader.load(url, (gltf) => {
        const clip = gltf.animations[0];
        if (!clip) {
            console.warn("No animation found in VRMA");
            return;
        }
        const vrm = vrmRef.current;
        if (!vrm) return;

        const tracks: THREE.KeyframeTrack[] = [];
        console.log(`[VrmViewer] VRMA Clip found: ${clip.name}, Duration: ${clip.duration}, Tracks: ${clip.tracks.length}`);

        clip.tracks.forEach((track) => {
            const parts = track.name.split('.');
            const property = parts.pop();
            const trackBoneName = parts.join('.'); 
            let boneName: VRMHumanBoneName | null = null;
            
            if (VRM0_BONE_MAP[trackBoneName]) {
                boneName = VRM0_BONE_MAP[trackBoneName] as VRMHumanBoneName;
            }
            if (!boneName) {
                for (const part of parts) {
                    const candidate = Object.values(VRMHumanBoneName).find(
                        b => b.toLowerCase() === part.toLowerCase()
                    );
                    if (candidate) {
                        boneName = candidate;
                        break;
                    }
                }
            }

            if (boneName) {
                // @ts-ignore
                const node = vrm.humanoid?.getNormalizedBoneNode(boneName);
                if (node) {
                    if (!node.name) node.name = boneName;
                    // @ts-ignore
                    const TypedTrack = track.constructor;
                    const newTrack = new TypedTrack(
                        node.name + '.' + property,
                        track.times,
                        track.values
                    );
                    tracks.push(newTrack);
                }
            }
        });

        console.log(`[VrmViewer] Retargeted ${tracks.length} / ${clip.tracks.length} tracks.`);
        if (tracks.length === 0) {
            console.warn("Could not retarget any tracks. Playing original clip might fail if node names differ.");
            tracks.push(...clip.tracks);
        }

        const newClip = new THREE.AnimationClip(clip.name, clip.duration, tracks);
        if (mixerRef.current) mixerRef.current.stopAllAction();
        
        const mixer = new THREE.AnimationMixer(vrm.scene);
        mixerRef.current = mixer;
        const action = mixer.clipAction(newClip);
        action.play();
        currentActionRef.current = action;
        setIsVrmaPlaying(true);
        console.log("Playing VRMA animation");
    });
  };

  const CHARACTER_BLUE_MODEL_SUFFIX = "/models/character_blue.glb";
  const CHARACTER_BLUE_ANIMATIONS: string[] = [
    "/models/animations/character_blue/Animation_360_Power_Spin_Jump_withSkin.glb",
    "/models/animations/character_blue/Animation_All_Night_Dance_withSkin.glb",
    "/models/animations/character_blue/Animation_Angry_Ground_Stomp_1_withSkin.glb",
    "/models/animations/character_blue/Animation_Angry_Ground_Stomp_2_withSkin.glb",
    "/models/animations/character_blue/Animation_Angry_Stomp_withSkin.glb",
    "/models/animations/character_blue/Animation_Archery_Aim_with_Lateral_Scan_withSkin.glb",
    "/models/animations/character_blue/Animation_Arm_Circle_Shuffle_withSkin.glb",
    "/models/animations/character_blue/Animation_Bass_Beats_withSkin.glb",
    "/models/animations/character_blue/Animation_Boom_Dance_withSkin.glb",
    "/models/animations/character_blue/Animation_Cardio_Dance_withSkin.glb",
    "/models/animations/character_blue/Animation_Casual_Walk_withSkin.glb",
    "/models/animations/character_blue/Animation_Catching_Breath_withSkin.glb",
    "/models/animations/character_blue/Animation_Cherish_Pop_Dance_withSkin.glb",
    "/models/animations/character_blue/Animation_Crystal_Beads_withSkin.glb",
    "/models/animations/character_blue/Animation_Dont_You_Dare_withSkin.glb",
    "/models/animations/character_blue/Animation_Fast_Lightning_withSkin.glb",
    "/models/animations/character_blue/Animation_FunnyDancing_01_withSkin.glb",
    "/models/animations/character_blue/Animation_FunnyDancing_03_withSkin.glb",
    "/models/animations/character_blue/Animation_Gangnam_Groove_withSkin.glb",
    "/models/animations/character_blue/Animation_Hip_Hop_Dance_1_withSkin.glb",
    "/models/animations/character_blue/Animation_Hip_Hop_Dance_3_withSkin.glb",
    "/models/animations/character_blue/Animation_Hip_Hop_Dance_4_withSkin.glb",
    "/models/animations/character_blue/Animation_Indoor_Swing_withSkin.glb",
    "/models/animations/character_blue/Animation_OMG_Groove_withSkin.glb",
    "/models/animations/character_blue/Animation_Pod_Baby_Groove_withSkin.glb",
    "/models/animations/character_blue/Animation_Pop_Dance_LSA2_withSkin.glb",
    "/models/animations/character_blue/Animation_push_up_to_idle_withSkin.glb",
    "/models/animations/character_blue/Animation_push_up_withSkin.glb",
    "/models/animations/character_blue/Animation_Quad_Climb_Right_withSkin.glb",
    "/models/animations/character_blue/Animation_Running_withSkin.glb",
    "/models/animations/character_blue/Animation_Shake_It_Off_Dance_withSkin.glb",
    "/models/animations/character_blue/Animation_Squat_Stance_withSkin.glb",
    "/models/animations/character_blue/Animation_Victory_Fist_Pump_withSkin.glb",
    "/models/animations/character_blue/Animation_Wake_Up_and_Look_Up_withSkin.glb",
    "/models/animations/character_blue/Animation_Walk_Backward_withSkin.glb",
    "/models/animations/character_blue/Animation_Walk_to_Sit_withSkin.glb",
    "/models/animations/character_blue/Animation_Walk_Turn_Right_Female_withSkin.glb",
    "/models/animations/character_blue/Animation_Walking_withSkin.glb",
    "/models/animations/character_blue/Animation_Wave_for_Help_3_withSkin.glb",
    "/models/animations/character_blue/Animation_You_Groove_withSkin.glb",
  ];

  const playRandomCharacterBlueAnimation = () => {
    if (CHARACTER_BLUE_ANIMATIONS.length === 0) return;
    const scene = sceneRef.current;
    if (!scene || !normalizedConfig) return;

    const loader = new GLTFLoader();
    const index = Math.floor(Math.random() * CHARACTER_BLUE_ANIMATIONS.length);
    const url = CHARACTER_BLUE_ANIMATIONS[index];

    loader.load(
      url,
      (gltf: GLTF) => {
        const clip = gltf.animations[0];
        if (!clip) {
          console.warn('[VrmViewer] No animation in character_blue clip:', url);
          return;
        }

        const disposeObject = (obj: THREE.Object3D) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((material: THREE.Material) => material.dispose());
            } else if (mesh.material) {
              mesh.material.dispose();
            }
          }
        };

        if (glbModelRef.current) {
          scene.remove(glbModelRef.current);
          glbModelRef.current.traverse(disposeObject);
          glbModelRef.current = null;
        }

        const model = gltf.scene;
        model.traverse((obj: THREE.Object3D) => {
          obj.frustumCulled = false;
          if ((obj as THREE.Bone).isBone) {
            const bone = obj as THREE.Bone;
            glbBonesRef.current.set(bone.name, bone);
          }
        });
        model.scale.setScalar(normalizedConfig.scale);
        model.position.set(normalizedConfig.x, normalizedConfig.y, 0);
        scene.add(model);
        glbModelRef.current = model;

        if (mixerRef.current) {
          mixerRef.current.stopAllAction();
        }
        const mixer = new THREE.AnimationMixer(model);
        mixerRef.current = mixer;
        const action = mixer.clipAction(clip);
        action.reset().play();
        currentActionRef.current = action;
        setIsVrmaPlaying(true);
        console.log('[VrmViewer] Playing character_blue animation:', url);
      },
      undefined,
      (error: unknown) => {
        console.error('[VrmViewer] Failed to load character_blue animation:', url, error);
      },
    );
  };
  const loadGlbModelFromUrl = (url: string) => {
    const scene = sceneRef.current;
    if (!scene || !normalizedConfig) return;

    const loader = new GLTFLoader();
    loader.register((parser: GLTFParser) => new VRMLoaderPlugin(parser));

    const disposeObject = (obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material: THREE.Material) => material.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    };

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

    glbBonesRef.current.clear();
    initialBoneTransformsRef.current.clear();
    setRigBones([]);
    setSelectedBone('');
    setRigModelStamp((v) => v + 1);
    rootOffsetRef.current = null;

    loader.load(
      url,
      (gltf: GLTF) => {
        const model = gltf.scene;
        model.traverse((obj: THREE.Object3D) => {
          obj.frustumCulled = false;
        });
        rebuildGlbBoneIndices(model);
        model.scale.setScalar(normalizedConfig.scale);
        model.position.set(normalizedConfig.x, normalizedConfig.y, 0);
        scene.add(model);
        glbModelRef.current = model;

        const bones = Array.from(glbBonesRef.current.keys()).sort((a, b) => a.localeCompare(b));
        bones.forEach((boneName) => {
          const node = glbBonesRef.current.get(boneName);
          if (!node) return;
          initialBoneTransformsRef.current.set(boneName, {
            q: node.quaternion.clone(),
            p: node.position.clone(),
          });
        });
        setRigBones(bones);
        if (bones.length > 0) setSelectedBone(bones[0]);
        setRigModelStamp((v) => v + 1);

        const clip = gltf.animations[0];
        if (clip) {
          if (mixerRef.current) {
            mixerRef.current.stopAllAction();
          }
          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;
          const action = mixer.clipAction(clip);
          action.play();
          currentActionRef.current = action;
          setIsVrmaPlaying(true);
          console.log('[VrmViewer] Playing GLB animation from upload');
        } else {
          console.log('[VrmViewer] Uploaded GLB has no animations');
        }
      },
      undefined,
      (error: unknown) => {
        console.error('[VrmViewer] Failed to load uploaded model:', error);
      },
    );
  };

  const handleVrmaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'vrma') {
      playVrmaFromUrl(url);
    } else if (extension === 'glb' || extension === 'gltf') {
      loadGlbModelFromUrl(url);
    } else if (extension === 'fbx') {
      playMixamoFbxFromUrl(url);
    }
  };

  const stopVrma = () => {
      if (mixerRef.current) {
          mixerRef.current.stopAllAction();
          mixerRef.current = null;
      }
      seatedContactRef.current = null;
      disposeSeatedRapier();
      walkTargetRef.current = null;
      setIsVrmaPlaying(false);
  };

  const stopProcedural = useCallback(() => {
    proceduralActiveRef.current = false;
    setIsProceduralPlaying(false);
    // Restore base quaternions.
    for (const [key, node] of proceduralNodesRef.current.entries()) {
      const base = proceduralBaseQuatRef.current.get(key);
      if (!base) continue;
      node.quaternion.copy(base);
      node.updateMatrixWorld(true);
    }
    proceduralNodesRef.current.clear();
    proceduralBaseQuatRef.current.clear();
  }, []);

  const startProcedural = useCallback(() => {
    // Stop any mixer-driven animation first.
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
      mixerRef.current = null;
      currentActionRef.current = null;
      setIsVrmaPlaying(false);
    }
    // If a pose idle is running (eg. floor sit), stop it so we don't fight over arms/spine.
    stopPoseIdle();

    // Resolve key bones for either VRM or GLB.
    const vrm = vrmRef.current;
    const isVRM = Boolean(vrm?.humanoid);
    const nodes = new Map<string, THREE.Object3D>();

    const setNode = (key: string, node: THREE.Object3D | null) => {
      if (!node) return;
      nodes.set(key, node);
      proceduralBaseQuatRef.current.set(key, node.quaternion.clone());
    };

    if (isVRM) {
      setNode('hips', vrm?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Hips) ?? null);
      setNode('spine', vrm?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Spine) ?? null);
      setNode('chest', vrm?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Chest) ?? null);
      setNode('neck', vrm?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Neck) ?? null);
      setNode('head', vrm?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Head) ?? null);
      setNode('leftUpperArm', vrm?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm) ?? null);
      setNode('leftLowerArm', vrm?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.LeftLowerArm) ?? null);
      setNode('rightUpperArm', vrm?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm) ?? null);
      setNode('rightLowerArm', vrm?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.RightLowerArm) ?? null);
    } else {
      const byNorm = (name: string) => glbBonesNormalizedRef.current.get(name.toLowerCase()) ?? null;
      // Mixamo-style normalized names.
      setNode('hips', byNorm('Hips'));
      setNode('spine', byNorm('Spine'));
      setNode('chest', byNorm('Spine1'));
      setNode('upperChest', byNorm('Spine2'));
      setNode('neck', byNorm('Neck'));
      setNode('head', byNorm('Head'));
      setNode('leftUpperArm', byNorm('LeftArm'));
      setNode('leftLowerArm', byNorm('LeftForeArm'));
      setNode('rightUpperArm', byNorm('RightArm'));
      setNode('rightLowerArm', byNorm('RightForeArm'));
    }

    if (nodes.size === 0) {
      toaster.create({
        title: 'No bones found',
        description: 'This model has no usable bones for procedural motion.',
        type: 'error',
        duration: 3500,
      });
      return;
    }

    proceduralNodesRef.current = nodes;
    proceduralStartRef.current = performance.now() / 1000;
    proceduralActiveRef.current = true;
    setIsProceduralPlaying(true);
  }, []);

  // Expose a simple "run this script" API from DevTools console:
  // `window.vtuberMotion.start()` / `window.vtuberMotion.stop()`
  useEffect(() => {
    (window as any).vtuberMotion = {
      start: startProcedural,
      stop: stopProcedural,
    };
    return () => {
      if ((window as any).vtuberMotion?.start === startProcedural) {
        delete (window as any).vtuberMotion;
      }
    };
  }, [startProcedural, stopProcedural]);

  const applyPoseProfile = useCallback((profileId: string) => {
    // Stop any animation that is currently driving the rig.
    stopProcedural();
    stopVrma();
    stopPoseIdle();

    resetAllBones();
    resetModelRootPosition();

    const root = getCurrentModelRoot();
    const applyOffsets = (offsets: Partial<Record<LogicalBone, THREE.Euler>>) => {
      (Object.keys(offsets) as LogicalBone[]).forEach((key) => {
        const node = getLogicalBoneNode(key);
        const e = offsets[key];
        if (!node || !e) return;
        const base = node.quaternion.clone();
        const qOff = new THREE.Quaternion().setFromEuler(e);
        node.quaternion.copy(base).multiply(qOff);
        node.updateMatrixWorld(true);
      });
    };

    if (profileId === 'floor_sit_cross_leg') {
      seatedContactRef.current = null;
      disposeSeatedRapier();
      const isVRM = Boolean(vrmRef.current?.humanoid);
      if (!isVRM) {
        // Apply captured GLB pose exactly (best match for Thanh.glb).
        if (root && modelBasePositionRef.current) {
          root.position.copy(modelBasePositionRef.current);
          root.position.y += FLOOR_SIT_CROSS_LEG_POSE_GLTF.rootYOffset;
          root.updateMatrixWorld(true);
        }

        // Set key bone quaternions by name (Mixamo-style skeleton).
        Object.entries(FLOOR_SIT_CROSS_LEG_POSE_GLTF.boneQuaternions).forEach(([boneName, q]) => {
          const node = glbBonesRef.current.get(boneName)
            ?? glbBonesNormalizedRef.current.get(normalizeMixamoNodeName(boneName).toLowerCase())
            ?? null;
          if (!node) return;
          node.quaternion.set(q[0], q[1], q[2], q[3]).normalize();
          node.updateMatrixWorld(true);
        });
      } else {
        // Fallback heuristics for VRM avatars.
        if (root && modelBasePositionRef.current) {
          root.position.copy(modelBasePositionRef.current);
          root.position.y -= 0.75;
          root.updateMatrixWorld(true);
        }
        applyOffsets({
          hips: new THREE.Euler(0.05, 0, 0, 'XYZ'),
          spine: new THREE.Euler(0.08, 0, 0, 'XYZ'),
          chest: new THREE.Euler(0.06, 0, 0, 'XYZ'),
          neck: new THREE.Euler(-0.04, 0, 0, 'XYZ'),
          head: new THREE.Euler(-0.03, 0, 0, 'XYZ'),
          leftUpperLeg: new THREE.Euler(1.10, 0.45, 0.15, 'XYZ'),
          leftLowerLeg: new THREE.Euler(-1.35, 0, 0, 'XYZ'),
          leftFoot: new THREE.Euler(0.15, 0, 0.10, 'XYZ'),
          rightUpperLeg: new THREE.Euler(1.10, -0.45, -0.15, 'XYZ'),
          rightLowerLeg: new THREE.Euler(-1.35, 0, 0, 'XYZ'),
          rightFoot: new THREE.Euler(0.15, 0, -0.10, 'XYZ'),
          leftShoulder: new THREE.Euler(0.10, 0, 0.05, 'XYZ'),
          leftUpperArm: new THREE.Euler(0.40, 0, 0.25, 'XYZ'),
          leftLowerArm: new THREE.Euler(-0.85, 0, 0.10, 'XYZ'),
          leftHand: new THREE.Euler(0.05, 0, 0.08, 'XYZ'),
          rightShoulder: new THREE.Euler(0.10, 0, -0.05, 'XYZ'),
          rightUpperArm: new THREE.Euler(0.40, 0, -0.25, 'XYZ'),
          rightLowerArm: new THREE.Euler(-0.85, 0, -0.10, 'XYZ'),
          rightHand: new THREE.Euler(0.05, 0, -0.08, 'XYZ'),
        });
      }

      setActivePoseProfile(profileId);
      // Capture base quats *after* pose applied, then add a subtle idle on top.
      startPoseIdle([
        'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
        'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
        'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
      ]);
      return;
    }

    if (profileId === 'chair_sit') {
      seatedContactRef.current = null;
      disposeSeatedRapier();
      const isVRM = Boolean(vrmRef.current?.humanoid);
      if (!isVRM) {
        applyOffsets({
          hips: new THREE.Euler(0.05, 0, 0, 'XYZ'),
          spine: new THREE.Euler(0.10, 0, 0, 'XYZ'),
          chest: new THREE.Euler(0.05, 0, 0, 'XYZ'),
          leftUpperLeg: new THREE.Euler(1.22, 0.10, 0.04, 'XYZ'),
          leftLowerLeg: new THREE.Euler(-1.22, 0, 0, 'XYZ'),
          leftFoot: new THREE.Euler(0.18, 0, 0, 'XYZ'),
          rightUpperLeg: new THREE.Euler(1.22, -0.10, -0.04, 'XYZ'),
          rightLowerLeg: new THREE.Euler(-1.22, 0, 0, 'XYZ'),
          rightFoot: new THREE.Euler(0.18, 0, 0, 'XYZ'),
          leftUpperArm: new THREE.Euler(0.25, 0, 0.16, 'XYZ'),
          leftLowerArm: new THREE.Euler(-0.65, 0, 0.08, 'XYZ'),
          rightUpperArm: new THREE.Euler(0.25, 0, -0.16, 'XYZ'),
          rightLowerArm: new THREE.Euler(-0.65, 0, -0.08, 'XYZ'),
        });
      } else {
        applyOffsets({
          hips: new THREE.Euler(0.08, 0, 0, 'XYZ'),
          spine: new THREE.Euler(0.12, 0, 0, 'XYZ'),
          chest: new THREE.Euler(0.08, 0, 0, 'XYZ'),
          neck: new THREE.Euler(-0.03, 0, 0, 'XYZ'),
          head: new THREE.Euler(-0.03, 0, 0, 'XYZ'),
          leftUpperLeg: new THREE.Euler(1.28, 0.12, 0.05, 'XYZ'),
          leftLowerLeg: new THREE.Euler(-1.18, 0, 0, 'XYZ'),
          leftFoot: new THREE.Euler(0.20, 0, 0.02, 'XYZ'),
          rightUpperLeg: new THREE.Euler(1.28, -0.12, -0.05, 'XYZ'),
          rightLowerLeg: new THREE.Euler(-1.18, 0, 0, 'XYZ'),
          rightFoot: new THREE.Euler(0.20, 0, -0.02, 'XYZ'),
          leftShoulder: new THREE.Euler(0.05, 0, 0.03, 'XYZ'),
          leftUpperArm: new THREE.Euler(0.28, 0, 0.18, 'XYZ'),
          leftLowerArm: new THREE.Euler(-0.72, 0, 0.06, 'XYZ'),
          leftHand: new THREE.Euler(0.04, 0, 0.04, 'XYZ'),
          rightShoulder: new THREE.Euler(0.05, 0, -0.03, 'XYZ'),
          rightUpperArm: new THREE.Euler(0.28, 0, -0.18, 'XYZ'),
          rightLowerArm: new THREE.Euler(-0.72, 0, -0.06, 'XYZ'),
          rightHand: new THREE.Euler(0.04, 0, -0.04, 'XYZ'),
        });
      }

      setActivePoseProfile(profileId);
      startPoseIdle([
        'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
        'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
        'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
      ]);
      return;
    }

    // Unknown or "none": just reset.
    seatedContactRef.current = null;
    setActivePoseProfile('');
  }, [getCurrentModelRoot, getLogicalBoneNode, resetAllBones, resetModelRootPosition, stopProcedural]);

  const sitOnSceneObject = useCallback((objectId: string) => {
    const target = getAiSceneObject(objectId);
    const root = getCurrentModelRoot();
    const sitPoint = target?.interactionPoints?.sit;

    if (!target || !sitPoint || !root || !target.actions.includes('sit')) {
      toaster.create({
        title: 'Cannot sit there',
        description: target ? `${target.humanName} has no sit point.` : `Object ${objectId} was not found.`,
        type: 'error',
        duration: 2500,
      });
      return;
    }

    const baseRotY = vrmRef.current?.meta?.metaVersion === '0' ? Math.PI : 0;
    const [fx, , fz] = target.facingDirection;
    const facingYaw = Math.atan2(fx, fz);
    root.position.set(sitPoint[0], 0, sitPoint[2]);
    root.rotation.y = baseRotY + facingYaw;
    root.updateMatrixWorld(true);
    if (modelBasePositionRef.current) {
      modelBasePositionRef.current.copy(root.position);
    }

    stopPoseIdle();
    stopProcedural();
    disposeSeatedRapier();
    seatedContactRef.current = {
      objectId,
      targetPelvisY: sitPoint[1],
      standPosition: target.interactionPoints.approach ?? [sitPoint[0], 0, sitPoint[2] + 0.7],
      rootX: sitPoint[0],
      rootZ: sitPoint[2],
      rootYaw: baseRotY + facingYaw,
    };
    createSeatedRapierHarness(sitPoint);
    ensureRapierReady().then(() => {
      if (seatedContactRef.current?.objectId !== objectId) return;
      createSeatedRapierHarness(sitPoint);
    }).catch((err) => {
      console.warn('[VrmViewer] Rapier init failed; falling back to kinematic seated correction:', err);
    });
    currentStateAnimUrlRef.current = SITTING_TALKING_FBX_URL;
    const sittingPlayback = { loopOnce: true, clampWhenFinished: true };
    const didUseVrmRetarget = playVrmRetargetedFbxFromUrl(SITTING_TALKING_FBX_URL, sittingPlayback);
    if (!didUseVrmRetarget) {
      playMixamoFbxFromUrl(SITTING_TALKING_FBX_URL, sittingPlayback);
    }

    toaster.create({
      title: 'Scene action',
      description: `Sitting on ${target.humanName}.`,
      type: 'success',
      duration: 1800,
    });
  }, [createSeatedRapierHarness, disposeSeatedRapier, ensureRapierReady, getAiSceneObject, getCurrentModelRoot, playMixamoFbxFromUrl, playVrmRetargetedFbxFromUrl, stopPoseIdle, stopProcedural]);

  const standFromSceneObject = useCallback(() => {
    const root = getCurrentModelRoot();
    const seatedContact = seatedContactRef.current;
    const standPosition = seatedContact?.standPosition ?? null;

    seatedContactRef.current = null;
    disposeSeatedRapier();
    stopPoseIdle();
    stopProcedural();
    stopVrma();
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

    currentStateAnimUrlRef.current = '';
    if (vrmRef.current?.humanoid) {
      playStateAnimFbx('/models/animations/Idle.fbx');
    }

    toaster.create({
      title: 'Scene action',
      description: 'Standing up.',
      type: 'success',
      duration: 1800,
    });
  }, [disposeSeatedRapier, getCurrentModelRoot, playStateAnimFbx, resetAllBones, stopPoseIdle, stopProcedural]);

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
  }, [getSceneObject3D]);

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
          break;
        case 'inspect':
        case 'read':
        case 'lookOut':
        case 'lookThrough':
          focusCameraOnSceneObject(entry);
          break;
        case 'open':
          animateSceneObjectOpenState(entry, true);
          focusCameraOnSceneObject(entry);
          break;
        case 'close':
          animateSceneObjectOpenState(entry, false);
          focusCameraOnSceneObject(entry);
          break;
        case 'pickUp': {
          const object = getSceneObject3D(entry.id);
          if (object) object.visible = false;
          break;
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
          break;
        }
        case 'call':
          focusCameraOnSceneObject(entry);
          break;
        default:
          focusCameraOnSceneObject(entry);
          break;
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
  }, [
    animateSceneObjectOpenState,
    focusCameraOnSceneObject,
    getAiSceneObject,
    getSceneObject3D,
    moveAvatarToSceneObject,
    startWalkingToSceneObject,
  ]);

  useEffect(() => {
    const onSceneAction = (event: Event) => {
      const detail = (event as CustomEvent<AiSceneActionEventDetail>).detail;
      if (detail?.action === 'sit' && detail.objectId) {
        sitOnSceneObject(detail.objectId);
      } else if (detail?.action === 'stand') {
        standFromSceneObject();
      } else if (detail?.action && detail.objectId) {
        executeSceneObjectAction(detail.action, detail.objectId);
      }
    };

    window.addEventListener('ai-scene-action', onSceneAction);
    return () => window.removeEventListener('ai-scene-action', onSceneAction);
  }, [executeSceneObjectAction, sitOnSceneObject, standFromSceneObject]);

  // Expose pose profiles to DevTools console:
  // `window.vtuberPose.apply('cross_leg_floor_sit')` / `window.vtuberPose.reset()`
  useEffect(() => {
    (window as any).vtuberPose = {
      apply: (id: string) => applyPoseProfile(id),
      reset: () => applyPoseProfile(''),
      sit: (objectId = 'CHAIR_Desk_01') => sitOnSceneObject(objectId),
      stand: () => standFromSceneObject(),
      action: (action: string, objectId: string) => executeSceneObjectAction(action, objectId),
      profiles: [
        { id: '', name: 'Reset' },
        { id: 'floor_sit_cross_leg', name: 'Floor Sit (Crossed Legs)' },
        { id: 'chair_sit', name: 'Chair Sit' },
      ],
    };
    return () => {
      if ((window as any).vtuberPose?.apply) {
        delete (window as any).vtuberPose;
      }
    };
  }, [applyPoseProfile, executeSceneObjectAction, sitOnSceneObject, standFromSceneObject]);

  const handleDoubleClick = () => {
      const currentUrl = normalizedConfig?.url?.toLowerCase() || "";
      if (currentUrl.endsWith(CHARACTER_BLUE_MODEL_SUFFIX.toLowerCase())) {
        console.log("Double click detected on character_blue model, playing random animation...");
        playRandomCharacterBlueAnimation();
      } else {
        // Avoid trying to load a hard-coded VRMA that may not exist in the backend.
        // Use the upload button instead.
        console.log("Double click detected (no default action).");
      }
  };

  // Event Listener for MediaPipe
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<VrmMotionMessage>;
      applyMotionToAvatar(custom.detail);
    };
    window.addEventListener('vrm-motion', handler as EventListener);
    return () => {
      window.removeEventListener('vrm-motion', handler as EventListener);
    };
  }, [applyMotionToAvatar]);

  // Thinking animation pool — add more Mixamo FBX files to this array for variety.
  // Idle.fbx gives a "still, contemplating" look while the procedural head/eye system
  // still applies the thinking gaze pattern on top.
  const THINKING_ANIMS = [
    '/models/animations/Thinking.fbx',
    '/models/animations/Idle.fbx',
  ];
  const thinkingAnimRef = useRef('');

  // Drive AnimationManager state and FBX animations from AI conversation state
  useEffect(() => {
    if (!vrmRef.current?.humanoid) return;
    if (stateAnimTimerRef.current) {
      clearTimeout(stateAnimTimerRef.current);
      stateAnimTimerRef.current = null;
    }
    const am = animMgrRef.current;
    switch (aiState) {
      case AiStateEnum.IDLE:
      case AiStateEnum.INTERRUPTED:
        if (am) am.isSpeaking = false;
        am?.setState('idle');
        playStateAnimFbx('/models/animations/Idle.fbx');
        break;
      case AiStateEnum.LISTENING:
        if (am) am.isSpeaking = false;
        am?.setState('listening');
        playStateAnimFbx('/models/animations/Idle.fbx');
        break;
      case AiStateEnum.THINKING_SPEAKING: {
        if (am) am.isSpeaking = false;
        am?.setState('thinking');
        // Pick a random thinking animation (different from last time if possible)
        let pick = THINKING_ANIMS[Math.floor(Math.random() * THINKING_ANIMS.length)];
        if (THINKING_ANIMS.length > 1 && pick === thinkingAnimRef.current) {
          pick = THINKING_ANIMS.find((a) => a !== pick) ?? pick;
        }
        thinkingAnimRef.current = pick;
        currentStateAnimUrlRef.current = '';
        playStateAnimFbx(pick);
        break;
      }
      default:
        if (am) am.isSpeaking = false;
        am?.setState('idle');
        playStateAnimFbx('/models/animations/Idle.fbx');
        break;
    }
  }, [aiState, playStateAnimFbx]);

  // Switch to Talking animation and enable lip sync only when audio actually plays
  useEffect(() => {
    const onAudioStart = () => {
      if (walkTargetRef.current) return;
      if (animMgrRef.current) {
        animMgrRef.current.isSpeaking = true;
        animMgrRef.current.setState('talking');
      }
      currentStateAnimUrlRef.current = '';
      playStateAnimFbx('/models/animations/Talking.fbx');
    };
    const onAudioStop = () => {
      if (animMgrRef.current) animMgrRef.current.isSpeaking = false;
    };
    window.addEventListener('vrm-audio-start', onAudioStart);
    window.addEventListener('vrm-audio-stop', onAudioStop);
    return () => {
      window.removeEventListener('vrm-audio-start', onAudioStart);
      window.removeEventListener('vrm-audio-stop', onAudioStop);
    };
  }, [playStateAnimFbx]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.enabled = !(mode === 'pet' && forceIgnoreMouse);
    }
  }, [forceIgnoreMouse, mode]);

  // Initial Model Loading
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !normalizedConfig?.url) {
      return () => {};
    }

    // Reset per-model state.
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
      mixerRef.current = null;
    }
    currentActionRef.current = null;
    loadedClipsRef.current = [];
    setClipNames([]);
    setSelectedClipName('');
    setIsVrmaPlaying(false);
    if (sceneRef.current && skeletonHelperRef.current) {
      sceneRef.current.remove(skeletonHelperRef.current);
    }
    skeletonHelperRef.current = null;
    initialBoneTransformsRef.current.clear();
    setRigBones([]);
    setSelectedBone('');
    setRigSearch('');
    setRigRotDeg({ x: 0, y: 0, z: 0 });
    setRigPos({ x: 0, y: 0, z: 0 });
    setShowSkeleton(false);
    setWireframe(false);
    setRigModelStamp((v) => v + 1);

    console.log('[VrmViewer] Initializing with config:', normalizedConfig);

    const hasSceneGlb = Boolean(normalizedConfig.sceneGlb);
    const hasNamiStudioScene = normalizedConfig.scenePreset === 'nami_studio_apartment';
    const hasEnvironmentScene = hasSceneGlb || hasNamiStudioScene;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    if (normalizedConfig.backgroundColor) {
      scene.background = new THREE.Color(normalizedConfig.backgroundColor);
    } else if (hasNamiStudioScene) {
      scene.background = new THREE.Color(0xffc983);
    } else if (hasSceneGlb) {
      scene.background = new THREE.Color(0x111111);
    } else {
      scene.background = null;
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: !normalizedConfig.backgroundColor && !hasEnvironmentScene,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = hasNamiStudioScene ? 1.18 : 1;
    if (hasEnvironmentScene) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Enable WebXR for VR scene support
    renderer.xr.enabled = true;
    if (hasEnvironmentScene) {
      const vrButton = VRButton.createButton(renderer);
      vrButton.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;pointer-events:auto;';
      document.body.appendChild(vrButton);
      vrButtonRef.current = vrButton;
    }

    const camera = new THREE.PerspectiveCamera(
      30,
      (container.clientWidth || 1) / (container.clientHeight || 1),
      0.1,
      hasEnvironmentScene ? 200 : 20,
    );
    camera.position.fromArray(normalizedConfig.cameraPosition);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.autoRotate = normalizedConfig.autoRotate;
    controls.autoRotateSpeed = 0.8;
    controls.minDistance = 0.1;
    controls.maxDistance = 10;
    controls.target.fromArray(normalizedConfig.cameraTarget);
    controlsRef.current = controls;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x222244, 0.9);
    scene.add(hemi);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(1, 1.5, 0.5);
    dirLight.castShadow = hasEnvironmentScene;
    if (hasEnvironmentScene) {
      dirLight.shadow.mapSize.set(2048, 2048);
      dirLight.shadow.camera.near = 0.1;
      dirLight.shadow.camera.far = 20;
      dirLight.shadow.camera.left = -6;
      dirLight.shadow.camera.right = 6;
      dirLight.shadow.camera.top = 6;
      dirLight.shadow.camera.bottom = -6;
    }
    scene.add(dirLight);

    let disposed = false;

    if (hasNamiStudioScene) {
      const { root: apartment, registry } = createNamiStudioApartmentScene();
      apartment.position.set(0, 0, 0);
      scene.add(apartment);
      roomModelRef.current = apartment;
      (window as any).__AI_SCENE_REGISTRY__ = registry;

      const blueprintLoader = new GLTFLoader();
      const blueprintDracoLoader = new DRACOLoader();
      blueprintDracoLoader.setDecoderPath('/draco/');
      blueprintLoader.setDRACOLoader(blueprintDracoLoader);
      apartment.traverse((anchor: THREE.Object3D) => {
        const asset = anchor.userData.blueprintAsset as {
          url: string;
          scale: number;
          offset: [number, number, number];
          rotation: [number, number, number];
        } | undefined;
        if (!asset) return;

        blueprintLoader.load(
          asset.url,
          (gltf: GLTF) => {
            if (disposed) return;
            const model = gltf.scene;
            model.name = `${anchor.name}_Blueprint3DModel`;
            model.rotation.set(...asset.rotation);
            model.scale.setScalar(asset.scale);
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

      console.log('[VrmViewer] Nami studio apartment scene ready:', registry);
    }

    // Load 3D scene/room GLB environment
    if (hasSceneGlb) {
      const roomLoader = new GLTFLoader();
      roomLoader.load(
        normalizedConfig.sceneGlb,
        (gltf: GLTF) => {
          if (disposed) return;
          const room = gltf.scene;
          const [px, py, pz] = normalizedConfig.sceneGlbPosition ?? [0, 0, 0];
          const [rx, ry, rz] = normalizedConfig.sceneGlbRotation ?? [0, 0, 0];
          const rawScale = normalizedConfig.sceneGlbScale ?? 1;
          const [sx, sy, sz] = Array.isArray(rawScale) ? rawScale : [rawScale as number, rawScale as number, rawScale as number];
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
          console.log('[VrmViewer] VR scene GLB loaded:', normalizedConfig.sceneGlb);
        },
        undefined,
        (err: unknown) => console.error('[VrmViewer] Failed to load scene GLB:', err),
      );
    }

    const loader = new GLTFLoader();
    loader.register((parser: GLTFParser) => new VRMLoaderPlugin(parser));

    console.log('[VrmViewer] Starting load:', normalizedConfig.url);
    loader.load(
      normalizedConfig.url,
      (gltf: GLTF) => {
        if (disposed) return;
        console.log('[VrmViewer] Model loaded successfully');
        
        const vrm = gltf.userData.vrm as VRM | undefined;

        // Store embedded clips (if any) so we can autoplay / switch them.
        loadedClipsRef.current = Array.isArray(gltf.animations) ? gltf.animations : [];
        const names = loadedClipsRef.current.map((c) => c.name).filter((n) => n && n.trim().length > 0);
        setClipNames(names);
        if (names.length > 0) setSelectedClipName(names[0]);
        console.log('[VrmViewer] Embedded animations:', loadedClipsRef.current.length, names);
        
        if (vrm) {
          VRMUtils.removeUnnecessaryVertices(vrm.scene);
          if (typeof VRMUtils.combineSkeletons === 'function') {
            VRMUtils.combineSkeletons(vrm.scene);
          } else {
            VRMUtils.removeUnnecessaryJoints(vrm.scene);
          }
          VRMUtils.rotateVRM0(vrm);
          // Fully reset scene rotation — keep only the Y=π that rotateVRM0 sets for
          // VRM 0.x (needed to flip the facing direction); zero everything else.
          const isVRM0Scene = vrm.meta?.metaVersion === '0';
          const baseRotY = isVRM0Scene ? Math.PI : 0;
          vrm.scene.rotation.set(0, baseRotY + THREE.MathUtils.degToRad(normalizedConfig.vrmRotY ?? 0), 0);
          console.log('[VrmViewer] metaVersion=', vrm.meta?.metaVersion, 'scene.rotation.y=', vrm.scene.rotation.y);
          vrm.scene.traverse((obj: THREE.Object3D) => {
            obj.frustumCulled = false;
          });
          vrm.scene.scale.setScalar(normalizedConfig.scale);
          vrm.scene.position.set(normalizedConfig.x, normalizedConfig.y, normalizedConfig.vrmPosZ ?? 0);
          modelBasePositionRef.current = vrm.scene.position.clone();
          scene.add(vrm.scene);
          vrmRef.current = vrm;

          // Populate rig debug list from VRM humanoid bones.
          const bones: string[] = [];
          Object.values(VRMHumanBoneName).forEach((boneKey) => {
            const key = String(boneKey);
            const node = vrm.humanoid?.getNormalizedBoneNode(boneKey as VRMHumanBoneName);
            if (!node) return;
            bones.push(key);
            initialBoneTransformsRef.current.set(key, {
              q: node.quaternion.clone(),
              p: node.position.clone(),
            });
          });
          setRigBones(bones);
          if (bones.length > 0) setSelectedBone(bones[0]);
          setRigModelStamp((v) => v + 1);

          // Initialize procedural animation manager and start idle animation
          if (animMgrRef.current) animMgrRef.current.destroy();
          animMgrRef.current = new VrmAnimationManager(vrm);
          currentStateAnimUrlRef.current = '';
          // Create the one persistent mixer for this model's lifetime.
          if (mixerRef.current) { mixerRef.current.stopAllAction(); mixerRef.current = null; }
          const vrmMixer = new THREE.AnimationMixer(vrm.scene);
          mixerRef.current = vrmMixer;
          loadMixamoAnimForVRM('/models/animations/Idle.fbx', vrm).then((clip) => {
            if (disposed) return;
            currentStateAnimUrlRef.current = '/models/animations/Idle.fbx';
            const action = vrmMixer.clipAction(clip);
            action.reset().play();
            currentActionRef.current = action;
            setIsVrmaPlaying(true);
            if (animMgrRef.current) animMgrRef.current.isMixamoPlaying = true;
          }).catch((err) => console.error('[VrmViewer] Idle animation failed:', err));

          // VRMs typically don't ship animation clips, but if they do, autoplay the first.
          if (loadedClipsRef.current.length > 0) {
            playLoadedClipByName(loadedClipsRef.current[0].name);
          }
        } else {
          const model = gltf.scene;
          model.traverse((obj: THREE.Object3D) => {
            obj.frustumCulled = false;
          });
          rebuildGlbBoneIndices(model);
          model.scale.setScalar(normalizedConfig.scale);
          model.position.set(normalizedConfig.x, normalizedConfig.y, normalizedConfig.vrmPosZ ?? 0);
          modelBasePositionRef.current = model.position.clone();
          scene.add(model);
          glbModelRef.current = model;

          // Populate rig debug list from raw GLB bone names.
          const bones = Array.from(glbBonesRef.current.keys()).sort((a, b) => a.localeCompare(b));
          bones.forEach((boneName) => {
            const node = glbBonesRef.current.get(boneName);
            if (!node) return;
            initialBoneTransformsRef.current.set(boneName, {
              q: node.quaternion.clone(),
              p: node.position.clone(),
            });
          });
          setRigBones(bones);
          if (bones.length > 0) setSelectedBone(bones[0]);
          setRigModelStamp((v) => v + 1);

          // Match the 3d-human-model viewer behavior: play the first embedded clip.
          if (loadedClipsRef.current.length > 0) {
            playLoadedClipByName(loadedClipsRef.current[0].name);
          }
        }
      },
      undefined,
      (error: unknown) => {
        console.error('[VrmViewer] Failed to load model:', error);
      },
    );

    const clock = new THREE.Clock();
    const renderLoop = () => {
      const delta = clock.getDelta();
      controls.update();
      if (mixerRef.current) {
          mixerRef.current.update(delta);
      }

      if (poseIdleActiveRef.current) {
        const t = (performance.now() / 1000) - poseIdleStartRef.current;
        const breathe = Math.sin(t * 1.15);
        const sway = Math.sin(t * 0.65 + 0.5);
        const micro = Math.sin(t * 2.2);

        const applyIdle = (key: LogicalBone, euler: THREE.Euler) => {
          const node = poseIdleNodesRef.current.get(key);
          const base = poseIdleBaseQuatRef.current.get(key);
          if (!node || !base) return;
          const qOff = new THREE.Quaternion().setFromEuler(euler);
          node.quaternion.copy(base).multiply(qOff);
          node.updateMatrixWorld(true);
        };

        applyIdle('chest', new THREE.Euler(0.015 * breathe, 0.01 * sway, 0, 'XYZ'));
        applyIdle('spine', new THREE.Euler(0.010 * breathe, 0.015 * sway, 0, 'XYZ'));
        applyIdle('neck', new THREE.Euler(0.010 * micro, 0.010 * sway, 0, 'XYZ'));
        applyIdle('head', new THREE.Euler(0.015 * micro, 0.020 * sway, 0.005 * micro, 'XYZ'));

        // Tiny arm micro-adjustments.
        applyIdle('leftUpperArm', new THREE.Euler(0.01 * breathe, 0, 0.015 * micro, 'XYZ'));
        applyIdle('rightUpperArm', new THREE.Euler(0.01 * breathe, 0, -0.015 * micro, 'XYZ'));
        applyIdle('leftHand', new THREE.Euler(0, 0, 0.01 * micro, 'XYZ'));
        applyIdle('rightHand', new THREE.Euler(0, 0, -0.01 * micro, 'XYZ'));
      }

      // Simple procedural animation: arm wave + slight torso/head movement.
      if (proceduralActiveRef.current) {
        const t = (performance.now() / 1000) - proceduralStartRef.current;
        // Clap loop: bring hands together, contact, and separate.
        // This is intentionally subtle and model-agnostic; tweak via Rig Debug if axes differ.
        const speed = 2.8; // claps per second-ish
        const s = Math.sin(t * speed);
        const closeRaw = (s + 1) * 0.5; // 0..1
        const close = closeRaw * closeRaw; // ease in a bit
        const micro = Math.sin(t * speed * 2.0 + 0.7);
        const twist = Math.sin(t * 0.6);

        const applyOffset = (key: string, euler: THREE.Euler) => {
          const node = proceduralNodesRef.current.get(key);
          const base = proceduralBaseQuatRef.current.get(key);
          if (!node || !base) return;
          const qOff = new THREE.Quaternion().setFromEuler(euler);
          node.quaternion.copy(base).multiply(qOff);
          node.updateMatrixWorld(true);
        };

        // Body "alive" while clapping.
        applyOffset('hips', new THREE.Euler(0.01 * close, 0.04 * twist, 0, 'XYZ'));
        applyOffset('spine', new THREE.Euler(0.02 * close, 0.06 * twist, 0, 'XYZ'));
        applyOffset('chest', new THREE.Euler(0.03 * close, 0.05 * twist, 0, 'XYZ'));
        applyOffset('neck', new THREE.Euler(0.01 * micro, 0.03 * twist, 0, 'XYZ'));
        applyOffset('head', new THREE.Euler(0.015 * micro, 0.04 * twist, 0.004 * micro, 'XYZ'));

        // Arms: move inward/outward symmetrically.
        // Upper arms rotate forward slightly and adduct (Z) to bring hands together.
        applyOffset('leftUpperArm', new THREE.Euler(0.15 + 0.20 * close, 0.10 * close, 0.95 * close, 'XYZ'));
        applyOffset('rightUpperArm', new THREE.Euler(0.15 + 0.20 * close, -0.10 * close, -0.95 * close, 'XYZ'));

        // Forearms flex to "close" the clap.
        applyOffset('leftLowerArm', new THREE.Euler(-0.15 * close, 0, 0.55 * close, 'XYZ'));
        applyOffset('rightLowerArm', new THREE.Euler(-0.15 * close, 0, -0.55 * close, 'XYZ'));
      }
      
      // AnimationManager — procedural head/eye/blink (runs after mixer so it overrides FBX head tracks)
      if (animMgrRef.current) {
        animMgrRef.current.isMixamoPlaying = isVrmaPlayingRef.current;
        animMgrRef.current.update(delta);
      }

      const vrm = vrmRef.current;
      if (vrm) {
          vrm.update(delta);
          // Lip sync only while the AI is actually speaking
          if (animMgrRef.current?.isSpeaking) {
              const s = Math.sin(clock.elapsedTime * 15);
              const open = (s + 1) * 0.35;
              vrm.expressionManager?.setValue('aa', open);
          } else {
              vrm.expressionManager?.setValue('aa', 0);
          }
      }

      const walkTarget = walkTargetRef.current;
      if (walkTarget) {
        const root = vrmRef.current?.scene ?? glbModelRef.current;
        if (root) {
          keepWalkingAnimationActive();
          const toTarget = walkTarget.position.clone().sub(root.position);
          toTarget.y = 0;
          const distance = toTarget.length();
          if (distance <= 0.05) {
            root.position.set(walkTarget.position.x, walkTarget.position.y, walkTarget.position.z);
            root.rotation.y = (vrmRef.current?.meta?.metaVersion === '0' ? Math.PI : 0)
              + Math.atan2(walkTarget.lookAt.x - root.position.x, walkTarget.lookAt.z - root.position.z);
            root.updateMatrixWorld(true);
            modelBasePositionRef.current = root.position.clone();

            const onArrive = walkTarget.onArrive;
            walkTargetRef.current = null;
            if (mixerRef.current) {
              mixerRef.current.stopAllAction();
              mixerRef.current = null;
              currentActionRef.current = null;
            }
            setIsVrmaPlaying(false);
            currentStateAnimUrlRef.current = '';
            if (vrmRef.current?.humanoid) {
              playStateAnimFbx('/models/animations/Idle.fbx');
            }
            onArrive?.();
          } else {
            const step = Math.min(distance, delta * 1.15);
            const direction = toTarget.normalize();
            root.position.addScaledVector(direction, step);
            root.position.y = THREE.MathUtils.lerp(root.position.y, walkTarget.position.y, 0.18);
            root.rotation.y = (vrmRef.current?.meta?.metaVersion === '0' ? Math.PI : 0)
              + Math.atan2(direction.x, direction.z);
            root.updateMatrixWorld(true);
          }
        }
      }

      const seatedContact = seatedContactRef.current;
      if (seatedContact) {
        const root = vrmRef.current?.scene ?? glbModelRef.current;
        const hipsNode = vrmRef.current?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.Hips)
          ?? glbBonesNormalizedRef.current.get('hips')
          ?? null;
        const leftFootNode = vrmRef.current?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.LeftFoot)
          ?? glbBonesNormalizedRef.current.get('leftfoot')
          ?? null;
        const rightFootNode = vrmRef.current?.humanoid?.getNormalizedBoneNode(VRMHumanBoneName.RightFoot)
          ?? glbBonesNormalizedRef.current.get('rightfoot')
          ?? null;
        if (root && hipsNode) {
          root.position.x = THREE.MathUtils.lerp(root.position.x, seatedContact.rootX, 0.35);
          root.position.z = THREE.MathUtils.lerp(root.position.z, seatedContact.rootZ, 0.35);
          root.rotation.x = 0;
          root.rotation.y = seatedContact.rootYaw;
          root.rotation.z = 0;
          root.updateMatrixWorld(true);

          const hipsWorld = new THREE.Vector3();
          hipsNode.getWorldPosition(hipsWorld);
          const rapierHarness = seatedRapierRef.current;
          let targetPelvisY = seatedContact.targetPelvisY;
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
            if (modelBasePositionRef.current) {
              modelBasePositionRef.current.copy(root.position);
            }
          }

          const floorY = 0.015;
          const footWorldPositions = [leftFootNode, rightFootNode]
            .filter((node): node is THREE.Object3D => Boolean(node))
            .map((node) => {
              const p = new THREE.Vector3();
              node.getWorldPosition(p);
              return p;
            });
          const minFootY = footWorldPositions.length
            ? Math.min(...footWorldPositions.map((p) => p.y))
            : Infinity;
          if (minFootY < floorY) {
            root.position.y += floorY - minFootY;
            root.updateMatrixWorld(true);
            if (modelBasePositionRef.current) {
              modelBasePositionRef.current.copy(root.position);
            }
          }
        }
      }
      
      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(renderLoop);

    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });

    resizeObserver.observe(container);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      renderer.dispose();
      if (stateAnimTimerRef.current) { clearTimeout(stateAnimTimerRef.current); stateAnimTimerRef.current = null; }
      if (animMgrRef.current) { animMgrRef.current.destroy(); animMgrRef.current = null; }
      currentStateAnimUrlRef.current = '';
      seatedContactRef.current = null;
      disposeSeatedRapier();
      walkTargetRef.current = null;
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      if (vrButtonRef.current) {
        if (document.body.contains(vrButtonRef.current)) {
          document.body.removeChild(vrButtonRef.current);
        }
        vrButtonRef.current = null;
      }
      const disposeObject = (obj: THREE.Object3D) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((material: THREE.Material) => material.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }
        }
      };
      if (roomModelRef.current) {
        scene.remove(roomModelRef.current);
        roomModelRef.current.traverse(disposeObject);
        roomModelRef.current = null;
      }
      if ((window as any).__AI_SCENE_REGISTRY__?.sceneId === 'nami_studio_apartment') {
        delete (window as any).__AI_SCENE_REGISTRY__;
      }
      vrmRef.current?.scene.traverse(disposeObject);
      glbModelRef.current?.traverse(disposeObject);

      vrmRef.current = null;
      glbModelRef.current = null;
      glbBonesRef.current.clear();
      glbBonesNormalizedRef.current.clear();
      glbSkinnedMeshesRef.current = [];
      poseIdleActiveRef.current = false;
      poseIdleNodesRef.current.clear();
      poseIdleBaseQuatRef.current.clear();
      skeletonHelperRef.current = null;
      sceneRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedConfig?.url]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div
        ref={containerRef}
        onDoubleClick={handleDoubleClick}
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          pointerEvents: mode === 'pet' && forceIgnoreMouse ? 'none' : 'auto',
        }}
      />
      {/* UI Overlay */}
      <div style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: '12px',
        borderRadius: '8px',
        color: 'white',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        fontFamily: 'sans-serif',
        fontSize: '12px',
        maxWidth: '280px',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Pose Corrections</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={invertLegs} 
            onChange={(e) => setInvertLegs(e.target.checked)}
          />
          Invert Legs
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input 
            type="checkbox" 
            checked={flipHips} 
            onChange={(e) => setFlipHips(e.target.checked)}
          />
          Flip Hips (180°)
        </label>
        
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.3)', margin: '4px 0' }}></div>

        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Pose Profiles</div>
        <select
          value={activePoseProfile}
          onChange={(e) => setActivePoseProfile(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.08)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '4px',
            padding: '4px 6px',
          }}
        >
          <option value="" style={{ color: 'black' }}>Reset</option>
          <option value="floor_sit_cross_leg" style={{ color: 'black' }}>Floor Sit (Crossed Legs)</option>
        </select>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => applyPoseProfile(activePoseProfile)}
            disabled={isAnyAnimationPlaying}
            style={{
              cursor: !isAnyAnimationPlaying ? 'pointer' : 'not-allowed',
              background: 'rgba(255,255,255,0.12)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '4px 8px',
              borderRadius: '4px',
              flex: 1,
            }}
          >
            Apply Pose
          </button>
          <button
            onClick={() => applyPoseProfile('')}
            disabled={isAnyAnimationPlaying}
            style={{
              cursor: !isAnyAnimationPlaying ? 'pointer' : 'not-allowed',
              background: 'rgba(255,255,255,0.12)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '4px 8px',
              borderRadius: '4px',
              flex: 1,
            }}
          >
            Reset Pose
          </button>
        </div>

        <button
          onClick={copyCurrentPoseToClipboard}
          style={{
            cursor: 'pointer',
            background: 'rgba(255,255,255,0.12)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '4px 8px',
            borderRadius: '4px',
            width: '100%',
          }}
        >
          Copy Pose (All Joints)
        </button>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.3)', margin: '4px 0' }}></div>

        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>VRM Animation</div>
        {clipNames.length > 0 ? (
          <>
            <div style={{ opacity: 0.85 }}>Embedded clips</div>
            <select
              value={selectedClipName}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedClipName(next);
                playLoadedClipByName(next);
              }}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.08)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '4px',
                padding: '4px 6px',
              }}
            >
              {clipNames.map((name) => (
                <option key={name} value={name} style={{ color: 'black' }}>
                  {name}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isProceduralPlaying ? (
            <button
              onClick={startProcedural}
              disabled={isVrmaPlaying}
              style={{
                cursor: !isVrmaPlaying ? 'pointer' : 'not-allowed',
                background: 'rgba(255,255,255,0.12)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '4px 8px',
                borderRadius: '4px',
                flex: 1,
              }}
            >
              Clap Hands
            </button>
          ) : (
            <button
              onClick={stopProcedural}
              style={{
                cursor: 'pointer',
                background: '#e53e3e',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                flex: 1,
              }}
            >
              Stop Demo
            </button>
          )}

          <button
            onClick={stopVrma}
            disabled={!isVrmaPlaying}
            style={{
              cursor: isVrmaPlaying ? 'pointer' : 'not-allowed',
              background: isVrmaPlaying ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '4px 8px',
              borderRadius: '4px',
              flex: 1,
            }}
          >
            Stop Clip
          </button>
        </div>

        {!isAnyAnimationPlaying ? (
            <label style={{ 
                display: 'inline-block', 
                cursor: 'pointer', 
                background: '#3182ce', 
                padding: '4px 8px', 
                borderRadius: '4px', 
                textAlign: 'center' 
            }}>
                Upload animation
                <input 
                    type="file" 
                    accept=".vrma,.glb,.gltf,.fbx" 
                    style={{ display: 'none' }} 
                    onChange={handleVrmaUpload} 
                />
            </label>
        ) : (
            <button 
                onClick={() => { stopProcedural(); stopVrma(); }}
                style={{ 
                    cursor: 'pointer', 
                    background: '#e53e3e', 
                    color: 'white', 
                    border: 'none', 
                    padding: '4px 8px', 
                    borderRadius: '4px' 
                }}
            >
                Stop Animation
            </button>
        )}

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.3)', margin: '4px 0' }}></div>

        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Rig Debug</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showSkeleton}
            onChange={(e) => setShowSkeleton(e.target.checked)}
          />
          Skeleton
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={wireframe}
            onChange={(e) => setWireframe(e.target.checked)}
          />
          Wireframe
        </label>

        <input
          value={rigSearch}
          onChange={(e) => setRigSearch(e.target.value)}
          placeholder="Search bone..."
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.08)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '4px',
            padding: '4px 6px',
          }}
        />

        <select
          value={selectedBone}
          onChange={(e) => setSelectedBone(e.target.value)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.08)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '4px',
            padding: '4px 6px',
          }}
        >
          {rigBones
            .filter((b) => b.toLowerCase().includes(rigSearch.toLowerCase()))
            .slice(0, 200)
            .map((b) => (
              <option key={b} value={b} style={{ color: 'black' }}>{b}</option>
            ))}
        </select>

        <div style={{ opacity: 0.85 }}>Rotation (deg)</div>
        {(['x', 'y', 'z'] as const).map((axis) => (
          <label key={axis} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px' }}>{axis.toUpperCase()}</span>
            <input
              type="range"
              min={-180}
              max={180}
              step={1}
              disabled={!selectedBone || isAnyAnimationPlaying}
              value={Math.round(rigRotDeg[axis])}
              onChange={(e) => {
                const next = { ...rigRotDeg, [axis]: Number(e.target.value) } as Vec3;
                setRigRotDeg(next);
                if (selectedBone) applyRigToBone(selectedBone, next, rigPos);
              }}
              style={{ flex: 1 }}
            />
            <span style={{ width: '44px', textAlign: 'right' }}>{Math.round(rigRotDeg[axis])}</span>
          </label>
        ))}

        <div style={{ opacity: 0.85 }}>Position</div>
        {(['x', 'y', 'z'] as const).map((axis) => (
          <label key={axis} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px' }}>{axis.toUpperCase()}</span>
            <input
              type="range"
              min={-2}
              max={2}
              step={0.01}
              disabled={!selectedBone || isAnyAnimationPlaying}
              value={rigPos[axis]}
              onChange={(e) => {
                const next = { ...rigPos, [axis]: Number(e.target.value) } as Vec3;
                setRigPos(next);
                if (selectedBone) applyRigToBone(selectedBone, rigRotDeg, next);
              }}
              style={{ flex: 1 }}
            />
            <span style={{ width: '44px', textAlign: 'right' }}>{rigPos[axis].toFixed(2)}</span>
          </label>
        ))}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => (selectedBone ? resetBone(selectedBone) : undefined)}
            disabled={!selectedBone || isAnyAnimationPlaying}
            style={{
              cursor: selectedBone && !isAnyAnimationPlaying ? 'pointer' : 'not-allowed',
              background: 'rgba(255,255,255,0.12)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '4px 8px',
              borderRadius: '4px',
              flex: 1,
            }}
          >
            Reset Bone
          </button>
          <button
            onClick={resetAllBones}
            disabled={isAnyAnimationPlaying}
            style={{
              cursor: !isAnyAnimationPlaying ? 'pointer' : 'not-allowed',
              background: 'rgba(255,255,255,0.12)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '4px 8px',
              borderRadius: '4px',
              flex: 1,
            }}
          >
            Reset All
          </button>
        </div>
        {isAnyAnimationPlaying ? (
          <div style={{ opacity: 0.75, fontSize: '11px' }}>
            Stop animation to edit bones.
          </div>
        ) : null}

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.3)', margin: '4px 0' }} />

        {/* ── VRM Transform ── */}
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>VRM Transform</div>

        <div style={{ opacity: 0.85 }}>Scale</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="range" min={0.01} max={10} step={0.01}
            value={vrmScale}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVrmScale(v);
              applyVrmTransform(v, vrmPosX, vrmPosY, vrmPosZ, vrmRotY);
            }}
            style={{ flex: 1 }}
          />
          <span style={{ width: '44px', textAlign: 'right' }}>{vrmScale.toFixed(2)}</span>
        </label>

        <div style={{ opacity: 0.85 }}>Position</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px' }}>X</span>
          <input
            type="range" min={-10} max={10} step={0.05}
            value={vrmPosX}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVrmPosX(v);
              applyVrmTransform(vrmScale, v, vrmPosY, vrmPosZ, vrmRotY);
            }}
            style={{ flex: 1 }}
          />
          <span style={{ width: '44px', textAlign: 'right' }}>{vrmPosX.toFixed(2)}</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px' }}>Y</span>
          <input
            type="range" min={-10} max={10} step={0.05}
            value={vrmPosY}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVrmPosY(v);
              applyVrmTransform(vrmScale, vrmPosX, v, vrmPosZ, vrmRotY);
            }}
            style={{ flex: 1 }}
          />
          <span style={{ width: '44px', textAlign: 'right' }}>{vrmPosY.toFixed(2)}</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px' }}>Z</span>
          <input
            type="range" min={-10} max={10} step={0.05}
            value={vrmPosZ}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVrmPosZ(v);
              applyVrmTransform(vrmScale, vrmPosX, vrmPosY, v, vrmRotY);
            }}
            style={{ flex: 1 }}
          />
          <span style={{ width: '44px', textAlign: 'right' }}>{vrmPosZ.toFixed(2)}</span>
        </label>

        <div style={{ opacity: 0.85 }}>Rotation Y (deg)</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input
            type="range" min={-180} max={180} step={1}
            value={Math.round(vrmRotY)}
            onChange={(e) => {
              const v = Number(e.target.value);
              setVrmRotY(v);
              applyVrmTransform(vrmScale, vrmPosX, vrmPosY, vrmPosZ, v);
            }}
            style={{ flex: 1 }}
          />
          <span style={{ width: '44px', textAlign: 'right' }}>{Math.round(vrmRotY)}°</span>
        </label>

        <button
          onClick={() => {
            const s = normalizedConfig?.scale ?? 1;
            const px = normalizedConfig?.x ?? 0;
            const py = normalizedConfig?.y ?? 0;
            const pz = normalizedConfig?.vrmPosZ ?? 0;
            const ry = normalizedConfig?.vrmRotY ?? 0;
            setVrmScale(s); setVrmPosX(px); setVrmPosY(py); setVrmPosZ(pz); setVrmRotY(ry);
            applyVrmTransform(s, px, py, pz, ry);
          }}
          style={{
            cursor: 'pointer', background: 'rgba(255,255,255,0.12)', color: 'white',
            border: '1px solid rgba(255,255,255,0.2)', padding: '4px 8px', borderRadius: '4px',
          }}
        >
          Reset VRM Transform
        </button>

        {/* ── Scene Transform (only when sceneGlb is set) ── */}
        {normalizedConfig?.sceneGlb ? (
          <>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.3)', margin: '4px 0' }} />
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Scene Transform</div>

            <div style={{ opacity: 0.85 }}>Position</div>
            {(['x', 'y', 'z'] as const).map((axis) => (
              <label key={axis} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px' }}>{axis.toUpperCase()}</span>
                <input
                  type="range" min={-20} max={20} step={0.1}
                  value={scenePos[axis]}
                  onChange={(e) => {
                    const next = { ...scenePos, [axis]: Number(e.target.value) };
                    setScenePos(next);
                    applySceneTransform(next, sceneRotDeg, sceneScale);
                  }}
                  style={{ flex: 1 }}
                />
                <span style={{ width: '44px', textAlign: 'right' }}>{scenePos[axis].toFixed(1)}</span>
              </label>
            ))}

            <div style={{ opacity: 0.85 }}>Rotation (deg)</div>
            {(['x', 'y', 'z'] as const).map((axis) => (
              <label key={axis} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px' }}>{axis.toUpperCase()}</span>
                <input
                  type="range" min={-180} max={180} step={1}
                  value={Math.round(sceneRotDeg[axis])}
                  onChange={(e) => {
                    const next = { ...sceneRotDeg, [axis]: Number(e.target.value) };
                    setSceneRotDeg(next);
                    applySceneTransform(scenePos, next, sceneScale);
                  }}
                  style={{ flex: 1 }}
                />
                <span style={{ width: '44px', textAlign: 'right' }}>{Math.round(sceneRotDeg[axis])}</span>
              </label>
            ))}

            <div style={{ opacity: 0.85 }}>Scale</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="range" min={0.01} max={50} step={0.05}
                value={sceneScale}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSceneScale(v);
                  applySceneTransform(scenePos, sceneRotDeg, v);
                }}
                style={{ flex: 1 }}
              />
              <span style={{ width: '44px', textAlign: 'right' }}>{sceneScale.toFixed(2)}</span>
            </label>

            <button
              onClick={() => {
                const pos = normalizedConfig.sceneGlbPosition ?? [0, 0, 0];
                const rot = normalizedConfig.sceneGlbRotation ?? [0, 0, 0];
                const rawS = normalizedConfig.sceneGlbScale ?? 1;
                const s = Array.isArray(rawS) ? rawS[0] : rawS as number;
                const p = { x: pos[0], y: pos[1], z: pos[2] };
                const r = {
                  x: THREE.MathUtils.radToDeg(rot[0]),
                  y: THREE.MathUtils.radToDeg(rot[1]),
                  z: THREE.MathUtils.radToDeg(rot[2]),
                };
                setScenePos(p); setSceneRotDeg(r); setSceneScale(s);
                applySceneTransform(p, r, s);
              }}
              style={{
                cursor: 'pointer', background: 'rgba(255,255,255,0.12)', color: 'white',
                border: '1px solid rgba(255,255,255,0.2)', padding: '4px 8px', borderRadius: '4px',
              }}
            >
              Reset Scene Transform
            </button>
          </>
        ) : null}

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.3)', margin: '4px 0' }} />
        <button
          onClick={copyTransformConfig}
          style={{
            cursor: 'pointer', background: '#2d6a4f', color: 'white',
            border: '1px solid rgba(255,255,255,0.2)', padding: '4px 8px', borderRadius: '4px',
          }}
        >
          Copy Config to Clipboard
        </button>
        <div style={{ opacity: 0.65, fontSize: '10px' }}>
          Paste into model_dict.json to save.
        </div>
      </div>
    </div>
  );
});
