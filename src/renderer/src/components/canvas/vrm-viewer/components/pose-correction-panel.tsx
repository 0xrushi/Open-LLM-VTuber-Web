import React from 'react';

interface PoseCorrectionPanelProps {
  invertLegs: boolean;
  setInvertLegs: (val: boolean) => void;
  flipHips: boolean;
  setFlipHips: (val: boolean) => void;
}

export const PoseCorrectionPanel: React.FC<PoseCorrectionPanelProps> = ({
  invertLegs,
  setInvertLegs,
  flipHips,
  setFlipHips,
}) => {
  return (
    <>
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Pose Corrections</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
        <input 
          type="checkbox" 
          checked={invertLegs} 
          onChange={(e) => setInvertLegs(e.target.checked)}
        />
        Invert Legs
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
        <input 
          type="checkbox" 
          checked={flipHips} 
          onChange={(e) => setFlipHips(e.target.checked)}
        />
        Flip Hips (180°)
      </label>
    </>
  );
};
