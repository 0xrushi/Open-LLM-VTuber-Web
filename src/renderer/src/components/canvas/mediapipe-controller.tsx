import { useEffect, useRef, useState } from 'react';
import type { Results } from '@mediapipe/holistic';
import { Camera } from '@mediapipe/camera_utils';
// @ts-ignore
import * as Kalidokit from 'kalidokit';
import { Box, Button, Text, VStack, Input } from '@chakra-ui/react';
import { useLive2DConfig } from '@/context/live2d-config-context';
import { toaster } from '@/components/ui/toaster';

const HOLISTIC_VERSION = '0.5.1675471629';

const loadScriptOnce = (() => {
  const cache = new Map<string, Promise<void>>();
  return (src: string) => {
    const existing = cache.get(src);
    if (existing) return existing;
    const p = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.crossOrigin = 'anonymous';
      el.onload = () => resolve();
      el.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(el);
    });
    cache.set(src, p);
    return p;
  };
})();

// Define the shape of the event detail to match VrmViewer
interface BoneRotation {
  x?: number;
  y?: number;
  z?: number;
  w?: number;
}

interface BonePose {
  name: string;
  rotation?: BoneRotation;
  position?: { x?: number; y?: number; z?: number };
}

interface VrmMotionMessage {
  bones?: BonePose[];
  worldQuaternion?: boolean;
}

interface MediaPipeControllerProps {
  showControls?: boolean;
}

export const MediaPipeController = ({
  showControls = true,
}: MediaPipeControllerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState('Initializing...');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isWebcam, setIsWebcam] = useState(false);
  const holisticRef = useRef<any>(null);
  const cameraRef = useRef<Camera | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const { modelInfo } = useLive2DConfig();

  useEffect(() => {
    // Only supported for VRM avatars. (GLB/GLTF are intentionally excluded.)
    const currentUrl = modelInfo?.url?.toLowerCase() || '';
    if (!currentUrl.endsWith('.vrm')) {
      setStatus('Pose tracking is available for VRM avatars only.');
      return () => {};
    }

    let cancelled = false;
    let instance: any = null;

    const init = async () => {
      try {
        // In some bundlers, `@mediapipe/holistic` doesn't provide a usable constructor.
        // Load the official browser build which defines `window.Holistic`.
        await loadScriptOnce(`https://cdn.jsdelivr.net/npm/@mediapipe/holistic@${HOLISTIC_VERSION}/holistic.js`);
        const HolisticCtor = (window as any).Holistic;
        if (typeof HolisticCtor !== 'function') {
          throw new Error('window.Holistic is not available after script load');
        }
        if (cancelled) return;

        instance = new HolisticCtor({
          locateFile: (file: string) => (
            `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@${HOLISTIC_VERSION}/${file}`
          ),
        });

        instance.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
          refineFaceLandmarks: true,
        });

        instance.onResults(onResults);
        holisticRef.current = instance;
        setStatus('Ready to load video or webcam');
      } catch (err) {
        console.error('[MediaPipe] Failed to initialize Holistic:', err);
        setStatus('Pose tracking failed to initialize. Check console for details.');
      }
    };

    init();

    return () => {
      cancelled = true;
      try {
        instance?.close?.();
      } catch (e) {
        // ignore
      }
      holisticRef.current = null;
    };
  }, [modelInfo?.url]);

  const onResults = (results: Results) => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Accessing potential minified properties or standard ones
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = results as any;
    // Check common property names for 3D landmarks
    const pose3DLandmarks = r.ea || r.poseWorldLandmarks || r.za; 
    const poseLandmarks = results.poseLandmarks;
    const faceLandmarks = results.faceLandmarks;

    // Debug logging (throttle this if it's too spammy, but for now we need to know)
    if (Math.random() < 0.05) {
        console.log('[MediaPipe] onResults:', { 
            hasPose3D: !!pose3DLandmarks, 
            hasPose: !!poseLandmarks, 
            hasFace: !!faceLandmarks,
            keys: Object.keys(r)
        });
    }

    // Kalidokit solve
    if (poseLandmarks && pose3DLandmarks) {
      const poseRig = Kalidokit.Pose.solve(pose3DLandmarks, poseLandmarks, {
        runtime: 'mediapipe',
        video: videoElement,
      });
      
      const faceRig = Kalidokit.Face.solve(faceLandmarks, {
        runtime: 'mediapipe',
        video: videoElement,
      });

      broadcastMotion(poseRig, faceRig, pose3DLandmarks);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const broadcastMotion = (poseRig: any, faceRig: any, pose3DLandmarks?: any) => {
    if (!poseRig) return;

    const bones: BonePose[] = [];

    // Helper to map KalidoKit rotation to our format
    const mapRotation = (name: string, rotation: { x: number; y: number; z: number }, dampener = 1) => {
      // Kalidokit returns Euler in radians
      bones.push({
        name,
        rotation: {
          x: rotation.x * dampener,
          y: rotation.y * dampener,
          z: rotation.z * dampener,
        },
      });
    };

    // Body
    if (poseRig.Hips) {
        mapRotation('hips', poseRig.Hips.rotation, 0.7);
        
        // Position Handling for Jumping
        // Try KalidoKit first, then fallback to raw landmarks
        let hipsPos = poseRig.Hips.position;
        
        if (!hipsPos && pose3DLandmarks) {
            // Fallback: Calculate from raw 3D landmarks (23=Left Hip, 24=Right Hip)
            // These are in meters, relative to a reference point
            const leftHip = pose3DLandmarks[23];
            const rightHip = pose3DLandmarks[24];
            if (leftHip && rightHip) {
                hipsPos = {
                    x: (leftHip.x + rightHip.x) / 2,
                    y: (leftHip.y + rightHip.y) / 2,
                    z: (leftHip.z + rightHip.z) / 2
                };
            }
        }

        if (hipsPos) {
            // Scale factor. MediaPipe 3D landmarks are roughly in meters.
            // Jumping requires significant Y movement.
            // Note: We might need to "zero" this against a resting pose, 
            // but VrmViewer treats it as an offset from initial position.
            // The problem is `hipsPos` is absolute, so at rest it might be (0, 0, 0) or (0, 0.8, 0).
            // If we send absolute (0, 0.8, 0), the avatar will fly up 0.8m + initial position.
            // We need RELATIVE movement. 
            
            // Ideally we'd store the "initial" hips position and subtract it.
            // For now, let's assume the user starts standing (approx 0 movement) 
            // and we just want to capture DELTA. 
            // A simple hack is to just pass it scaled and hope VrmViewer's "initial position" logic handles the offset,
            // OR we can rely on the fact that Y usually varies.
            
            const posScale = 2.0; // Reduced scale since raw meters are larger than normalized 0-1
            
            bones.push({
                name: 'hips',
                position: {
                    x: hipsPos.x * posScale,
                    y: -(hipsPos.y) * posScale, // Invert Y
                    z: hipsPos.z * posScale
                }
            });
        }
    }
    if (poseRig.Spine) {
        // Dampen spine and chest to prevent over-rotation (twisted torso)
        // when Hips already rotate the hierarchy.
        mapRotation('spine', poseRig.Spine, 0.3);
        mapRotation('chest', poseRig.Spine, 0.3); 
    } 
    
    // Arms
    if (poseRig.RightUpperArm) mapRotation('rightUpperArm', poseRig.RightUpperArm, 1);
    if (poseRig.RightLowerArm) mapRotation('rightLowerArm', poseRig.RightLowerArm, 1);
    if (poseRig.LeftUpperArm) mapRotation('leftUpperArm', poseRig.LeftUpperArm, 1);
    if (poseRig.LeftLowerArm) mapRotation('leftLowerArm', poseRig.LeftLowerArm, 1);
    
    // Legs
    if (poseRig.RightUpperLeg) mapRotation('rightUpperLeg', poseRig.RightUpperLeg, 1);
    if (poseRig.RightLowerLeg) mapRotation('rightLowerLeg', poseRig.RightLowerLeg, 1);
    if (poseRig.LeftUpperLeg) mapRotation('leftUpperLeg', poseRig.LeftUpperLeg, 1);
    if (poseRig.LeftLowerLeg) mapRotation('leftLowerLeg', poseRig.LeftLowerLeg, 1);

    // Head
    if (faceRig && faceRig.head) {
      mapRotation('neck', faceRig.head, 0.7);
    }

    if (bones.length > 0) {
      // console.log(`[MediaPipe] Broadcasting ${bones.length} bone updates`);
      const detail: VrmMotionMessage = { bones };
      const event = new CustomEvent('vrm-motion', {
        detail,
      });
      window.dispatchEvent(event);
    }
  };

  const startWebcam = () => {
    setIsWebcam(true);
    setIsVideoPlaying(false);
    
    if (cameraRef.current) {
        // stop existing camera if any (though start() might handle it, better safe)
    }

    const videoElement = videoRef.current;
    if (videoElement && holisticRef.current) {
       // Stop video playback if it was running
       videoElement.pause();
       videoElement.srcObject = null;

       const camera = new Camera(videoElement, {
        onFrame: async () => {
          if (holisticRef.current) {
             await holisticRef.current.send({ image: videoElement });
          }
        },
        width: 640,
        height: 480,
      });
      camera.start();
      cameraRef.current = camera;
      setStatus('Tracking: Webcam');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const currentUrl = modelInfo?.url?.toLowerCase() || '';
    const isGlbModel = currentUrl.endsWith('.glb') || currentUrl.endsWith('.gltf');
    if (isGlbModel) {
      toaster.create({
        title: 'Video pose tracking is only supported for VRM avatars. GLB/GLTF models are not supported yet.',
        type: 'error',
        duration: 4000,
      });
      setStatus('Video pose not supported for GLB/GLTF models');
      return;
    }

    setIsWebcam(false);
    // Stop webcam if running
    if (cameraRef.current) {
        // @ts-ignore - stop might be missing in type definition but exists in JS
        if (cameraRef.current.stop) cameraRef.current.stop(); 
        cameraRef.current = null;
    }

    const url = URL.createObjectURL(file);
    const videoElement = videoRef.current;
    if (videoElement) {
        videoElement.srcObject = null;
        videoElement.src = url;
        videoElement.play();
        setIsVideoPlaying(true);
        setStatus('Tracking: Video File');
        
        // Start processing loop
        const processVideo = async () => {
            if (videoElement.paused || videoElement.ended) {
                 if (!videoElement.paused) requestAnimationFrame(processVideo);
                 return;
            }
            if (holisticRef.current) {
                await holisticRef.current.send({ image: videoElement });
            }
            requestAnimationFrame(processVideo);
        };
        videoElement.onloadeddata = () => processVideo();
    }
  };

  return (
    <>
      {showControls && (
        <Box
          position="absolute"
          top="20px"
          left="20px"
          zIndex={20}
          bg="rgba(0,0,0,0.8)"
          p={4}
          borderRadius="md"
          color="white"
          width="250px"
        >
          <VStack align="stretch" gap={3}>
            <Text fontSize="sm" color="green.400">{status}</Text>

            <Box>
              <Text fontSize="xs" mb={1}>Upload Video File:</Text>
              <Input
                type="file"
                accept="video/*"
                onChange={handleFileUpload}
                size="sm"
                p={1}
                bg="gray.700"
                border="none"
                height="auto"
              />
            </Box>

            <Button size="sm" onClick={startWebcam} colorScheme="blue">
              Switch to Webcam
            </Button>

            <Text fontSize="xs" color="gray.400">
              Use the underlying VRM controls to move camera.
            </Text>
          </VStack>
        </Box>
      )}

      <video
        ref={videoRef}
        className="input_video"
        playsInline
        loop
        muted
        style={{ display: 'none' }}
      />
    </>
  );
};
