import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { ClipPlaybackOptions } from '../types';
import { VrmAnimationManager } from '../vrm-animation-manager';
import { AnimationLayer } from '../action-graph';

export const useVrmAnimation = () => {
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const activeActionsRef = useRef<Map<AnimationLayer, THREE.AnimationAction>>(new Map());
  const activeActionIdsRef = useRef<Map<AnimationLayer, string>>(new Map());
  const loadedClipsRef = useRef<THREE.AnimationClip[]>([]);
  const [clipNames, setClipNames] = useState<string[]>([]);
  const [selectedClipName, setSelectedClipName] = useState<string>('');
  const [isVrmaPlaying, setIsVrmaPlaying] = useState(false);
  const isVrmaPlayingRef = useRef(false);

  useEffect(() => {
    isVrmaPlayingRef.current = isVrmaPlaying;
  }, [isVrmaPlaying]);

  const animMgrRef = useRef<VrmAnimationManager | null>(null);
  const currentStateAnimUrlRef = useRef<string>('');
  const stateAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sleepPoseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const configureActionPlayback = useCallback((action: THREE.AnimationAction, options?: ClipPlaybackOptions) => {
    if (options?.loopOnce) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = options.clampWhenFinished ?? true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
    }
  }, []);

  const playClipOnCurrentModel = useCallback((
    modelRoot: THREE.Object3D | null,
    skinnedMesh: THREE.SkinnedMesh | null,
    clip: THREE.AnimationClip,
    options?: ClipPlaybackOptions,
    layer: AnimationLayer = 'body'
  ) => {
    const mixerRoot: THREE.Object3D | null = modelRoot ?? skinnedMesh;

    if (!mixerRoot) return;
    
    // Reuse mixer if possible, otherwise create new one
    if (!mixerRef.current || mixerRef.current.getRoot() !== mixerRoot) {
      if (mixerRef.current) mixerRef.current.stopAllAction();
      mixerRef.current = new THREE.AnimationMixer(mixerRoot);
      activeActionsRef.current.clear();
      activeActionIdsRef.current.clear();
    }
    
    const mixer = mixerRef.current;
    
    // Stop existing action in the same layer
    const existingAction = activeActionsRef.current.get(layer);
    if (existingAction) {
      existingAction.fadeOut(0.3);
    }

    const action = mixer.clipAction(clip);
    configureActionPlayback(action, options);
    
    action.reset().fadeIn(0.3).play();
    
    if (options?.holdFirstFrame) {
      action.time = 0;
      mixer.update(0);
      action.paused = true;
    }
    
    if (options?.onSettled) {
      if (sleepPoseTimerRef.current) clearTimeout(sleepPoseTimerRef.current);
      const delay = options.holdFirstFrame ? 50 : Math.max(200, clip.duration * 1000);
      sleepPoseTimerRef.current = setTimeout(options.onSettled, delay);
    }
    
    activeActionsRef.current.set(layer, action);
    activeActionIdsRef.current.set(layer, options?.actionId ?? 'unknown');
    setIsVrmaPlaying(true);
    isVrmaPlayingRef.current = true;
  }, [configureActionPlayback]);

  const stopAllAnimations = useCallback(() => {
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
      mixerRef.current = null;
    }
    activeActionsRef.current.clear();
    activeActionIdsRef.current.clear();
    if (sleepPoseTimerRef.current) {
      clearTimeout(sleepPoseTimerRef.current);
      sleepPoseTimerRef.current = null;
    }
    setIsVrmaPlaying(false);
    isVrmaPlayingRef.current = false;
    currentStateAnimUrlRef.current = '';
  }, []);

  const stopLayerAnimation = useCallback((layer: AnimationLayer) => {
    const action = activeActionsRef.current.get(layer);
    if (action) {
      action.fadeOut(0.3);
      activeActionsRef.current.delete(layer);
      activeActionIdsRef.current.delete(layer);
    }
    if (activeActionsRef.current.size === 0) {
      setIsVrmaPlaying(false);
      isVrmaPlayingRef.current = false;
    }
  }, []);

  const pauseAllAnimations = useCallback(() => {
    activeActionsRef.current.forEach((action) => {
      action.paused = true;
    });
    if (sleepPoseTimerRef.current) {
      clearTimeout(sleepPoseTimerRef.current);
      sleepPoseTimerRef.current = null;
    }
    setIsVrmaPlaying(false);
    isVrmaPlayingRef.current = false;
    currentStateAnimUrlRef.current = '';
  }, []);

  const resumePausedAnimation = useCallback(() => {
    if (activeActionsRef.current.size === 0) return false;
    activeActionsRef.current.forEach((action) => {
      action.paused = false;
      action.enabled = true;
      if (!action.isRunning()) {
        action.play();
      }
    });
    setIsVrmaPlaying(true);
    isVrmaPlayingRef.current = true;
    return true;
  }, []);

  return useMemo(() => ({
    mixerRef,
    activeActionsRef,
    activeActionIdsRef,
    loadedClipsRef,
    clipNames,
    setClipNames,
    selectedClipName,
    setSelectedClipName,
    isVrmaPlaying,
    setIsVrmaPlaying,
    isVrmaPlayingRef,
    animMgrRef,
    currentStateAnimUrlRef,
    stateAnimTimerRef,
    sleepPoseTimerRef,
    configureActionPlayback,
    playClipOnCurrentModel,
    stopAllAnimations,
    stopLayerAnimation,
    pauseAllAnimations,
    resumePausedAnimation,
  }), [
    clipNames,
    selectedClipName,
    isVrmaPlaying,
    configureActionPlayback,
    playClipOnCurrentModel,
    stopAllAnimations,
    stopLayerAnimation,
    pauseAllAnimations,
    resumePausedAnimation
  ]);
};
