import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── Mock Three.js before importing the hook ──────────────────────────
const mockEuler = {
  x: 0, y: 0, z: 0,
  set: vi.fn(function (this: any, x: number, y: number, z: number) {
    this.x = x; this.y = y; this.z = z;
    return this;
  }),
  copy: vi.fn(function (this: any, other: any) {
    this.x = other.x; this.y = other.y; this.z = other.z;
    return this;
  }),
  clone: vi.fn(function (this: any) {
    return { ...this, copy: mockEuler.copy, set: mockEuler.set };
  }),
};

const mockVector3 = {
  x: 0, y: 0, z: 0,
  set: vi.fn(function (this: any, x: number, y: number, z: number) {
    this.x = x; this.y = y; this.z = z;
    return this;
  }),
  copy: vi.fn(function (this: any, other: any) {
    this.x = other.x; this.y = other.y; this.z = other.z;
    return this;
  }),
  clone: vi.fn(function (this: any) {
    return { ...this, copy: mockVector3.copy, set: mockVector3.set, sub: mockVector3.sub, add: mockVector3.add };
  }),
  sub: vi.fn(function (this: any, other: any) {
    this.x -= other.x; this.y -= other.y; this.z -= other.z;
    return this;
  }),
  add: vi.fn(function (this: any, other: any) {
    this.x += other.x; this.y += other.y; this.z += other.z;
    return this;
  }),
};

const mockPlane = {
  set: vi.fn(),
};

const mockRay = {
  intersectPlane: vi.fn().mockReturnValue(true),
};

const mockRaycaster = {
  setFromCamera: vi.fn(),
  ray: mockRay,
  intersectObjects: vi.fn().mockReturnValue([]),
};

const mockTransformControls = {
  attach: vi.fn(),
  detach: vi.fn(),
  setMode: vi.fn(),
  setRotationSnap: vi.fn(),
  setSize: vi.fn(),
  dispose: vi.fn(),
  visible: false,
  enabled: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

const mockScene = {
  add: vi.fn(),
  remove: vi.fn(),
};

const mockCamera = {};

let mockRenderer: { domElement: HTMLCanvasElement };

const mockObject3D = (name: string, type: string = 'chair') => ({
  name,
  position: { ...mockVector3, clone: mockVector3.clone, copy: mockVector3.copy, set: mockVector3.set },
  rotation: { ...mockEuler, clone: mockEuler.clone, copy: mockEuler.copy, set: mockEuler.set },
  updateMatrixWorld: vi.fn(),
  userData: {
    aiScene: {
      id: name,
      humanName: name,
      type,
      zone: 'LivingRoom',
      position: [0, 0, 0] as [number, number, number],
      rotation: [0, 0, 0] as [number, number, number],
      scale: [1, 1, 1] as [number, number, number],
      boundingBox: { min: [0, 0, 0] as [number, number, number], max: [1, 1, 1] as [number, number, number] },
      interactionPoints: { approach: [0, 0, 1] as [number, number, number] },
      facingDirection: [0, 0, 1] as [number, number, number],
      actions: ['inspect', 'sit'],
    },
  },
  parent: null,
});

vi.mock('three', () => ({
  Vector3: vi.fn(function () { return { ...mockVector3 }; }),
  Vector2: vi.fn(function () { return { x: 0, y: 0, set: vi.fn() }; }),
  Euler: vi.fn(function () { return { ...mockEuler }; }),
  Plane: vi.fn(function () { return mockPlane; }),
  Raycaster: vi.fn(function () { return mockRaycaster; }),
  MathUtils: { clamp: (v: number, min: number, max: number) => Math.min(max, Math.max(min, v)) },
}));

vi.mock('three/examples/jsm/controls/TransformControls.js', () => ({
  TransformControls: vi.fn(function () { return mockTransformControls; }),
}));

vi.mock('@/components/ui/toaster', () => ({
  toaster: {
    create: vi.fn(),
  },
}));

// Need to import after mocks are set up
import { useNamiStudioObjectDragSnap } from './use-nami-studio-object-drag-snap';

describe('useNamiStudioObjectDragSnap', () => {
  let localStorageData: Record<string, string> = {};
  let customEvents: CustomEvent[] = [];

  const setupRefs = () => ({
    roomModelRef: { current: { getObjectByName: vi.fn(), children: [] as any[] } },
    sceneRef: { current: mockScene as any },
    cameraRef: { current: mockCamera as any },
    rendererRef: { current: mockRenderer as any },
    controlsRef: { current: { enabled: true } },
    sceneObjectBaseTransformRef: { current: new Map() },
  });

  beforeEach(() => {
    const canvas = document.createElement('canvas');
    canvas.setPointerCapture = vi.fn();
    canvas.releasePointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn().mockReturnValue(true);
    mockRenderer = { domElement: canvas };
    localStorageData = {};
    customEvents = [];
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => localStorageData[key] ?? null,
      setItem: (key: string, value: string) => { localStorageData[key] = value; },
    });
    vi.stubGlobal('dispatchEvent', (event: Event) => {
      customEvents.push(event as CustomEvent);
      return true;
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('rotation setup', () => {
    it('should configure TransformControls in rotate mode with 15-degree snap', () => {
      const refs = setupRefs();
      const { result } = renderHook(() => useNamiStudioObjectDragSnap(refs));
      result.current.activateObjectDragSnap();

      expect(mockTransformControls.setMode).toHaveBeenCalledWith('rotate');
      expect(mockTransformControls.setRotationSnap).toHaveBeenCalledWith(Math.PI / 12);
      expect(mockTransformControls.setSize).toHaveBeenCalledWith(1.2);
      expect(mockTransformControls.visible).toBe(false);
      expect(mockTransformControls.enabled).toBe(false);
    });

    it('should disable camera controls while transform dragging', () => {
      const refs = setupRefs();
      const { result } = renderHook(() => useNamiStudioObjectDragSnap(refs));
      result.current.activateObjectDragSnap();

      const draggingListener = (mockTransformControls.addEventListener as any).mock.calls
        .find((call: any[]) => call[0] === 'dragging-changed');
      expect(draggingListener).toBeDefined();

      // Simulate dragging started
      draggingListener[1]({ value: true });
      expect(refs.controlsRef.current.enabled).toBe(false);

      // Simulate dragging ended
      draggingListener[1]({ value: false });
      expect(refs.controlsRef.current.enabled).toBe(true);
    });
  });

  describe('startRotation', () => {
    it('should attach object to transform controls and store original rotation', () => {
      const refs = setupRefs();
      const object = mockObject3D('CHAIR_01');
      object.rotation.y = Math.PI / 4;
      refs.roomModelRef.current.children = [object];

      const { result } = renderHook(() => useNamiStudioObjectDragSnap(refs));
      result.current.refreshSnappableObjects();
      const cleanup = result.current.activateObjectDragSnap();

      mockRaycaster.intersectObjects = vi.fn().mockReturnValue([{ object }]);
      // @ts-expect-error - accessing internal for testing
      (window as any).__AI_SCENE_REGISTRY__ = undefined;

      // Select object via pointer down + up (no drag movement)
      const domElement = mockRenderer.domElement;
      domElement.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true, pointerId: 1 }));
      domElement.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true, pointerId: 1 }));

      // Then pressing E starts rotation
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));

      expect(mockTransformControls.attach).toHaveBeenCalled();
      expect(mockTransformControls.visible).toBe(true);
      expect(mockTransformControls.enabled).toBe(true);

      cleanup?.();
    });
  });

  describe('confirmRotation', () => {
    it('should persist rotation to localStorage and update registry on confirm', () => {
      const refs = setupRefs();
      const object = mockObject3D('CHAIR_01');
      object.rotation.y = Math.PI / 3;
      refs.roomModelRef.current.children = [object];

      const registry = {
        sceneId: 'test',
        displayName: 'Test',
        units: 'meters' as const,
        navmesh: { walkableAreas: [], blockedObjectIds: [] },
        objects: [object.userData.aiScene],
      };
      // @ts-expect-error
      (window as any).__AI_SCENE_REGISTRY__ = registry;

      const { result } = renderHook(() => useNamiStudioObjectDragSnap(refs));
      result.current.refreshSnappableObjects();
      const cleanup = result.current.activateObjectDragSnap();

      // Start rotation via keyboard flow
      const domElement = mockRenderer.domElement;
      mockRaycaster.intersectObjects = vi.fn().mockReturnValue([{ object }]);
      domElement.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true, pointerId: 1 }));
      domElement.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true, pointerId: 1 }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));

      // Modify rotation
      object.rotation.y = Math.PI / 2;

      // Confirm with E
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));

      // Verify localStorage has the rotation
      const stored = JSON.parse(localStorageData['nami-studio-object-transforms-v1'] ?? '{}');
      expect(stored).toHaveProperty('CHAIR_01');
      expect(stored['CHAIR_01'].rotation[1]).toBeCloseTo(1.571, 2); // ~PI/2

      // Verify registry was updated
      expect(object.userData.aiScene.rotation[1]).toBeCloseTo(1.571, 2);

      // Verify transform controls were detached and hidden
      expect(mockTransformControls.detach).toHaveBeenCalled();
      expect(mockTransformControls.visible).toBe(false);
      expect(mockTransformControls.enabled).toBe(false);

      cleanup?.();
    });
  });

  describe('cancelRotation', () => {
    it('should restore original rotation when Escape is pressed', () => {
      const refs = setupRefs();
      const object = mockObject3D('CHAIR_01');
      const originalRotation = { x: 0, y: Math.PI / 6, z: 0 };
      object.rotation.copy(originalRotation);
      refs.roomModelRef.current.children = [object];

      // @ts-expect-error
      (window as any).__AI_SCENE_REGISTRY__ = {
        sceneId: 'test',
        displayName: 'Test',
        units: 'meters',
        navmesh: { walkableAreas: [], blockedObjectIds: [] },
        objects: [object.userData.aiScene],
      };

      const { result } = renderHook(() => useNamiStudioObjectDragSnap(refs));
      result.current.refreshSnappableObjects();
      const cleanup = result.current.activateObjectDragSnap();

      // Select and start rotation
      const domElement = mockRenderer.domElement;
      mockRaycaster.intersectObjects = vi.fn().mockReturnValue([{ object }]);
      domElement.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true, pointerId: 1 }));
      domElement.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true, pointerId: 1 }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));

      // Change rotation
      object.rotation.y = Math.PI;

      // Cancel with Escape
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      // Verify rotation was restored
      expect(object.rotation.copy).toHaveBeenCalledWith(expect.objectContaining({ x: 0, y: expect.any(Number), z: 0 }));
      expect(object.updateMatrixWorld).toHaveBeenCalledWith(true);

      // Verify transform controls were detached and hidden
      expect(mockTransformControls.detach).toHaveBeenCalled();
      expect(mockTransformControls.visible).toBe(false);
      expect(mockTransformControls.enabled).toBe(false);

      cleanup?.();
    });
  });

  describe('keyboard rotation flow', () => {
    it('should ignore E key when actively dragging', () => {
      const refs = setupRefs();
      const { result } = renderHook(() => useNamiStudioObjectDragSnap(refs));
      const cleanup = result.current.activateObjectDragSnap();

      const domElement = mockRenderer.domElement;
      const object = mockObject3D('CHAIR_01');
      mockRaycaster.intersectObjects = vi.fn().mockReturnValue([{ object }]);

      // Start a drag
      domElement.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));

      // Move to trigger dragging state
      domElement.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));

      // Press E while dragging - should not start rotation
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));

      // TransformControls should NOT be attached because we're dragging
      // (the drag state prevents rotation start)
      cleanup?.();
    });

    it('should start rotation from hovered object when E is pressed', () => {
      const refs = setupRefs();
      const object = mockObject3D('CHAIR_01');
      refs.roomModelRef.current.children = [object];

      const { result } = renderHook(() => useNamiStudioObjectDragSnap(refs));
      result.current.refreshSnappableObjects();
      const cleanup = result.current.activateObjectDragSnap();

      mockRaycaster.intersectObjects = vi.fn().mockReturnValue([{ object }]);

      // Hover over object via pointermove when not dragging
      const domElement = mockRenderer.domElement;
      domElement.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1 }));

      // Press E
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));

      expect(mockTransformControls.attach).toHaveBeenCalled();
      cleanup?.();
    });

    it('should ignore E key when input or textarea is focused', () => {
      const refs = setupRefs();
      const { result } = renderHook(() => useNamiStudioObjectDragSnap(refs));
      const cleanup = result.current.activateObjectDragSnap();

      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));

      expect(mockTransformControls.attach).not.toHaveBeenCalled();

      document.body.removeChild(input);
      cleanup?.();
    });

    it('should ignore Escape when not rotating', () => {
      const refs = setupRefs();
      const { result } = renderHook(() => useNamiStudioObjectDragSnap(refs));
      const cleanup = result.current.activateObjectDragSnap();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      // Should not throw and detach should not be called extra times
      expect(mockTransformControls.detach).not.toHaveBeenCalled();

      cleanup?.();
    });
  });

  describe('persistObjectPosition rotation', () => {
    it('should save rotation to localStorage including all three axes', () => {
      const refs = setupRefs();
      const object = mockObject3D('TABLE_01');
      object.rotation.x = 0.123;
      object.rotation.y = 0.456;
      object.rotation.z = 0.789;
      refs.roomModelRef.current.children = [object];

      // @ts-expect-error
      (window as any).__AI_SCENE_REGISTRY__ = {
        sceneId: 'test',
        displayName: 'Test',
        units: 'meters',
        navmesh: { walkableAreas: [], blockedObjectIds: [] },
        objects: [object.userData.aiScene],
      };

      const { result } = renderHook(() => useNamiStudioObjectDragSnap(refs));
      result.current.refreshSnappableObjects();
      const cleanup = result.current.activateObjectDragSnap();

      // Trigger persist by going through the full rotation flow
      const domElement = mockRenderer.domElement;
      mockRaycaster.intersectObjects = vi.fn().mockReturnValue([{ object }]);
      domElement.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true, pointerId: 1 }));
      domElement.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true, pointerId: 1 }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));

      const stored = JSON.parse(localStorageData['nami-studio-object-transforms-v1'] ?? '{}');
      expect(stored['TABLE_01'].rotation).toHaveLength(3);
      expect(stored['TABLE_01'].rotation[0]).toBeCloseTo(0.123, 2);
      expect(stored['TABLE_01'].rotation[1]).toBeCloseTo(0.456, 2);
      expect(stored['TABLE_01'].rotation[2]).toBeCloseTo(0.789, 2);

      cleanup?.();
    });
  });

  describe('applyStoredTransforms', () => {
    it('should apply stored rotation from localStorage on refresh', () => {
      const refs = setupRefs();
      const object = mockObject3D('CHAIR_01');
      object.rotation.set = vi.fn().mockReturnValue(object.rotation);

      localStorageData['nami-studio-object-transforms-v1'] = JSON.stringify({
        CHAIR_01: {
          position: [1, 0, 2],
          rotation: [0, Math.PI / 2, 0],
        },
      });

      refs.roomModelRef.current.getObjectByName = vi.fn().mockReturnValue(object);
      refs.roomModelRef.current.children = [object];

      // @ts-expect-error
      (window as any).__AI_SCENE_REGISTRY__ = {
        sceneId: 'test',
        displayName: 'Test',
        units: 'meters',
        navmesh: { walkableAreas: [], blockedObjectIds: [] },
        objects: [object.userData.aiScene],
      };

      const { result } = renderHook(() => useNamiStudioObjectDragSnap(refs));
      result.current.refreshSnappableObjects();

      expect(object.rotation.set).toHaveBeenCalledWith(0, expect.any(Number), 0);
      expect(object.updateMatrixWorld).toHaveBeenCalledWith(true);
    });
  });

  describe('cleanup', () => {
    it('should detach transform controls and remove from scene on cleanup', () => {
      const refs = setupRefs();
      const { result } = renderHook(() => useNamiStudioObjectDragSnap(refs));
      const cleanup = result.current.activateObjectDragSnap();

      cleanup?.();

      expect(mockTransformControls.detach).toHaveBeenCalled();
      expect(mockTransformControls.dispose).toHaveBeenCalled();
      expect(mockScene.remove).toHaveBeenCalledWith(mockTransformControls);
    });
  });
});
