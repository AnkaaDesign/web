type MessageType = "success" | "error" | "warning" | "info";
type NotifyOptions = { duration?: number; closable?: boolean };
type NotifyHandler = (type: MessageType, title: string, message?: string, options?: NotifyOptions) => void;
type RetryNotifyHandler = (title: string, description: string, url: string, method: string, attempt: number, maxAttempts: number) => void;
type DismissRetryHandler = (url: string, method: string) => void;

// Simple notification interface that can be overridden by platforms
export const notify = {
  _handler: null as NotifyHandler | null,
  _retryHandler: null as RetryNotifyHandler | null,
  _dismissRetryHandler: null as DismissRetryHandler | null,

  setHandler(handler: NotifyHandler) {
    this._handler = handler;
  },

  setRetryHandler(handler: RetryNotifyHandler) {
    this._retryHandler = handler;
  },

  setDismissRetryHandler(handler: DismissRetryHandler) {
    this._dismissRetryHandler = handler;
  },

  show(type: MessageType, title: string, message?: string, options?: NotifyOptions) {
    if (this._handler) {
      this._handler(type, title, message, options);
    } else {
      // Default fallback - just log to console
      console.log(`${type.toUpperCase()}: ${title}${message ? ` - ${message}` : ""}`);
    }
  },

  success(title: string, message?: string, options?: NotifyOptions) {
    this.show("success", title, message, options);
  },

  error(title: string, message?: string, options?: NotifyOptions) {
    this.show("error", title, message, options);
  },

  warning(title: string, message?: string, options?: NotifyOptions) {
    this.show("warning", title, message, options);
  },

  info(title: string, message?: string, options?: NotifyOptions) {
    this.show("info", title, message, options);
  },

  retry(title: string, description: string, url: string, method: string, attempt: number, maxAttempts: number) {
    if (this._retryHandler) {
      this._retryHandler(title, description, url, method, attempt, maxAttempts);
    } else {
      // Fallback to regular info notification
      this.info(title, `${description} (Tentativa ${attempt} de ${maxAttempts})`);
    }
  },

  dismissRetry(url: string, method: string) {
    if (this._dismissRetryHandler) {
      this._dismissRetryHandler(url, method);
    }
  },
};
