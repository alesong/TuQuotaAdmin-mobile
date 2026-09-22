import React, { useCallback } from 'react';
import { FloatingGateButton } from './FloatingGateButton';
import { useAuth } from '../context/AuthContext';
import { Config } from '../constants/Config';

/**
 * Wraps FloatingGateButton with the API call logic.
 * Must be rendered inside AuthProvider so it has access to the token.
 */
export function FloatingGateProvider() {
  const { token } = useAuth();
  const [gateLoading, setGateLoading] = React.useState<string | null>(null);

  const handleOpenGate = useCallback(async (sid: string, sName: string) => {
    if (!token) return;
    setGateLoading(sid);
    try {
      const response = await fetch(`${Config.API_URL}/resident-services/open-gate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ serviceId: sid }),
      });
      const data = await response.json();
      if (!(response.ok && data.success)) {
        console.warn('Floating gate open failed:', data.message);
      }
    } catch (e) {
      console.warn('Floating gate: network error', e);
    } finally {
      setGateLoading(null);
    }
  }, [token]);

  return (
    <FloatingGateButton
      onOpenGate={handleOpenGate}
      gateLoading={gateLoading}
    />
  );
}
