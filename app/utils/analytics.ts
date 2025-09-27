// Analytics utility for Google Analytics tracking
// Provides type-safe event tracking with consistent naming
// Optimized for mobile performance with batching and throttling

// Performance optimization: Event batching for mobile
let eventQueue: Array<{ name: string; params: Record<string, unknown> }> = [];
let batchTimer: number | null = null;

const flushEvents = () => {
  if (eventQueue.length === 0) return;

  if (typeof window !== 'undefined' && window.gtag) {
    try {
      // Process events in batch
      eventQueue.forEach(({ name, params }) => {
        window.gtag('event', name, params);
      });
    } catch (error) {
      console.error('Batch analytics error:', error);
    }
  }

  eventQueue = [];
  batchTimer = null;
};

const scheduleEventFlush = () => {
  if (batchTimer) return;

  // Use longer delay on mobile for better performance
  const isMobile = typeof window !== 'undefined' && /Mobile|Android|iPhone/i.test(navigator.userAgent);
  const delay = isMobile ? 2000 : 500;

  batchTimer = window.setTimeout(flushEvents, delay);
};

type EventCategory = 'setup' | 'interaction' | 'engagement' | 'navigation';

interface BaseEventParams {
  event_category?: EventCategory;
  event_label?: string;
  value?: number;
}

interface SetupEventParams extends BaseEventParams {
  method?: 'custom' | 'random' | 'numbers';
  count?: number;
  has_team_name?: boolean;
}

interface InteractionEventParams extends BaseEventParams {
  segments?: number;
  spin_power?: number;
  result?: string;
  is_respin?: boolean;
  velocity?: number;
  close_method?: 'button' | 'backdrop' | 'x' | 'remove';
}

interface ValidationEventParams extends BaseEventParams {
  warning_type?: 'min_names' | 'long_names' | 'duplicates';
  count?: number;
}

type EventParams = SetupEventParams | InteractionEventParams | ValidationEventParams;

/**
 * Track an event to Google Analytics
 */
export const trackEvent = (eventName: string, parameters?: EventParams) => {
  // Use batching for non-critical events on mobile
  const isMobile = typeof window !== 'undefined' && /Mobile|Android|iPhone/i.test(navigator.userAgent);
  const isRealTimeEvent = eventName.includes('conversion') || eventName.includes('page_view');

  const eventParams = {
    ...parameters,
    // Add timestamp for session tracking
    event_timestamp: new Date().toISOString(),
    // Add device type
    device_type: isMobile ? 'mobile' : 'desktop',
  };

  // For real-time events or desktop, send immediately
  if (!isMobile || isRealTimeEvent) {
    if (typeof window !== 'undefined' && window.gtag) {
      try {
        window.gtag('event', eventName, eventParams);
      } catch (error) {
        console.error('Analytics tracking error:', error);
      }
    }
  } else {
    // Batch non-critical events on mobile
    eventQueue.push({ name: eventName, params: eventParams });
    scheduleEventFlush();
  }
};

/**
 * Setup and Input Events
 */
export const trackNameInputOpened = () => {
  trackEvent('name_input_opened', {
    event_category: 'setup',
    event_label: 'modal_opened'
  });
};

export const trackInputMethodSelected = (method: 'custom' | 'random' | 'numbers') => {
  trackEvent('input_method_selected', {
    event_category: 'setup',
    method,
    event_label: `method_${method}`
  });
};

export const trackCustomNamesSubmitted = (count: number, hasTeamName: boolean) => {
  trackEvent('custom_names_submitted', {
    event_category: 'setup',
    count,
    has_team_name: hasTeamName,
    event_label: `names_${count}`
  });
};

export const trackRandomSelection = (type: 'names' | 'numbers', count: number) => {
  trackEvent('random_selection', {
    event_category: 'setup',
    method: type === 'names' ? 'random' : 'numbers',
    count,
    event_label: `${type}_${count}`
  });
};

export const trackValidationWarning = (warningType: 'min_names' | 'long_names' | 'duplicates', details?: { count?: number }) => {
  trackEvent('validation_warning', {
    event_category: 'setup',
    warning_type: warningType,
    event_label: `warning_${warningType}`,
    ...details
  });
};

export const trackTeamNameSet = (hasTeamName: boolean) => {
  trackEvent('team_name_added', {
    event_category: 'setup',
    event_label: hasTeamName ? 'team_name_set' : 'team_name_empty',
    value: hasTeamName ? 1 : 0
  });
};

/**
 * Wheel Interaction Events
 */
export const trackWheelDragStart = () => {
  trackEvent('wheel_drag_start', {
    event_category: 'interaction',
    event_label: 'drag_initiated'
  });
};

export const trackWheelDragEnd = (velocity: number) => {
  trackEvent('wheel_drag_end', {
    event_category: 'interaction',
    velocity: Math.round(velocity * 100) / 100,
    event_label: 'drag_completed'
  });
};

export const trackSpinInitiated = (segments: number, spinPower: number) => {
  trackEvent('spin_initiated', {
    event_category: 'interaction',
    segments,
    spin_power: Math.round(spinPower * 100),
    event_label: `spin_${segments}_segments`
  });
};

export const trackSpinCompleted = (result: string, segments: number, isRespin: boolean) => {
  trackEvent('spin_completed', {
    event_category: 'interaction',
    result,
    segments,
    is_respin: isRespin,
    event_label: isRespin ? 'respin_landed' : 'winner_selected'
  });
};

export const trackWinnerAcknowledged = (closeMethod: 'button' | 'backdrop' | 'x' | 'remove') => {
  trackEvent('winner_acknowledged', {
    event_category: 'interaction',
    close_method: closeMethod,
    event_label: `closed_via_${closeMethod}`
  });
};

/**
 * Engagement Events
 */
export const trackFairnessChecked = () => {
  trackEvent('fairness_checked', {
    event_category: 'engagement',
    event_label: 'fairness_popup_viewed'
  });
};

export const trackWheelReset = (hadCustomNames: boolean) => {
  trackEvent('wheel_reset', {
    event_category: 'engagement',
    event_label: hadCustomNames ? 'reset_custom' : 'reset_random',
    value: hadCustomNames ? 1 : 0
  });
};

export const trackRespinTriggered = () => {
  trackEvent('respin_triggered', {
    event_category: 'interaction',
    event_label: 'free_spin_activated'
  });
};

/**
 * Modal Events
 */
export const trackModalClosed = (modalType: string, closeMethod: string) => {
  trackEvent('modal_closed', {
    event_category: 'navigation',
    event_label: `${modalType}_${closeMethod}`
  });
};

/**
 * Session Events
 */
let sessionStartTime: number | null = null;
let spinCount = 0;

export const startSession = () => {
  sessionStartTime = Date.now();
  spinCount = 0;
  trackEvent('session_started', {
    event_category: 'engagement',
    event_label: 'session_begin'
  });
};

export const incrementSpinCount = () => {
  spinCount++;
};

export const endSession = () => {
  if (sessionStartTime) {
    const duration = Math.round((Date.now() - sessionStartTime) / 1000);
    trackEvent('session_ended', {
      event_category: 'engagement',
      event_label: 'session_complete',
      value: duration
    });

    trackEvent('session_stats', {
      event_category: 'engagement',
      event_label: `spins_${spinCount}`,
      value: spinCount
    });
  }
};

/**
 * Google Ads Conversion Tracking
 * Track conversion events for Google Ads campaigns
 */
const GOOGLE_ADS_ID = 'AW-17581138422';

interface ConversionData {
  send_to: string;
  value?: number;
  currency: string;
  transaction_id?: string;
}

export const trackConversion = (
  conversionLabel: string,
  value?: number,
  currency: string = 'USD',
  transactionId?: string
) => {
  if (typeof window !== 'undefined' && window.gtag) {
    try {
      const conversionData: ConversionData = {
        'send_to': `${GOOGLE_ADS_ID}/${conversionLabel}`,
        'value': value,
        'currency': currency
      };

      // Add transaction ID if provided (helps prevent duplicate conversions)
      if (transactionId) {
        conversionData['transaction_id'] = transactionId;
      }

      window.gtag('event', 'conversion', conversionData);
    } catch (error) {
      console.error('Conversion tracking error:', error);
    }
  }
};

/**
 * Track Google Ads conversion for spin button clicks
 * This is the specific conversion tracking for the outbound click campaign
 */
export const trackSpinButtonConversion = (callback?: () => void) => {
  if (typeof window !== 'undefined' && window.gtag) {
    try {
      window.gtag('event', 'conversion', {
        'send_to': 'AW-17581138422/Gt9zCIS84Z4bEPbDq79B',
        'event_callback': callback
      });
    } catch (error) {
      console.error('Spin button conversion tracking error:', error);
      // Call callback even if tracking fails to not break functionality
      if (callback) callback();
    }
  } else {
    // Call callback even if gtag is not available
    if (callback) callback();
  }
};

/**
 * Common conversion events
 */
export const trackWheelUsageConversion = () => {
  // Track when user successfully completes a wheel spin
  trackConversion('wheel_usage', 1.0);
};

export const trackEngagementConversion = (engagementLevel: 'low' | 'medium' | 'high') => {
  // Track different engagement levels
  const values = {
    low: 0.5,
    medium: 1.0,
    high: 2.0
  };
  trackConversion('user_engagement', values[engagementLevel]);
};

export const trackSignupConversion = () => {
  // Track when user signs up (if you add authentication later)
  trackConversion('signup', 10.0);
};

export const trackPremiumConversion = (planValue: number) => {
  // Track premium plan conversions (if you add paid features)
  trackConversion('premium_purchase', planValue);
};