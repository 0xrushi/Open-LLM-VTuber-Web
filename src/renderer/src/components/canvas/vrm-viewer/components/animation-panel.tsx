import React from 'react';

interface AnimationPanelProps {
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
}

export const AnimationPanel: React.FC<AnimationPanelProps> = ({
  clipNames,
  selectedClipName,
  onClipSelect,
  isProceduralPlaying,
  onStartProcedural,
  onStopProcedural,
  isVrmaPlaying,
  isAnimationFrozen,
  onStopVrma,
  onResumeAnimation,
}) => {
  const isAnyAnimationPlaying = isVrmaPlaying || isProceduralPlaying;

  return (
    <>
      <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>VRM Animation</div>
      {clipNames.length > 0 && (
        <>
          <div style={{ opacity: 0.85 }}>Embedded clips</div>
          <select
            value={selectedClipName}
            onChange={(e) => onClipSelect(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.08)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '4px',
              padding: '4px 6px',
            }}
          >
            {clipNames.map((name) => (
              <option key={name} value={name} style={{ color: 'black' }}>
                {name}
              </option>
            ))}
          </select>
        </>
      )}
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        {!isProceduralPlaying ? (
          <button
            onClick={onStartProcedural}
            disabled={isVrmaPlaying}
            style={{
              cursor: !isVrmaPlaying ? 'pointer' : 'not-allowed',
              background: 'rgba(255,255,255,0.12)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              padding: '4px 8px',
              borderRadius: '4px',
              flex: 1,
            }}
          >
            Clap Hands
          </button>
        ) : (
          <button
            onClick={onStopProcedural}
            style={{
              cursor: 'pointer',
              background: '#e53e3e',
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '4px',
              flex: 1,
            }}
          >
            Stop Demo
          </button>
        )}

        <button
          onClick={onStopVrma}
          disabled={!isVrmaPlaying}
          style={{
            cursor: isVrmaPlaying ? 'pointer' : 'not-allowed',
            background: isVrmaPlaying ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '4px 8px',
            borderRadius: '4px',
            flex: 1,
          }}
        >
          Stop Clip
        </button>
      </div>

      <div style={{ marginTop: '8px' }}>
        {!isAnyAnimationPlaying ? (
          <button
              onClick={onResumeAnimation}
              disabled={!isAnimationFrozen}
              style={{
                  cursor: isAnimationFrozen ? 'pointer' : 'not-allowed',
                  background: isAnimationFrozen ? '#3182ce' : 'rgba(255,255,255,0.06)',
                  color: 'white',
                  border: isAnimationFrozen ? 'none' : '1px solid rgba(255,255,255,0.2)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  width: '100%'
              }}
          >
              Resume Animation
          </button>
        ) : (
          <button 
              onClick={onStopVrma}
              style={{ 
                  cursor: 'pointer', 
                  background: '#e53e3e', 
                  color: 'white', 
                  border: 'none', 
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  width: '100%'
              }}
          >
              Stop Animation
          </button>
        )}
      </div>
    </>
  );
};
