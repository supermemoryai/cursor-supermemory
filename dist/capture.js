import { createRequire } from "node:module";
var __defProp = Object.defineProperty;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// src/hooks/capture.ts
import { createHash as createHash4 } from "node:crypto";

// src/config.ts
import path2 from "node:path";
import os2 from "node:os";
import fs2 from "node:fs";

// src/auth.ts
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
var CREDENTIALS_DIR = path.join(os.homedir(), ".supermemory-cursor");
var CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "credentials.json");
var AUTH_URL = process.env.SUPERMEMORY_AUTH_URL || "https://console.supermemory.ai/auth/connect";
function loadCredentials() {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE))
      return null;
    const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
    if (data.apiKey)
      return data;
    return null;
  } catch {
    return null;
  }
}

// src/config.ts
var GLOBAL_CONFIG_PATH = path2.join(os2.homedir(), ".config", "cursor", "supermemory.json");
var DEFAULTS = {
  baseUrl: null,
  similarityThreshold: 0.55,
  maxMemories: 10,
  maxProjectMemories: 5,
  injectProfile: true,
  signalExtraction: false,
  signalKeywords: ["remember", "architecture", "decision", "bug", "fix"],
  signalTurnsBefore: 3,
  repoContainerTag: null,
  userContainerTag: null,
  projectContainerTag: null
};
function readJson(filePath) {
  try {
    if (!fs2.existsSync(filePath))
      return null;
    return JSON.parse(fs2.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}
function findProjectConfig(cwd) {
  let dir = cwd;
  while (true) {
    const configPath = path2.join(dir, ".cursor", ".supermemory", "config.json");
    const data = readJson(configPath);
    if (data)
      return data;
    const parent = path2.dirname(dir);
    if (parent === dir)
      break;
    dir = parent;
  }
  return null;
}
function loadConfig(cwd) {
  const projectConfig = findProjectConfig(cwd || process.cwd());
  const globalConfig = readJson(GLOBAL_CONFIG_PATH);
  const merged = { ...DEFAULTS, ...globalConfig, ...projectConfig };
  return {
    apiKey: process.env.SUPERMEMORY_API_KEY ?? merged.apiKey ?? null,
    baseUrl: process.env.SUPERMEMORY_API_URL ?? process.env.SUPERMEMORY_BASE_URL ?? merged.baseUrl ?? null,
    apiVersion: process.env.SUPERMEMORY_API_VERSION ?? merged.apiVersion,
    similarityThreshold: merged.similarityThreshold,
    maxMemories: merged.maxMemories,
    maxProjectMemories: merged.maxProjectMemories,
    injectProfile: merged.injectProfile,
    signalExtraction: merged.signalExtraction,
    signalKeywords: Array.isArray(merged.signalKeywords) ? merged.signalKeywords.filter((keyword) => typeof keyword === "string") : DEFAULTS.signalKeywords,
    signalTurnsBefore: merged.signalTurnsBefore,
    repoContainerTag: merged.repoContainerTag,
    userContainerTag: merged.userContainerTag,
    projectContainerTag: merged.projectContainerTag
  };
}
function getApiKey(config) {
  if (config.apiKey)
    return config.apiKey;
  const creds = loadCredentials();
  return creds?.apiKey ?? null;
}

// src/hook-api.ts
import { createHash, createHmac } from "node:crypto";

// node_modules/supermemory/dist/esm/generated/core/auth/AuthProvider.js
function isAuthProvider(value) {
  return typeof value === "object" && value !== null && "getAuthRequest" in value && typeof value.getAuthRequest === "function";
}
// node_modules/supermemory/dist/esm/generated/core/auth/NoOpAuthProvider.js
class NoOpAuthProvider {
  getAuthRequest() {
    return Promise.resolve({ headers: {} });
  }
}
// node_modules/supermemory/dist/esm/generated/core/fetcher/EndpointSupplier.js
var EndpointSupplier = {
  get: async (supplier, arg) => {
    if (typeof supplier === "function") {
      return supplier(arg);
    } else {
      return supplier;
    }
  }
};

// node_modules/supermemory/dist/esm/generated/core/json.js
var toJson = (value, replacer, space) => {
  return JSON.stringify(value, replacer, space);
};
function fromJson(text, reviver) {
  return JSON.parse(text, reviver);
}

// node_modules/supermemory/dist/esm/generated/core/logging/logger.js
var LogLevel = {
  Debug: "debug",
  Info: "info",
  Warn: "warn",
  Error: "error"
};
var logLevelMap = {
  [LogLevel.Debug]: 1,
  [LogLevel.Info]: 2,
  [LogLevel.Warn]: 3,
  [LogLevel.Error]: 4
};

class ConsoleLogger {
  debug(message, ...args) {
    console.debug(message, ...args);
  }
  info(message, ...args) {
    console.info(message, ...args);
  }
  warn(message, ...args) {
    console.warn(message, ...args);
  }
  error(message, ...args) {
    console.error(message, ...args);
  }
}

class Logger {
  level;
  logger;
  silent;
  constructor(config) {
    this.level = logLevelMap[config.level];
    this.logger = config.logger;
    this.silent = config.silent;
  }
  shouldLog(level) {
    return !this.silent && this.level <= logLevelMap[level];
  }
  isDebug() {
    return this.shouldLog(LogLevel.Debug);
  }
  debug(message, ...args) {
    if (this.isDebug()) {
      this.logger.debug(message, ...args);
    }
  }
  isInfo() {
    return this.shouldLog(LogLevel.Info);
  }
  info(message, ...args) {
    if (this.isInfo()) {
      this.logger.info(message, ...args);
    }
  }
  isWarn() {
    return this.shouldLog(LogLevel.Warn);
  }
  warn(message, ...args) {
    if (this.isWarn()) {
      this.logger.warn(message, ...args);
    }
  }
  isError() {
    return this.shouldLog(LogLevel.Error);
  }
  error(message, ...args) {
    if (this.isError()) {
      this.logger.error(message, ...args);
    }
  }
}
function createLogger(config) {
  if (config == null) {
    return defaultLogger;
  }
  if (config instanceof Logger) {
    return config;
  }
  config = config ?? {};
  config.level ??= LogLevel.Info;
  config.logger ??= new ConsoleLogger;
  config.silent ??= true;
  return new Logger(config);
}
var defaultLogger = new Logger({
  level: LogLevel.Info,
  logger: new ConsoleLogger,
  silent: true
});

// node_modules/supermemory/dist/esm/generated/core/url/qs.js
var defaultQsOptions = {
  arrayFormat: "indices",
  encode: true
};
function encodeValue(value, shouldEncode) {
  if (value === undefined) {
    return "";
  }
  if (value === null) {
    return "";
  }
  const stringValue = String(value);
  return shouldEncode ? encodeURIComponent(stringValue) : stringValue;
}
function stringifyObject(obj, prefix = "", options) {
  const parts = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value == null) {
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        continue;
      }
      const effectiveFormat = options.arrayFormat;
      if (effectiveFormat === "comma") {
        const encodedKey = options.encode ? encodeURIComponent(fullKey) : fullKey;
        const encodedValues = value.filter((item) => item !== undefined && item !== null).map((item) => encodeValue(item, options.encode));
        if (encodedValues.length > 0) {
          parts.push(`${encodedKey}=${encodedValues.join(",")}`);
        }
      } else {
        for (let i = 0;i < value.length; i++) {
          const item = value[i];
          if (item == null) {
            continue;
          }
          if (typeof item === "object" && !Array.isArray(item) && item !== null) {
            const arrayKey = effectiveFormat === "indices" ? `${fullKey}[${i}]` : fullKey;
            parts.push(...stringifyObject(item, arrayKey, options));
          } else {
            const arrayKey = effectiveFormat === "indices" ? `${fullKey}[${i}]` : fullKey;
            const encodedKey = options.encode ? encodeURIComponent(arrayKey) : arrayKey;
            parts.push(`${encodedKey}=${encodeValue(item, options.encode)}`);
          }
        }
      }
    } else if (typeof value === "object" && value !== null) {
      if (Object.keys(value).length === 0) {
        continue;
      }
      parts.push(...stringifyObject(value, fullKey, options));
    } else {
      const encodedKey = options.encode ? encodeURIComponent(fullKey) : fullKey;
      parts.push(`${encodedKey}=${encodeValue(value, options.encode)}`);
    }
  }
  return parts;
}
function toQueryString(obj, options) {
  if (obj == null || typeof obj !== "object") {
    return "";
  }
  const parts = stringifyObject(obj, "", {
    ...defaultQsOptions,
    ...options
  });
  return parts.join("&");
}

// node_modules/supermemory/dist/esm/generated/core/fetcher/createRequestUrl.js
function createRequestUrl(baseUrl, queryParameters) {
  const queryString = toQueryString(queryParameters, { arrayFormat: "repeat" });
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

// node_modules/supermemory/dist/esm/generated/core/fetcher/BinaryResponse.js
function getBinaryResponse(response) {
  const binaryResponse = {
    get bodyUsed() {
      return response.bodyUsed;
    },
    stream: () => response.body,
    arrayBuffer: response.arrayBuffer.bind(response),
    blob: response.blob.bind(response)
  };
  if ("bytes" in response && typeof response.bytes === "function") {
    binaryResponse.bytes = response.bytes.bind(response);
  }
  return binaryResponse;
}

// node_modules/supermemory/dist/esm/generated/core/fetcher/getResponseBody.js
function retainResponse(target, response) {
  Object.defineProperty(target, "__fern_response_ref", {
    value: response,
    enumerable: false,
    configurable: true,
    writable: false
  });
}
async function getResponseBody(response, responseType) {
  switch (responseType) {
    case "binary-response":
      return getBinaryResponse(response);
    case "blob":
      return await response.blob();
    case "arrayBuffer":
      return await response.arrayBuffer();
    case "sse":
      if (response.body == null) {
        return {
          ok: false,
          error: {
            reason: "body-is-null",
            statusCode: response.status
          }
        };
      }
      retainResponse(response.body, response);
      return response.body;
    case "streaming":
      if (response.body == null) {
        return {
          ok: false,
          error: {
            reason: "body-is-null",
            statusCode: response.status
          }
        };
      }
      retainResponse(response.body, response);
      return response.body;
    case "text":
      return await response.text();
  }
  const text = await response.text();
  if (text.length > 0) {
    try {
      const responseBody = fromJson(text);
      return responseBody;
    } catch (_err) {
      return {
        ok: false,
        error: {
          reason: "non-json",
          statusCode: response.status,
          rawBody: text
        }
      };
    }
  }
  return;
}

// node_modules/supermemory/dist/esm/generated/core/fetcher/getErrorResponseBody.js
async function getErrorResponseBody(response) {
  let contentType = response.headers.get("Content-Type")?.toLowerCase();
  if (contentType == null || contentType.length === 0) {
    return getResponseBody(response);
  }
  if (contentType.indexOf(";") !== -1) {
    contentType = contentType.split(";")[0]?.trim() ?? "";
  }
  switch (contentType) {
    case "application/hal+json":
    case "application/json":
    case "application/ld+json":
    case "application/problem+json":
    case "application/vnd.api+json":
    case "text/json": {
      const text = await response.text();
      return text.length > 0 ? fromJson(text) : undefined;
    }
    default:
      if (contentType.startsWith("application/vnd.") && contentType.endsWith("+json")) {
        const text = await response.text();
        return text.length > 0 ? fromJson(text) : undefined;
      }
      return await response.text();
  }
}

// node_modules/supermemory/dist/esm/generated/core/fetcher/getFetchFn.js
async function getFetchFn() {
  return fetch;
}

// node_modules/supermemory/dist/esm/generated/core/fetcher/getRequestBody.js
async function getRequestBody({ body, type }) {
  if (type === "form") {
    return toQueryString(body, { arrayFormat: "repeat", encode: true });
  }
  if (type.includes("json")) {
    return toJson(body);
  } else {
    return body;
  }
}

// node_modules/supermemory/dist/esm/generated/core/fetcher/Headers.js
var Headers2;
if (typeof globalThis.Headers !== "undefined") {
  Headers2 = globalThis.Headers;
} else {
  Headers2 = class Headers3 {
    headers;
    constructor(init) {
      this.headers = new Map;
      if (init) {
        if (init instanceof Headers3) {
          init.forEach((value, key) => this.append(key, value));
        } else if (Array.isArray(init)) {
          for (const [key, value] of init) {
            if (typeof key === "string" && typeof value === "string") {
              this.append(key, value);
            } else {
              throw new TypeError("Each header entry must be a [string, string] tuple");
            }
          }
        } else {
          for (const [key, value] of Object.entries(init)) {
            if (typeof value === "string") {
              this.append(key, value);
            } else {
              throw new TypeError("Header values must be strings");
            }
          }
        }
      }
    }
    append(name, value) {
      const key = name.toLowerCase();
      const existing = this.headers.get(key) || [];
      this.headers.set(key, [...existing, value]);
    }
    delete(name) {
      const key = name.toLowerCase();
      this.headers.delete(key);
    }
    get(name) {
      const key = name.toLowerCase();
      const values = this.headers.get(key);
      return values ? values.join(", ") : null;
    }
    has(name) {
      const key = name.toLowerCase();
      return this.headers.has(key);
    }
    set(name, value) {
      const key = name.toLowerCase();
      this.headers.set(key, [value]);
    }
    forEach(callbackfn, thisArg) {
      const boundCallback = thisArg ? callbackfn.bind(thisArg) : callbackfn;
      this.headers.forEach((values, key) => boundCallback(values.join(", "), key, this));
    }
    getSetCookie() {
      return this.headers.get("set-cookie") || [];
    }
    *entries() {
      for (const [key, values] of this.headers.entries()) {
        yield [key, values.join(", ")];
      }
    }
    *keys() {
      yield* this.headers.keys();
    }
    *values() {
      for (const values of this.headers.values()) {
        yield values.join(", ");
      }
    }
    [Symbol.iterator]() {
      return this.entries();
    }
  };
}

// node_modules/supermemory/dist/esm/generated/core/fetcher/signals.js
var TIMEOUT = "timeout";
function getTimeoutSignal(timeoutMs) {
  const controller = new AbortController;
  const abortId = setTimeout(() => controller.abort(new DOMException(TIMEOUT, "AbortError")), timeoutMs);
  return { signal: controller.signal, abortId };
}
function anySignal(...args) {
  const signals = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  const controller = new AbortController;
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal?.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal?.reason), {
      signal: controller.signal
    });
    if (signal.aborted) {
      controller.abort(signal?.reason);
      return controller.signal;
    }
  }
  return controller.signal;
}

// node_modules/supermemory/dist/esm/generated/core/fetcher/makeRequest.js
var _cacheNoStoreSupported;
function isCacheNoStoreSupported() {
  if (_cacheNoStoreSupported != null) {
    return _cacheNoStoreSupported;
  }
  try {
    new Request("http://localhost", { cache: "no-store" });
    _cacheNoStoreSupported = true;
  } catch {
    _cacheNoStoreSupported = false;
  }
  return _cacheNoStoreSupported;
}
var makeRequest = async (fetchFn, url, method, headers, requestBody, timeoutMs, abortSignal, withCredentials, duplex, disableCache) => {
  const signals = [];
  let timeoutAbortId;
  if (timeoutMs != null) {
    const { signal, abortId } = getTimeoutSignal(timeoutMs);
    timeoutAbortId = abortId;
    signals.push(signal);
  }
  if (abortSignal != null) {
    signals.push(abortSignal);
  }
  const newSignals = anySignal(signals);
  try {
    return await fetchFn(url, {
      method,
      headers,
      body: requestBody,
      signal: newSignals,
      credentials: withCredentials ? "include" : undefined,
      duplex,
      ...disableCache && isCacheNoStoreSupported() ? { cache: "no-store" } : {}
    });
  } finally {
    if (timeoutAbortId != null) {
      clearTimeout(timeoutAbortId);
    }
  }
};

// node_modules/supermemory/dist/esm/generated/core/fetcher/RawResponse.js
var abortRawResponse = {
  headers: new Headers2,
  redirected: false,
  status: 499,
  statusText: "Client Closed Request",
  type: "error",
  url: ""
};
var unknownRawResponse = {
  headers: new Headers2,
  redirected: false,
  status: 0,
  statusText: "Unknown Error",
  type: "error",
  url: ""
};
function toRawResponse(response) {
  return {
    headers: response.headers,
    redirected: response.redirected,
    status: response.status,
    statusText: response.statusText,
    type: response.type,
    url: response.url
  };
}

// node_modules/supermemory/dist/esm/generated/core/fetcher/redactUrl.js
var SENSITIVE_QUERY_PARAMS = new Set([
  "api_key",
  "api-key",
  "apikey",
  "token",
  "access_token",
  "access-token",
  "auth_token",
  "auth-token",
  "password",
  "passwd",
  "secret",
  "api_secret",
  "api-secret",
  "apisecret",
  "key",
  "session",
  "session_id",
  "session-id"
]);
function redactUrl(url) {
  const protocolIndex = url.indexOf("://");
  if (protocolIndex === -1)
    return url;
  const afterProtocol = protocolIndex + 3;
  const pathStart = url.indexOf("/", afterProtocol);
  let queryStart = url.indexOf("?", afterProtocol);
  let fragmentStart = url.indexOf("#", afterProtocol);
  const firstDelimiter = Math.min(pathStart === -1 ? url.length : pathStart, queryStart === -1 ? url.length : queryStart, fragmentStart === -1 ? url.length : fragmentStart);
  let atIndex = -1;
  for (let i = afterProtocol;i < firstDelimiter; i++) {
    if (url[i] === "@") {
      atIndex = i;
    }
  }
  if (atIndex !== -1) {
    url = `${url.slice(0, afterProtocol)}[REDACTED]@${url.slice(atIndex + 1)}`;
  }
  queryStart = url.indexOf("?");
  if (queryStart === -1)
    return url;
  fragmentStart = url.indexOf("#", queryStart);
  const queryEnd = fragmentStart !== -1 ? fragmentStart : url.length;
  const queryString = url.slice(queryStart + 1, queryEnd);
  if (queryString.length === 0)
    return url;
  const lower = queryString.toLowerCase();
  const hasSensitive = lower.includes("token") || lower.includes("key") || lower.includes("password") || lower.includes("passwd") || lower.includes("secret") || lower.includes("session") || lower.includes("auth");
  if (!hasSensitive) {
    return url;
  }
  const redactedParams = [];
  const params = queryString.split("&");
  for (const param of params) {
    const equalIndex = param.indexOf("=");
    if (equalIndex === -1) {
      redactedParams.push(param);
      continue;
    }
    const key = param.slice(0, equalIndex);
    let shouldRedact = SENSITIVE_QUERY_PARAMS.has(key.toLowerCase());
    if (!shouldRedact && key.includes("%")) {
      try {
        const decodedKey = decodeURIComponent(key);
        shouldRedact = SENSITIVE_QUERY_PARAMS.has(decodedKey.toLowerCase());
      } catch {}
    }
    redactedParams.push(shouldRedact ? `${key}=[REDACTED]` : param);
  }
  return url.slice(0, queryStart + 1) + redactedParams.join("&") + url.slice(queryEnd);
}

// node_modules/supermemory/dist/esm/generated/core/fetcher/requestWithRetries.js
var INITIAL_RETRY_DELAY = 1000;
var MAX_RETRY_DELAY = 60000;
var DEFAULT_MAX_RETRIES = 2;
var JITTER_FACTOR = 0.2;
function isRetryableStatusCode(statusCode) {
  return [408, 429].includes(statusCode) || statusCode >= 500;
}
function addPositiveJitter(delay) {
  const jitterMultiplier = 1 + Math.random() * JITTER_FACTOR;
  return delay * jitterMultiplier;
}
function addSymmetricJitter(delay) {
  const jitterMultiplier = 1 + (Math.random() - 0.5) * JITTER_FACTOR;
  return delay * jitterMultiplier;
}
function getRetryDelayFromHeaders(response, retryAttempt) {
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const retryAfterSeconds = parseInt(retryAfter, 10);
    if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
      return Math.min(retryAfterSeconds * 1000, MAX_RETRY_DELAY);
    }
    const retryAfterDate = new Date(retryAfter);
    if (!Number.isNaN(retryAfterDate.getTime())) {
      const delay = retryAfterDate.getTime() - Date.now();
      if (delay > 0) {
        return Math.min(Math.max(delay, 0), MAX_RETRY_DELAY);
      }
    }
  }
  const rateLimitReset = response.headers.get("X-RateLimit-Reset");
  if (rateLimitReset) {
    const resetTime = parseInt(rateLimitReset, 10);
    if (!Number.isNaN(resetTime)) {
      const delay = resetTime * 1000 - Date.now();
      if (delay > 0) {
        return addPositiveJitter(Math.min(delay, MAX_RETRY_DELAY));
      }
    }
  }
  return addSymmetricJitter(Math.min(INITIAL_RETRY_DELAY * 2 ** retryAttempt, MAX_RETRY_DELAY));
}
async function requestWithRetries(requestFn, maxRetries = DEFAULT_MAX_RETRIES, abortSignal) {
  for (let i = 0;; ++i) {
    let response;
    try {
      response = await requestFn();
    } catch (error) {
      const aborted = abortSignal?.aborted === true || error instanceof Error && error.name === "AbortError";
      if (aborted || i >= maxRetries)
        throw error;
      await new Promise((resolve) => setTimeout(resolve, addSymmetricJitter(Math.min(INITIAL_RETRY_DELAY * 2 ** i, MAX_RETRY_DELAY))));
      continue;
    }
    if (!isRetryableStatusCode(response.status) || i >= maxRetries)
      return response;
    await new Promise((resolve) => setTimeout(resolve, getRetryDelayFromHeaders(response, i)));
  }
}

// node_modules/supermemory/dist/esm/generated/core/fetcher/Fetcher.js
var SENSITIVE_HEADERS = new Set([
  "authorization",
  "www-authenticate",
  "x-api-key",
  "api-key",
  "apikey",
  "x-api-token",
  "x-auth-token",
  "auth-token",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "proxy-authenticate",
  "x-csrf-token",
  "x-xsrf-token",
  "x-session-token",
  "x-access-token"
]);
function redactHeaders(headers) {
  const filtered = {};
  for (const [key, value] of headers instanceof Headers2 ? headers.entries() : Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      filtered[key] = "[REDACTED]";
    } else {
      filtered[key] = value;
    }
  }
  return filtered;
}
function redactQueryParameters(queryParameters) {
  if (queryParameters == null) {
    return;
  }
  const redacted = {};
  for (const [key, value] of Object.entries(queryParameters)) {
    redacted[key] = SENSITIVE_QUERY_PARAMS.has(key.toLowerCase()) ? "[REDACTED]" : value;
  }
  return redacted;
}
async function getHeaders(args) {
  const newHeaders = new Headers2;
  newHeaders.set("Accept", args.responseType === "json" ? "application/json" : args.responseType === "text" ? "text/plain" : args.responseType === "sse" ? "text/event-stream" : "*/*");
  if (args.body !== undefined && args.contentType != null) {
    newHeaders.set("Content-Type", args.contentType);
  }
  if (args.headers == null) {
    return newHeaders;
  }
  for (const [key, value] of Object.entries(args.headers)) {
    const result = await EndpointSupplier.get(value, { endpointMetadata: args.endpointMetadata ?? {} });
    if (typeof result === "string") {
      newHeaders.set(key, result);
      continue;
    }
    if (result == null) {
      continue;
    }
    newHeaders.set(key, `${result}`);
  }
  return newHeaders;
}
async function fetcherImpl(args) {
  let url = args.url;
  if (args.queryString != null && args.queryString.length > 0) {
    url = `${url}?${args.queryString}`;
  } else {
    url = createRequestUrl(args.url, args.queryParameters);
  }
  const requestBody = await getRequestBody({
    body: args.body,
    type: args.requestType ?? "other"
  });
  const fetchFn = args.fetchFn ?? await getFetchFn();
  const headers = await getHeaders(args);
  const logger = createLogger(args.logging);
  if (logger.isDebug()) {
    const metadata = {
      method: args.method,
      url: redactUrl(url),
      headers: redactHeaders(headers),
      queryParameters: redactQueryParameters(args.queryParameters),
      hasBody: requestBody != null
    };
    logger.debug("Making HTTP request", metadata);
  }
  try {
    const response = await requestWithRetries(async () => makeRequest(fetchFn, url, args.method, headers, requestBody, args.timeoutMs, args.abortSignal, args.withCredentials, args.duplex, args.responseType === "streaming" || args.responseType === "sse"), args.maxRetries, args.abortSignal);
    if (response.status >= 200 && response.status < 400) {
      if (logger.isDebug()) {
        const metadata = {
          method: args.method,
          url: redactUrl(url),
          statusCode: response.status,
          responseHeaders: redactHeaders(response.headers)
        };
        logger.debug("HTTP request succeeded", metadata);
      }
      const body = await getResponseBody(response, args.responseType);
      return {
        ok: true,
        body,
        headers: response.headers,
        rawResponse: toRawResponse(response)
      };
    } else {
      if (logger.isError()) {
        const metadata = {
          method: args.method,
          url: redactUrl(url),
          statusCode: response.status,
          responseHeaders: redactHeaders(Object.fromEntries(response.headers.entries()))
        };
        logger.error("HTTP request failed with error status", metadata);
      }
      return {
        ok: false,
        error: {
          reason: "status-code",
          statusCode: response.status,
          body: await getErrorResponseBody(response)
        },
        rawResponse: toRawResponse(response)
      };
    }
  } catch (error) {
    if (args.abortSignal?.aborted) {
      if (logger.isError()) {
        const metadata = {
          method: args.method,
          url: redactUrl(url)
        };
        logger.error("HTTP request was aborted", metadata);
      }
      return {
        ok: false,
        error: {
          reason: "unknown",
          errorMessage: "The user aborted a request",
          cause: error
        },
        rawResponse: abortRawResponse
      };
    } else if (error instanceof Error && error.name === "AbortError") {
      if (logger.isError()) {
        const metadata = {
          method: args.method,
          url: redactUrl(url),
          timeoutMs: args.timeoutMs
        };
        logger.error("HTTP request timed out", metadata);
      }
      return {
        ok: false,
        error: {
          reason: "timeout",
          cause: error
        },
        rawResponse: abortRawResponse
      };
    } else if (error instanceof Error) {
      if (logger.isError()) {
        const metadata = {
          method: args.method,
          url: redactUrl(url),
          errorMessage: error.message
        };
        logger.error("HTTP request failed with error", metadata);
      }
      return {
        ok: false,
        error: {
          reason: "unknown",
          errorMessage: error.message,
          cause: error
        },
        rawResponse: unknownRawResponse
      };
    }
    if (logger.isError()) {
      const metadata = {
        method: args.method,
        url: redactUrl(url),
        error: toJson(error)
      };
      logger.error("HTTP request failed with unknown error", metadata);
    }
    return {
      ok: false,
      error: {
        reason: "unknown",
        errorMessage: toJson(error),
        cause: error
      },
      rawResponse: unknownRawResponse
    };
  }
}
var fetcher = fetcherImpl;
// node_modules/supermemory/dist/esm/generated/core/fetcher/HttpResponsePromise.js
class HttpResponsePromise extends Promise {
  innerPromise;
  unwrappedPromise;
  constructor(promise) {
    super((resolve) => {
      resolve(undefined);
    });
    this.innerPromise = promise;
  }
  static fromFunction(fn, ...args) {
    return new HttpResponsePromise(fn(...args));
  }
  static interceptFunction(fn) {
    return (...args) => {
      return HttpResponsePromise.fromPromise(fn(...args));
    };
  }
  static fromPromise(promise) {
    return new HttpResponsePromise(promise);
  }
  static fromExecutor(executor) {
    const promise = new Promise(executor);
    return new HttpResponsePromise(promise);
  }
  static fromResult(result) {
    const promise = Promise.resolve(result);
    return new HttpResponsePromise(promise);
  }
  unwrap() {
    if (!this.unwrappedPromise) {
      this.unwrappedPromise = this.innerPromise.then(({ data }) => data);
    }
    return this.unwrappedPromise;
  }
  then(onfulfilled, onrejected) {
    return this.unwrap().then(onfulfilled, onrejected);
  }
  catch(onrejected) {
    return this.unwrap().catch(onrejected);
  }
  finally(onfinally) {
    return this.unwrap().finally(onfinally);
  }
  async withRawResponse() {
    return await this.innerPromise;
  }
}
// node_modules/supermemory/dist/esm/generated/core/url/join.js
function join(base, ...segments) {
  if (!base) {
    return "";
  }
  if (segments.length === 0) {
    return base;
  }
  if (base.includes("://")) {
    let url;
    try {
      url = new URL(base);
    } catch {
      return joinPath(base, ...segments);
    }
    const lastSegment = segments[segments.length - 1];
    const shouldPreserveTrailingSlash = lastSegment?.endsWith("/");
    for (const segment of segments) {
      const cleanSegment = trimSlashes(segment);
      if (cleanSegment) {
        url.pathname = joinPathSegments(url.pathname, cleanSegment);
      }
    }
    if (shouldPreserveTrailingSlash && !url.pathname.endsWith("/")) {
      url.pathname += "/";
    }
    return url.toString();
  }
  return joinPath(base, ...segments);
}
function joinPath(base, ...segments) {
  if (segments.length === 0) {
    return base;
  }
  let result = base;
  const lastSegment = segments[segments.length - 1];
  const shouldPreserveTrailingSlash = lastSegment?.endsWith("/");
  for (const segment of segments) {
    const cleanSegment = trimSlashes(segment);
    if (cleanSegment) {
      result = joinPathSegments(result, cleanSegment);
    }
  }
  if (shouldPreserveTrailingSlash && !result.endsWith("/")) {
    result += "/";
  }
  return result;
}
function joinPathSegments(left, right) {
  if (left.endsWith("/")) {
    return left + right;
  }
  return `${left}/${right}`;
}
function trimSlashes(str) {
  if (!str)
    return str;
  let start = 0;
  let end = str.length;
  if (str.startsWith("/"))
    start = 1;
  if (str.endsWith("/"))
    end = str.length - 1;
  return start === 0 && end === str.length ? str : str.slice(start, end);
}

// node_modules/supermemory/dist/esm/generated/core/fetcher/Supplier.js
var Supplier = {
  get: async (supplier) => {
    if (typeof supplier === "function") {
      return supplier();
    } else {
      return supplier;
    }
  }
};

// node_modules/supermemory/dist/esm/generated/core/fetcher/makePassthroughRequest.js
async function makePassthroughRequest(input, init, clientOptions, requestOptions) {
  const logger = createLogger(clientOptions.logging);
  let url;
  let effectiveInit = init;
  if (input instanceof Request) {
    url = input.url;
    if (init == null) {
      effectiveInit = {
        method: input.method,
        headers: Object.fromEntries(input.headers.entries()),
        body: input.body,
        signal: input.signal,
        credentials: input.credentials,
        cache: input.cache,
        redirect: input.redirect,
        referrer: input.referrer,
        integrity: input.integrity,
        mode: input.mode
      };
    }
  } else {
    url = input instanceof URL ? input.toString() : input;
  }
  const baseUrl = (clientOptions.baseUrl != null ? await Supplier.get(clientOptions.baseUrl) : undefined) ?? (clientOptions.environment != null ? await Supplier.get(clientOptions.environment) : undefined);
  let fullUrl;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    fullUrl = url;
  } else if (baseUrl != null) {
    fullUrl = join(baseUrl, url);
  } else {
    fullUrl = url;
  }
  const mergedHeaders = {};
  if (clientOptions.headers != null) {
    for (const [key, value] of Object.entries(clientOptions.headers)) {
      const resolved = await EndpointSupplier.get(value, { endpointMetadata: {} });
      if (resolved != null) {
        mergedHeaders[key.toLowerCase()] = `${resolved}`;
      }
    }
  }
  if (clientOptions.getAuthHeaders != null && targetsBaseUrl(fullUrl, baseUrl)) {
    const authHeaders = await clientOptions.getAuthHeaders();
    for (const [key, value] of Object.entries(authHeaders)) {
      mergedHeaders[key.toLowerCase()] = value;
    }
  }
  if (effectiveInit?.headers != null) {
    const initHeaders = effectiveInit.headers instanceof Headers ? Object.fromEntries(effectiveInit.headers.entries()) : Array.isArray(effectiveInit.headers) ? Object.fromEntries(effectiveInit.headers) : effectiveInit.headers;
    for (const [key, value] of Object.entries(initHeaders)) {
      if (value != null) {
        mergedHeaders[key.toLowerCase()] = value;
      }
    }
  }
  if (requestOptions?.headers != null) {
    for (const [key, value] of Object.entries(requestOptions.headers)) {
      mergedHeaders[key.toLowerCase()] = value;
    }
  }
  const method = effectiveInit?.method ?? "GET";
  const body = effectiveInit?.body;
  const timeoutInSeconds = requestOptions?.timeoutInSeconds ?? clientOptions.timeoutInSeconds;
  const timeoutMs = timeoutInSeconds != null ? timeoutInSeconds * 1000 : undefined;
  const maxRetries = requestOptions?.maxRetries ?? clientOptions.maxRetries;
  const abortSignal = requestOptions?.abortSignal ?? effectiveInit?.signal ?? undefined;
  const fetchFn = clientOptions.fetch ?? await getFetchFn();
  if (logger.isDebug()) {
    logger.debug("Making passthrough HTTP request", {
      method,
      url: redactUrl(fullUrl),
      hasBody: body != null
    });
  }
  const response = await requestWithRetries(async () => makeRequest(fetchFn, fullUrl, method, mergedHeaders, body ?? undefined, timeoutMs, abortSignal, effectiveInit?.credentials === "include", undefined, false), maxRetries);
  if (logger.isDebug()) {
    logger.debug("Passthrough HTTP request completed", {
      method,
      url: redactUrl(fullUrl),
      statusCode: response.status
    });
  }
  return response;
}
function targetsBaseUrl(fullUrl, baseUrl) {
  if (baseUrl == null) {
    return false;
  }
  try {
    return new URL(fullUrl).origin === new URL(baseUrl).origin;
  } catch {
    return false;
  }
}
// node_modules/supermemory/dist/esm/generated/core/file/file.js
async function toMultipartDataPart(file) {
  const { data, filename, contentType } = await getFileWithMetadata(file, {
    noSniffFileSize: true
  });
  return {
    data,
    filename,
    contentType
  };
}
async function getFileWithMetadata(file, { noSniffFileSize } = {}) {
  if (file == null) {
    throw new Error(`Expected file to be a Blob, Buffer, ReadableStream, or an object with a "path" or "data" property, but received ${file === null ? "null" : "undefined"}.`);
  }
  if (isFileLike(file)) {
    return getFileWithMetadata({
      data: file
    }, { noSniffFileSize });
  }
  if ("path" in file) {
    const fs3 = await import("fs");
    if (!fs3?.createReadStream) {
      throw new Error("File path uploads are not supported in this environment.");
    }
    const data = fs3.createReadStream(file.path);
    const contentLength = file.contentLength ?? (noSniffFileSize === true ? undefined : await tryGetFileSizeFromPath(file.path));
    const filename = file.filename ?? getNameFromPath(file.path);
    return {
      data,
      filename,
      contentType: file.contentType,
      contentLength
    };
  }
  if ("data" in file) {
    const data = file.data;
    const contentLength = file.contentLength ?? await tryGetContentLengthFromFileLike(data, {
      noSniffFileSize
    });
    const filename = file.filename ?? tryGetNameFromFileLike(data);
    return {
      data,
      filename,
      contentType: file.contentType ?? tryGetContentTypeFromFileLike(data),
      contentLength
    };
  }
  throw new Error(`Invalid FileUpload of type ${typeof file}: ${JSON.stringify(file)}`);
}
function isFileLike(value) {
  return isBuffer(value) || isArrayBufferView(value) || isArrayBuffer(value) || isUint8Array(value) || isBlob(value) || isFile(value) || isStreamLike(value) || isReadableStream(value);
}
async function tryGetFileSizeFromPath(path3) {
  try {
    const fs3 = await import("fs");
    if (!fs3?.promises?.stat) {
      return;
    }
    const fileStat = await fs3.promises.stat(path3);
    return fileStat.size;
  } catch (_fallbackError) {
    return;
  }
}
function tryGetNameFromFileLike(data) {
  if (isNamedValue(data)) {
    return data.name;
  }
  if (isPathedValue(data)) {
    return getNameFromPath(data.path.toString());
  }
  return;
}
async function tryGetContentLengthFromFileLike(data, { noSniffFileSize } = {}) {
  if (isBuffer(data)) {
    return data.length;
  }
  if (isArrayBufferView(data)) {
    return data.byteLength;
  }
  if (isArrayBuffer(data)) {
    return data.byteLength;
  }
  if (isBlob(data)) {
    return data.size;
  }
  if (isFile(data)) {
    return data.size;
  }
  if (noSniffFileSize === true) {
    return;
  }
  if (isPathedValue(data)) {
    return await tryGetFileSizeFromPath(data.path.toString());
  }
  return;
}
function tryGetContentTypeFromFileLike(data) {
  if (isBlob(data)) {
    return data.type;
  }
  if (isFile(data)) {
    return data.type;
  }
  return;
}
function getNameFromPath(path3) {
  const lastForwardSlash = path3.lastIndexOf("/");
  const lastBackSlash = path3.lastIndexOf("\\");
  const lastSlashIndex = Math.max(lastForwardSlash, lastBackSlash);
  return lastSlashIndex >= 0 ? path3.substring(lastSlashIndex + 1) : path3;
}
function isNamedValue(value) {
  return typeof value === "object" && value != null && "name" in value;
}
function isPathedValue(value) {
  return typeof value === "object" && value != null && "path" in value;
}
function isStreamLike(value) {
  return typeof value === "object" && value != null && (("read" in value) || ("pipe" in value));
}
function isReadableStream(value) {
  return typeof value === "object" && value != null && "getReader" in value;
}
function isBuffer(value) {
  return typeof Buffer !== "undefined" && Buffer.isBuffer && Buffer.isBuffer(value);
}
function isArrayBufferView(value) {
  return typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(value);
}
function isArrayBuffer(value) {
  return typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer;
}
function isUint8Array(value) {
  return typeof Uint8Array !== "undefined" && value instanceof Uint8Array;
}
function isBlob(value) {
  return typeof Blob !== "undefined" && value instanceof Blob;
}
function isFile(value) {
  return typeof File !== "undefined" && value instanceof File;
}
// node_modules/supermemory/dist/esm/generated/core/runtime/runtime.js
var RUNTIME = evaluateRuntime();
function evaluateRuntime() {
  const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";
  if (isBrowser) {
    return {
      type: "browser",
      version: window.navigator.userAgent
    };
  }
  const isCloudflare = typeof globalThis !== "undefined" && globalThis?.navigator?.userAgent === "Cloudflare-Workers";
  if (isCloudflare) {
    return {
      type: "workerd"
    };
  }
  const isEdgeRuntime = typeof EdgeRuntime === "string";
  if (isEdgeRuntime) {
    return {
      type: "edge-runtime"
    };
  }
  const isWebWorker = typeof self === "object" && typeof self?.importScripts === "function" && (self.constructor?.name === "DedicatedWorkerGlobalScope" || self.constructor?.name === "ServiceWorkerGlobalScope" || self.constructor?.name === "SharedWorkerGlobalScope");
  if (isWebWorker) {
    return {
      type: "web-worker"
    };
  }
  const isDeno = typeof Deno !== "undefined" && typeof Deno.version !== "undefined" && typeof Deno.version.deno !== "undefined";
  if (isDeno) {
    return {
      type: "deno",
      version: Deno.version.deno,
      os: Deno.build?.os,
      arch: Deno.build?.arch
    };
  }
  const isBun = typeof Bun !== "undefined" && typeof Bun.version !== "undefined";
  if (isBun) {
    return {
      type: "bun",
      version: Bun.version,
      os: typeof process !== "undefined" ? process.platform : undefined,
      arch: typeof process !== "undefined" ? process.arch : undefined
    };
  }
  const isReactNative = typeof navigator !== "undefined" && navigator?.product === "ReactNative";
  if (isReactNative) {
    return {
      type: "react-native"
    };
  }
  const _process = typeof process !== "undefined" ? process : undefined;
  const isNode = typeof _process !== "undefined" && typeof _process.versions?.node === "string";
  if (isNode) {
    return {
      type: "node",
      version: _process.versions.node,
      parsedVersion: Number(_process.versions.node.split(".")[0]),
      os: _process.platform,
      arch: _process.arch
    };
  }
  return {
    type: "unknown"
  };
}
var X86_64_ARCH_ALIASES = new Set(["x64", "amd64", "x86_64"]);
// node_modules/supermemory/dist/esm/generated/core/form-data-utils/FormDataWrapper.js
async function newFormData() {
  return new FormDataWrapper;
}

class FormDataWrapper {
  fd = new FormData;
  async setup() {}
  append(key, value) {
    this.fd.append(key, String(value));
  }
  async appendFile(key, value) {
    if (value == null) {
      throw new Error(`File upload for "${key}" received ${value === null ? "null" : "undefined"}. The generated code should not call appendFile with null/undefined — check that optional file fields are guarded before this call.`);
    }
    const { data, filename, contentType } = await toMultipartDataPart(value);
    const blob = await convertToBlob(data, contentType);
    if (filename) {
      this.fd.append(key, blob, filename);
    } else {
      this.fd.append(key, blob);
    }
  }
  getRequest() {
    return {
      body: this.fd,
      headers: {},
      duplex: "half"
    };
  }
}
function isStreamLike2(value) {
  return typeof value === "object" && value != null && (("read" in value) || ("pipe" in value));
}
function isReadableStream2(value) {
  return typeof value === "object" && value != null && "getReader" in value;
}
function isBuffer2(value) {
  return typeof Buffer !== "undefined" && Buffer.isBuffer && Buffer.isBuffer(value);
}
function isArrayBufferView2(value) {
  return ArrayBuffer.isView(value);
}
async function streamToBuffer(stream) {
  if (RUNTIME.type === "node") {
    const { Readable } = await import("stream");
    if (stream instanceof Readable) {
      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    }
  }
  if (isReadableStream2(stream)) {
    const reader = stream.getReader();
    const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done)
          break;
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }
    return Buffer.from(result);
  }
  throw new Error(`Unsupported stream type: ${typeof stream}. Expected Node.js Readable stream or Web ReadableStream.`);
}
async function convertToBlob(value, contentType) {
  if (isStreamLike2(value) || isReadableStream2(value)) {
    const buffer = await streamToBuffer(value);
    return new Blob([buffer], { type: contentType });
  }
  if (value instanceof Blob) {
    return value;
  }
  if (isBuffer2(value)) {
    return new Blob([value], { type: contentType });
  }
  if (value instanceof ArrayBuffer) {
    return new Blob([value], { type: contentType });
  }
  if (isArrayBufferView2(value)) {
    return new Blob([value], { type: contentType });
  }
  if (typeof value === "string") {
    return new Blob([value], { type: contentType });
  }
  if (typeof value === "object" && value !== null) {
    return new Blob([toJson(value)], { type: contentType ?? "application/json" });
  }
  return new Blob([String(value)], { type: contentType });
}
// node_modules/supermemory/dist/esm/generated/core/logging/index.js
var exports_logging = {};
__export(exports_logging, {
  createLogger: () => createLogger,
  Logger: () => Logger,
  LogLevel: () => LogLevel,
  ConsoleLogger: () => ConsoleLogger
});
// node_modules/supermemory/dist/esm/generated/core/url/index.js
var exports_url = {};
__export(exports_url, {
  toQueryString: () => toQueryString,
  queryBuilder: () => queryBuilder,
  join: () => join,
  encodePathParam: () => encodePathParam
});

// node_modules/supermemory/dist/esm/generated/core/url/encodePathParam.js
function encodePathParam(param) {
  if (param === null) {
    return "null";
  }
  const typeofParam = typeof param;
  switch (typeofParam) {
    case "undefined":
      return "undefined";
    case "string":
    case "number":
    case "boolean":
      break;
    default:
      param = String(param);
      break;
  }
  return encodeURIComponent(param);
}
// node_modules/supermemory/dist/esm/generated/core/url/QueryStringBuilder.js
function queryBuilder() {
  return new QueryStringBuilder;
}

class QueryStringBuilder {
  parts = new Map;
  add(key, value, options) {
    if (value === undefined || value === null) {
      return this;
    }
    const serialized = toQueryString({ [key]: value }, { arrayFormat: options?.style === "comma" ? "comma" : "repeat" });
    if (serialized.length > 0) {
      this.parts.set(key, serialized);
    }
    return this;
  }
  addMany(params) {
    if (params != null) {
      for (const [key, value] of Object.entries(params)) {
        this.add(key, value);
      }
    }
    return this;
  }
  mergeAdditional(additionalParams) {
    if (additionalParams != null) {
      for (const [key, value] of Object.entries(additionalParams)) {
        if (value === undefined || value === null) {
          continue;
        }
        const serialized = toQueryString({ [key]: value }, { arrayFormat: "repeat" });
        if (serialized.length > 0) {
          this.parts.set(key, serialized);
        }
      }
    }
    return this;
  }
  build() {
    return [...this.parts.values()].join("&");
  }
}
// node_modules/supermemory/dist/esm/generated/errors/SupermemoryError.js
class SupermemoryError extends Error {
  statusCode;
  body;
  rawResponse;
  cause;
  constructor({ message, statusCode, body, rawResponse, cause }) {
    super(buildMessage({ message, statusCode, body }));
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    this.name = "SupermemoryError";
    this.statusCode = statusCode;
    this.body = body;
    this.rawResponse = rawResponse;
    if (cause != null) {
      this.cause = cause;
    }
  }
  get requestId() {
    return this.rawResponse?.headers?.get("x-request-id") ?? undefined;
  }
}
function buildMessage({ message, statusCode, body }) {
  const lines = [];
  if (message != null) {
    lines.push(message);
  }
  if (statusCode != null) {
    lines.push(`Status code: ${statusCode.toString()}`);
  }
  if (body != null) {
    lines.push(`Body: ${toJson(body, undefined, 2)}`);
  }
  return lines.join(`
`);
}
// node_modules/supermemory/dist/esm/generated/errors/SupermemoryTimeoutError.js
class SupermemoryTimeoutError extends SupermemoryError {
  constructor(message, opts) {
    super({
      message,
      cause: opts?.cause
    });
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    this.name = "SupermemoryTimeoutError";
  }
}
// node_modules/supermemory/dist/esm/generated/auth/BearerAuthProvider.js
var TOKEN_PARAM = "apiKey";
var ENV_TOKEN = "SUPERMEMORY_API_KEY";

class BearerAuthProvider {
  options;
  constructor(options) {
    this.options = options;
  }
  static canCreate(options) {
    return options?.[TOKEN_PARAM] != null || process.env?.[ENV_TOKEN] != null;
  }
  async getAuthRequest({ endpointMetadata } = {}) {
    const apiKey = await Supplier.get(this.options[TOKEN_PARAM]) ?? process.env?.[ENV_TOKEN];
    if (apiKey == null) {
      throw new SupermemoryError({
        message: BearerAuthProvider.AUTH_CONFIG_ERROR_MESSAGE
      });
    }
    return {
      headers: { Authorization: `Bearer ${apiKey}` }
    };
  }
}
(function(BearerAuthProvider2) {
  BearerAuthProvider2.AUTH_SCHEME = "bearerAuth";
  BearerAuthProvider2.AUTH_CONFIG_ERROR_MESSAGE = `Please provide '${TOKEN_PARAM}' when initializing the client, or set the '${ENV_TOKEN}' environment variable`;
  function createInstance(options) {
    return new BearerAuthProvider2(options);
  }
  BearerAuthProvider2.createInstance = createInstance;
})(BearerAuthProvider || (BearerAuthProvider = {}));

// node_modules/supermemory/dist/esm/generated/core/headers.js
function mergeHeaders(...headersArray) {
  const result = {};
  for (const [key, value] of headersArray.filter((headers) => headers != null).flatMap((headers) => Object.entries(headers))) {
    const insensitiveKey = key.toLowerCase();
    if (value != null) {
      result[insensitiveKey] = value;
    } else if (insensitiveKey in result) {
      delete result[insensitiveKey];
    }
  }
  return result;
}
function mergeOnlyDefinedHeaders(...headersArray) {
  const result = {};
  for (const [key, value] of headersArray.filter((headers) => headers != null).flatMap((headers) => Object.entries(headers))) {
    const insensitiveKey = key.toLowerCase();
    if (value != null) {
      result[insensitiveKey] = value;
    }
  }
  return result;
}

// node_modules/supermemory/dist/esm/generated/BaseClient.js
function normalizeClientOptions(options) {
  const headers = mergeHeaders({
    "X-Fern-Language": "JavaScript",
    "X-Fern-Runtime": RUNTIME.type,
    "X-Fern-Runtime-Version": RUNTIME.version
  }, options?.headers);
  return {
    ...options,
    logging: exports_logging.createLogger(options?.logging),
    headers
  };
}
function normalizeClientOptionsWithAuth(options) {
  const normalized = normalizeClientOptions(options);
  if (options.auth === false) {
    normalized.authProvider = new NoOpAuthProvider;
    return normalized;
  }
  if (options.auth != null) {
    if (typeof options.auth === "function") {
      normalized.authProvider = { getAuthRequest: options.auth };
      return normalized;
    }
    if (isAuthProvider(options.auth)) {
      normalized.authProvider = options.auth;
      return normalized;
    }
    Object.assign(normalized, options.auth);
  }
  const normalizedWithNoOpAuthProvider = withNoOpAuthProvider(normalized);
  normalized.authProvider ??= new BearerAuthProvider(normalizedWithNoOpAuthProvider);
  return normalized;
}
function withNoOpAuthProvider(options) {
  return {
    ...options,
    authProvider: new NoOpAuthProvider
  };
}

// node_modules/supermemory/dist/esm/generated/core/requestBody.js
function mergeAdditionalBodyParameters(body, additionalBodyParameters) {
  if (additionalBodyParameters == null) {
    return body;
  }
  if (body == null) {
    return { ...additionalBodyParameters };
  }
  if (typeof body === "object" && !Array.isArray(body)) {
    return { ...body, ...additionalBodyParameters };
  }
  return body;
}

// node_modules/supermemory/dist/esm/generated/environments.js
var SupermemoryEnvironment = {
  Default: "https://api.supermemory.ai"
};

// node_modules/supermemory/dist/esm/generated/errors/handleNonStatusCodeError.js
function handleNonStatusCodeError(error, rawResponse, method, path3) {
  switch (error.reason) {
    case "non-json":
      throw new SupermemoryError({
        statusCode: error.statusCode,
        body: error.rawBody,
        rawResponse
      });
    case "body-is-null":
      throw new SupermemoryError({
        statusCode: error.statusCode,
        rawResponse
      });
    case "timeout":
      throw new SupermemoryTimeoutError(`Timeout exceeded when calling ${method} ${path3}.`, {
        cause: error.cause
      });
    case "unknown":
      throw new SupermemoryError({
        message: error.errorMessage,
        rawResponse,
        cause: error.cause
      });
    default:
      throw new SupermemoryError({
        message: "Unknown error",
        rawResponse
      });
  }
}

// node_modules/supermemory/dist/esm/generated/api/errors/BadRequestError.js
class BadRequestError extends SupermemoryError {
  constructor(body, rawResponse) {
    super({
      message: "BadRequestError",
      statusCode: 400,
      body,
      rawResponse
    });
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    this.name = "BadRequestError";
  }
}

// node_modules/supermemory/dist/esm/generated/api/errors/ConflictError.js
class ConflictError extends SupermemoryError {
  constructor(body, rawResponse) {
    super({
      message: "ConflictError",
      statusCode: 409,
      body,
      rawResponse
    });
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    this.name = "ConflictError";
  }
}

// node_modules/supermemory/dist/esm/generated/api/errors/ForbiddenError.js
class ForbiddenError extends SupermemoryError {
  constructor(body, rawResponse) {
    super({
      message: "ForbiddenError",
      statusCode: 403,
      body,
      rawResponse
    });
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    this.name = "ForbiddenError";
  }
}

// node_modules/supermemory/dist/esm/generated/api/errors/InternalServerError.js
class InternalServerError extends SupermemoryError {
  constructor(body, rawResponse) {
    super({
      message: "InternalServerError",
      statusCode: 500,
      body,
      rawResponse
    });
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    this.name = "InternalServerError";
  }
}

// node_modules/supermemory/dist/esm/generated/api/errors/NotFoundError.js
class NotFoundError extends SupermemoryError {
  constructor(body, rawResponse) {
    super({
      message: "NotFoundError",
      statusCode: 404,
      body,
      rawResponse
    });
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    this.name = "NotFoundError";
  }
}

// node_modules/supermemory/dist/esm/generated/api/errors/PaymentRequiredError.js
class PaymentRequiredError extends SupermemoryError {
  constructor(body, rawResponse) {
    super({
      message: "PaymentRequiredError",
      statusCode: 402,
      body,
      rawResponse
    });
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    this.name = "PaymentRequiredError";
  }
}

// node_modules/supermemory/dist/esm/generated/api/errors/ServiceUnavailableError.js
class ServiceUnavailableError extends SupermemoryError {
  constructor(body, rawResponse) {
    super({
      message: "ServiceUnavailableError",
      statusCode: 503,
      body,
      rawResponse
    });
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    this.name = "ServiceUnavailableError";
  }
}

// node_modules/supermemory/dist/esm/generated/api/errors/UnauthorizedError.js
class UnauthorizedError extends SupermemoryError {
  constructor(body, rawResponse) {
    super({
      message: "UnauthorizedError",
      statusCode: 401,
      body,
      rawResponse
    });
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    this.name = "UnauthorizedError";
  }
}

// node_modules/supermemory/dist/esm/generated/api/resources/connectors/client/Client.js
class ConnectorsClient {
  _options;
  constructor(options = {}) {
    this._options = normalizeClientOptionsWithAuth(options);
  }
  listAll(request = {}, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__listAll(request, requestOptions));
  }
  async __listAll(request = {}, requestOptions) {
    const { provider, page, limit } = request;
    const _queryParams = {
      provider: provider != null ? provider : undefined,
      page,
      limit
    };
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, "connectors"),
      method: "GET",
      headers: _headers,
      queryString: exports_url.queryBuilder().addMany(_queryParams).mergeAdditional(requestOptions?.queryParams).build(),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return {
        data: _response.body,
        rawResponse: _response.rawResponse
      };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "GET", "/connectors");
  }
  list(namespace, request = {}, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__list(namespace, request, requestOptions));
  }
  async __list(namespace, request = {}, requestOptions) {
    const { provider, page, limit } = request;
    const _queryParams = {
      provider: provider != null ? provider : undefined,
      page,
      limit
    };
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/connectors`),
      method: "GET",
      headers: _headers,
      queryString: exports_url.queryBuilder().addMany(_queryParams).mergeAdditional(requestOptions?.queryParams).build(),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "GET", "/ns/{namespace}/connectors");
  }
  create(namespace, request, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__create(namespace, request, requestOptions));
  }
  async __create(namespace, request, requestOptions) {
    const { body: _body } = request;
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/connectors`),
      method: "POST",
      headers: _headers,
      contentType: "application/json",
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "json",
      body: mergeAdditionalBodyParameters(_body, requestOptions?.additionalBodyParameters),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 402:
          throw new PaymentRequiredError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        case 503:
          throw new ServiceUnavailableError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "POST", "/ns/{namespace}/connectors");
  }
  get(namespace, id, request = {}, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__get(namespace, id, request, requestOptions));
  }
  async __get(namespace, id, request = {}, requestOptions) {
    const { include, returnUrl } = request;
    const _queryParams = {
      include: Array.isArray(include) ? include.map((item) => item) : include != null ? include : undefined,
      returnUrl
    };
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/connectors/${exports_url.encodePathParam(id)}`),
      method: "GET",
      headers: _headers,
      queryString: exports_url.queryBuilder().addMany(_queryParams).mergeAdditional(requestOptions?.queryParams).build(),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 404:
          throw new NotFoundError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "GET", "/ns/{namespace}/connectors/{id}");
  }
  delete(namespace, id, request = {}, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__delete(namespace, id, request, requestOptions));
  }
  async __delete(namespace, id, request = {}, requestOptions) {
    const { deleteDocuments } = request;
    const _queryParams = {
      deleteDocuments
    };
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/connectors/${exports_url.encodePathParam(id)}`),
      method: "DELETE",
      headers: _headers,
      queryString: exports_url.queryBuilder().addMany(_queryParams).mergeAdditional(requestOptions?.queryParams).build(),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 404:
          throw new NotFoundError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "DELETE", "/ns/{namespace}/connectors/{id}");
  }
  update(namespace, id, request = {}, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__update(namespace, id, request, requestOptions));
  }
  async __update(namespace, id, request = {}, requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/connectors/${exports_url.encodePathParam(id)}`),
      method: "PATCH",
      headers: _headers,
      contentType: "application/json",
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "json",
      body: mergeAdditionalBodyParameters(request, requestOptions?.additionalBodyParameters),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 404:
          throw new NotFoundError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "PATCH", "/ns/{namespace}/connectors/{id}");
  }
  sync(namespace, id, request = {}, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__sync(namespace, id, request, requestOptions));
  }
  async __sync(namespace, id, _request = {}, requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/connectors/${exports_url.encodePathParam(id)}/sync`),
      method: "POST",
      headers: _headers,
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 402:
          throw new PaymentRequiredError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 404:
          throw new NotFoundError(_response.error.body, _response.rawResponse);
        case 409:
          throw new ConflictError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        case 503:
          throw new ServiceUnavailableError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "POST", "/ns/{namespace}/connectors/{id}/sync");
  }
}

// node_modules/supermemory/dist/esm/generated/api/resources/documents/client/Client.js
class DocumentsClient {
  _options;
  constructor(options = {}) {
    this._options = normalizeClientOptionsWithAuth(options);
  }
  delete(namespace, request, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__delete(namespace, request, requestOptions));
  }
  async __delete(namespace, request, requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/document`),
      method: "DELETE",
      headers: _headers,
      contentType: "application/json",
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "json",
      body: mergeAdditionalBodyParameters(request, requestOptions?.additionalBodyParameters),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "DELETE", "/ns/{namespace}/document");
  }
  batchAdd(namespace, request, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__batchAdd(namespace, request, requestOptions));
  }
  async __batchAdd(namespace, request, requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/document/batch`),
      method: "POST",
      headers: _headers,
      contentType: "application/json",
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "json",
      body: mergeAdditionalBodyParameters(request, requestOptions?.additionalBodyParameters),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return {
        data: _response.body,
        rawResponse: _response.rawResponse
      };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 402:
          throw new PaymentRequiredError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "POST", "/ns/{namespace}/document/batch");
  }
  get(namespace, id, request = {}, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__get(namespace, id, request, requestOptions));
  }
  async __get(namespace, id, request = {}, requestOptions) {
    const { include } = request;
    const _queryParams = {
      include: Array.isArray(include) ? include.map((item) => item) : include != null ? include : undefined
    };
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/document/${exports_url.encodePathParam(id)}`),
      method: "GET",
      headers: _headers,
      queryString: exports_url.queryBuilder().addMany(_queryParams).mergeAdditional(requestOptions?.queryParams).build(),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 404:
          throw new NotFoundError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "GET", "/ns/{namespace}/document/{id}");
  }
  update(namespace, id, request = {}, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__update(namespace, id, request, requestOptions));
  }
  async __update(namespace, id, request = {}, requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/document/${exports_url.encodePathParam(id)}`),
      method: "PATCH",
      headers: _headers,
      contentType: "application/json",
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "json",
      body: mergeAdditionalBodyParameters(request, requestOptions?.additionalBodyParameters),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 402:
          throw new PaymentRequiredError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 404:
          throw new NotFoundError(_response.error.body, _response.rawResponse);
        case 409:
          throw new ConflictError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "PATCH", "/ns/{namespace}/document/{id}");
  }
  uploadFile(namespace, request, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__uploadFile(namespace, request, requestOptions));
  }
  async __uploadFile(namespace, request, requestOptions) {
    const _body = await newFormData();
    await _body.appendFile("file", request.file);
    if (request.supportingContext != null) {
      _body.append("supportingContext", request.supportingContext);
    }
    if (request.metadata != null) {
      _body.append("metadata", request.metadata);
    }
    if (request.group != null) {
      _body.append("group", request.group);
    }
    if (request.date != null) {
      _body.append("date", request.date);
    }
    if (request.taskType != null) {
      _body.append("taskType", request.taskType);
    }
    if (request.dreaming != null) {
      _body.append("dreaming", request.dreaming);
    }
    if (request.fileType != null) {
      _body.append("fileType", request.fileType);
    }
    if (request.mimeType != null) {
      _body.append("mimeType", request.mimeType);
    }
    const _maybeEncodedRequest = await _body.getRequest();
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, mergeOnlyDefinedHeaders({ ..._maybeEncodedRequest.headers }), requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/document/file`),
      method: "POST",
      headers: _headers,
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "file",
      duplex: _maybeEncodedRequest.duplex,
      body: _maybeEncodedRequest.body,
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return {
        data: _response.body,
        rawResponse: _response.rawResponse
      };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 402:
          throw new PaymentRequiredError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 409:
          throw new ConflictError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "POST", "/ns/{namespace}/document/file");
  }
  replaceWithFile(namespace, id, request, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__replaceWithFile(namespace, id, request, requestOptions));
  }
  async __replaceWithFile(namespace, id, request, requestOptions) {
    const _body = await newFormData();
    await _body.appendFile("file", request.file);
    if (request.supportingContext != null) {
      _body.append("supportingContext", request.supportingContext);
    }
    if (request.metadata != null) {
      _body.append("metadata", request.metadata);
    }
    if (request.group != null) {
      _body.append("group", request.group);
    }
    if (request.date != null) {
      _body.append("date", request.date);
    }
    if (request.taskType != null) {
      _body.append("taskType", request.taskType);
    }
    if (request.dreaming != null) {
      _body.append("dreaming", request.dreaming);
    }
    if (request.fileType != null) {
      _body.append("fileType", request.fileType);
    }
    if (request.mimeType != null) {
      _body.append("mimeType", request.mimeType);
    }
    const _maybeEncodedRequest = await _body.getRequest();
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, mergeOnlyDefinedHeaders({ ..._maybeEncodedRequest.headers }), requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/document/file/${exports_url.encodePathParam(id)}`),
      method: "POST",
      headers: _headers,
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "file",
      duplex: _maybeEncodedRequest.duplex,
      body: _maybeEncodedRequest.body,
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return {
        data: _response.body,
        rawResponse: _response.rawResponse
      };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 402:
          throw new PaymentRequiredError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 404:
          throw new NotFoundError(_response.error.body, _response.rawResponse);
        case 409:
          throw new ConflictError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "POST", "/ns/{namespace}/document/file/{id}");
  }
  updateFile(namespace, id, request, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__updateFile(namespace, id, request, requestOptions));
  }
  async __updateFile(namespace, id, request, requestOptions) {
    const _body = await newFormData();
    if (request.file != null) {
      await _body.appendFile("file", request.file);
    }
    if (request.supportingContext != null) {
      _body.append("supportingContext", request.supportingContext);
    }
    if (request.metadata != null) {
      _body.append("metadata", request.metadata);
    }
    if (request.group != null) {
      _body.append("group", request.group);
    }
    if (request.date != null) {
      _body.append("date", request.date);
    }
    if (request.taskType != null) {
      _body.append("taskType", request.taskType);
    }
    if (request.dreaming != null) {
      _body.append("dreaming", request.dreaming);
    }
    if (request.fileType != null) {
      _body.append("fileType", request.fileType);
    }
    if (request.mimeType != null) {
      _body.append("mimeType", request.mimeType);
    }
    const _maybeEncodedRequest = await _body.getRequest();
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, mergeOnlyDefinedHeaders({ ..._maybeEncodedRequest.headers }), requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/document/file/${exports_url.encodePathParam(id)}`),
      method: "PATCH",
      headers: _headers,
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "file",
      duplex: _maybeEncodedRequest.duplex,
      body: _maybeEncodedRequest.body,
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return {
        data: _response.body,
        rawResponse: _response.rawResponse
      };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 402:
          throw new PaymentRequiredError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 404:
          throw new NotFoundError(_response.error.body, _response.rawResponse);
        case 409:
          throw new ConflictError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "PATCH", "/ns/{namespace}/document/file/{id}");
  }
}

// node_modules/supermemory/dist/esm/generated/api/resources/memories/client/Client.js
class MemoriesClient {
  _options;
  constructor(options = {}) {
    this._options = normalizeClientOptionsWithAuth(options);
  }
  forget(namespace, request, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__forget(namespace, request, requestOptions));
  }
  async __forget(namespace, request, requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/memories`),
      method: "DELETE",
      headers: _headers,
      contentType: "application/json",
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "json",
      body: mergeAdditionalBodyParameters(request, requestOptions?.additionalBodyParameters),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "DELETE", "/ns/{namespace}/memories");
  }
  forgetMatching(namespace, request, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__forgetMatching(namespace, request, requestOptions));
  }
  async __forgetMatching(namespace, request, requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/memories/semantic`),
      method: "DELETE",
      headers: _headers,
      contentType: "application/json",
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "json",
      body: mergeAdditionalBodyParameters(request, requestOptions?.additionalBodyParameters),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return {
        data: _response.body,
        rawResponse: _response.rawResponse
      };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "DELETE", "/ns/{namespace}/memories/semantic");
  }
  get(namespace, id, request = {}, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__get(namespace, id, request, requestOptions));
  }
  async __get(namespace, id, request = {}, requestOptions) {
    const { include, relatedLimit } = request;
    const _queryParams = {
      include: Array.isArray(include) ? include.map((item) => item) : include != null ? include : undefined,
      relatedLimit
    };
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/memories/${exports_url.encodePathParam(id)}`),
      method: "GET",
      headers: _headers,
      queryString: exports_url.queryBuilder().addMany(_queryParams).mergeAdditional(requestOptions?.queryParams).build(),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 404:
          throw new NotFoundError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "GET", "/ns/{namespace}/memories/{id}");
  }
}

// node_modules/supermemory/dist/esm/generated/api/resources/namespaces/client/Client.js
class NamespacesClient {
  _options;
  constructor(options = {}) {
    this._options = normalizeClientOptionsWithAuth(options);
  }
  list(request = {}, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__list(request, requestOptions));
  }
  async __list(request = {}, requestOptions) {
    const { page, limit } = request;
    const _queryParams = {
      page,
      limit
    };
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, "ns"),
      method: "GET",
      headers: _headers,
      queryString: exports_url.queryBuilder().addMany(_queryParams).mergeAdditional(requestOptions?.queryParams).build(),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "GET", "/ns");
  }
  get(namespace, request = {}, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__get(namespace, request, requestOptions));
  }
  async __get(namespace, _request = {}, requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}`),
      method: "GET",
      headers: _headers,
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 404:
          throw new NotFoundError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "GET", "/ns/{namespace}");
  }
  delete(namespace, request = {}, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__delete(namespace, request, requestOptions));
  }
  async __delete(namespace, request = {}, requestOptions) {
    const { moveTo } = request;
    const _queryParams = {
      moveTo
    };
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}`),
      method: "DELETE",
      headers: _headers,
      queryString: exports_url.queryBuilder().addMany(_queryParams).mergeAdditional(requestOptions?.queryParams).build(),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 404:
          throw new NotFoundError(_response.error.body, _response.rawResponse);
        case 409:
          throw new ConflictError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "DELETE", "/ns/{namespace}");
  }
  update(namespace, request = {}, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__update(namespace, request, requestOptions));
  }
  async __update(namespace, request = {}, requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}`),
      method: "PATCH",
      headers: _headers,
      contentType: "application/json",
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "json",
      body: mergeAdditionalBodyParameters(request, requestOptions?.additionalBodyParameters),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 404:
          throw new NotFoundError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "PATCH", "/ns/{namespace}");
  }
}

// node_modules/supermemory/dist/esm/generated/api/resources/organization/client/Client.js
class OrganizationClient {
  _options;
  constructor(options = {}) {
    this._options = normalizeClientOptionsWithAuth(options);
  }
  get(requestOptions) {
    return HttpResponsePromise.fromPromise(this.__get(requestOptions));
  }
  async __get(requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, "organization"),
      method: "GET",
      headers: _headers,
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "GET", "/organization");
  }
  update(request, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__update(request, requestOptions));
  }
  async __update(request, requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, "organization"),
      method: "PATCH",
      headers: _headers,
      contentType: "application/json",
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "json",
      body: mergeAdditionalBodyParameters(request, requestOptions?.additionalBodyParameters),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return {
        data: _response.body,
        rawResponse: _response.rawResponse
      };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "PATCH", "/organization");
  }
}

// node_modules/supermemory/dist/esm/generated/api/resources/profiles/client/Client.js
class ProfilesClient {
  _options;
  constructor(options = {}) {
    this._options = normalizeClientOptionsWithAuth(options);
  }
  getBuckets(namespace, request = {}, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__getBuckets(namespace, request, requestOptions));
  }
  async __getBuckets(namespace, _request = {}, requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/profile/buckets`),
      method: "GET",
      headers: _headers,
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return {
        data: _response.body,
        rawResponse: _response.rawResponse
      };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "GET", "/ns/{namespace}/profile/buckets");
  }
  setBuckets(namespace, request, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__setBuckets(namespace, request, requestOptions));
  }
  async __setBuckets(namespace, request, requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/profile/buckets`),
      method: "PUT",
      headers: _headers,
      contentType: "application/json",
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "json",
      body: mergeAdditionalBodyParameters(request, requestOptions?.additionalBodyParameters),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return {
        data: _response.body,
        rawResponse: _response.rawResponse
      };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 404:
          throw new NotFoundError(_response.error.body, _response.rawResponse);
        case 409:
          throw new ConflictError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "PUT", "/ns/{namespace}/profile/buckets");
  }
  deleteBuckets(namespace, request, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__deleteBuckets(namespace, request, requestOptions));
  }
  async __deleteBuckets(namespace, request, requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/profile/buckets`),
      method: "DELETE",
      headers: _headers,
      contentType: "application/json",
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "json",
      body: mergeAdditionalBodyParameters(request, requestOptions?.additionalBodyParameters),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return {
        data: _response.body,
        rawResponse: _response.rawResponse
      };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 404:
          throw new NotFoundError(_response.error.body, _response.rawResponse);
        case 409:
          throw new ConflictError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "DELETE", "/ns/{namespace}/profile/buckets");
  }
}

// node_modules/supermemory/dist/esm/generated/Client.js
class SupermemoryClient {
  _options;
  _documents;
  _profiles;
  _memories;
  _connectors;
  _namespaces;
  _organization;
  constructor(options = {}) {
    this._options = normalizeClientOptionsWithAuth(options);
  }
  get documents() {
    return this._documents ??= new DocumentsClient(this._options);
  }
  get profiles() {
    return this._profiles ??= new ProfilesClient(this._options);
  }
  get memories() {
    return this._memories ??= new MemoriesClient(this._options);
  }
  get connectors() {
    return this._connectors ??= new ConnectorsClient(this._options);
  }
  get namespaces() {
    return this._namespaces ??= new NamespacesClient(this._options);
  }
  get organization() {
    return this._organization ??= new OrganizationClient(this._options);
  }
  add(namespace, request, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__add(namespace, request, requestOptions));
  }
  async __add(namespace, request, requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/document`),
      method: "POST",
      headers: _headers,
      contentType: "application/json",
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "json",
      body: mergeAdditionalBodyParameters(request, requestOptions?.additionalBodyParameters),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 402:
          throw new PaymentRequiredError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 409:
          throw new ConflictError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "POST", "/ns/{namespace}/document");
  }
  search(namespace, request, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__search(namespace, request, requestOptions));
  }
  async __search(namespace, request, requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/search`),
      method: "POST",
      headers: _headers,
      contentType: "application/json",
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "json",
      body: mergeAdditionalBodyParameters(request, requestOptions?.additionalBodyParameters),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 402:
          throw new PaymentRequiredError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "POST", "/ns/{namespace}/search");
  }
  profile(namespace, request = {}, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__profile(namespace, request, requestOptions));
  }
  async __profile(namespace, request = {}, requestOptions) {
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/profile`),
      method: "POST",
      headers: _headers,
      contentType: "application/json",
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "json",
      body: mergeAdditionalBodyParameters(request, requestOptions?.additionalBodyParameters),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "POST", "/ns/{namespace}/profile");
  }
  list(namespace, type, request = {}, requestOptions) {
    return HttpResponsePromise.fromPromise(this.__list(namespace, type, request, requestOptions));
  }
  async __list(namespace, type, request = {}, requestOptions) {
    const { page, limit, sort, order, ..._body } = request;
    const _queryParams = {
      page,
      limit,
      sort: sort != null ? sort : undefined,
      order: order != null ? order : undefined
    };
    const _authRequest = await this._options.authProvider.getAuthRequest();
    const _headers = mergeHeaders(_authRequest.headers, this._options?.headers, requestOptions?.headers);
    const _response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/list/${exports_url.encodePathParam(type)}`),
      method: "POST",
      headers: _headers,
      contentType: "application/json",
      queryString: exports_url.queryBuilder().addMany(_queryParams).mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "json",
      body: mergeAdditionalBodyParameters(_body, requestOptions?.additionalBodyParameters),
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options?.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options?.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options?.fetch,
      logging: this._options.logging
    });
    if (_response.ok) {
      return { data: _response.body, rawResponse: _response.rawResponse };
    }
    if (_response.error.reason === "status-code") {
      switch (_response.error.statusCode) {
        case 400:
          throw new BadRequestError(_response.error.body, _response.rawResponse);
        case 401:
          throw new UnauthorizedError(_response.error.body, _response.rawResponse);
        case 403:
          throw new ForbiddenError(_response.error.body, _response.rawResponse);
        case 500:
          throw new InternalServerError(_response.error.body, _response.rawResponse);
        default:
          throw new SupermemoryError({
            statusCode: _response.error.statusCode,
            body: _response.error.body,
            rawResponse: _response.rawResponse
          });
      }
    }
    return handleNonStatusCodeError(_response.error, _response.rawResponse, "POST", "/ns/{namespace}/list/{type}");
  }
  async fetch(input, init, requestOptions) {
    return makePassthroughRequest(input, init, {
      baseUrl: this._options.baseUrl ?? this._options.environment,
      headers: this._options.headers,
      timeoutInSeconds: this._options.timeoutInSeconds,
      maxRetries: this._options.maxRetries,
      fetch: this._options.fetch,
      logging: this._options.logging,
      getAuthHeaders: async () => (await this._options.authProvider.getAuthRequest()).headers
    }, requestOptions);
  }
}
// node_modules/supermemory/dist/esm/index.js
class Connectors extends ConnectorsClient {
  create(namespace, request, requestOptions) {
    return super.create(namespace, "provider" in request ? { body: request } : request, requestOptions);
  }
}

class Supermemory extends SupermemoryClient {
  get connectors() {
    return this._connectors ??= new Connectors(this._options);
  }
  async profileMarkdown(namespace, request = {}, requestOptions) {
    const auth2 = await this._options.authProvider.getAuthRequest();
    const response = await fetcher({
      url: exports_url.join(await Supplier.get(this._options.baseUrl) ?? await Supplier.get(this._options.environment) ?? SupermemoryEnvironment.Default, `ns/${exports_url.encodePathParam(namespace)}/profile`),
      method: "POST",
      headers: mergeHeaders(auth2.headers, this._options.headers, requestOptions?.headers, { Accept: "text/markdown" }),
      contentType: "application/json",
      queryString: exports_url.queryBuilder().mergeAdditional(requestOptions?.queryParams).build(),
      requestType: "json",
      body: request,
      responseType: "text",
      timeoutMs: (requestOptions?.timeoutInSeconds ?? this._options.timeoutInSeconds ?? 60) * 1000,
      maxRetries: requestOptions?.maxRetries ?? this._options.maxRetries,
      abortSignal: requestOptions?.abortSignal,
      fetchFn: this._options.fetch,
      logging: this._options.logging
    });
    if (response.ok)
      return response.body;
    if (response.error.reason === "status-code") {
      throw new SupermemoryError({ statusCode: response.error.statusCode, body: response.error.body, rawResponse: response.rawResponse });
    }
    return handleNonStatusCodeError(response.error, response.rawResponse, "POST", `/ns/${namespace}/profile`);
  }
}

// src/hook-api.ts
var DEFAULT_BASE_URL = "https://api.supermemory.ai";
var REQUEST_TIMEOUT_MS = 3000;
var INTEGRITY_VERSION = 1;
var SEED = "7f2a9c4b8e1d6f3a5c0b9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a";
function resolveApiVersion(baseUrl, apiVersion) {
  if (apiVersion !== undefined) {
    if (apiVersion === "v5" || apiVersion === "legacy")
      return apiVersion;
    throw new Error('Supermemory apiVersion must be "v5" or "legacy"');
  }
  let url;
  try {
    url = new URL(baseUrl || DEFAULT_BASE_URL);
  } catch {
    throw new Error("Supermemory API base URL is invalid");
  }
  return url.origin === DEFAULT_BASE_URL && /^\/*$/.test(url.pathname) && !url.username && !url.password && !url.search && !url.hash ? "v5" : "legacy";
}
function sdk(baseUrl, apiKey, tag) {
  return new Supermemory({
    apiKey,
    baseUrl: (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    headers: headers(apiKey, tag),
    timeoutInSeconds: REQUEST_TIMEOUT_MS / 1000,
    maxRetries: 0
  });
}
async function sdkRequest(request) {
  try {
    return await request;
  } catch (error) {
    const status = error?.statusCode;
    throw new Error(status ? `Supermemory request failed with HTTP ${status}` : "Supermemory request failed or timed out");
  }
}
var AGENT_ENTITY_CONTEXT = `Shared coding-agent memory for one software repository.

RULES:
- Preserve durable context that helps Claude Code, Codex, OpenCode, or Cursor continue the work
- Condense assistant responses into decisions, outcomes, and reusable knowledge
- Keep user preferences and project facts concise and independently understandable

EXTRACT:
- User preferences, accepted decisions, durable workflows, actions, and learnings
- Architecture, conventions, implementation patterns, setup requirements, and decisions

SKIP:
- Generic assistant suggestions the user did not accept
- Transient command output and low-value implementation chatter
- Granular details that do not help future work`;
function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}
function headers(apiKey, containerTag) {
  const contentHash = sha256(containerTag);
  const payload = [sha256(apiKey), contentHash, INTEGRITY_VERSION].join(":");
  const signature = createHmac("sha256", SEED).update(payload).digest("base64url");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Content-Hash": contentHash,
    "X-Request-Integrity": `v${INTEGRITY_VERSION}.${signature}`,
    "x-sm-source": "cursor"
  };
}
async function post(baseUrl, apiKey, path3, containerTag, body) {
  const response = await fetch(`${(baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "")}${path3}`, {
    method: "POST",
    headers: headers(apiKey, containerTag),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  }).catch(() => {
    throw new Error("Supermemory request failed or timed out");
  });
  if (!response.ok) {
    throw new Error(`Supermemory request failed with HTTP ${response.status}`);
  }
  return response.json().catch(() => {
    throw new Error("Supermemory returned an invalid response");
  });
}
async function addMemory(baseUrl, apiKey, content, containerTag, metadata, options = {}, apiVersion) {
  const version = resolveApiVersion(baseUrl, apiVersion);
  const result = version === "v5" ? await sdkRequest(sdk(baseUrl, apiKey, containerTag).add(containerTag, {
    content,
    id: options.customId,
    supportingContext: options.entityContext,
    metadata: {
      sm_source: "cursor",
      ...metadata
    },
    taskType: "memory",
    dreaming: "dynamic"
  }, {
    abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    maxRetries: 0
  })) : await post(baseUrl, apiKey, "/v3/documents", containerTag, {
    content,
    containerTag,
    metadata: { sm_source: "cursor", ...metadata },
    customId: options.customId,
    entityContext: options.entityContext
  });
  if (typeof result?.id !== "string" || !result.id.trim() || version === "v5" && ![
    "unknown",
    "queued",
    "extracting",
    "chunking",
    "embedding",
    "indexing",
    "done"
  ].includes(result.status) || result.status === "failed" || result.error) {
    throw new Error("Supermemory did not acknowledge the document");
  }
  return result;
}

// src/hook-state.ts
import { createHash as createHash2 } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import { join as join2 } from "node:path";
function statePath(conversationId) {
  const id = createHash2("sha256").update(conversationId || "unknown").digest("hex").slice(0, 32);
  return join2(homedir(), ".supermemory-cursor", "hook-state", `${id}.json`);
}
function readHookState(conversationId) {
  try {
    return JSON.parse(readFileSync(statePath(conversationId), "utf8"));
  } catch {
    return {};
  }
}
function writeHookState(conversationId, updates) {
  const filePath = statePath(conversationId);
  mkdirSync(join2(homedir(), ".supermemory-cursor", "hook-state"), {
    recursive: true,
    mode: 448
  });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify({ ...readHookState(conversationId), ...updates })}
`, { mode: 384 });
  renameSync(tempPath, filePath);
}
function deleteHookState(conversationId) {
  rmSync(statePath(conversationId), { force: true });
}

// src/tags.ts
import { execSync } from "node:child_process";
import { createHash as createHash3 } from "node:crypto";
import {
  existsSync,
  readFileSync as readFileSync2,
  realpathSync
} from "node:fs";
import { hostname, homedir as homedir2, userInfo } from "node:os";
import {
  basename,
  dirname,
  join as join3,
  resolve,
  sep
} from "node:path";
function sha2562(input) {
  return createHash3("sha256").update(input).digest("hex").slice(0, 16);
}
function getGitRoot(directory) {
  const isolateWorktrees = process.env.SUPERMEMORY_ISOLATE_WORKTREES === "true";
  try {
    if (isolateWorktrees) {
      return execSync("git rev-parse --show-toplevel", {
        cwd: directory,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"]
      }).trim() || null;
    }
    const gitCommonDir = execSync("git rev-parse --git-common-dir", {
      cwd: directory,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    if (gitCommonDir === ".git") {
      return execSync("git rev-parse --show-toplevel", {
        cwd: directory,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"]
      }).trim() || null;
    }
    const resolvedCommonDir = resolve(directory, gitCommonDir);
    if (basename(resolvedCommonDir) === ".git" && !resolvedCommonDir.includes(`${sep}.git${sep}`)) {
      return dirname(resolvedCommonDir);
    }
    return execSync("git rev-parse --show-toplevel", {
      cwd: directory,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim() || null;
  } catch {
    return null;
  }
}
function getProjectBasePath(directory) {
  return getGitRoot(directory) || resolve(directory);
}
function getGitEmail(directory) {
  try {
    return execSync("git config user.email", {
      cwd: getProjectBasePath(directory),
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim() || null;
  } catch {
    return null;
  }
}
function getMachineId() {
  return `${hostname()}_${userInfo().username}`;
}
function normalizeGitRemote(remoteUrl) {
  const raw = remoteUrl.trim();
  if (!raw)
    return null;
  let normalized;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      normalized = parsed.protocol === "file:" ? `file:${decodeURIComponent(parsed.pathname)}` : `${parsed.hostname.toLowerCase()}${parsed.port ? `:${parsed.port}` : ""}/${parsed.pathname.replace(/^\/+/, "")}`;
    } catch {
      normalized = raw;
    }
  } else {
    const scpStyle = raw.match(/^(?:[^@/]+@)?([^:]+):(.+)$/);
    normalized = scpStyle ? `${scpStyle[1].toLowerCase()}/${scpStyle[2]}` : `file:${resolve(raw)}`;
  }
  return normalized.replace(/[?#].*$/, "").replace(/\/+$/, "").replace(/\.git$/i, "").replace(/\/{2,}/g, "/").toLowerCase();
}
var repoInfoCache = new Map;
function getGitRepoInfo(directory) {
  const cached = repoInfoCache.get(directory);
  if (cached)
    return cached;
  try {
    const remoteUrl = execSync("git remote get-url origin", {
      cwd: directory,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
    const normalizedRemote = normalizeGitRemote(remoteUrl);
    const displayRemote = remoteUrl.replace(/\/+$/, "").replace(/\.git$/i, "");
    const separator = Math.max(displayRemote.lastIndexOf("/"), displayRemote.lastIndexOf(":"));
    const result = {
      name: displayRemote.slice(separator + 1) || null,
      normalizedRemote
    };
    repoInfoCache.set(directory, result);
    return result;
  } catch {
    const result = { name: null, normalizedRemote: null };
    repoInfoCache.set(directory, result);
    return result;
  }
}
function readJson2(filePath) {
  try {
    if (!existsSync(filePath))
      return null;
    return JSON.parse(readFileSync2(filePath, "utf-8"));
  } catch {
    return null;
  }
}
function stripJsoncComments(content) {
  let result = "";
  let index = 0;
  let inString = false;
  let singleLineComment = false;
  let multiLineComment = false;
  while (index < content.length) {
    const char = content[index];
    const next = content[index + 1];
    if (!singleLineComment && !multiLineComment && char === '"') {
      let backslashes = 0;
      for (let cursor = index - 1;cursor >= 0 && content[cursor] === "\\"; cursor--) {
        backslashes++;
      }
      if (backslashes % 2 === 0)
        inString = !inString;
      result += char;
      index++;
      continue;
    }
    if (inString) {
      result += char;
      index++;
      continue;
    }
    if (!singleLineComment && !multiLineComment && char === "/" && next === "/") {
      singleLineComment = true;
      index += 2;
      continue;
    }
    if (!singleLineComment && !multiLineComment && char === "/" && next === "*") {
      multiLineComment = true;
      index += 2;
      continue;
    }
    if (singleLineComment) {
      if (char === `
`) {
        singleLineComment = false;
        result += char;
      }
      index++;
      continue;
    }
    if (multiLineComment) {
      if (char === "*" && next === "/") {
        multiLineComment = false;
        index += 2;
        continue;
      }
      if (char === `
`)
        result += char;
      index++;
      continue;
    }
    result += char;
    index++;
  }
  return result.replace(/,\s*([}\]])/g, "$1");
}
function loadOpenCodeConfig() {
  const configDir = join3(homedir2(), ".config", "opencode");
  for (const filename of ["supermemory.jsonc", "supermemory.json"]) {
    try {
      const configPath = join3(configDir, filename);
      if (!existsSync(configPath))
        continue;
      return JSON.parse(stripJsoncComments(readFileSync2(configPath, "utf-8")));
    } catch {
      return null;
    }
  }
  return null;
}
function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function uniqueTags(tags) {
  return [
    ...new Set(tags.filter((tag) => typeof tag === "string" && tag.trim().length > 0))
  ];
}
function sanitizeRepoName(name) {
  const sanitized = name.toLowerCase().replace(/[^a-z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return sanitized.slice(0, 95).replace(/_+$/g, "") || "unknown";
}
function getProjectIdentity(directory) {
  const basePath = getProjectBasePath(directory);
  const { normalizedRemote } = getGitRepoInfo(basePath);
  const isolateWorktrees = process.env.SUPERMEMORY_ISOLATE_WORKTREES === "true";
  let localIdentity = basePath;
  try {
    localIdentity = realpathSync.native(basePath);
  } catch {}
  return sha2562(!isolateWorktrees && normalizedRemote ? normalizedRemote : `path:${localIdentity}`);
}
function getProjectName(directory) {
  const basePath = getProjectBasePath(directory);
  return getGitRepoInfo(basePath).name || basename(basePath) || "unknown";
}
function getGeneratedRepoTag(directory) {
  const name = sanitizeRepoName(getProjectName(directory)).slice(0, 72).replace(/_+$/g, "");
  return `repo_${name || "unknown"}__${getProjectIdentity(directory)}`;
}
function getLegacyRepoTag(directory) {
  return `repo_${sanitizeRepoName(getProjectName(directory))}`;
}
function getLegacyCursorUserTags(directory, config) {
  const identities = uniqueTags([
    config.userContainerTag || process.env.SUPERMEMORY_USER_TAG || process.env.CURSOR_USER_EMAIL || getGitEmail(directory) || getMachineId()
  ]);
  return identities.map((identity) => `cursor_user_${sha2562(identity)}`);
}
function getLegacyCursorProjectTags(directory, config) {
  const basePath = getProjectBasePath(directory);
  const identities = uniqueTags([
    config.projectContainerTag || process.env.SUPERMEMORY_PROJECT_TAG || basePath
  ]);
  return identities.map((identity) => `cursor_project_${sha2562(identity)}`);
}
function getLegacyClaudeTags(directory) {
  const basePath = getProjectBasePath(directory);
  const projectHash = sha2562(basePath);
  const config = readJson2(join3(basePath, ".claude", ".supermemory-claude", "config.json"));
  return {
    personal: uniqueTags([
      stringValue(config?.personalContainerTag),
      `user_project_${projectHash}`,
      `claudecode_project_${projectHash}`
    ]),
    project: uniqueTags([
      stringValue(config?.repoContainerTag),
      getLegacyRepoTag(directory)
    ]),
    repoContainerTag: stringValue(config?.repoContainerTag)
  };
}
function getLegacyCodexTags(directory) {
  const config = readJson2(join3(homedir2(), ".codex", "supermemory.json"));
  const prefix = stringValue(config?.containerTagPrefix) || "codex";
  const userIdentity = getGitEmail(directory) || process.env.USER || process.env.USERNAME || hostname();
  const userHash = sha2562(userIdentity);
  const projectHash = sha2562(getProjectBasePath(directory));
  return {
    personal: uniqueTags([
      stringValue(config?.userContainerTag),
      `${prefix}_user_${userHash}`,
      `codex_user_${userHash}`
    ]),
    project: uniqueTags([
      stringValue(config?.projectContainerTag),
      `${prefix}_project_${projectHash}`,
      `codex_project_${projectHash}`
    ]),
    projectContainerTag: stringValue(config?.projectContainerTag)
  };
}
function getLegacyOpenCodeTags(directory) {
  const config = loadOpenCodeConfig();
  const prefix = stringValue(config?.containerTagPrefix) || "opencode";
  const userIdentity = getGitEmail(directory) || process.env.USER || process.env.USERNAME || "anonymous";
  const userHash = sha2562(userIdentity);
  const projectHashes = [
    ...new Set([directory, resolve(directory), getProjectBasePath(directory)].map((value) => sha2562(value)))
  ];
  return {
    personal: uniqueTags([
      stringValue(config?.userContainerTag),
      `${prefix}_user_${userHash}`,
      `opencode_user_${userHash}`
    ]),
    project: uniqueTags([
      stringValue(config?.projectContainerTag),
      ...projectHashes.flatMap((hash) => [
        `${prefix}_project_${hash}`,
        `opencode_project_${hash}`
      ])
    ]),
    projectContainerTag: stringValue(config?.projectContainerTag)
  };
}
function getResolvedTags(directory, config) {
  const generated = getGeneratedRepoTag(directory);
  const cursorPersonal = getLegacyCursorUserTags(directory, config);
  const cursorProjects = getLegacyCursorProjectTags(directory, config);
  const claude = getLegacyClaudeTags(directory);
  const codex = getLegacyCodexTags(directory);
  const opencode = getLegacyOpenCodeTags(directory);
  const canonical = config.repoContainerTag || process.env.SUPERMEMORY_REPO_TAG || claude.repoContainerTag || codex.projectContainerTag || opencode.projectContainerTag || generated;
  const personalReads = uniqueTags([
    canonical,
    generated,
    ...cursorPersonal,
    ...claude.personal,
    ...codex.personal,
    ...opencode.personal
  ]);
  const projectReads = uniqueTags([
    canonical,
    generated,
    ...cursorProjects,
    ...claude.project,
    ...codex.project,
    ...opencode.project
  ]);
  return {
    canonical,
    user: canonical,
    project: canonical,
    projectId: getProjectIdentity(directory),
    projectName: getProjectName(directory),
    personalReads,
    projectReads,
    allReads: uniqueTags([...personalReads, ...projectReads]),
    legacyCursorPersonal: cursorPersonal,
    legacyCursorProjects: cursorProjects
  };
}

// src/hooks/types.ts
function workspaceRoot(input) {
  return input.workspace_roots?.[0] || process.env.CURSOR_PROJECT_DIR || process.cwd();
}
function conversationId(input) {
  return input.conversation_id || input.session_id || "unknown";
}

// src/runtime.ts
import { readFile } from "node:fs/promises";
import { realpathSync as realpathSync2 } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
async function readStdinText() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
async function readStdinJson() {
  return JSON.parse(await readStdinText());
}
function readTextFile(filePath) {
  return readFile(filePath, "utf8");
}
function isMainModule(metaUrl) {
  const entry = process.argv[1];
  if (!entry)
    return false;
  try {
    return realpathSync2(entry) === realpathSync2(fileURLToPath(metaUrl));
  } catch {
    return pathToFileURL(entry).href === metaUrl;
  }
}
async function runHook(handler, fallback = { continue: true }) {
  const write = process.stdout.write.bind(process.stdout);
  let answered = false;
  process.stdout.write = (...args) => {
    answered = true;
    return write(...args);
  };
  try {
    await handler(await readStdinJson());
  } catch (error) {
    if (process.env.SUPERMEMORY_DEBUG === "true") {
      console.error("[supermemory] hook failed:", error);
    }
    if (!answered)
      write(JSON.stringify(fallback));
  } finally {
    process.stdout.write = write;
  }
}

// src/hooks/capture.ts
function cleanContent(text) {
  return text.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "").replace(/<supermemory-(?:context|recall)>[\s\S]*?<\/supermemory-(?:context|recall)>/g, "").trim();
}
function textFromContent(content) {
  if (typeof content === "string")
    return cleanContent(content);
  if (!Array.isArray(content))
    return "";
  return content.flatMap((block) => {
    if (!block || typeof block !== "object")
      return [];
    const value = block;
    return value.type === "text" && typeof value.text === "string" ? [cleanContent(value.text)] : [];
  }).filter(Boolean).join(`
`);
}
function extractEntry(entry) {
  const role = entry.role ?? entry.type;
  if (role !== "user" && role !== "assistant")
    return null;
  const message = entry.message;
  const text = textFromContent(entry.content ?? message?.content);
  return text ? { role, text } : null;
}
function parseTranscript(text) {
  let entries = [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed))
      entries = parsed;
  } catch {
    entries = text.split(`
`).filter(Boolean).flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  }
  return entries.flatMap((entry) => {
    const captured = extractEntry(entry);
    return captured ? [captured] : [];
  });
}
function selectCaptureEntries(entries, start, signalExtraction, signalKeywords, signalTurnsBefore) {
  const pending = entries.slice(start);
  if (!signalExtraction)
    return pending;
  const keywords = signalKeywords.map((keyword) => keyword.toLowerCase());
  const signalIndex = pending.findLastIndex((entry) => entry.role === "user" && keywords.some((keyword) => entry.text.toLowerCase().includes(keyword)));
  if (signalIndex < 0)
    return [];
  let first = signalIndex;
  let userTurns = Math.max(1, signalTurnsBefore);
  while (first > 0 && userTurns > 1) {
    first--;
    if (pending[first]?.role === "user")
      userTurns--;
  }
  return pending.slice(first);
}
function formatCapture(entries) {
  if (entries.length === 0)
    return "";
  const parts = [`<|turn_start|>${new Date().toISOString()}`];
  for (const entry of entries) {
    parts.push(`<|start|>${entry.role}<|message|>${entry.text}<|end|>`);
  }
  parts.push("<|turn_end|>");
  return parts.join(`

`);
}
async function capture(input) {
  if ([input.status, input.reason].some((value) => ["aborted", "error"].includes(value ?? ""))) {
    return;
  }
  const transcriptPath = input.transcript_path || process.env.CURSOR_TRANSCRIPT_PATH;
  if (!transcriptPath)
    return;
  try {
    const root = workspaceRoot(input);
    const config = loadConfig(root);
    const apiKey = getApiKey(config);
    if (!apiKey)
      return;
    const id = conversationId(input);
    const state = readHookState(id);
    const entries = parseTranscript(await readTextFile(transcriptPath));
    const capturedEntries = state.transcriptPath === transcriptPath ? state.capturedEntries ?? 0 : 0;
    const start = capturedEntries <= entries.length ? capturedEntries : 0;
    const selected = selectCaptureEntries(entries, start, config.signalExtraction, config.signalKeywords, config.signalTurnsBefore);
    const content = formatCapture(selected);
    if (content.length < 100)
      return;
    const tags = getResolvedTags(root, config);
    const generation = input.generation_id || createHash4("sha256").update(content).digest("hex").slice(0, 32);
    await addMemory(config.baseUrl, apiKey, content, tags.canonical, {
      type: "conversation",
      project: tags.projectName,
      sm_project_id: tags.projectId,
      sm_scope: "personal",
      sm_capture_mode: "stop",
      sessionId: id,
      timestamp: new Date().toISOString()
    }, {
      customId: `cursor:capture:${createHash4("sha256").update(`${id}:${generation}`).digest("hex")}`,
      entityContext: AGENT_ENTITY_CONTEXT
    }, config.apiVersion);
    writeHookState(id, {
      capturedEntries: entries.length,
      transcriptPath
    });
  } catch (error) {
    if (process.env.SUPERMEMORY_DEBUG === "true") {
      console.error("[supermemory] capture failed:", error);
    }
  }
}
async function runCapture(input) {
  try {
    await capture(input);
  } finally {
    if (input.hook_event_name === "sessionEnd") {
      deleteHookState(conversationId(input));
    }
  }
}
if (isMainModule(import.meta.url)) {
  await runHook(runCapture, {});
}
export {
  selectCaptureEntries,
  runCapture,
  parseTranscript,
  formatCapture
};
