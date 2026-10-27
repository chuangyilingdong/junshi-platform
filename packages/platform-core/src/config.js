const deploymentMode = String(process.env.DEPLOYMENT_MODE || 'local-mock').trim();
const allowedModes = new Set(['development', 'internal-test', 'public', 'local-mock', 'mock']);
const apiMode = String(process.env.JUNSHI_API_MODE || (allowedModes.has(deploymentMode) && (deploymentMode.includes('mock') || deploymentMode === 'development') ? 'mock' : 'independent')).trim();

export const DEPLOYMENT_MODE = allowedModes.has(deploymentMode) ? deploymentMode : 'development';
export const JUNSHI_API_MODE = apiMode;
export const PORT = Number(process.env.PORT || 8788);
export const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://aicyld.com';
export const AUTH_PEPPER = String(process.env.AUTH_PEPPER || 'junshi-local-mock-pepper');

export const AI_PROVIDER = String(process.env.AI_PROVIDER || 'local-mock').trim();
export const AI_PROVIDER_MODEL = String(process.env.AI_PROVIDER_MODEL || 'junshi-mock-text-v1').trim();
export const AI_PROVIDER_ENDPOINT = String(process.env.AI_PROVIDER_ENDPOINT || '').trim();
export const AI_PROVIDER_API_KEY = String(process.env.AI_PROVIDER_API_KEY || '').trim();
export const AI_PROVIDER_TIMEOUT_MS = Math.max(1000, Math.min(300000, Number(process.env.AI_PROVIDER_TIMEOUT_MS || 120000)));
export const AI_PROVIDER_MAX_WAIT_MS = Math.max(0, Number(process.env.AI_PROVIDER_MAX_WAIT_MS ?? 1800000));
export const AI_PROVIDER_POLL_INTERVAL_MS = Math.max(250, Math.min(10000, Number(process.env.AI_PROVIDER_POLL_INTERVAL_MS || 2000)));
export const AI_PROVIDER_VOICE = String(process.env.AI_PROVIDER_VOICE || 'alloy').trim() || 'alloy';
export const AI_PROVIDER_MODALITY_ENDPOINTS = Object.freeze({});

export const CORS_ALLOWED_ORIGINS = String(
  process.env.CORS_ALLOWED_ORIGINS || [PUBLIC_SITE_URL, 'http://localhost:5173', 'http://localhost:5175', 'http://localhost:5176'].join(','),
).split(',').map((value) => value.trim()).filter(Boolean);