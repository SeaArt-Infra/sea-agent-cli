export async function withRegisterErrorHint<T>(resource: string, examplePath: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (err) {
    if (!(err instanceof Error) || !err.message.startsWith("400:")) {
      throw err;
    }
    if (!isGenericBadRequest(err.message)) {
      throw err;
    }
    throw new Error(`${err.message}\n[hint] Check required fields and value types against ${examplePath}; run seaagent ${resource} register --help for payload notes.`);
  }
}

export function warnProviderNormalized(resource: string, payload: unknown, response: unknown): void {
  const requestedProvider = stringField(payload, "provider");
  const returnedProvider = findStringField(response, "provider");
  if (!requestedProvider || !returnedProvider || requestedProvider === returnedProvider) {
    return;
  }
  process.stderr.write(`[info] ${resource} provider "${requestedProvider}" normalized to "${returnedProvider}"; use the returned provider value for --provider filters\n`);
}

function findStringField(value: unknown, field: string): string {
  if (!value || typeof value !== "object") {
    return "";
  }
  const direct = stringField(value, field);
  if (direct) {
    return direct;
  }
  return findStringField((value as Record<string, unknown>).data, field)
    || findStringField((value as Record<string, unknown>).response, field);
}

function stringField(value: unknown, field: string): string {
  if (!value || typeof value !== "object") {
    return "";
  }
  const fieldValue = (value as Record<string, unknown>)[field];
  return typeof fieldValue === "string" ? fieldValue : "";
}

function isGenericBadRequest(message: string): boolean {
  const detail = message.replace(/^400:\s*/i, "").trim().toLowerCase();
  return detail === "bad request" || detail === "invalid request" || detail === "invalid argument" || detail === "validation failed";
}
