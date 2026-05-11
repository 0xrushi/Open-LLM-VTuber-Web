import type React from 'react';
import { useCallback, useRef } from 'react';
import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { toaster } from '@/components/ui/toaster';
import {
  AiSceneRegistry,
  SceneObjectRegistryEntry,
  SceneVec3,
} from '../../nami-studio-scene';

type BaseTransform = {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  visible: boolean;
};

interface UseNamiStudioObjectDragSnapOptions {
  roomModelRef: React.MutableRefObject<THREE.Object3D | null>;
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  rendererRef: React.MutableRefObject<THREE.WebGLRenderer | null>;
  controlsRef: React.MutableRefObject<any>;
  sceneObjectBaseTransformRef: React.MutableRefObject<Map<string, BaseTransform>>;
}

type StoredTransform = {
  position: SceneVec3;
  rotation: SceneVec3;
};

const STORAGE_KEY = 'nami-studio-object-transforms-v1';
const DRAGGABLE_TYPES = new Set([
  'appliance',
  'bed',
  'chair',
  'cupboard',
  'desk',
  'drawer',
  'lantern',
  'prop',
  'rug',
  'shelf',
  'sofa',
  'table',
  'treadmill',
  'wardrobe',
]);
const LOCKED_TYPES = new Set(['floor', 'wall', 'window', 'zone']);
const GRID_SIZE = 0.25;
const SNAP_DISTANCE = 0.35;
const ROOM_LIMITS = {
  minX: -5.15,
  maxX: 5.15,
  minZ: -3.75,
  maxZ: 3.75,
};
const ROTATION_SNAP = Math.PI / 12; // 15 degrees

const toSceneVec3 = (value: THREE.Vector3 | THREE.Euler): SceneVec3 => [
  Number(value.x.toFixed(3)),
  Number(value.y.toFixed(3)),
  Number(value.z.toFixed(3)),
];

const roundToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

const loadStoredTransforms = (): Record<string, StoredTransform> => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.warn('[VrmViewer] Failed to read stored Nami studio transforms:', error);
    return {};
  }
};

const saveStoredTransform = (objectId: string, transform: StoredTransform) => {
  const stored = loadStoredTransforms();
  stored[objectId] = transform;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
};

const translatePoint = (point: SceneVec3, delta: THREE.Vector3): SceneVec3 => [
  Number((point[0] + delta.x).toFixed(3)),
  Number((point[1] + delta.y).toFixed(3)),
  Number((point[2] + delta.z).toFixed(3)),
];

const updateRegistryEntryCoordinates = (
  registry: AiSceneRegistry | undefined,
  object: THREE.Object3D,
  nextPosition: THREE.Vector3,
) => {
  const entry = registry?.objects.find((candidate) => candidate.id === object.name);
  const objectEntry = object.userData.aiScene as SceneObjectRegistryEntry | undefined;
  const targetEntry = entry ?? objectEntry;
  if (!targetEntry) return;

  const previousPosition = new THREE.Vector3(...targetEntry.position);
  const delta = nextPosition.clone().sub(previousPosition);
  const nextScenePosition = toSceneVec3(nextPosition);

  targetEntry.position = nextScenePosition;
  targetEntry.rotation = toSceneVec3(object.rotation);
  targetEntry.boundingBox = {
    min: translatePoint(targetEntry.boundingBox.min, delta),
    max: translatePoint(targetEntry.boundingBox.max, delta),
  };
  targetEntry.interactionPoints = Object.fromEntries(
    Object.entries(targetEntry.interactionPoints).map(([key, point]) => [key, translatePoint(point, delta)]),
  );

  object.userData.aiScene = targetEntry;
  if (registry) {
    window.dispatchEvent(new CustomEvent('ai-scene-registry-updated', {
      detail: { objectId: object.name, entry: targetEntry, registry },
    }));
  }
};

const findDraggableRoot = (object: THREE.Object3D | null, draggableRoots: Set<THREE.Object3D>) => {
  let cursor: THREE.Object3D | null = object;
  while (cursor) {
    if (draggableRoots.has(cursor)) return cursor;
    cursor = cursor.parent;
  }
  return null;
};

const isDraggableEntry = (entry: SceneObjectRegistryEntry | undefined) => (
  !!entry && DRAGGABLE_TYPES.has(entry.type) && !LOCKED_TYPES.has(entry.type)
);

export const useNamiStudioObjectDragSnap = ({
  roomModelRef,
  sceneRef,
  cameraRef,
  rendererRef,
  controlsRef,
  sceneObjectBaseTransformRef,
}: UseNamiStudioObjectDragSnapOptions) => {
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const dragPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const planeHitRef = useRef(new THREE.Vector3());
  const dragOffsetRef = useRef(new THREE.Vector3());
  const draggableObjectsRef = useRef<THREE.Object3D[]>([]);
  const draggableRootSetRef = useRef<Set<THREE.Object3D>>(new Set());
  const draggingRef = useRef<THREE.Object3D | null>(null);
  const originalCursorRef = useRef('');
  const originalPositionRef = useRef(new THREE.Vector3());
  const didDragRef = useRef(false);
  const hoveredObjectRef = useRef<THREE.Object3D | null>(null);
  const selectedObjectRef = useRef<THREE.Object3D | null>(null);
  const rotatingObjectRef = useRef<THREE.Object3D | null>(null);
  const originalRotationRef = useRef<THREE.Euler | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);

  const getRegistry = useCallback(() => (
    (window as any).__AI_SCENE_REGISTRY__ as AiSceneRegistry | undefined
  ), []);

  const setPointerFromEvent = useCallback((event: PointerEvent, domElement: HTMLElement) => {
    const rect = domElement.getBoundingClientRect();
    pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }, []);

  const getSnapCandidates = useCallback((dragged: THREE.Object3D) => {
    const candidates: THREE.Vector3[] = [];
    for (const object of draggableObjectsRef.current) {
      if (object === dragged) continue;
      const entry = object.userData.aiScene as SceneObjectRegistryEntry | undefined;
      if (!entry) continue;
      candidates.push(new THREE.Vector3(...entry.position));
      const approach = entry.interactionPoints.approach;
      if (approach) candidates.push(new THREE.Vector3(approach[0], dragged.position.y, approach[2]));
    }
    return candidates;
  }, []);

  const snapPosition = useCallback((dragged: THREE.Object3D, rawPosition: THREE.Vector3) => {
    const snapped = rawPosition.clone();
    snapped.x = THREE.MathUtils.clamp(roundToGrid(snapped.x), ROOM_LIMITS.minX, ROOM_LIMITS.maxX);
    snapped.z = THREE.MathUtils.clamp(roundToGrid(snapped.z), ROOM_LIMITS.minZ, ROOM_LIMITS.maxZ);

    let nearest: THREE.Vector3 | null = null;
    let nearestDistance = SNAP_DISTANCE;
    for (const candidate of getSnapCandidates(dragged)) {
      const dx = candidate.x - rawPosition.x;
      const dz = candidate.z - rawPosition.z;
      const distance = Math.hypot(dx, dz);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = candidate;
      }
    }

    if (nearest) {
      snapped.x = THREE.MathUtils.clamp(Number(nearest.x.toFixed(3)), ROOM_LIMITS.minX, ROOM_LIMITS.maxX);
      snapped.z = THREE.MathUtils.clamp(Number(nearest.z.toFixed(3)), ROOM_LIMITS.minZ, ROOM_LIMITS.maxZ);
    }

    return snapped;
  }, [getSnapCandidates]);

  const persistObjectPosition = useCallback((object: THREE.Object3D) => {
    const registry = getRegistry();
    updateRegistryEntryCoordinates(registry, object, object.position);

    const base = sceneObjectBaseTransformRef.current.get(object.name);
    if (base) {
      base.position.copy(object.position);
      base.rotation.copy(object.rotation);
      base.visible = object.visible;
    }

    saveStoredTransform(object.name, {
      position: toSceneVec3(object.position),
      rotation: toSceneVec3(object.rotation),
    });
  }, [getRegistry, sceneObjectBaseTransformRef]);

  const applyStoredTransforms = useCallback(() => {
    const room = roomModelRef.current;
    if (!room) return;

    const stored = loadStoredTransforms();
    const registry = getRegistry();
    Object.entries(stored).forEach(([objectId, transform]) => {
      const object = room.getObjectByName(objectId);
      const entry = object?.userData.aiScene as SceneObjectRegistryEntry | undefined;
      if (!object || !isDraggableEntry(entry)) return;

      object.position.set(...transform.position);
      object.rotation.set(...transform.rotation);
      object.updateMatrixWorld(true);
      updateRegistryEntryCoordinates(registry, object, object.position);
      sceneObjectBaseTransformRef.current.set(objectId, {
        position: object.position.clone(),
        rotation: object.rotation.clone(),
        visible: object.visible,
      });
    });
  }, [getRegistry, roomModelRef, sceneObjectBaseTransformRef]);

  const refreshSnappableObjects = useCallback(() => {
    const room = roomModelRef.current;
    if (!room) return;

    applyStoredTransforms();

    const roots: THREE.Object3D[] = [];
    room.children.forEach((object: THREE.Object3D) => {
      const entry = object.userData.aiScene as SceneObjectRegistryEntry | undefined;
      if (!isDraggableEntry(entry)) return;
      roots.push(object);
      sceneObjectBaseTransformRef.current.set(object.name, {
        position: object.position.clone(),
        rotation: object.rotation.clone(),
        visible: object.visible,
      });
    });

    draggableObjectsRef.current = roots;
    draggableRootSetRef.current = new Set(roots);
  }, [applyStoredTransforms, roomModelRef, sceneObjectBaseTransformRef]);

  const activateObjectDragSnap = useCallback(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    const domElement = renderer?.domElement;
    if (!renderer || !camera || !scene || !domElement) return undefined;

    const transformControls = new TransformControls(camera, domElement);
    transformControls.setMode('rotate');
    transformControls.setRotationSnap(ROTATION_SNAP);
    transformControls.setSize(1.2);
    transformControls.visible = false;
    transformControls.enabled = false;
    scene.add(transformControls);
    transformControlsRef.current = transformControls;

    transformControls.addEventListener('dragging-changed', (event: any) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = !event.value;
      }
    });

    const startRotation = (object: THREE.Object3D) => {
      rotatingObjectRef.current = object;
      originalRotationRef.current = object.rotation.clone();

      transformControls.attach(object);
      transformControls.visible = true;
      transformControls.enabled = true;

      const entry = object.userData.aiScene as SceneObjectRegistryEntry | undefined;
      toaster.create({
        title: 'Rotate mode',
        description: `Drag the red / green / blue rings to rotate ${entry?.humanName ?? object.name}. Press E to confirm. Escape to cancel.`,
        type: 'info',
        duration: 4000,
      });
    };

    const confirmRotation = () => {
      const object = rotatingObjectRef.current;
      if (!object) return;

      persistObjectPosition(object);

      transformControls.detach();
      transformControls.visible = false;
      transformControls.enabled = false;

      const entry = object.userData.aiScene as SceneObjectRegistryEntry | undefined;
      toaster.create({
        title: 'Object rotated',
        description: `${entry?.humanName ?? object.name} rotation updated.`,
        type: 'success',
        duration: 1600,
      });

      rotatingObjectRef.current = null;
      originalRotationRef.current = null;
    };

    const cancelRotation = () => {
      const object = rotatingObjectRef.current;
      if (!object || !originalRotationRef.current) return;

      object.rotation.copy(originalRotationRef.current);
      object.updateMatrixWorld(true);

      transformControls.detach();
      transformControls.visible = false;
      transformControls.enabled = false;

      const entry = object.userData.aiScene as SceneObjectRegistryEntry | undefined;
      toaster.create({
        title: 'Rotation cancelled',
        description: `${entry?.humanName ?? object.name} rotation restored.`,
        type: 'info',
        duration: 1600,
      });

      rotatingObjectRef.current = null;
      originalRotationRef.current = null;
    };

    const onPointerDown = (event: PointerEvent) => {
      console.log('onPointerDown fired, button:', event.button);
      if (event.button !== 0) return;

      // Let TransformControls handle interaction when rotation gizmo is active
      if (rotatingObjectRef.current) return;

      console.log('draggableObjectsRef.current.length:', draggableObjectsRef.current.length);
      if (draggableObjectsRef.current.length === 0) return;
      setPointerFromEvent(event, domElement);
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      const hits = raycasterRef.current.intersectObjects(draggableObjectsRef.current, true);
      console.log('hits:', hits.length, hits);
      const hit = hits.find((candidate: THREE.Intersection) => (
        findDraggableRoot(candidate.object, draggableRootSetRef.current)
      ));
      console.log('hit:', hit);
      const dragged = findDraggableRoot(hit?.object ?? null, draggableRootSetRef.current);
      console.log('dragged:', dragged);
      if (!dragged) {
        selectedObjectRef.current = null;
        return;
      }

      draggingRef.current = dragged;
      originalPositionRef.current.copy(dragged.position);
      didDragRef.current = false;
      dragPlaneRef.current.set(new THREE.Vector3(0, 1, 0), -dragged.position.y);
      raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, planeHitRef.current);
      dragOffsetRef.current.copy(dragged.position).sub(planeHitRef.current);

      const controls = controlsRef.current;
      if (controls) controls.enabled = false;
      originalCursorRef.current = domElement.style.cursor;
      domElement.style.cursor = 'grabbing';
      domElement.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    };

    const onPointerMove = (event: PointerEvent) => {
      // Let TransformControls handle interaction when rotation gizmo is active
      if (rotatingObjectRef.current) return;

      const dragged = draggingRef.current;
      if (!dragged) {
        setPointerFromEvent(event, domElement);
        raycasterRef.current.setFromCamera(pointerRef.current, camera);
        const hits = raycasterRef.current.intersectObjects(draggableObjectsRef.current, true);
        const hit = hits.find((candidate: THREE.Intersection) => (
          findDraggableRoot(candidate.object, draggableRootSetRef.current)
        ));
        const hovered = findDraggableRoot(hit?.object ?? null, draggableRootSetRef.current);
        hoveredObjectRef.current = hovered ?? null;
        domElement.style.cursor = hovered ? 'grab' : originalCursorRef.current;
        return;
      }

      setPointerFromEvent(event, domElement);
      raycasterRef.current.setFromCamera(pointerRef.current, camera);
      if (!raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, planeHitRef.current)) return;

      const rawPosition = planeHitRef.current.clone().add(dragOffsetRef.current);
      rawPosition.y = originalPositionRef.current.y;
      const snapped = snapPosition(dragged, rawPosition);
      dragged.position.copy(snapped);
      dragged.updateMatrixWorld(true);
      didDragRef.current = true;
      event.preventDefault();
      event.stopPropagation();
    };

    const finishDrag = (event: PointerEvent) => {
      const dragged = draggingRef.current;
      if (!dragged) return;

      draggingRef.current = null;
      const controls = controlsRef.current;
      if (controls) controls.enabled = true;
      domElement.style.cursor = originalCursorRef.current;
      if (domElement.hasPointerCapture(event.pointerId)) {
        domElement.releasePointerCapture(event.pointerId);
      }

      if (didDragRef.current) {
        persistObjectPosition(dragged);
        const entry = dragged.userData.aiScene as SceneObjectRegistryEntry | undefined;
        toaster.create({
          title: 'Scene object moved',
          description: `${entry?.humanName ?? dragged.name} is now at ${dragged.position.x.toFixed(2)}, ${dragged.position.y.toFixed(2)}, ${dragged.position.z.toFixed(2)}.`,
          type: 'success',
          duration: 1600,
        });
        selectedObjectRef.current = null;
      } else {
        selectedObjectRef.current = dragged;
        const entry = dragged.userData.aiScene as SceneObjectRegistryEntry | undefined;
        toaster.create({
          title: 'Object selected',
          description: `Press E to rotate ${entry?.humanName ?? dragged.name}`,
          type: 'info',
          duration: 2000,
        });
      }

      event.preventDefault();
      event.stopPropagation();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      console.log('onKeyDown fired, key:', event.key, 'dragging:', !!draggingRef.current, 'selected:', !!selectedObjectRef.current, 'hovered:', !!hoveredObjectRef.current);
      const target = event.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;

      if (event.key === 'e' || event.key === 'E') {
        event.preventDefault();
        if (draggingRef.current) return;
        if (rotatingObjectRef.current) {
          confirmRotation();
        } else {
          const targetObj = selectedObjectRef.current ?? hoveredObjectRef.current;
          console.log('targetObj for rotation:', targetObj);
          if (targetObj) startRotation(targetObj);
        }
      } else if (event.key === 'Escape') {
        if (rotatingObjectRef.current) {
          cancelRotation();
        }
      }
    };

    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('pointermove', onPointerMove);
    domElement.addEventListener('pointerup', finishDrag);
    domElement.addEventListener('pointercancel', finishDrag);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerup', finishDrag);
      domElement.removeEventListener('pointercancel', finishDrag);
      window.removeEventListener('keydown', onKeyDown);

      transformControls.detach();
      transformControls.dispose();
      scene.remove(transformControls);
      transformControlsRef.current = null;
    };
  }, [
    cameraRef,
    controlsRef,
    persistObjectPosition,
    rendererRef,
    sceneRef,
    setPointerFromEvent,
    snapPosition,
  ]);

  return { activateObjectDragSnap, refreshSnappableObjects };
};
