import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSocket } from './useSocket';

export function useOrderNotifications(customerName?: string) {
  const [notification, setNotification] = useState<any>(null);
  const [showAlert, setShowAlert] = useState(false);

  const handleOrderCompleted = useCallback((data: any) => {
    // Show notification
    setNotification(data);
    setShowAlert(true);

    // Browser notification vibration
    try {
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200]); // vibrate pattern
      }

      // Try audio notification - play a simple beep
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // A5 note
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      console.error('[NOTIFICATION] Error playing sound:', e);
    }
  }, []);

  const events = useMemo(
    () => (customerName ? { 'order-completed-notification': handleOrderCompleted } : undefined),
    [customerName, handleOrderCompleted]
  );

  useSocket({
    room: customerName ? `customer-${customerName}` : undefined,
    events,
  });

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (!showAlert) return;
    const timer = setTimeout(() => setShowAlert(false), 5000);
    return () => clearTimeout(timer);
  }, [showAlert]);

  return { notification, showAlert, setShowAlert };
}
