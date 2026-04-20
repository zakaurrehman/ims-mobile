// Port of ims-main/hooks/useMetalPrices.js for React Native.
// Uses AsyncStorage instead of localStorage; same 30-min cache + 48h history logic.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback } from 'react';

const API_KEY = '3rc1dhplhw4nkgqkeuix54cmg83w2lpvf23o8qt1b0i7m3a2za352hvz465l';
const SYMBOLS = 'LME-NI,LME-XCU,LME-ALU,LME-LEAD,LME-TIN,LME-ZNC,STEEL-SC,LCO,MO';

// 1 metric ton = 32,150.746 troy ounces (metals-api /latest uses troy oz as base unit)
const TROY_OZ_PER_MT = 32150.746;

const CACHE_MS    = 30 * 60 * 1000;  // 30 min
const MAX_AGE_MS  = 48 * 60 * 60 * 1000;  // keep 48h of history
const DAY_MS      = 24 * 60 * 60 * 1000;

const CACHE_KEY   = '@ims:metal-prices-cache';
const HISTORY_KEY = '@ims:metal-prices-history';

export const METAL_META = {
  'LME-NI':   { name: 'Nickel',       symbol: 'Ni', order: 1 },
  'LME-XCU':  { name: 'Copper',       symbol: 'Cu', order: 2 },
  'LME-ALU':  { name: 'Aluminium',    symbol: 'Al', order: 3 },
  'LME-LEAD': { name: 'Lead',         symbol: 'Pb', order: 4 },
  'LME-TIN':  { name: 'Tin',          symbol: 'Sn', order: 5 },
  'LME-ZNC':  { name: 'Zinc',         symbol: 'Zn', order: 6 },
  'STEEL-SC': { name: 'Steel Scrap',  symbol: 'St', order: 7 },
  'LCO':      { name: 'Cobalt',       symbol: 'Co', order: 8 },
  'MO':       { name: 'Molybdenum',   symbol: 'Mo', order: 9 },
};

// ─── AsyncStorage helpers (mirrors web's localStorage helpers) ───────────────
const loadHistory = async () => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

const saveHistory = async (history) => {
  try { await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
};

// Find the cached price closest to 24h ago for a given symbol
const getPrice24hAgo = (history, sym) => {
  const target = Date.now() - DAY_MS;
  let closest = null;
  let closestDiff = Infinity;
  for (const entry of history) {
    if (entry.prices?.[sym]?.price == null) continue;
    const diff = Math.abs(entry.ts - target);
    if (diff < closestDiff) {
      closestDiff = diff;
      closest = entry.prices[sym].price;
    }
  }
  return closest;
};

const dateStr = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().split('T')[0];
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export default function useMetalPrices(refreshInterval = 60 * 1000) {
  const [prices, setPrices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [apiDate, setApiDate] = useState(null);

  const fetchPrices = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // ── Check AsyncStorage cache ────────────────────────────────────────────
      if (!forceRefresh) {
        try {
          const cached = await AsyncStorage.getItem(CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.fetchedAtMs < CACHE_MS) {
              setPrices(parsed.prices);
              setApiDate(parsed.date || null);
              setLastUpdated(new Date(parsed.fetchedAtMs));
              setLoading(false);
              return;
            }
          }
        } catch {}
      }

      // ── 1. Fetch current prices ─────────────────────────────────────────────
      const url = `https://metals-api.com/api/latest?access_key=${API_KEY}&base=USD&symbols=${SYMBOLS}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`metals-api HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.info || 'metals-api returned success:false');

      const rates = json.rates || {};

      // ── 2. Fetch 24h fluctuation (best-effort, non-fatal) ──────────────────
      let fluctRates = {};
      try {
        const yesterday = dateStr(-1);
        const today     = dateStr(0);
        const fluctUrl  = `https://metals-api.com/api/fluctuation?access_key=${API_KEY}&base=USD&symbols=${SYMBOLS}&start_date=${yesterday}&end_date=${today}`;
        const fluctRes  = await fetch(fluctUrl);
        if (fluctRes.ok) {
          const fluctJson = await fluctRes.json();
          if (fluctJson.success && fluctJson.fluctuation) fluctRates = fluctJson.rates || {};
        }
      } catch {}

      // ── 3. Load history for fallback change calculation ─────────────────────
      const history = await loadHistory();

      // ── 4. Build prices object (same logic as web route.js) ─────────────────
      const incoming = {};
      Object.entries(METAL_META).forEach(([sym, meta]) => {
        // metals-api may return rate as "USD{sym}" key or plain sym (inverted)
        const usdRate = rates[`USD${sym}`] ?? (rates[sym] ? 1 / rates[sym] : null);
        if (!usdRate) return;

        const price = Math.round(usdRate * TROY_OZ_PER_MT * 100) / 100;

        let change = null, change_pct = null;
        const f = fluctRates[sym];
        if (f && f.start_rate && f.start_rate !== 0) {
          // Use fluctuation API data
          const startPrice = Math.round((1 / f.start_rate) * TROY_OZ_PER_MT * 100) / 100;
          change     = Math.round((price - startPrice) * 100) / 100;
          change_pct = Math.round(f.change_pct * 100) / 100;
        } else {
          // Fallback: calculate from history
          const prev = getPrice24hAgo(history, sym);
          if (prev != null) {
            change     = Math.round((price - prev) * 100) / 100;
            change_pct = prev !== 0
              ? Math.round(((price - prev) / prev) * 10000) / 100
              : null;
          }
        }

        incoming[sym] = { ...meta, unit: 'USD/MT', price, change, change_pct };
      });

      // ── 5. Update 48h price history ─────────────────────────────────────────
      const now = Date.now();
      const snapshot = Object.fromEntries(
        Object.entries(incoming).map(([sym, m]) => [sym, { price: m.price }])
      );
      const lastEntry = history[history.length - 1];
      if (!lastEntry || now - lastEntry.ts >= 10 * 60 * 1000) {
        history.push({ ts: now, prices: snapshot });
      }
      const trimmed = history.filter(e => e.ts >= now - MAX_AGE_MS);
      await saveHistory(trimmed);

      // ── 6. Persist cache ────────────────────────────────────────────────────
      const result = { prices: incoming, date: json.date || null, fetchedAtMs: now };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result));

      setPrices(incoming);
      setApiDate(json.date || null);
      setLastUpdated(new Date(now));
    } catch (err) {
      setError(err.message);
      // On error, serve stale cache rather than showing nothing
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.prices) {
            setPrices(parsed.prices);
            setApiDate(parsed.date || null);
            setLastUpdated(new Date(parsed.fetchedAtMs));
          }
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(() => fetchPrices(), refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPrices, refreshInterval]);

  const formatPrice = useCallback((price) => {
    if (price == null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  }, []);

  return {
    prices,
    loading,
    error,
    lastUpdated,
    apiDate,
    refresh: () => fetchPrices(true),
    formatPrice,
  };
}
