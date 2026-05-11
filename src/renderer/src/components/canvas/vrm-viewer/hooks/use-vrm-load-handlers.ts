import React, { useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader, GLTF, GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRM, VRMUtils } from '@pixiv/three-vrm';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { toaster } from '@/components/ui/toaster';
import { 
  normalizeMixamoNodeName, 
  loadMixamoAnimForVRM 
} from '../utils';
import { 
  MIXAMO_TO_VRM_BONE_MAP,
  CHARACTER_BLUE_ANIMATIONS,
} from '../constants';
import { ClipPlaybackOptions } from '../types';

export const useVrmLoadHandlers = (
  vrmRef: React.MutableRefObject<VRM | null>,
  glbModelRef: React.MutableRefObject<THREE.Object3D | null>,
  glbBonesRef: React.MutableRefObject<Map<string, THREE.Bone>>,
  glbBonesNormalizedRef: React.MutableRefObject<Map<string, THREE.Bone>>,
  glbSkinnedMeshesRef: React.MutableRefObject<THREE.SkinnedMesh[]>,
  mixerRef: React.MutableRefObject<THREE.AnimationMixer | null>,
  currentActionRef: React.MutableRefObject<THREE.AnimationAction | null>,
  loadedClipsRef: React.MutableRefObject<THREE.AnimationClip[]>,
  setIsVrmaPlaying: (val: boolean) => void,
  setClipNames: (names: string[]) => void,
  setSelectedClipName: (name: string) => void,
  rebuildGlbBoneIndices: (root: THREE.Object3D) => void,
  initialBoneTransformsRef: React.MutableRefObject<Map<string, { q: THREE.Quaternion; p: THREE.Vector3 }>>,
  setRigBones: (bones: string[]) => void,
  setSelectedBone: (bone: string) => void,
  setRigModelStamp: (val: (v: number) => number) => void,
  configureActionPlayback: (action: THREE.AnimationAction, options?: ClipPlaybackOptions) => void,
  playClipOnCurrentModel: (root: THREE.Object3D | null, skinned: THREE.SkinnedMesh | null, clip: THREE.AnimationClip, options?: ClipPlaybackOptions) => void,
) => {

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
      
      const isGLB = !isVRM;
      const targetBoneName = (targetNode as any).isBone ? (targetNode as THREE.Bone).name : targetNode.name;
      if (!targetBoneName || targetBoneName.trim().length === 0) continue;
      const targetPathPrefix = isGLB
        ? `.bones[${targetBoneName}]`
        : (targetNode.uuid);

      if (property !== 'quaternion' && property !== 'rotation' && property !== 'position') {
        continue;
      }
      if (property === 'scale') {
        continue;
      }

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
        const restY = targetNode.position.y;
        const posValues = new Float32Array(count * 3);
        for (let i = 0; i < count; i += 1) {
          const x = values[i * 3];
          const y = values[i * 3 + 1];
          const z = values[i * 3 + 2];
          posValues[i * 3] = x - baseX;
          posValues[i * 3 + 1] = restY + (y - baseY);
          posValues[i * 3 + 2] = z - baseZ;
        }
        tracks.push(new THREE.VectorKeyframeTrack(
          `${targetPathPrefix}.position`,
          track.times,
          posValues,
        ));
        continue;
      }

      // @ts-ignore
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
  }, [vrmRef, glbBonesRef, glbBonesNormalizedRef]);

  const playMixamoFbxFromUrl = useCallback((url: string, options?: ClipPlaybackOptions) => {
    const loader = new FBXLoader();
    loader.load(
      url,
      (fbx: THREE.Group) => {
        const clip = (fbx as any).animations?.[0] as THREE.AnimationClip | undefined;
        if (!clip) return;
        const vrm = vrmRef.current;
        const isVRM = Boolean(vrm?.humanoid);

        // Never use direct mapped quaternion playback on VRM in this path.
        // Always use compensated Mixamo->VRM retarget math to avoid limb inversion.
        if (isVRM && vrm) {
          loadMixamoAnimForVRM(url, vrm, options).then((retargetedClip) => {
            playClipOnCurrentModel(vrm.scene, null, retargetedClip, options);
          }).catch((error) => {
            console.error('[VrmViewer] VRM safe retarget fallback failed:', error);
          });
          return;
        }

        if (!isVRM) {
          const targetMesh = glbSkinnedMeshesRef.current[0] ?? null;
          if (targetMesh?.skeleton) {
            try {
              let sourceSkeleton: THREE.Skeleton | null = null;
              fbx.traverse((obj: THREE.Object3D) => {
                // @ts-ignore
                if (sourceSkeleton) return;
                // @ts-ignore
                if (obj.isSkinnedMesh) {
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
              if (sourceSkeleton && sourceSkeleton.bones?.length) {
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
                      posValues[i * 3] = 0;
                      posValues[i * 3 + 1] = values[i * 3 + 1] - baseY;
                      posValues[i * 3 + 2] = 0;
                    }
                    cleaned.push(new THREE.VectorKeyframeTrack(t.name, t.times, posValues));
                    continue;
                  }
                  if (t.name.endsWith('.scale')) continue;
                  if (t.name.includes('.material') || t.name.includes('.materials')) continue;
                  cleaned.push(t);
                }
                converted = new THREE.AnimationClip(clip.name || 'mixamo', clip.duration, cleaned);
                playClipOnCurrentModel(vrmRef.current?.scene || null, targetMesh, converted, options);
                return;
              }
            } catch (e) {
              console.warn('[VrmViewer] retargetClip failed; falling back to manual retarget:', e);
            }
          }
        }

        const retargeted = retargetMixamoClipToCurrentModel(clip);
        if (retargeted) {
          playClipOnCurrentModel(vrmRef.current?.scene || glbModelRef.current, glbSkinnedMeshesRef.current[0] || null, retargeted, options);
        }
      },
      undefined,
      (err: unknown) => {
        console.error('[VrmViewer] Failed to load FBX:', err);
        const msg = String((err as any)?.message ?? err ?? '');
        if (msg.includes('FBX version not supported') || msg.includes('FileVersion')) {
          toaster.create({
            title: 'FBX not supported',
            description: 'This FBX is an old format. Re-download from Mixamo as "FBX Binary" (7.4+) or re-export from Blender as FBX 7.4 binary.',
            type: 'error',
            duration: 6000,
          });
        }
      },
    );
  }, [vrmRef, glbModelRef, glbSkinnedMeshesRef, retargetMixamoClipToCurrentModel, playClipOnCurrentModel]);

  const playVrmRetargetedFbxFromUrl = useCallback((url: string, options?: ClipPlaybackOptions) => {
    const vrm = vrmRef.current;
    if (!vrm?.humanoid) return false;

    console.log('[VrmViewer] Loading retargeted FBX:', url);
    loadMixamoAnimForVRM(url, vrm, options).then((clip) => {
      console.log('[VrmViewer] FBX loaded and retargeted:', url, 'duration:', clip.duration);
      playClipOnCurrentModel(vrm.scene, null, clip, options);
    }).catch((err) => {
      console.error('[VrmViewer] Retargeted FBX failed:', err);
      toaster.create({
        title: 'Animation failed',
        description: `Retargeted FBX failed for ${url}`,
        type: 'error',
        duration: 4000,
      });
      throw err;
    });

    return true;
  }, [vrmRef, playClipOnCurrentModel]);

  const playRetargetedClipJsonFromUrl = useCallback(async (url: string, options?: ClipPlaybackOptions): Promise<boolean> => {
    const vrm = vrmRef.current;
    if (!vrm?.scene) return false;
    try {
      const response = await fetch(url);
      if (!response.ok) return false;
      const payload = await response.json();
      const clip = THREE.AnimationClip.parse(payload);
      if (!clip) return false;
      playClipOnCurrentModel(vrm.scene, null, clip, options);
      return true;
    } catch (error) {
      console.warn('[VrmViewer] Failed to load retargeted clip json:', url, error);
      return false;
    }
  }, [vrmRef, playClipOnCurrentModel]);

  const makeVrmClipInPlace = useCallback((clip: THREE.AnimationClip): THREE.AnimationClip => {
    const tracks = clip.tracks.map((track: THREE.KeyframeTrack) => {
      if (!track.name.endsWith('.position')) return track;

      const values = track.values;
      const count = Math.floor(values.length / 3);
      if (count <= 0) return track;

      const inPlaceValues = new Float32Array(values.length);
      const baseX = values[0];
      const baseZ = values[2];
      for (let i = 0; i < count; i += 1) {
        inPlaceValues[i * 3] = baseX;
        inPlaceValues[i * 3 + 1] = values[i * 3 + 1];
        inPlaceValues[i * 3 + 2] = baseZ;
      }

      return new THREE.VectorKeyframeTrack(track.name, track.times, inPlaceValues);
    });

    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  }, []);

  const playVrmaFromUrl = useCallback(async (url: string, options?: ClipPlaybackOptions) => {
    const vrm = vrmRef.current;
    if (!vrm) throw new Error(`[VrmViewer] VRMA requested without loaded VRM: ${url}`);

    const loader = new GLTFLoader();
    loader.register((parser: GLTFParser) => new VRMAnimationLoaderPlugin(parser));

    try {
      const gltf = await loader.loadAsync(url);
      const vrmAnimations = (gltf as any).userData?.vrmAnimations as any[] | undefined;
      if (!vrmAnimations || vrmAnimations.length === 0) {
        throw new Error(`[VrmViewer] No vrmAnimations in VRMA: ${url}`);
      }

      let clip = createVRMAnimationClip(vrmAnimations[0], vrm as any);
      if (!clip) {
        throw new Error(`[VrmViewer] Failed to create VRM clip from VRMA: ${url}`);
      }

      if (options?.includeHipsPosition === false) {
        clip = makeVrmClipInPlace(clip);
      }

      playClipOnCurrentModel(vrm.scene, null, clip, options);
    } catch (err) {
      console.error('[VrmViewer] Failed to load VRMA:', url, err);
      toaster.create({
        title: 'Animation failed',
        description: `VRMA failed for ${url}`,
        type: 'error',
        duration: 4000,
      });
      throw err;
    }
  }, [vrmRef, playClipOnCurrentModel, makeVrmClipInPlace]);

  const loadGlbModelFromUrl = useCallback((url: string, scene: THREE.Scene | null, normalizedConfig: any, disposeObject: (obj: THREE.Object3D) => void) => {
    if (!scene || !normalizedConfig) return;

    const loader = new GLTFLoader();
    loader.register((parser: any) => new VRMLoaderPlugin(parser));

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

    loader.load(
      url,
      (gltf: any) => {
        const model = gltf.scene;
        model.traverse((obj: THREE.Object3D) => {
          obj.frustumCulled = false;
        });
        rebuildGlbBoneIndices(model);
        const bboxRaw = new THREE.Box3().setFromObject(model);
        const rawSize = bboxRaw.getSize(new THREE.Vector3());
        const rawHeight = rawSize.y;
        let normalizedScale = normalizedConfig.scale;
        if (Number.isFinite(rawHeight) && rawHeight > 0.0001) {
          const targetHeight = 1.6;
          const autoScale = targetHeight / rawHeight;
          normalizedScale = autoScale;
        }
        model.scale.setScalar(normalizedScale);
        const bbox = new THREE.Box3().setFromObject(model);
        const center = bbox.getCenter(new THREE.Vector3());
        const min = bbox.min.clone();
        const targetX = normalizedConfig.x ?? 0;
        const targetY = normalizedConfig.y ?? 0;
        const targetZ = normalizedConfig.vrmPosZ ?? 0;
        if (Number.isFinite(center.x) && Number.isFinite(center.y) && Number.isFinite(center.z) && Number.isFinite(min.y)) {
          model.position.set(targetX - center.x, targetY - min.y, targetZ - center.z);
        } else {
          model.position.set(targetX, targetY, targetZ);
        }
        model.userData.needsAutoFrame = true;
        scene.add(model);
        glbModelRef.current = model;
        console.log('[VrmViewer] GLB loaded:', url);

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
          playClipOnCurrentModel(model, null, clip);
        }
      },
      undefined,
      (error: unknown) => {
        console.error('[VrmViewer] Failed to load GLB model:', url, error);
        toaster.create({
          title: 'Model load failed',
          description: `Failed to load ${url}. Check console for details.`,
          type: 'error',
          duration: 4000,
        });
      }
    );
  }, [vrmRef, glbModelRef, glbBonesRef, initialBoneTransformsRef, setRigBones, setSelectedBone, setRigModelStamp, rebuildGlbBoneIndices, playClipOnCurrentModel]);

  const playLoadedClipByName = useCallback((modelRoot: THREE.Object3D | null, name: string) => {
    if (!modelRoot) return;
    const clip = loadedClipsRef.current.find((c) => c.name === name);
    if (!clip) return;
    playClipOnCurrentModel(modelRoot, null, clip);
  }, [loadedClipsRef, playClipOnCurrentModel]);

  const playRandomCharacterBlueAnimation = useCallback((scene: THREE.Scene | null, normalizedConfig: any, disposeObject: (obj: THREE.Object3D) => void) => {
    if (CHARACTER_BLUE_ANIMATIONS.length === 0 || !scene || !normalizedConfig) return;

    const loader = new GLTFLoader();
    const index = Math.floor(Math.random() * CHARACTER_BLUE_ANIMATIONS.length);
    const url = CHARACTER_BLUE_ANIMATIONS[index];

    loader.load(
      url,
      (gltf: any) => {
        const clip = gltf.animations[0];
        if (!clip) return;

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

        playClipOnCurrentModel(model, null, clip);
      },
    );
  }, [glbModelRef, glbBonesRef, playClipOnCurrentModel]);

  return useMemo(() => ({
    playMixamoFbxFromUrl,
    playVrmRetargetedFbxFromUrl,
    playRetargetedClipJsonFromUrl,
    playVrmaFromUrl,
    loadGlbModelFromUrl,
    playLoadedClipByName,
    playRandomCharacterBlueAnimation,
  }), [
    playMixamoFbxFromUrl,
    playVrmRetargetedFbxFromUrl,
    playRetargetedClipJsonFromUrl,
    playVrmaFromUrl,
    loadGlbModelFromUrl,
    playLoadedClipByName,
    playRandomCharacterBlueAnimation
  ]);
};
