import {
  createContext, useContext, useState, useMemo,
} from 'react';
import { useLocalStorage } from '@/hooks/utils/use-local-storage';
import { useConfig } from '@/context/character-config-context';

/**
 * Model emotion mapping interface
 * @interface EmotionMap
 */
interface EmotionMap {
  [key: string]: number | string;
}

/**
 * Motion weight mapping interface
 * @interface MotionWeightMap
 */
export interface MotionWeightMap {
  [key: string]: number;
}

/**
 * Tap motion mapping interface
 * @interface TapMotionMap
 */
export interface TapMotionMap {
  [key: string]: MotionWeightMap;
}

/**
 * Live2D model information interface
 * @interface ModelInfo
 */
export interface ModelInfo {
  /** Model name */
  name?: string;

  /** Model description */
  description?: string;

  /** Model URL */
  url: string;

  /** Renderer family for 3D models such as VRM/GLB */
  renderer?: string;

  /** Scale factor */
  kScale: number;

  /** Initial X position shift */
  initialXshift: number;

  /** Initial Y position shift */
  initialYshift: number;

  /** Idle motion group name */
  idleMotionGroupName?: string;

  /** Default emotion */
  defaultEmotion?: number | string;

  /** Emotion mapping configuration */
  emotionMap: EmotionMap;

  /** Enable pointer interactivity */
  pointerInteractive?: boolean;

  /** Tap motion mapping configuration */
  tapMotions?: TapMotionMap;

  /** Enable scroll to resize */
  scrollToResize?: boolean;

  /** Initial scale */
  initialScale?: number;

  /** VRM camera zoom (distance multiplier) */
  vrmZoom?: number;

  /** VRM model Y-axis rotation in degrees */
  vrmRotY?: number;

  /** VRM model Z position (depth in scene) */
  vrmPosZ?: number;

  /** VR scene - GLB environment file URL */
  sceneGlb?: string;
  /** VR scene GLB position offset [x, y, z] */
  sceneGlbPosition?: [number, number, number];
  /** VR scene GLB rotation [x, y, z] in radians */
  sceneGlbRotation?: [number, number, number];
  /** VR scene GLB scale (uniform number or [x, y, z]) */
  sceneGlbScale?: number | [number, number, number];

  /** Built-in procedural scene preset id */
  scenePreset?: string;

  /** Scene or viewer background color */
  backgroundColor?: string;

  /** VRM camera position [x, y, z] */
  cameraPosition?: [number, number, number];

  /** VRM camera target [x, y, z] */
  cameraTarget?: [number, number, number];

  /** Enable orbit camera auto-rotation */
  autoRotate?: boolean;
}

/**
 * Live2D configuration context state interface
 * @interface Live2DConfigState
 */
interface Live2DConfigState {
  modelInfo?: ModelInfo;
  setModelInfo: (info: ModelInfo | undefined) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

/**
 * Default values and constants
 */
const DEFAULT_CONFIG = {
  modelInfo: {
    scrollToResize: true,
  } as ModelInfo | undefined,
  isLoading: false,
};

/**
 * Create the Live2D configuration context
 */
export const Live2DConfigContext = createContext<Live2DConfigState | null>(null);

/**
 * Live2D Configuration Provider Component
 * @param {Object} props - Provider props
 * @param {React.ReactNode} props.children - Child components
 */
export function Live2DConfigProvider({ children }: { children: React.ReactNode }) {
  const { confUid } = useConfig();

  const [isLoading, setIsLoading] = useState(DEFAULT_CONFIG.isLoading);

  const [modelInfo, setModelInfoState] = useLocalStorage<ModelInfo | undefined>(
    "modelInfo",
    DEFAULT_CONFIG.modelInfo,
    {
      filter: (value) => (value ? { ...value, url: "" } : value),
    },
  );

  // const [modelInfo, setModelInfoState] = useState<ModelInfo | undefined>(DEFAULT_CONFIG.modelInfo);

  const setModelInfo = (info: ModelInfo | undefined) => {
    if (!info?.url) {
      setModelInfoState(undefined);
      return;
    }

    const isVrmRenderer = info.renderer === "vrm"
      || /\.(vrm|glb|gltf)(\?|#|$)/i.test(info.url);
    // Live2D configs historically use half-scale values. VRM/GLB configs are
    // already authored in Three.js world scale, so keep them literal.
    const finalScale = isVrmRenderer
      ? Number(info.kScale || 0.88)
      : Number(info.kScale || 0.5) * 2;
    console.log("Setting model info with default scale:", finalScale);

    setModelInfoState({
      ...info,
      kScale: finalScale,
      pointerInteractive:
        "pointerInteractive" in info
          ? info.pointerInteractive
          : (modelInfo?.pointerInteractive ?? true),
      scrollToResize:
        "scrollToResize" in info
          ? info.scrollToResize
          : (modelInfo?.scrollToResize ?? true),
      vrmZoom:
        "vrmZoom" in info
          ? info.vrmZoom
          : (modelInfo?.vrmZoom ?? 0.4),
    });
  };

  const contextValue = useMemo(
    () => ({
      modelInfo,
      setModelInfo,
      isLoading,
      setIsLoading,
    }),
    [modelInfo, isLoading, setIsLoading],
  );

  return (
    <Live2DConfigContext.Provider value={contextValue}>
      {children}
    </Live2DConfigContext.Provider>
  );
}

/**
 * Custom hook to use the Live2D configuration context
 * @throws {Error} If used outside of Live2DConfigProvider
 */
export function useLive2DConfig() {
  const context = useContext(Live2DConfigContext);

  if (!context) {
    throw new Error('useLive2DConfig must be used within a Live2DConfigProvider');
  }

  return context;
}

// Export the provider as default
export default Live2DConfigProvider;
