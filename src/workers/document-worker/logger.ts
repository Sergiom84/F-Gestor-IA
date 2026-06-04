type LogContext = Record<string, unknown>;

function writeLog(level: "info" | "error", event: string, context: LogContext): void {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...context
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  console.info(line);
}

export function logInfo(event: string, context: LogContext = {}): void {
  writeLog("info", event, context);
}

export function logError(event: string, error: unknown, context: LogContext = {}): void {
  writeLog("error", event, {
    ...context,
    error: error instanceof Error
      ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
      : String(error)
  });
}
