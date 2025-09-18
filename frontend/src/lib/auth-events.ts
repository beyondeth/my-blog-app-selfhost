/**
 * Global authentication event emitter
 * Synchronizes auth state across the entire app
 */

type AuthEventType = 'login' | 'logout' | 'token-refreshed' | 'auth-error';

interface AuthEvent {
  type: AuthEventType;
  payload?: any;
}

class AuthEventEmitter {
  private listeners: Map<AuthEventType, Set<(payload?: any) => void>> = new Map();

  on(event: AuthEventType, callback: (payload?: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  emit(event: AuthEventType, payload?: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(payload);
        } catch (error) {
          console.error(`Error in auth event listener for ${event}:`, error);
        }
      });
    }

    // Log for debugging
    console.log(`[AuthEvent] ${event}`, payload);
  }

  off(event: AuthEventType, callback?: (payload?: any) => void) {
    if (!callback) {
      // Remove all listeners for this event
      this.listeners.delete(event);
    } else {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
      }
    }
  }

  clear() {
    this.listeners.clear();
  }
}

export const authEvents = new AuthEventEmitter();

// Helper functions for common auth events
export const emitLogin = (user: any) => {
  authEvents.emit('login', user);
};

export const emitLogout = () => {
  authEvents.emit('logout');
};

export const emitTokenRefreshed = () => {
  authEvents.emit('token-refreshed');
};

export const emitAuthError = (error: string) => {
  authEvents.emit('auth-error', error);
};