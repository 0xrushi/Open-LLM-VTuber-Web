import React from 'react';
import { Vec3 } from '../types';

interface RigDebugPanelProps {
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
  isAnyAnimationPlaying: boolean;
}

export const RigDebugPanel: React.FC<RigDebugPanelProps> = ({
  showSkeleton,
  setShowSkeleton,
  wireframe,
  setWireframe,
  rigSearch,
  setRigSearch,
  selectedBone,
  setSelectedBone,
  rigBones,
  rigRotDeg,
  setRigRotDeg,
  rigPos,
  setRigPos,
  onApplyRig,
  isAnyAnimationPlaying,
}) => {
  return (
    <>
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Rig Debug</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={showSkeleton}
          onChange={(e) => setShowSkeleton(e.target.checked)}
        />
        Skeleton
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={wireframe}
          onChange={(e) => setWireframe(e.target.checked)}
        />
        Wireframe
      </label>

      <input
        value={rigSearch}
        onChange={(e) => setRigSearch(e.target.value)}
        placeholder="Search bone..."
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.08)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '4px',
          padding: '4px 6px',
          marginTop: '4px'
        }}
      />

      <select
        value={selectedBone}
        onChange={(e) => setSelectedBone(e.target.value)}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.08)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '4px',
          padding: '4px 6px',
          marginTop: '4px'
        }}
      >
        {rigBones
          .filter((b) => b.toLowerCase().includes(rigSearch.toLowerCase()))
          .slice(0, 200)
          .map((b) => (
            <option key={b} value={b} style={{ color: 'black' }}>{b}</option>
          ))}
      </select>

      <div style={{ opacity: 0.85, marginTop: '8px' }}>Rotation (deg)</div>
      {(['x', 'y', 'z'] as const).map((axis) => (
        <label key={axis} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px' }}>{axis.toUpperCase()}</span>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            disabled={!selectedBone || isAnyAnimationPlaying}
            value={Math.round(rigRotDeg[axis])}
            onChange={(e) => {
              const next = { ...rigRotDeg, [axis]: Number(e.target.value) } as Vec3;
              setRigRotDeg(next);
              if (selectedBone) onApplyRig(selectedBone, next, rigPos);
            }}
            style={{ flex: 1 }}
          />
          <span style={{ width: '44px', textAlign: 'right' }}>{Math.round(rigRotDeg[axis])}</span>
        </label>
      ))}

      <div style={{ opacity: 0.85, marginTop: '8px' }}>Translation</div>
      {(['x', 'y', 'z'] as const).map((axis) => (
        <label key={axis} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px' }}>{axis.toUpperCase()}</span>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.01}
            disabled={!selectedBone || isAnyAnimationPlaying}
            value={rigPos[axis]}
            onChange={(e) => {
              const next = { ...rigPos, [axis]: Number(e.target.value) } as Vec3;
              setRigPos(next);
              if (selectedBone) onApplyRig(selectedBone, rigRotDeg, next);
            }}
            style={{ flex: 1 }}
          />
          <span style={{ width: '44px', textAlign: 'right' }}>{rigPos[axis].toFixed(2)}</span>
        </label>
      ))}
    </>
  );
};
