import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';

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

const mockScene = { add: vi.fn(), remove: vi.fn() };

vi.mock('three', () => ({
  Vector3: vi.fn(function () { return { x:0,y:0,z:0,set:vi.fn(),copy:vi.fn(function(this:any,o:any){return this}),clone:vi.fn(),sub:vi.fn(function(this:any){return this}) }; }),
  Vector2: vi.fn(function () { return { x:0,y:0,set:vi.fn() }; }),
  Euler: vi.fn(function () { return { x:0,y:0,z:0,set:vi.fn(),copy:vi.fn(function(this:any,o:any){return this}),clone:vi.fn() }; }),
  Plane: vi.fn(function () { return { set: vi.fn() }; }),
  Raycaster: vi.fn(function () { return mockRaycaster; }),
  MathUtils: { clamp: (v: number, min: number, max: number) => Math.min(max, Math.max(min, v)) },
}));

vi.mock('three/examples/jsm/controls/TransformControls.js', () => ({
  TransformControls: vi.fn(function () { return mockTransformControls; }),
}));

vi.mock('@/components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

import { useNamiStudioObjectDragSnap } from './use-nami-studio-object-drag-snap';

describe('debug', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
    vi.stubGlobal('dispatchEvent', () => true);
    vi.clearAllMocks();
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('should call attach', () => {
    const canvas = document.createElement('canvas');
    canvas.setPointerCapture = vi.fn() as any;
    canvas.releasePointerCapture = vi.fn() as any;
    canvas.hasPointerCapture = vi.fn().mockReturnValue(true) as any;

    const object = {
      name: 'CHAIR_01',
      position: { x:0,y:0,z:0, copy: vi.fn(function(this:any){return this}), clone: vi.fn(function(this:any){return this}), set: vi.fn(), sub: vi.fn(function(this:any){return this}) },
      rotation: { x:0,y:0,z:0, copy: vi.fn(function(this:any,o:any){return this}), clone: vi.fn(function(this:any){return {...this,copy:vi.fn(),set:vi.fn()}}), set: vi.fn() },
      updateMatrixWorld: vi.fn(),
      userData: {
        aiScene: {
          id: 'CHAIR_01', humanName: 'CHAIR_01', type: 'chair', zone: 'LivingRoom',
          position: [0,0,0] as [number,number,number],
          rotation: [0,0,0] as [number,number,number],
          scale: [1,1,1] as [number,number,number],
          boundingBox: { min: [0,0,0] as [number,number,number], max: [1,1,1] as [number,number,number] },
          interactionPoints: { approach: [0,0,1] as [number,number,number] },
          facingDirection: [0,0,1] as [number,number,number],
          actions: ['inspect','sit'],
        },
      },
      parent: null,
    };

    const refs = {
      roomModelRef: { current: { getObjectByName: vi.fn(), children: [object] as any[] } },
      sceneRef: { current: mockScene as any },
      cameraRef: { current: {} as any },
      rendererRef: { current: { domElement: canvas } as any },
      controlsRef: { current: { enabled: true } },
      sceneObjectBaseTransformRef: { current: new Map() },
    };

    (window as any).__AI_SCENE_REGISTRY__ = undefined;

    const { result } = renderHook(() => useNamiStudioObjectDragSnap(refs));
    result.current.refreshSnappableObjects();
    const cleanup = result.current.activateObjectDragSnap();

    // Set up raycaster to return our object
    mockRaycaster.intersectObjects = vi.fn().mockReturnValue([{ object }]);

    // Simulate pointerdown + pointerup to select
    canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent('pointerup', { button: 0, bubbles: true, pointerId: 1 }));

    // Press E to rotate
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }));

    console.log('attach calls:', mockTransformControls.attach.mock.calls);
    expect(mockTransformControls.attach).toHaveBeenCalled();
    cleanup?.();
  });
});
