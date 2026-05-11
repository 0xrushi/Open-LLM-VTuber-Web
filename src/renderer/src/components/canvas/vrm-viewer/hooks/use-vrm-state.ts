import { useState } from 'react';
import { Vec3 } from '../types';

export const useVrmState = () => {
  const [invertLegs, setInvertLegs] = useState(true);
  const [flipHips, setFlipHips] = useState(true);
  const [activePoseProfile, setActivePoseProfile] = useState<string>('');
  
  // Rig Debug UI
  const [rigSearch, setRigSearch] = useState<string>('');
  const [selectedBone, setSelectedBone] = useState<string>('');
  const [rigRotDeg, setRigRotDeg] = useState<Vec3>({ x: 0, y: 0, z: 0 });
  const [rigPos, setRigPos] = useState<Vec3>({ x: 0, y: 0, z: 0 });
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [wireframe, setWireframe] = useState(false);

  // Transform UI
  const [vrmScale, setVrmScale] = useState(1.0);
  const [vrmPosX, setVrmPosX] = useState(0.0);
  const [vrmPosY, setVrmPosY] = useState(0.0);
  const [vrmPosZ, setVrmPosZ] = useState(0.0);
  const [vrmRotY, setVrmRotY] = useState(0.0);
  const [scenePos, setScenePos] = useState<Vec3>({ x: 0, y: 0, z: 0 });
  const [sceneRotDeg, setSceneRotDeg] = useState<Vec3>({ x: 0, y: 0, z: 0 });
  const [sceneScale, setSceneScale] = useState(1.0);

  return {
    invertLegs, setInvertLegs,
    flipHips, setFlipHips,
    activePoseProfile, setActivePoseProfile,
    rigSearch, setRigSearch,
    selectedBone, setSelectedBone,
    rigRotDeg, setRigRotDeg,
    rigPos, setRigPos,
    showSkeleton, setShowSkeleton,
    wireframe, setWireframe,
    vrmScale, setVrmScale,
    vrmPosX, setVrmPosX,
    vrmPosY, setVrmPosY,
    vrmPosZ, setVrmPosZ,
    vrmRotY, setVrmRotY,
    scenePos, setScenePos,
    sceneRotDeg, setSceneRotDeg,
    sceneScale, setSceneScale,
  };
};
