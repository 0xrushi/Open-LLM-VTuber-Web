import React from 'react';
import { Vec3 } from '../types';
import { PoseCorrectionPanel } from './pose-correction-panel';
import { AnimationPanel } from './animation-panel';
import { RigDebugPanel } from './rig-debug-panel';
import { ActionGraphVisualizer } from './action-graph-visualizer';

interface UiOverlayProps {
  invertLegs: boolean;
  setInvertLegs: (val: boolean) => void;
  flipHips: boolean;
  setFlipHips: (val: boolean) => void;
  activePoseProfile: string;
  setActivePoseProfile: (val: string) => void;
  onApplyPoseProfile: (profile: string) => void;
  onCopyPose: () => void;
  clipNames: string[];
  selectedClipName: string;
  onClipSelect: (name: string) => void;
  isProceduralPlaying: boolean;
  onStartProcedural: () => void;
  onStopProcedural: () => void;
  isVrmaPlaying: boolean;
  isAnimationFrozen: boolean;
  onStopVrma: () => void;
  onResumeAnimation: () => void;
  showSkeleton: boolean;
  setShowSkeleton: (val: boolean) => void;
  wireframe: boolean;
  setWireframe: (val: boolean) => void;
  rigSearch: string;
  setRigSearch: (val: string) => void;
  selectedBone: string;
  setSelectedBone: (val: string) => void;
  rigBones: string[];
  rigRotDeg: Vec3;
  setRigRotDeg: (val: Vec3) => void;
  rigPos: Vec3;
  setRigPos: (val: Vec3) => void;
  onApplyRig: (bone: string, rot: Vec3, pos: Vec3) => void;
}

export const UiOverlay: React.FC<UiOverlayProps> = (props) => {
  const isAnyAnimationPlaying = props.isVrmaPlaying || props.isProceduralPlaying;

  return (
    <div style={{
      position: 'absolute',
      top: '16px',
      right: '16px',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: '12px',
      borderRadius: '8px',
      color: 'white',
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      fontFamily: 'sans-serif',
      fontSize: '12px',
      maxWidth: '280px',
      maxHeight: '80vh',
      overflow: 'auto'
    }}>
      <PoseCorrectionPanel
        invertLegs={props.invertLegs}
        setInvertLegs={props.setInvertLegs}
        flipHips={props.flipHips}
        setFlipHips={props.setFlipHips}
      />

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.3)', margin: '4px 0' }}></div>

      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Pose Profiles</div>
      <select
        value={props.activePoseProfile}
        onChange={(e) => props.setActivePoseProfile(e.target.value)}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.08)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '4px',
          padding: '4px 6px',
        }}
      >
        <option value="" style={{ color: 'black' }}>Reset</option>
        <option value="floor_sit_cross_leg" style={{ color: 'black' }}>Floor Sit (Crossed Legs)</option>
        <option value="chair_sit" style={{ color: 'black' }}>Chair Sit</option>
      </select>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => props.onApplyPoseProfile(props.activePoseProfile)}
          disabled={isAnyAnimationPlaying}
          style={{
            cursor: !isAnyAnimationPlaying ? 'pointer' : 'not-allowed',
            background: 'rgba(255,255,255,0.12)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '4px 8px',
            borderRadius: '4px',
            flex: 1,
          }}
        >
          Apply Pose
        </button>
        <button
          onClick={() => props.onApplyPoseProfile('')}
          disabled={isAnyAnimationPlaying}
          style={{
            cursor: !isAnyAnimationPlaying ? 'pointer' : 'not-allowed',
            background: 'rgba(255,255,255,0.12)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '4px 8px',
            borderRadius: '4px',
            flex: 1,
          }}
        >
          Reset Pose
        </button>
      </div>

      <button
        onClick={props.onCopyPose}
        style={{
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.12)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '4px 8px',
          borderRadius: '4px',
          width: '100%',
        }}
      >
        Copy Pose (All Joints)
      </button>

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.3)', margin: '4px 0' }}></div>

      <AnimationPanel
        clipNames={props.clipNames}
        selectedClipName={props.selectedClipName}
        onClipSelect={props.onClipSelect}
        isProceduralPlaying={props.isProceduralPlaying}
        onStartProcedural={props.onStartProcedural}
        onStopProcedural={props.onStopProcedural}
        isVrmaPlaying={props.isVrmaPlaying}
        isAnimationFrozen={props.isAnimationFrozen}
        onStopVrma={props.onStopVrma}
        onResumeAnimation={props.onResumeAnimation}
      />

      <div style={{ height: '1px', background: 'rgba(255,255,255,0.3)', margin: '4px 0' }}></div>

      <RigDebugPanel
        showSkeleton={props.showSkeleton}
        setShowSkeleton={props.setShowSkeleton}
        wireframe={props.wireframe}
        setWireframe={props.setWireframe}
        rigSearch={props.rigSearch}
        setRigSearch={props.setRigSearch}
        selectedBone={props.selectedBone}
        setSelectedBone={props.setSelectedBone}
        rigBones={props.rigBones}
        rigRotDeg={props.rigRotDeg}
        setRigRotDeg={props.setRigRotDeg}
        rigPos={props.rigPos}
        setRigPos={props.setRigPos}
        onApplyRig={props.onApplyRig}
        isAnyAnimationPlaying={isAnyAnimationPlaying}
      />
      <div style={{ height: '1px', background: 'rgba(255,255,255,0.3)', margin: '4px 0' }}></div>
      <ActionGraphVisualizer />
    </div>
  );
};
