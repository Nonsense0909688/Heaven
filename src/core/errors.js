// Shared error types and exit codes.
//
// Exit codes are part of Heaven's public contract: scripts and CI can tell
// *why* a command failed without parsing text.
export const EXIT = Object.freeze({
  OK: 0,
  USAGE: 1,    // bad flags, bad config, unresolved variables, internal errors
  HTTP: 2,     // server answered with 4xx/5xx
  NETWORK: 3,  // DNS, connection, TLS, timeout
  ASSERT: 4,   // an expectation / test / threshold failed
  DIFF: 5,     // `compare` found differences
});

/** An error whose message is meant for the user (printed as "error: ..."). */
export class HeavenError extends Error {
  constructor(message, exitCode = EXIT.USAGE) {
    super(message);
    this.name = 'HeavenError';
    this.exitCode = exitCode;
  }
}

/** The request never produced an HTTP answer (DNS, refused, TLS, timeout). */
export class NetworkError extends HeavenError {
  constructor(message, code) {
    super(message, EXIT.NETWORK);
    this.name = 'NetworkError';
    this.code = code;
  }
}
