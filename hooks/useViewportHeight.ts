import { useEffect, useState, useCallback } from 'react';

interface ViewportConfig {
  enableFirefoxSupport?: boolean;
  enableKeyboardDetection?: boolean;
  modalOpen?: boolean;
}

export function useViewportHeight(config: ViewportConfig = {}) {
  const {
    enableFirefoxSupport = true,
    enableKeyboardDetection = false,
    modalOpen = false,
  } = config;

  const [isFirefox, setIsFirefox] = useState(false);
  const [hasVisualViewport, setHasVisualViewport] = useState(false);

  // Detect Firefox and visualViewport support on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const userAgent = navigator.userAgent;
    const firefoxMatch = userAgent.match(/Firefox\/(\d+)/);
    setIsFirefox(!!firefoxMatch);
    setHasVisualViewport('visualViewport' in window);
  }, []);

  // Core viewport update function
  const updateViewportHeight = useCallback(() => {
    if (typeof window === 'undefined') return;

    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);

    if (enableFirefoxSupport && isFirefox && hasVisualViewport && window.visualViewport) {
      const visualVh = window.visualViewport.height * 0.01;
      document.documentElement.style.setProperty('--visual-vh', `${visualVh}px`);
    }
  }, [isFirefox, hasVisualViewport, enableFirefoxSupport]);

  // Basic viewport management
  useEffect(() => {
    updateViewportHeight();
    window.addEventListener('resize', updateViewportHeight, { passive: true });
    window.addEventListener('orientationchange', updateViewportHeight, { passive: true });

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      window.removeEventListener('orientationchange', updateViewportHeight);
    };
  }, [updateViewportHeight]);

  // Modal close viewport fix (when modal closes, recalculate viewport)
  useEffect(() => {
    if (!modalOpen) {
      const delay = isFirefox ? 200 : 100;
      const timer = setTimeout(() => {
        updateViewportHeight();
        window.dispatchEvent(new Event('resize'));
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [modalOpen, isFirefox, updateViewportHeight]);

  // Advanced modal viewport handling (when modal is open)
  useEffect(() => {
    if (!modalOpen) return;

    let viewportRestoreTimeout: NodeJS.Timeout;
    const handleViewportRestore = () => {
      clearTimeout(viewportRestoreTimeout);
      viewportRestoreTimeout = setTimeout(updateViewportHeight, isFirefox ? 50 : 16);
    };

    // Use visualViewport API if available
    if (hasVisualViewport && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportRestore, { passive: true });
    }

    // Traditional focus events as fallback
    window.addEventListener('focusin', handleViewportRestore);
    window.addEventListener('focusout', handleViewportRestore);

    return () => {
      clearTimeout(viewportRestoreTimeout);
      if (hasVisualViewport && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportRestore);
      }
      window.removeEventListener('focusin', handleViewportRestore);
      window.removeEventListener('focusout', handleViewportRestore);
    };
  }, [modalOpen, isFirefox, hasVisualViewport, updateViewportHeight]);

  // Firefox keyboard detection (polls for height changes when modal is open)
  useEffect(() => {
    if (!enableKeyboardDetection || !isFirefox || !modalOpen) return;

    let lastWindowHeight = window.innerHeight;
    const firefoxKeyboardDetector = () => {
      const currentHeight = window.innerHeight;
      const heightDiff = Math.abs(currentHeight - lastWindowHeight);

      // If significant height change (> 150px), likely keyboard show/hide
      if (heightDiff > 150) {
        updateViewportHeight();
        lastWindowHeight = currentHeight;
      }
    };

    const interval = setInterval(firefoxKeyboardDetector, 100);
    return () => clearInterval(interval);
  }, [enableKeyboardDetection, isFirefox, modalOpen, updateViewportHeight]);

  return { isFirefox, hasVisualViewport, updateViewportHeight };
}
