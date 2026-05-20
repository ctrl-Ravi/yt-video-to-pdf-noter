import React from 'react';

interface PermissionPromptProps {
  onAllow: () => void;
  onDecline: () => void;
}

export function PermissionPrompt({ onAllow, onDecline }: PermissionPromptProps) {
  return (
    <div style={{ padding: '16px', background: '#111827', border: '1px solid #374151', borderRadius: '6px', color: 'white', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
      <h3 style={{ fontWeight: 'bold', margin: '0 0 8px 0' }}>Permission Required</h3>
      <p style={{ fontSize: '14px', color: '#D1D5DB', margin: '0 0 16px 0' }}>
        YT Noter Pro needs permission to capture the screen to take screenshots of DRM-protected videos.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button 
          onClick={onDecline}
          style={{ padding: '4px 12px', fontSize: '14px', background: '#1F2937', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Decline
        </button>
        <button 
          onClick={onAllow}
          style={{ padding: '4px 12px', fontSize: '14px', background: '#2563EB', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          Allow
        </button>
      </div>
    </div>
  );
}
