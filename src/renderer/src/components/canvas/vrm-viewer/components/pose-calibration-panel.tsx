import React, { useEffect, useMemo, useState } from 'react';

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

interface PoseCalibrationPanelProps {
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

const toNumber = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const fmt = (value?: number) => String(value ?? 0);

export const PoseCalibrationPanel: React.FC<PoseCalibrationPanelProps> = ({
  calibrationObjects,
  getObjectCalibration,
  onSaveSitCalibration,
  onSaveSleepCalibration,
  onCaptureCurrentSitCalibration,
  onCaptureCurrentSleepCalibration,
  onExportCalibration,
  onReapplySit,
  onReapplySleep,
  getActiveSitObjectId,
  getActiveSleepObjectId,
}) => {
  const [mode, setMode] = useState<'sit' | 'sleep'>('sit');
  const [selectedObjectId, setSelectedObjectId] = useState('');
  const [sitX, setSitX] = useState('0');
  const [sitZ, setSitZ] = useState('0');
  const [sitPelvisY, setSitPelvisY] = useState('0');
  const [sleepX, setSleepX] = useState('0');
  const [sleepZ, setSleepZ] = useState('0');
  const [sleepSurfaceY, setSleepSurfaceY] = useState('0');
  const [sleepHipsY, setSleepHipsY] = useState('0.1');
  const [sleepRootY, setSleepRootY] = useState('0');
  const [sleepYaw, setSleepYaw] = useState('0');

  const modeObjects = useMemo(() => (
    calibrationObjects.filter((object) => (mode === 'sit' ? object.hasSit : object.hasSleep))
  ), [calibrationObjects, mode]);

  useEffect(() => {
    if (!modeObjects.length) {
      setSelectedObjectId('');
      return;
    }
    if (!modeObjects.some((object) => object.id === selectedObjectId)) {
      setSelectedObjectId(modeObjects[0].id);
    }
  }, [modeObjects, selectedObjectId]);

  useEffect(() => {
    if (!selectedObjectId) return;
    const calibration = getObjectCalibration(selectedObjectId);
    if (mode === 'sit') {
      setSitX(fmt(calibration?.sit?.xOffset));
      setSitZ(fmt(calibration?.sit?.zOffset));
      setSitPelvisY(fmt(calibration?.sit?.pelvisYOffset));
      return;
    }
    setSleepX(fmt(calibration?.sleep?.xOffset));
    setSleepZ(fmt(calibration?.sleep?.zOffset));
    setSleepSurfaceY(fmt(calibration?.sleep?.surfaceYOffset));
    setSleepHipsY(fmt(calibration?.sleep?.hipsAboveSurfaceOffset ?? 0.1));
    setSleepRootY(fmt(calibration?.sleep?.rootYOffset));
    setSleepYaw(fmt(calibration?.sleep?.yawOffset));
  }, [selectedObjectId, mode, getObjectCalibration]);

  const activeModeObjectId = mode === 'sit' ? getActiveSitObjectId() : getActiveSleepObjectId();
  const hasObjects = modeObjects.length > 0;
  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.08)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '4px',
    padding: '4px 6px',
  };
  const buttonStyle: React.CSSProperties = {
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.12)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.2)',
    padding: '4px 8px',
    borderRadius: '4px',
  };

  const save = (reapply: boolean) => {
    if (!selectedObjectId) return;
    if (mode === 'sit') {
      onSaveSitCalibration(selectedObjectId, {
        xOffset: toNumber(sitX),
        zOffset: toNumber(sitZ),
        pelvisYOffset: toNumber(sitPelvisY),
      });
      if (reapply) onReapplySit(selectedObjectId);
      return;
    }
    onSaveSleepCalibration(selectedObjectId, {
      xOffset: toNumber(sleepX),
      zOffset: toNumber(sleepZ),
      surfaceYOffset: toNumber(sleepSurfaceY),
      hipsAboveSurfaceOffset: toNumber(sleepHipsY),
      rootYOffset: toNumber(sleepRootY),
      yawOffset: toNumber(sleepYaw),
    });
    if (reapply) onReapplySleep(selectedObjectId);
  };

  const captureCurrent = () => {
    if (mode === 'sit') {
      if (onCaptureCurrentSitCalibration()) {
        const id = getActiveSitObjectId();
        if (id) setSelectedObjectId(id);
      }
      return;
    }
    if (onCaptureCurrentSleepCalibration()) {
      const id = getActiveSleepObjectId();
      if (id) setSelectedObjectId(id);
    }
  };

  return (
    <>
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Pose Calibration</div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => setMode('sit')}
          style={{
            cursor: 'pointer',
            background: mode === 'sit' ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.1)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.25)',
            padding: '4px 8px',
            borderRadius: '4px',
            flex: 1,
          }}
        >
          Sit
        </button>
        <button
          onClick={() => setMode('sleep')}
          style={{
            cursor: 'pointer',
            background: mode === 'sleep' ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.1)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.25)',
            padding: '4px 8px',
            borderRadius: '4px',
            flex: 1,
          }}
        >
          Sleep
        </button>
      </div>

      <select
        value={selectedObjectId}
        onChange={(e) => setSelectedObjectId(e.target.value)}
        disabled={!hasObjects}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.08)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '4px',
          padding: '4px 6px',
          marginTop: '6px',
        }}
      >
        {!hasObjects && <option style={{ color: 'black' }}>No targets</option>}
        {modeObjects.map((object) => (
          <option key={object.id} value={object.id} style={{ color: 'black' }}>
            {object.humanName}
          </option>
        ))}
      </select>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span>{mode === 'sit' ? 'X Offset' : 'X Offset'}</span>
          <input
            style={inputStyle}
            value={mode === 'sit' ? sitX : sleepX}
            onChange={(e) => (mode === 'sit' ? setSitX(e.target.value) : setSleepX(e.target.value))}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span>Z Offset</span>
          <input
            style={inputStyle}
            value={mode === 'sit' ? sitZ : sleepZ}
            onChange={(e) => (mode === 'sit' ? setSitZ(e.target.value) : setSleepZ(e.target.value))}
          />
        </label>
        {mode === 'sit' ? (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '2px', gridColumn: '1 / span 2' }}>
            <span>Pelvis Y Offset</span>
            <input style={inputStyle} value={sitPelvisY} onChange={(e) => setSitPelvisY(e.target.value)} />
          </label>
        ) : (
          <>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>Surface Y Offset</span>
              <input style={inputStyle} value={sleepSurfaceY} onChange={(e) => setSleepSurfaceY(e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>Root Y Offset</span>
              <input style={inputStyle} value={sleepRootY} onChange={(e) => setSleepRootY(e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>Hips Above Surface</span>
              <input style={inputStyle} value={sleepHipsY} onChange={(e) => setSleepHipsY(e.target.value)} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span>Yaw Offset (rad)</span>
              <input style={inputStyle} value={sleepYaw} onChange={(e) => setSleepYaw(e.target.value)} />
            </label>
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
        <button style={buttonStyle} onClick={() => save(false)} disabled={!selectedObjectId}>Save</button>
        <button style={buttonStyle} onClick={() => save(true)} disabled={!selectedObjectId}>Save + Reapply</button>
        <button style={buttonStyle} onClick={captureCurrent}>Capture Current</button>
        <button style={buttonStyle} onClick={onExportCalibration}>Export JSON</button>
      </div>

      <button
        style={{ ...buttonStyle, marginTop: '6px', width: '100%' }}
        onClick={() => activeModeObjectId && setSelectedObjectId(activeModeObjectId)}
        disabled={!activeModeObjectId}
      >
        Use Active {mode === 'sit' ? 'Sit' : 'Sleep'} Target
      </button>
    </>
  );
};
