// Analytics utility for Google Analytics tracking
// Provides type-safe event tracking with consistent naming

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
  if (typeof window !== 'undefined' && window.gtag) {
    try {
      window.gtag('event', eventName, {
        ...parameters,
        // Add timestamp for session tracking
        event_timestamp: new Date().toISOString(),
        // Add device type
        device_type: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      });
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
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