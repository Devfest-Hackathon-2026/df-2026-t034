// Retry only a transient overloaded service, once. Quota/authentication errors
// remain explicit user-visible failures; the handler's 45s deadline still applies.
export const GEMINI_RETRY_OPTIONS = {
  attempts: 2,
  httpStatusCodes: [503],
  initialDelay: 1,
  maxDelay: 1,
  jitter: 0,
};
