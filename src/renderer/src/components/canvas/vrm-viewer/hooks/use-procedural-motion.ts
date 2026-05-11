import { useCallback, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { LogicalBone } from '../types';

export const useProceduralMotion = () => {
  const [isProceduralPlaying, setIsProceduralPlaying] = useState(false);
  const proceduralActiveRef = useRef(false);
  const proceduralStartRef = useRef(0);
  const proceduralBaseQuatRef = useRef<Map<string, THREE.Quaternion>>(new Map());
  const proceduralNodesRef = useRef<Map<string, THREE.Object3D>>(new Map());

  const stopProcedural = useCallback((preservePose = false) => {
    proceduralActiveRef.current = false;
    setIsProceduralPlaying(false);
    if (preservePose) {
      proceduralNodesRef.current.clear();
      proceduralBaseQuatRef.current.clear();
      return;
    }
    for (const [key, node] of proceduralNodesRef.current.entries()) {
      const base = proceduralBaseQuatRef.current.get(key);
      if (!base) continue;
      node.quaternion.copy(base);
      node.updateMatrixWorld(true);
    }
    proceduralNodesRef.current.clear();
    proceduralBaseQuatRef.current.clear();
  }, []);

  const [isPoseIdleActive, setIsPoseIdleActive] = useState(false);
  const poseIdleActiveRef = useRef(false);
  const poseIdleStartRef = useRef(0);
  const poseIdleBaseQuatRef = useRef<Map<LogicalBone, THREE.Quaternion>>(new Map());
  const poseIdleNodesRef = useRef<Map<LogicalBone, THREE.Object3D>>(new Map());

  const stopPoseIdle = useCallback((preservePose = false) => {
    poseIdleActiveRef.current = false;
    setIsPoseIdleActive(false);
    if (preservePose) {
      poseIdleNodesRef.current.clear();
      poseIdleBaseQuatRef.current.clear();
      return;
    }
    for (const [key, node] of poseIdleNodesRef.current.entries()) {
      const base = poseIdleBaseQuatRef.current.get(key);
      if (!base) continue;
      node.quaternion.copy(base);
      node.updateMatrixWorld(true);
    }
    poseIdleNodesRef.current.clear();
    poseIdleBaseQuatRef.current.clear();
  }, []);

  return useMemo(() => ({
    isProceduralPlaying,
    setIsProceduralPlaying,
    proceduralActiveRef,
    proceduralStartRef,
    proceduralBaseQuatRef,
    proceduralNodesRef,
    stopProcedural,
    isPoseIdleActive,
    setIsPoseIdleActive,
    poseIdleActiveRef,
    poseIdleStartRef,
    poseIdleBaseQuatRef,
    poseIdleNodesRef,
    stopPoseIdle,
  }), [
    isProceduralPlaying,
    stopProcedural,
    isPoseIdleActive,
    setIsPoseIdleActive,
    stopPoseIdle
  ]);
};
