import { VRMHumanBoneName } from '@pixiv/three-vrm';
import { AnimationHierarchy } from './types';

export const IDLE_FBX_URL = '/models/animations/Idle.fbx';
export const THINKING_FBX_URL = '/models/animations/Thinking.fbx';
export const TALKING_FBX_URL = '/models/animations/Talking.fbx';
export const SITTING_TALKING_FBX_URL = '/models/animations/SittingTalkingFromMixamo.fbx';
export const WALKING_FBX_URL = '/models/animations/WalkingAnimation.fbx';
export const SLEEPING_FBX_URL = '/models/animations/FemaleLayingPose.fbx';
export const KISS_FBX_URL = '/models/animations/BlowAKiss.fbx';
export const IDLE_VRMA_URL = '/models/animations/vrma/converted/Idle.vrma';
export const THINKING_VRMA_URL = '/models/animations/vrma/converted/Thinking.vrma';
export const WALKING_VRMA_URL = '/models/animations/vrma/converted/WalkingAnimation.vrma';
export const SITTING_TALKING_VRMA_URL = '/models/animations/vrma/converted/SittingTalkingFromMixamo.vrma';
export const SLEEPING_VRMA_URL = '/models/animations/vrma/converted/FemaleLayingPose.vrma';
export const KISS_VRMA_URL = '/models/animations/vrma/BlowAKiss.vrma';
export const KISS_RETARGETED_CLIP_URL = '/models/animations/retargeted/BlowAKiss.clip.json';
export const DANCE_FBX_ANIMATIONS = [
  '/models/animations/Dancing_Twerk.fbx',
];
export const DANCE_VRMA_ANIMATIONS = [
  '/models/animations/vrma/converted/Dancing_Twerk.vrma',
];
export const SITTING_VRMA_ANIMATIONS = [
  '/models/animations/vrma/converted/SittingTalkingFromMixamo.vrma',
  '/models/animations/vrma/converted/Sitting Talking Mixamo.vrma',
  '/models/animations/vrma/converted/Sitting Mixamo.vrma',
  '/models/animations/vrma/converted/Sitting Angry Mixamo.vrma',
  '/models/animations/vrma/converted/Sitting Laughing Mixamo.vrma',
  '/models/animations/vrma/converted/Sitting Clap.vrma',
  '/models/animations/vrma/converted/Sitting Gun Motion.vrma',
];
export const TALKING_VRMA_ANIMATIONS = [
  '/models/animations/vrma/converted/Talking.vrma',
  '/models/animations/vrma/converted/Sitting Talking Mixamo.vrma',
  '/models/animations/vrma/converted/Hand Raising Mixamo.vrma',
  '/models/animations/vrma/converted/Reaching Out from Mixamo.vrma',
  '/models/animations/vrma/converted/Shake Gesture.vrma',
];
export const TAUNTING_VRMA_ANIMATIONS = [
  '/models/animations/vrma/converted/Taunt from Mixamo.vrma',
  '/models/animations/vrma/converted/Insult Mixamo.vrma',
  '/models/animations/vrma/converted/Loser Mixamo.vrma',
  '/models/animations/vrma/converted/Threatening Mixamo.vrma',
  '/models/animations/vrma/converted/Cocky Head Turn.vrma',
  '/models/animations/vrma/converted/Pouting Mixamo.vrma',
];
export const THINKING_VRMA_ANIMATIONS = [
  '/models/animations/vrma/converted/Thinking.vrma',
  '/models/animations/vrma/converted/Thinking Mixamo.vrma',
  '/models/animations/vrma/converted/Focus.vrma',
  '/models/animations/vrma/converted/Plotting from Mixamo.vrma',
  '/models/animations/vrma/converted/Bashful Mixamo.vrma',
  '/models/animations/vrma/converted/Looking Behind.vrma',
];
export const FISTPUMP_VRMA_ANIMATIONS = [
  '/models/animations/vrma/converted/Fist Pump Mixamo.vrma',
  '/models/animations/vrma/converted/Fist Pump from Mixamo.vrma',
  '/models/animations/vrma/converted/Victory Model.vrma',
  '/models/animations/vrma/converted/Happy Mixamo.vrma',
  '/models/animations/vrma/converted/Standing Clap.vrma',
];
export const STRETCH_YAWN_SHOULDER_VRMA_ANIMATIONS = [
  '/models/animations/vrma/converted/Arm Stretching Mixamo.vrma',
  '/models/animations/vrma/converted/Neck Stretching Mixamo.vrma',
  '/models/animations/vrma/converted/Shoulder Rubbing Mixamo.vrma',
  '/models/animations/vrma/converted/Yawn Mixamo.vrma',
];

export const ANIMATION_HIERARCHY: AnimationHierarchy = {
  idle: {
    fbx: [IDLE_FBX_URL],
    vrma: [IDLE_VRMA_URL],
  },
  thinking: {
    fbx: [THINKING_FBX_URL],
    vrma: THINKING_VRMA_ANIMATIONS,
  },
  talking: {
    fbx: [TALKING_FBX_URL],
    vrma: TALKING_VRMA_ANIMATIONS,
  },
  sit: {
    fbx: [SITTING_TALKING_FBX_URL],
    vrma: SITTING_VRMA_ANIMATIONS,
  },
  taunt: {
    fbx: [],
    vrma: TAUNTING_VRMA_ANIMATIONS,
  },
  fistpump: {
    fbx: [],
    vrma: FISTPUMP_VRMA_ANIMATIONS,
  },
  stretch: {
    fbx: [],
    vrma: STRETCH_YAWN_SHOULDER_VRMA_ANIMATIONS,
  },
  walking: {
    fbx: [WALKING_FBX_URL],
    vrma: [WALKING_VRMA_URL],
  },
  dance: {
    fbx: DANCE_FBX_ANIMATIONS,
    vrma: DANCE_VRMA_ANIMATIONS,
  },
  happy: {
    fbx: [KISS_FBX_URL],
    vrma: [KISS_VRMA_URL],
  },
  kiss: {
    fbx: [KISS_FBX_URL],
    vrma: [KISS_VRMA_URL],
  },
  sad: {
    fbx: [],
    vrma: [],
  },
  sleep: {
    fbx: [SLEEPING_FBX_URL],
    vrma: [SLEEPING_VRMA_URL],
  },
};

// Mapping from VRM 0.x standard bone names to Humanoid bone names
export const VRM0_BONE_MAP: Record<string, VRMHumanBoneName> = {
    'J_Bip_C_Hips': 'hips' as VRMHumanBoneName,
    'J_Bip_C_Spine': 'spine' as VRMHumanBoneName,
    'J_Bip_C_Chest': 'chest' as VRMHumanBoneName,
    'J_Bip_C_UpperChest': 'upperChest' as VRMHumanBoneName,
    'J_Bip_C_Neck': 'neck' as VRMHumanBoneName,
    'J_Bip_C_Head': 'head' as VRMHumanBoneName,
    'J_Bip_L_Shoulder': 'leftShoulder' as VRMHumanBoneName,
    'J_Bip_L_UpperArm': 'leftUpperArm' as VRMHumanBoneName,
    'J_Bip_L_LowerArm': 'leftLowerArm' as VRMHumanBoneName,
    'J_Bip_L_Hand': 'leftHand' as VRMHumanBoneName,
    'J_Bip_R_Shoulder': 'rightShoulder' as VRMHumanBoneName,
    'J_Bip_R_UpperArm': 'rightUpperArm' as VRMHumanBoneName,
    'J_Bip_R_LowerArm': 'rightLowerArm' as VRMHumanBoneName,
    'J_Bip_R_Hand': 'rightHand' as VRMHumanBoneName,
    'J_Bip_L_UpperLeg': 'leftUpperLeg' as VRMHumanBoneName,
    'J_Bip_L_LowerLeg': 'leftLowerLeg' as VRMHumanBoneName,
    'J_Bip_L_Foot': 'leftFoot' as VRMHumanBoneName,
    'J_Bip_L_ToeBase': 'leftToes' as VRMHumanBoneName,
    'J_Bip_R_UpperLeg': 'rightUpperLeg' as VRMHumanBoneName,
    'J_Bip_R_LowerLeg': 'rightLowerLeg' as VRMHumanBoneName,
    'J_Bip_R_Foot': 'rightFoot' as VRMHumanBoneName,
    'J_Bip_R_ToeBase': 'rightToes' as VRMHumanBoneName,
    'J_Bip_L_Thumb1': 'leftThumbProximal' as VRMHumanBoneName, 'J_Bip_L_Thumb2': 'leftThumbIntermediate' as VRMHumanBoneName, 'J_Bip_L_Thumb3': 'leftThumbDistal' as VRMHumanBoneName,
    'J_Bip_L_Index1': 'leftIndexProximal' as VRMHumanBoneName, 'J_Bip_L_Index2': 'leftIndexIntermediate' as VRMHumanBoneName, 'J_Bip_L_Index3': 'leftIndexDistal' as VRMHumanBoneName,
    'J_Bip_L_Middle1': 'leftMiddleProximal' as VRMHumanBoneName, 'J_Bip_L_Middle2': 'leftMiddleIntermediate' as VRMHumanBoneName, 'J_Bip_L_Middle3': 'leftMiddleDistal' as VRMHumanBoneName,
    'J_Bip_L_Ring1': 'leftRingProximal' as VRMHumanBoneName, 'J_Bip_L_Ring2': 'leftRingIntermediate' as VRMHumanBoneName, 'J_Bip_L_Ring3': 'leftRingDistal' as VRMHumanBoneName,
    'J_Bip_L_Little1': 'leftLittleProximal' as VRMHumanBoneName, 'J_Bip_L_Little2': 'leftLittleIntermediate' as VRMHumanBoneName, 'J_Bip_L_Little3': 'leftLittleDistal' as VRMHumanBoneName,
    'J_Bip_R_Thumb1': 'rightThumbProximal' as VRMHumanBoneName, 'J_Bip_R_Thumb2': 'rightThumbIntermediate' as VRMHumanBoneName, 'J_Bip_R_Thumb3': 'rightThumbDistal' as VRMHumanBoneName,
    'J_Bip_R_Index1': 'rightIndexProximal' as VRMHumanBoneName, 'J_Bip_R_Index2': 'rightIndexIntermediate' as VRMHumanBoneName, 'J_Bip_R_Index3': 'rightIndexDistal' as VRMHumanBoneName,
    'J_Bip_R_Middle1': 'rightMiddleProximal' as VRMHumanBoneName, 'J_Bip_R_Middle2': 'rightMiddleIntermediate' as VRMHumanBoneName, 'J_Bip_R_Middle3': 'rightMiddleDistal' as VRMHumanBoneName,
    'J_Bip_R_Ring1': 'rightRingProximal' as VRMHumanBoneName, 'J_Bip_R_Ring2': 'rightRingIntermediate' as VRMHumanBoneName, 'J_Bip_R_Ring3': 'rightRingDistal' as VRMHumanBoneName,
    'J_Bip_R_Little1': 'rightLittleProximal' as VRMHumanBoneName, 'J_Bip_R_Little2': 'rightLittleIntermediate' as VRMHumanBoneName, 'J_Bip_R_Little3': 'rightLittleDistal' as VRMHumanBoneName,
};

// Mixamo (FBX) bone names to VRM humanoid bone names.
// Mixamo rigs commonly use these exact names (sometimes prefixed like "mixamorig:").
export const MIXAMO_TO_VRM_BONE_MAP: Record<string, VRMHumanBoneName> = {
  Hips: 'hips' as VRMHumanBoneName,
  Spine: 'spine' as VRMHumanBoneName,
  Spine1: 'chest' as VRMHumanBoneName,
  Spine2: 'upperChest' as VRMHumanBoneName,
  Neck: 'neck' as VRMHumanBoneName,
  Head: 'head' as VRMHumanBoneName,
  LeftShoulder: 'leftShoulder' as VRMHumanBoneName,
  LeftArm: 'leftUpperArm' as VRMHumanBoneName,
  LeftForeArm: 'leftLowerArm' as VRMHumanBoneName,
  LeftHand: 'leftHand' as VRMHumanBoneName,
  RightShoulder: 'rightShoulder' as VRMHumanBoneName,
  RightArm: 'rightUpperArm' as VRMHumanBoneName,
  RightForeArm: 'rightLowerArm' as VRMHumanBoneName,
  RightHand: 'rightHand' as VRMHumanBoneName,
  LeftUpLeg: 'leftUpperLeg' as VRMHumanBoneName,
  LeftLeg: 'leftLowerLeg' as VRMHumanBoneName,
  LeftFoot: 'leftFoot' as VRMHumanBoneName,
  LeftToeBase: 'leftToes' as VRMHumanBoneName,
  RightUpLeg: 'rightUpperLeg' as VRMHumanBoneName,
  RightLeg: 'rightLowerLeg' as VRMHumanBoneName,
  RightFoot: 'rightFoot' as VRMHumanBoneName,
  RightToeBase: 'rightToes' as VRMHumanBoneName,
  LeftHandThumb1: 'leftThumbProximal' as VRMHumanBoneName,
  LeftHandThumb2: 'leftThumbIntermediate' as VRMHumanBoneName,
  LeftHandThumb3: 'leftThumbDistal' as VRMHumanBoneName,
  LeftHandIndex1: 'leftIndexProximal' as VRMHumanBoneName,
  LeftHandIndex2: 'leftIndexIntermediate' as VRMHumanBoneName,
  LeftHandIndex3: 'leftIndexDistal' as VRMHumanBoneName,
  LeftHandMiddle1: 'leftMiddleProximal' as VRMHumanBoneName,
  LeftHandMiddle2: 'leftMiddleIntermediate' as VRMHumanBoneName,
  LeftHandMiddle3: 'leftMiddleDistal' as VRMHumanBoneName,
  LeftHandRing1: 'leftRingProximal' as VRMHumanBoneName,
  LeftHandRing2: 'leftRingIntermediate' as VRMHumanBoneName,
  LeftHandRing3: 'leftRingDistal' as VRMHumanBoneName,
  LeftHandPinky1: 'leftLittleProximal' as VRMHumanBoneName,
  LeftHandPinky2: 'leftLittleIntermediate' as VRMHumanBoneName,
  LeftHandPinky3: 'leftLittleDistal' as VRMHumanBoneName,
  RightHandThumb1: 'rightThumbProximal' as VRMHumanBoneName,
  RightHandThumb2: 'rightThumbIntermediate' as VRMHumanBoneName,
  RightHandThumb3: 'rightThumbDistal' as VRMHumanBoneName,
  RightHandIndex1: 'rightIndexProximal' as VRMHumanBoneName,
  RightHandIndex2: 'rightIndexIntermediate' as VRMHumanBoneName,
  RightHandIndex3: 'rightIndexDistal' as VRMHumanBoneName,
  RightHandMiddle1: 'rightMiddleProximal' as VRMHumanBoneName,
  RightHandMiddle2: 'rightMiddleIntermediate' as VRMHumanBoneName,
  RightHandMiddle3: 'rightMiddleDistal' as VRMHumanBoneName,
  RightHandRing1: 'rightRingProximal' as VRMHumanBoneName,
  RightHandRing2: 'rightRingIntermediate' as VRMHumanBoneName,
  RightHandRing3: 'rightRingDistal' as VRMHumanBoneName,
  RightHandPinky1: 'rightLittleProximal' as VRMHumanBoneName,
  RightHandPinky2: 'rightLittleIntermediate' as VRMHumanBoneName,
  RightHandPinky3: 'rightLittleDistal' as VRMHumanBoneName,
};

// Captured pose for Thanh.glb (gltf) "floor sit, crossed legs" preset.
export const FLOOR_SIT_CROSS_LEG_POSE_GLTF = {
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

export const MIXAMO_VRM_RIG_MAP: Partial<Record<string, VRMHumanBoneName>> = {
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

export const CHARACTER_BLUE_MODEL_SUFFIX = "/models/character_blue.glb";
export const CHARACTER_BLUE_ANIMATIONS: string[] = [
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
  "/models/animations/character_blue/Animation_Wave_for_Ride_3_withSkin.glb",
  "/models/animations/character_blue/Animation_You_Groove_withSkin.glb",
];
