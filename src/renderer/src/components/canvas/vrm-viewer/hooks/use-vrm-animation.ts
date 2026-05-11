import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { ClipPlaybackOptions } from '../types';
import { VrmAnimationManager } from '../vrm-animation-manager';

export const useVrmAnimation = () => {
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
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
    options?: ClipPlaybackOptions
  ) => {
    const mixerRoot: THREE.Object3D | null = modelRoot ?? skinnedMesh;

    if (!mixerRoot) return;
    
    // Reuse mixer if possible, otherwise create new one
    if (!mixerRef.current || mixerRef.current.getRoot() !== mixerRoot) {
      if (mixerRef.current) mixerRef.current.stopAllAction();
      mixerRef.current = new THREE.AnimationMixer(mixerRoot);
    }
    
    const mixer = mixerRef.current;
    // Ensure only one primary clip drives the avatar at a time.
    mixer.stopAllAction();
    const action = mixer.clipAction(clip);
    configureActionPlayback(action, options);
    action.reset().play();
    if (options?.holdFirstFrame) {
      action.time = 0;
      mixer.update(0);
      action.paused = true;
    }
    
    if (options?.onSettled) {
      if (sleepPoseTimerRef.current) clearTimeout(sleepPoseTimerRef.current);
      // holdFirstFrame applies the pose immediately via mixer.update(0); fire settled callback
      // quickly so callers can correct world positions without waiting for the full clip duration.
      const delay = options.holdFirstFrame ? 50 : Math.max(200, clip.duration * 1000);
      sleepPoseTimerRef.current = setTimeout(options.onSettled, delay);
    }
    
    currentActionRef.current = action;
    setIsVrmaPlaying(true);
    isVrmaPlayingRef.current = true;
  }, [configureActionPlayback]);

  const stopAllAnimations = useCallback(() => {
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
      mixerRef.current = null;
    }
    if (sleepPoseTimerRef.current) {
      clearTimeout(sleepPoseTimerRef.current);
      sleepPoseTimerRef.current = null;
    }
    setIsVrmaPlaying(false);
    isVrmaPlayingRef.current = false;
    currentActionRef.current = null;
    currentStateAnimUrlRef.current = '';
  }, []);

  const pauseAllAnimations = useCallback(() => {
    if (currentActionRef.current) {
      currentActionRef.current.paused = true;
    }
    if (sleepPoseTimerRef.current) {
      clearTimeout(sleepPoseTimerRef.current);
      sleepPoseTimerRef.current = null;
    }
    setIsVrmaPlaying(false);
    isVrmaPlayingRef.current = false;
    currentStateAnimUrlRef.current = '';
  }, []);

  const resumePausedAnimation = useCallback(() => {
    if (!currentActionRef.current) return false;
    currentActionRef.current.paused = false;
    currentActionRef.current.enabled = true;
    if (!currentActionRef.current.isRunning()) {
      currentActionRef.current.play();
    }
    setIsVrmaPlaying(true);
    isVrmaPlayingRef.current = true;
    return true;
  }, []);

  return useMemo(() => ({
    mixerRef,
    currentActionRef,
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
    pauseAllAnimations,
    resumePausedAnimation,
  }), [
    clipNames,
    selectedClipName,
    isVrmaPlaying,
    configureActionPlayback,
    playClipOnCurrentModel,
    stopAllAnimations,
    pauseAllAnimations,
    resumePausedAnimation
  ]);
};
