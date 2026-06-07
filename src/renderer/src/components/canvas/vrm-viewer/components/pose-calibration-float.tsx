import React, { useState } from 'react';
import { PoseCalibrationPanel } from './pose-calibration-panel';

type CalibrationObject = {
  id: string;
  humanName: string;
  hasSit: boolean;
  hasSleep: boolean;
};

type SitCalibration = {
  xOffset?: number;
  zOffset?: number;
  pelvisYOffset?: number;
};

type SleepCalibration = {
  xOffset?: number;
  zOffset?: number;
  surfaceYOffset?: number;
  hipsAboveSurfaceOffset?: number;
  yawOffset?: number;
  rootYOffset?: number;
};

type ObjectCalibration = {
  sit?: SitCalibration;
  sleep?: SleepCalibration;
};

interface PoseCalibrationFloatProps {
  calibrationObjects: CalibrationObject[];
  getObjectCalibration: (objectId: string) => ObjectCalibration | null;
  onSaveSitCalibration: (objectId: string, calibration: SitCalibration) => void;
  onSaveSleepCalibration: (objectId: string, calibration: SleepCalibration) => void;
  onCaptureCurrentSitCalibration: () => boolean;
  onCaptureCurrentSleepCalibration: () => boolean;
  onExportCalibration: () => void;
  onReapplySit: (objectId: string) => void;
  onReapplySleep: (objectId: string) => void;
  getActiveSitObjectId: () => string | null;
  getActiveSleepObjectId: () => string | null;
}

export const PoseCalibrationFloat: React.FC<PoseCalibrationFloatProps> = (props) => {
  const [open, setOpen] = useState(true);

  const shellStyle: React.CSSProperties = {
    position: 'absolute',
    left: '16px',
    top: '16px',
    zIndex: 105,
    color: '#d8ffe9',
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
    fontSize: '12px',
  };

  const buttonStyle: React.CSSProperties = {
    cursor: 'pointer',
    background: 'linear-gradient(180deg, rgba(5, 14, 18, 0.9), rgba(7, 22, 25, 0.78))',
    color: '#d8ffe9',
    border: '1px solid rgba(95, 243, 181, 0.38)',
    padding: '6px 10px',
    borderRadius: '6px',
    boxShadow: '0 0 0 1px rgba(0,0,0,0.65), 0 10px 28px rgba(0,0,0,0.35), 0 0 18px rgba(95,243,181,0.10)',
    letterSpacing: '0.04em',
  };

  return (
    <div style={shellStyle}>
      <button style={buttonStyle} onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide Calibration' : 'Show Calibration'}
      </button>
      {open && (
        <div
          style={{
            marginTop: '8px',
            background: 'linear-gradient(180deg, rgba(5, 14, 18, 0.86), rgba(7, 22, 25, 0.76))',
            padding: '12px',
            borderRadius: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            width: '280px',
            maxHeight: '70vh',
            overflow: 'auto',
            border: '1px solid rgba(95, 243, 181, 0.38)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.65), 0 18px 52px rgba(0,0,0,0.42), 0 0 28px rgba(95,243,181,0.11), inset 0 1px 0 rgba(255,255,255,0.07)',
            backdropFilter: 'blur(12px) saturate(130%)',
          }}
        >
          <PoseCalibrationPanel {...props} />
        </div>
      )}
    </div>
  );
};
