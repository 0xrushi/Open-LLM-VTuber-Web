/* eslint-disable react-hooks/exhaustive-deps */
import {
  memo, useCallback, useEffect, useMemo, useRef,
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
}

const safeNumber = (value: number | undefined, fallback: number) => (
  Number.isFinite(value) ? Number(value) : fallback
);

export const VrmViewer = memo(() => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const requestRef = useRef<number>();
  const vrmRef = useRef<VRM | null>(null);
  const { modelInfo } = useLive2DConfig();
  const { mode } = useMode();
  const { forceIgnoreMouse } = useForceIgnoreMouse();

  const normalizedConfig = useMemo(() => {
    if (!modelInfo) return null;
    return {
      url: modelInfo.url,
      scale: safeNumber(modelInfo.kScale as number | undefined, 1),
      x: safeNumber(modelInfo.initialXshift as number | undefined, 0),
      y: safeNumber(modelInfo.initialYshift as number | undefined, 0),
      autoRotate: (modelInfo.autoRotate as boolean | undefined) ?? true,
      cameraPosition: (modelInfo.cameraPosition as [number, number, number] | undefined)
        ?? [0, 1.3, 1.2],
      cameraTarget: (modelInfo.cameraTarget as [number, number, number] | undefined)
        ?? [0, 1.3, 0],
      backgroundColor: modelInfo.backgroundColor as string | undefined,
    };
  }, [modelInfo]);

  const applyMotionToAvatar = useCallback((motion: VrmMotionMessage) => {
    if (!motion?.bones || motion.bones.length === 0) return;
    const vrm = vrmRef.current;
    if (!vrm?.humanoid) return;

    motion.bones.forEach((bone) => {
      if (!bone.name) return;
      const normalizedName = bone.name.replace(/[\s_-]/g, '');
      const resolvedName =
        (VRMHumanBoneName as Record<string, VRMHumanBoneName>)[normalizedName as keyof typeof VRMHumanBoneName]
        || (bone.name as VRMHumanBoneName);
      const node = vrm.humanoid?.getNormalizedBoneNode(resolvedName);
      if (!node) {
        console.warn(`VRM motion ignored for unknown bone: ${bone.name}`);
        return;
      }
      if (bone.rotation) {
        const { x = 0, y = 0, z = 0, w } = bone.rotation;
        if (typeof w === 'number') {
          node.quaternion.set(x, y, z, w).normalize();
        } else {
          const euler = new THREE.Euler(x, y, z, 'XYZ');
          node.quaternion.setFromEuler(euler);
        }
      }
      if (bone.position) {
        const { x, y, z } = bone.position;
        if (typeof x === 'number') node.position.x = x;
        if (typeof y === 'number') node.position.y = y;
        if (typeof z === 'number') node.position.z = z;
      }
      node.updateMatrixWorld(true);
    });
  }, []);

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

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !normalizedConfig?.url) {
      return () => {};
    }

    const scene = new THREE.Scene();
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
    controls.enablePan = false;
    controls.autoRotate = normalizedConfig.autoRotate;
    controls.autoRotateSpeed = 0.8;
    controls.minDistance = 0.6;
    controls.maxDistance = 3;
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

    loader.load(
      normalizedConfig.url,
      (gltf: GLTF) => {
        if (disposed) return;
        const vrm = gltf.userData.vrm as VRM;
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
      },
      undefined,
      (error: unknown) => {
        console.error('Failed to load VRM model', error);
      },
    );

    const clock = new THREE.Clock();
    const renderLoop = () => {
      const delta = clock.getDelta();
      controls.update();
      vrmRef.current?.update(delta);
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
      vrmRef.current?.scene.traverse((obj: THREE.Object3D) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((material: THREE.Material) => material.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }
        }
      });
      vrmRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
    };
  }, [normalizedConfig]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: mode === 'pet' && forceIgnoreMouse ? 'none' : 'auto',
      }}
    />
  );
});

VrmViewer.displayName = 'VrmViewer';
