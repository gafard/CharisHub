import { useState, useEffect, useRef } from 'react';

export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'weak' | 'offline';

function computeQuality(lossRate: number): NetworkQuality {
  if (lossRate < 0.01) return 'excellent';
  if (lossRate < 0.05) return 'good';
  if (lossRate < 0.1) return 'fair';
  return 'weak';
}

export function useNetworkQuality(peerConnections: Map<string, RTCPeerConnection>) {
  const [qualityMap, setQualityMap] = useState<Map<string, NetworkQuality>>(new Map());
  const prevStatsRef = useRef<Map<string, { packetsLost: number; packetsReceived: number; timestamp: number }>>(new Map());
  
  useEffect(() => {
    if (peerConnections.size === 0) {
      setQualityMap(new Map());
      return;
    }

    const interval = setInterval(async () => {
      const newQuality = new Map<string, NetworkQuality>();
      
      for (const [peerId, pc] of peerConnections) {
        if (pc.connectionState !== 'connected') continue;
        
        try {
          const stats = await pc.getStats();
          let currentLost = 0;
          let currentReceived = 0;
          
          stats.forEach((report) => {
            if (report.type === 'inbound-rtp' && (report.kind === 'audio' || report.kind === 'video')) {
              currentLost += (report.packetsLost || 0);
              currentReceived += (report.packetsReceived || 0);
            }
          });
          
          const prev = prevStatsRef.current.get(peerId);
          if (prev) {
            const deltaLost = currentLost - prev.packetsLost;
            const deltaReceived = currentReceived - prev.packetsReceived;
            const total = deltaLost + deltaReceived;
            const lossRate = total > 0 ? deltaLost / total : 0;
            
            newQuality.set(peerId, computeQuality(lossRate));
          }
          
          prevStatsRef.current.set(peerId, {
            packetsLost: currentLost,
            packetsReceived: currentReceived,
            timestamp: Date.now(),
          });
        } catch (err) {
          // Ignore stats errors
        }
      }
      
      setQualityMap(newQuality);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [peerConnections]);
  
  return qualityMap;
}
