/* eslint-disable react-hooks/exhaustive-deps */
import {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  GLTFLoader,
  GLTF,
  GLTFParser,
} from 'three/examples/jsm/loaders/GLTFLoader.js';
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

const safeNumber = (value: number | undefined, fallback: number) => (
  Number.isFinite(value) ? Number(value) : fallback
);

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

export const VrmViewer = memo(() => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const requestRef = useRef<number>();
  const vrmRef = useRef<VRM | null>(null);
  const rootOffsetRef = useRef<THREE.Vector3 | null>(null);
  const glbModelRef = useRef<THREE.Object3D | null>(null);
  const glbBonesRef = useRef<Map<string, THREE.Bone>>(new Map());
  
  // Animation Refs
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);

  const { modelInfo } = useLive2DConfig();
  const { mode } = useMode();
  const { forceIgnoreMouse } = useForceIgnoreMouse();
  const { aiState } = useAiState();

  // --- Pose Fix States ---
  const [invertLegs, setInvertLegs] = useState(true);
  const [flipHips, setFlipHips] = useState(true);
  const [isVrmaPlaying, setIsVrmaPlaying] = useState(false);

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
      scale: safeNumber(modelInfo.kScale as number | undefined, 1),
      x: safeNumber(modelInfo.initialXshift as number | undefined, 0),
      y: safeNumber(modelInfo.initialYshift as number | undefined, 0),
      autoRotate: (modelInfo.autoRotate as boolean | undefined) ?? false,
      cameraPosition: zoomedCameraPosition,
      cameraTarget: (modelInfo.cameraTarget as [number, number, number] | undefined)
        ?? [0, 1.3, 0],
      backgroundColor: modelInfo.backgroundColor as string | undefined,
      zoom,
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
    rootOffsetRef.current = null;

    loader.load(
      url,
      (gltf: GLTF) => {
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
    }
  };

  const stopVrma = () => {
      if (mixerRef.current) {
          mixerRef.current.stopAllAction();
          mixerRef.current = null;
      }
      setIsVrmaPlaying(false);
  };

  const handleDoubleClick = () => {
      const currentUrl = normalizedConfig?.url?.toLowerCase() || "";
      if (currentUrl.endsWith(CHARACTER_BLUE_MODEL_SUFFIX.toLowerCase())) {
        console.log("Double click detected on character_blue model, playing random animation...");
        playRandomCharacterBlueAnimation();
      } else {
        console.log("Double click detected! Playing VRMA_01...");
        playVrmaFromUrl("/models/VRMA_01.vrma");
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

    console.log('[VrmViewer] Initializing with config:', normalizedConfig);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = normalizedConfig.backgroundColor
      ? new THREE.Color(normalizedConfig.backgroundColor)
      : null;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: normalizedConfig.backgroundColor === undefined,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth || 1, container.clientHeight || 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      30,
      (container.clientWidth || 1) / (container.clientHeight || 1),
      0.1,
      20,
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
    scene.add(dirLight);

    const loader = new GLTFLoader();
    loader.register((parser: GLTFParser) => new VRMLoaderPlugin(parser));

    let disposed = false;

    console.log('[VrmViewer] Starting load:', normalizedConfig.url);
    loader.load(
      normalizedConfig.url,
      (gltf: GLTF) => {
        if (disposed) return;
        console.log('[VrmViewer] Model loaded successfully');
        
        const vrm = gltf.userData.vrm as VRM | undefined;
        
        if (vrm) {
          VRMUtils.removeUnnecessaryVertices(vrm.scene);
          if (typeof VRMUtils.combineSkeletons === 'function') {
            VRMUtils.combineSkeletons(vrm.scene);
          } else {
            VRMUtils.removeUnnecessaryJoints(vrm.scene);
          }
          VRMUtils.rotateVRM0(vrm);
          vrm.scene.traverse((obj: THREE.Object3D) => {
            obj.frustumCulled = false;
          });
          vrm.scene.scale.setScalar(normalizedConfig.scale);
          vrm.scene.position.set(normalizedConfig.x, normalizedConfig.y, 0);
          scene.add(vrm.scene);
          vrmRef.current = vrm;
        } else {
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
      
      const vrm = vrmRef.current;
      if (vrm) {
          vrm.update(delta);
          // Simple Lip Sync (Sine Wave)
          if (aiState === AiStateEnum.THINKING_SPEAKING) {
              const s = Math.sin(clock.elapsedTime * 15);
              const open = (s + 1) * 0.4;
              vrm.expressionManager?.setValue('aa', open);
          } else {
              vrm.expressionManager?.setValue('aa', 0);
          }
      }
      
      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(renderLoop);
    };
    renderLoop();

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
      cancelAnimationFrame(requestRef.current ?? 0);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
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
      vrmRef.current?.scene.traverse(disposeObject);
      glbModelRef.current?.traverse(disposeObject);
      
      vrmRef.current = null;
      glbModelRef.current = null;
      glbBonesRef.current.clear();
      sceneRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
    };
  }, [normalizedConfig]);

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
        maxWidth: '200px'
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
        
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>VRM Animation</div>
        {!isVrmaPlaying ? (
            <label style={{ 
                display: 'inline-block', 
                cursor: 'pointer', 
                background: '#3182ce', 
                padding: '4px 8px', 
                borderRadius: '4px', 
                textAlign: 'center' 
            }}>
                Upload .vrma
                <input 
                    type="file" 
                    accept=".vrma,.glb,.gltf" 
                    style={{ display: 'none' }} 
                    onChange={handleVrmaUpload} 
                />
            </label>
        ) : (
            <button 
                onClick={stopVrma}
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
      </div>
    </div>
  );
});
