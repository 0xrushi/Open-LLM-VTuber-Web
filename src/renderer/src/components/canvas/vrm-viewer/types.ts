import * as THREE from 'three';
import { VRMHumanBoneName } from '@pixiv/three-vrm';

export interface BoneRotation {
  x?: number;
  y?: number;
  z?: number;
  w?: number;
}

export interface BonePosition {
  x?: number;
  y?: number;
  z?: number;
}

export interface BonePose {
  name: string;
  rotation?: BoneRotation;
  position?: BonePosition;
}

export interface VrmMotionMessage {
  bones?: BonePose[];
  worldQuaternion?: boolean;
}

export interface AiSceneActionEventDetail {
  action: string;
  objectId?: string;
  sourceText?: string;
}

export interface SeatedContactTarget {
  objectId: string;
  targetPelvisY: number;
  standPosition: [number, number, number];
  rootStartX: number;
  rootStartZ: number;
  rootStartYaw: number;
  rootX: number;
  rootZ: number;
  rootYaw: number;
  settleStartTime: number;
  settleDuration: number;
}

export interface WalkTarget {
  objectId: string;
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  onArrive?: () => boolean | void;
}

export interface SleepPoseTarget {
  objectId: string;
  rootX: number;
  rootY: number;
  rootZ: number;
  rootYaw: number;
  surfaceY: number;
  hipsAboveSurfaceOffset: number;
  standPosition: [number, number, number];
}

export interface ClipPlaybackOptions {
  loopOnce?: boolean;
  clampWhenFinished?: boolean;
  includeHipsRotation?: boolean;
  includeHipsPosition?: boolean;
  disableZRollStripping?: boolean;
  hipsRotationMultiplier?: number;
  hipsPositionMultiplier?: number;
  trunkBendMultiplier?: number;
  trunkPitchOffset?: number;
  armRotationMultiplier?: number;
  holdFirstFrame?: boolean;
  onSettled?: () => void;
  actionId?: string;
}

export interface SeatedRapierHarness {
  world: any;
  pelvisBody: any;
  pelvisCollider: any;
  seatCollider: any;
  floorCollider: any;
  desiredPelvis: THREE.Vector3;
}

export type Vec3 = { x: number; y: number; z: number };

export type VrmAnimationState = 'idle' | 'listening' | 'thinking' | 'talking';

export interface AnimationCategory {
  fbx?: string[];
  vrma?: string[];
}

export type AnimationHierarchy = Record<string, AnimationCategory>;

export type LogicalBone =
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
