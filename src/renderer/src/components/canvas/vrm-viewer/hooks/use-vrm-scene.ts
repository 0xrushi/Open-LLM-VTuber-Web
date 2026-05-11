import { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface SceneSetupOptions {
  container: HTMLDivElement;
  backgroundColor?: string;
  autoRotate?: boolean;
  cameraPosition: [number, number, number];
  cameraTarget: [number, number, number];
  hasEnvironmentScene?: boolean;
  hasNamiStudioScene?: boolean;
}

export const useVrmScene = () => {
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const vrButtonRef = useRef<HTMLElement | null>(null);

  const setupScene = useCallback(({
    container,
    backgroundColor,
    autoRotate,
    cameraPosition,
    cameraTarget,
    hasEnvironmentScene,
    hasNamiStudioScene,
  }: SceneSetupOptions) => {
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    if (backgroundColor) {
      scene.background = new THREE.Color(backgroundColor);
    } else if (hasNamiStudioScene) {
      scene.background = new THREE.Color(0xffc983);
    } else if (hasEnvironmentScene) {
      scene.background = new THREE.Color(0x111111);
    } else {
      scene.background = null;
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: !backgroundColor && !hasEnvironmentScene,
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

    renderer.xr.enabled = true;

    const camera = new THREE.PerspectiveCamera(
      30,
      (container.clientWidth || 1) / (container.clientHeight || 1),
      0.1,
      hasEnvironmentScene ? 200 : 20,
    );
    camera.position.fromArray(cameraPosition);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.autoRotate = autoRotate ?? false;
    controls.autoRotateSpeed = 0.8;
    controls.minDistance = 0.1;
    controls.maxDistance = 10;
    controls.target.fromArray(cameraTarget);
    controlsRef.current = controls;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x222244, 0.9);
    scene.add(hemi);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight.position.set(1, 1.5, 0.5);
    dirLight.castShadow = !!hasEnvironmentScene;
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

    return { scene, renderer, camera, controls };
  }, []);

  const cleanupScene = useCallback((container: HTMLDivElement | null) => {
    if (controlsRef.current) controlsRef.current.dispose();
    if (rendererRef.current) {
      rendererRef.current.setAnimationLoop(null);
      if (container && rendererRef.current.domElement.parentElement === container) {
        container.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current.dispose();
    }
    if (vrButtonRef.current && document.body.contains(vrButtonRef.current)) {
      document.body.removeChild(vrButtonRef.current);
    }
    
    sceneRef.current = null;
    rendererRef.current = null;
    cameraRef.current = null;
    controlsRef.current = null;
    vrButtonRef.current = null;
  }, []);

  return {
    sceneRef,
    rendererRef,
    cameraRef,
    controlsRef,
    vrButtonRef,
    setupScene,
    cleanupScene,
  };
};
