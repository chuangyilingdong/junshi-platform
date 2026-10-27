import { arow } from '../lib.js';

const MODALITIES = ['TEXT', 'IMAGE', 'VIDEO', 'MUSIC'];
const DEFAULT_PER_CALL_FEN = Object.freeze({ TEXT: 10, IMAGE: 100, VIDEO: 500, MUSIC: 200 });

function parseObject(value) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '{}')) || {}; } catch { return {}; }
}

export async function getComputePricing() {
  const value = parseObject((await arow('SELECT compute_pricing FROM platform_settings WHERE id=1').catch(() => null))?.compute_pricing);
  const perCall = {};
  for (const modality of MODALITIES) {
    const raw = value?.perCall?.[modality];
    perCall[modality] = raw === undefined || raw === null || raw === ''
      ? DEFAULT_PER_CALL_FEN[modality]
      : Math.max(0, Math.round(Number(raw) || 0));
  }
  const models = {};
  for (const [model, price] of Object.entries(value?.models && typeof value.models === 'object' ? value.models : {})) {
    const name = String(model || '').trim();
    if (name) models[name] = Math.max(0, Math.round(Number(price) || 0));
  }
  return { perCall, models, updatedAt: value?.updatedAt || null };
}

export async function priceFenFor({ modality, model = '' } = {}) {
  const pricing = await getComputePricing();
  const key = String(model || '').trim();
  if (key && Object.prototype.hasOwnProperty.call(pricing.models, key)) return Number(pricing.models[key]);
  return Number(pricing.perCall[String(modality || '').toUpperCase()] ?? 0);
}

export async function billingReadiness() {
  const pricing = await getComputePricing();
  const blockers = [];
  for (const modality of MODALITIES) {
    const unitFen = Number(pricing.perCall[modality]);
    if (!Number.isFinite(unitFen) || unitFen < 0) blockers.push(`COMPUTE_PRICE_INVALID:${modality}`);
  }
  return {
    ready: blockers.length === 0,
    basis: 'OBSERVATION_ONLY',
    charged: false,
    pricing,
    blockers,
  };
}