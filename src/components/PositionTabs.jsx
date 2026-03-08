import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { API_BASE } from '../utils/apiClient'
import { FEE_PER_TRANSACTION, ccySym, toUSD } from '../utils/constants'
import { loadCachedPrices, saveCachedPrices, recordPriceSnapshot } from '../utils/storage'
import { setPositionData } from '../utils/positionCalcs'

const TODAY = new Date().toISOString().slice(0, 10)

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysBetween(a, b) {
  if (!a || !b) return null
  return Math.floor((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000)
}

// ── Hardcoded fallback data ─────────────────────────────────────────────

// ── Tickers to ignore during sync ────────────────────────────────────────
// Tickers to ignore during sync (leftovers, corporate actions, etc.)
const IGNORED_TICKERS = new Set(['EUGM'])

const defaultLongPositions = [
  { ticker: 'FTNT', status: 'open', entryPrice: 84.46, quantity: 10, openDate: '2026-01-12', unrealizedPnL: (83.50 - 84.46) * 10, profitPercent: ((83.50 - 84.46) / 84.46) * 100 },
  { ticker: 'ANET', status: 'open', entryPrice: 148.83, quantity: 20, openDate: '2026-01-29', profitPercent: -10.5, unrealizedPnL: -318.67 },
  { ticker: 'SOFI', status: 'open', entryPrice: 23.17, quantity: 100, openDate: '2026-01-30', profitPercent: -19.9, unrealizedPnL: -461.31 },
  { ticker: 'RDDT', status: 'open', entryPrice: 181.30, quantity: 3, openDate: '2026-02-03', unrealizedPnL: (138.40 - 181.30) * 3, profitPercent: ((138.40 - 181.30) / 181.30) * 100 },
  { ticker: 'ENVA', status: 'open', entryPrice: 156, quantity: 5, openDate: '2026-02-10', unrealizedPnL: (137.58 - 156) * 5, profitPercent: ((137.58 - 156) / 156) * 100 },
  { ticker: 'CEG', status: 'open', entryPrice: 280.17, quantity: 2, openDate: '2026-02-12', unrealizedPnL: (318.67 - 280.17) * 2, profitPercent: ((318.67 - 280.17) / 280.17) * 100 },
  { ticker: 'CEG', status: 'open', entryPrice: 310.77, quantity: 2, openDate: '2026-02-12', unrealizedPnL: (318.67 - 310.77) * 2, profitPercent: ((318.67 - 310.77) / 310.77) * 100 },
  { ticker: 'THM', status: 'open', entryPrice: 2.29, quantity: 100, openDate: '2026-02-17', unrealizedPnL: (3.06 - 2.29) * 100, profitPercent: ((3.06 - 2.29) / 2.29) * 100 },
  { ticker: 'RIG', status: 'open', entryPrice: 6.15, quantity: 100, openDate: '2026-02-17', unrealizedPnL: (5.94 - 6.15) * 100, profitPercent: ((5.94 - 6.15) / 6.15) * 100 },
  { ticker: 'ZBIO', status: 'open', entryPrice: 27.41, quantity: 15, openDate: '2026-02-17', unrealizedPnL: (25.28 - 27.41) * 15, profitPercent: ((25.28 - 27.41) / 27.41) * 100 },
  { ticker: 'ALAB', status: 'open', entryPrice: 148.73, quantity: 8, openDate: '2026-02-17', unrealizedPnL: (118.51 - 148.73) * 8, profitPercent: ((118.51 - 148.73) / 148.73) * 100 },
  { ticker: 'RIG', status: 'open', entryPrice: 6.14, quantity: 100, openDate: '2026-02-20', unrealizedPnL: (5.94 - 6.14) * 100, profitPercent: ((5.94 - 6.14) / 6.14) * 100 },
  { ticker: 'ZBIO', status: 'open', entryPrice: 27.52, quantity: 15, openDate: '2026-02-20', unrealizedPnL: (25.28 - 27.52) * 15, profitPercent: ((25.28 - 27.52) / 27.52) * 100 },
  { ticker: 'ENVA', status: 'open', entryPrice: 138, quantity: 5, openDate: '2026-02-23', unrealizedPnL: (137.58 - 138) * 5, profitPercent: ((137.58 - 138) / 138) * 100 },
  { ticker: 'DASH', status: 'open', entryPrice: 164.14, quantity: 2, openDate: '2026-02-24', unrealizedPnL: (179.75 - 164.14) * 2, profitPercent: ((179.75 - 164.14) / 164.14) * 100 },
  { ticker: 'NU', status: 'open', entryPrice: 16.53, quantity: 20, openDate: '2026-02-24', unrealizedPnL: (14.45 - 16.53) * 20, profitPercent: ((14.45 - 16.53) / 16.53) * 100 },
  { ticker: 'TLN', status: 'open', entryPrice: 373.26, quantity: 2, openDate: '2026-02-24', unrealizedPnL: (324.61 - 373.26) * 2, profitPercent: ((324.61 - 373.26) / 373.26) * 100 },
  { ticker: 'DASH', status: 'open', entryPrice: 174.35, quantity: 2, openDate: '2026-02-25', unrealizedPnL: (179.75 - 174.35) * 2, profitPercent: ((179.75 - 174.35) / 174.35) * 100 },
  { ticker: 'THM', status: 'open', entryPrice: 2.93, quantity: 100, openDate: '2026-02-25', unrealizedPnL: (3.06 - 2.93) * 100, profitPercent: ((3.06 - 2.93) / 2.93) * 100 },
  { ticker: 'BLCO', status: 'open', entryPrice: 18.59, quantity: 40, openDate: '2026-02-25', unrealizedPnL: (17.06 - 18.59) * 40, profitPercent: ((17.06 - 18.59) / 18.59) * 100 },
  { ticker: 'NU', status: 'open', entryPrice: 15.88, quantity: 20, openDate: '2026-02-26', unrealizedPnL: (14.45 - 15.88) * 20, profitPercent: ((14.45 - 15.88) / 15.88) * 100 },
  { ticker: 'LRCX', status: 'open', entryPrice: 238.63, quantity: 2, openDate: '2026-02-26', unrealizedPnL: (199.69 - 238.63) * 2, profitPercent: ((199.69 - 238.63) / 238.63) * 100 },
  { ticker: 'SITM', status: 'open', entryPrice: 408.60, quantity: 1, openDate: '2026-03-02', unrealizedPnL: (328 - 408.60) * 1, profitPercent: ((328 - 408.60) / 408.60) * 100 },
  { ticker: 'CEG', status: 'open', entryPrice: 319.18, quantity: 2, openDate: '2026-03-03', unrealizedPnL: (318.67 - 319.18) * 2, profitPercent: ((318.67 - 319.18) / 319.18) * 100 },
  { ticker: 'NOW', status: 'open', entryPrice: 108.53, quantity: 10, openDate: '2026-03-03', profitPercent: 14.5, unrealizedPnL: 157.03 },
  { ticker: 'MELI', status: 'open', entryPrice: 1652, quantity: 1, openDate: '2026-03-03', profitPercent: 7.94, unrealizedPnL: 131.25 },
  { ticker: 'THM', status: 'open', entryPrice: 3.32, quantity: 100, openDate: '2026-03-03', unrealizedPnL: (3.06 - 3.32) * 100, profitPercent: ((3.06 - 3.32) / 3.32) * 100 },
  { ticker: 'PINS', status: 'open', entryPrice: 19.10, quantity: 30, openDate: '2026-03-03', unrealizedPnL: (19.94 - 19.10) * 30, profitPercent: ((19.94 - 19.10) / 19.10) * 100 },
  { ticker: 'LRMR', status: 'open', entryPrice: 5.30, quantity: 100, openDate: '2026-03-03', unrealizedPnL: (5.35 - 5.30) * 100, profitPercent: ((5.35 - 5.30) / 5.30) * 100 },
  { ticker: 'ARRY', status: 'open', entryPrice: 7.29, quantity: 100, openDate: '2026-03-03', unrealizedPnL: (6.80 - 7.29) * 100, profitPercent: ((6.80 - 7.29) / 7.29) * 100 },
  { ticker: 'AU', status: 'open', entryPrice: 115, quantity: 5, openDate: '2026-03-03', unrealizedPnL: (106.40 - 115) * 5, profitPercent: ((106.40 - 115) / 115) * 100 },
  { ticker: 'AU', status: 'open', entryPrice: 115.55, quantity: 5, openDate: '2026-03-03', unrealizedPnL: (106.40 - 115.55) * 5, profitPercent: ((106.40 - 115.55) / 115.55) * 100 },
  { ticker: 'SITM', status: 'open', entryPrice: 410, quantity: 1, openDate: '2026-03-03', unrealizedPnL: (328 - 410) * 1, profitPercent: ((328 - 410) / 410) * 100 },
  { ticker: 'OKTA', status: 'open', entryPrice: 71.73, quantity: 10, openDate: '2026-03-04', profitPercent: 12.6, unrealizedPnL: 90.65 },
  { ticker: 'COHR', status: 'open', entryPrice: 248.19, quantity: 3, openDate: '2026-03-07', unrealizedPnL: (237 - 248.19) * 3, profitPercent: ((237 - 248.19) / 248.19) * 100 },
  { ticker: 'OKLO', status: 'open', entryPrice: 63.03, quantity: 10, openDate: '2026-03-05', unrealizedPnL: (58.22 - 63.03) * 10, profitPercent: ((58.22 - 63.03) / 63.03) * 100 },
  { ticker: 'OKLO', status: 'open', entryPrice: 59.04, quantity: 10, openDate: '2026-03-07', unrealizedPnL: (58.22 - 59.04) * 10, profitPercent: ((58.22 - 59.04) / 59.04) * 100 },
  { ticker: 'ONDS', status: 'open', entryPrice: 10.86, quantity: 100, openDate: '2026-01-29', profitPercent: -9.3, unrealizedPnL: -101.00 },
  { ticker: 'COGT', status: 'open', entryPrice: 38.58, quantity: 35, openDate: '2026-01-28', unrealizedPnL: (37.80 - 38.58) * 35, profitPercent: ((37.80 - 38.58) / 38.58) * 100 },
  { ticker: 'SNDK', status: 'open', entryPrice: 542.17, quantity: 2, openDate: '2026-03-06', unrealizedPnL: (522 - 542.17) * 2, profitPercent: ((522 - 542.17) / 542.17) * 100 },
  { ticker: 'ORCL', status: 'open', entryPrice: 153.06, quantity: 4, openDate: '2026-03-06', unrealizedPnL: (152.56 - 153.06) * 4, profitPercent: ((152.56 - 153.06) / 153.06) * 100 },
  { ticker: 'STRL', status: 'open', entryPrice: 413.19, quantity: 3, openDate: '2026-03-04', unrealizedPnL: (391.25 - 413.19) * 3, profitPercent: ((391.25 - 413.19) / 413.19) * 100 },
  { ticker: 'BTCWEUR', status: 'open', entryPrice: 15.04, quantity: 100, openDate: '2026-03-07', currency: 'EUR', unrealizedPnL: (14.06 - 15.04) * 100, profitPercent: ((14.06 - 15.04) / 15.04) * 100 },
  { ticker: 'BTCE', status: 'open', entryPrice: 55.98, quantity: 100, openDate: '2026-03-04', unrealizedPnL: (52.39 - 55.98) * 100, profitPercent: ((52.39 - 55.98) / 55.98) * 100 },
  { ticker: 'WHR', status: 'open', entryPrice: 59.12, quantity: 2, openDate: '2026-03-06', unrealizedPnL: (58.90 - 59.12) * 2, profitPercent: ((58.90 - 59.12) / 59.12) * 100 },
  { ticker: 'CIEN', status: 'open', entryPrice: 284.28, quantity: 6, openDate: '2026-03-05', unrealizedPnL: (292.5 - 284.28) * 6, profitPercent: ((292.5 - 284.28) / 284.28) * 100 },
  { ticker: 'MU', status: 'open', entryPrice: 413.40, quantity: 2, openDate: '2026-02-25', unrealizedPnL: (369.17 - 413.40) * 2, profitPercent: ((369.17 - 413.40) / 413.40) * 100 },
  { ticker: 'GE', status: 'open', entryPrice: 325.78, quantity: 1, openDate: '2026-03-05', unrealizedPnL: (322.12 - 325.78) * 1, profitPercent: ((322.12 - 325.78) / 325.78) * 100 },
  { ticker: 'AMAT', status: 'open', entryPrice: 328.17, quantity: 2, openDate: '2026-03-06', unrealizedPnL: (324.74 - 328.17) * 2, profitPercent: ((324.74 - 328.17) / 328.17) * 100 },
  { ticker: 'HYMC', status: 'open', entryPrice: 40.20, quantity: 10, openDate: '2026-03-06', unrealizedPnL: (39.30 - 40.20) * 10, profitPercent: ((39.30 - 40.20) / 40.20) * 100 },
  { ticker: 'COHR', status: 'open', entryPrice: 255.17, quantity: 2, openDate: '2026-03-04', unrealizedPnL: (237.00 - 255.17) * 2, profitPercent: ((237.00 - 255.17) / 255.17) * 100 },
  { ticker: 'IREN', status: 'open', entryPrice: 38.87, quantity: 15, openDate: '2026-03-05', unrealizedPnL: (36.71 - 38.87) * 15, profitPercent: ((36.71 - 38.87) / 38.87) * 100 },
]

const defaultShortPositions = [
  { ticker: 'LITE', status: 'open', entryPrice: 716.95, quantity: 3, exitPrice: 500, openDate: '2026-02-26', profitPercent: 20.8, unrealizedPnL: 446.85 },
  { ticker: 'APP', status: 'open', entryPrice: 447.75, quantity: 6, openDate: '2026-02-26', unrealizedPnL: (447.75 - 499.17) * 6, profitPercent: ((447.75 - 499.17) / 447.75) * 100 },
  { ticker: 'CAT', status: 'open', entryPrice: 742, quantity: 1, openDate: '2026-03-02', profitPercent: 8.54, unrealizedPnL: 63.43 },
  { ticker: 'MDB', status: 'open', entryPrice: 244.11, quantity: 6, openDate: '2026-03-03', unrealizedPnL: (244.11 - 269.95) * 6, profitPercent: ((244.11 - 269.95) / 244.11) * 100 },
  { ticker: 'POWL', status: 'open', entryPrice: 521, quantity: 2, openDate: '2026-03-04', unrealizedPnL: (521 - 489) * 2, profitPercent: ((521 - 489) / 521) * 100 },
  { ticker: 'POWL', status: 'open', entryPrice: 487.26, quantity: 1, openDate: '2026-03-07', unrealizedPnL: (487.26 - 489) * 1, profitPercent: ((487.26 - 489) / 487.26) * 100 },
  { ticker: 'CRDO', status: 'open', entryPrice: 113.93, quantity: 5, openDate: '2026-03-05', unrealizedPnL: (113.93 - 109.11) * 5, profitPercent: ((113.93 - 109.11) / 113.93) * 100 },
  { ticker: 'CRWD', status: 'open', entryPrice: 398.61, quantity: 10, openDate: '2026-03-05', unrealizedPnL: (398.61 - 428.70) * 10, profitPercent: ((398.61 - 428.70) / 398.61) * 100 },
]

const defaultClosedLongPositions = [
  {
    ticker: 'ANET',
    status: 'closed',
    entryPrice: 132.68,
    quantity: 30,
    exitPrice: 128.86,
    profitDollar: -114.50,
    openDate: '2026-01-06',
    closeDate: '2026-01-07',
  },
  {
    ticker: 'ANET',
    status: 'closed',
    entryPrice: 130.93,
    quantity: 35,
    exitPrice: 130.01,
    profitDollar: -32.15,
    openDate: '2026-01-07',
    closeDate: '2026-01-20',
  },
  {
    ticker: 'HY9H',
    status: 'closed',
    entryPrice: 510,
    quantity: 1,
    exitPrice: 560,
    profitDollar: 50,
    openDate: '2026-03-04',
    closeDate: '2026-03-04',
    currency: 'EUR',
  },
  {
    ticker: 'SAM',
    status: 'closed',
    entryPrice: 1.2136,
    quantity: 2500,
    exitPrice: 1.0144,
    profitDollar: -466.64,
    fees: 0,
    openDate: '2026-01-30',
    closeDate: '2026-03-07',
    currency: 'CAD',
  },
  {
    ticker: 'FCX',
    status: 'closed',
    entryPrice: 64.41,
    quantity: 13,
    exitPrice: 64.60,
    profitPercent: 0.29,
    profitDollar: 2.46,
    fees: 1.05,
    openDate: '2026-01-26',
    closeDate: '2026-02-04',
  },
  {
    ticker: 'CRDO',
    status: 'closed',
    entryPrice: (2 * 113.54 + 4 * 99.53) / 6,
    quantity: 6,
    exitPrice: 105.70,
    profitDollar: (105.70 - (2 * 113.54 + 4 * 99.53) / 6) * 6,
    fees: 3 * FEE_PER_TRANSACTION, // 2 buys + 1 sell
    openDate: '2026-03-02',
    closeDate: '2026-03-04',
  },
  {
    ticker: 'CRDO',
    status: 'closed',
    entryPrice: (2 * 132.66 + 1 * 121.55 + 3 * 130.90) / 6,
    quantity: 6,
    exitPrice: 130.35,
    profitDollar: (130.35 - (2 * 132.66 + 1 * 121.55 + 3 * 130.90) / 6) * 6,
    fees: 4 * FEE_PER_TRANSACTION, // 3 buys + 1 sell
    openDate: '2026-02-10',
    closeDate: '2026-02-18',
  },
  {
    ticker: 'NVDA',
    status: 'closed',
    entryPrice: 173.39,
    quantity: 1,
    exitPrice: 182.63,
    profitDollar: (182.63 - 173.39) * 1,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-03-02',
    closeDate: '2026-03-04',
  },
  {
    ticker: 'AD',
    status: 'closed',
    entryPrice: 50.10,
    quantity: 10,
    exitPrice: 47.51,
    profitDollar: (47.51 - 50.10) * 10,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-01-23',
    closeDate: '2026-01-26',
  },
  {
    ticker: 'GOOG',
    status: 'closed',
    entryPrice: (1 * 301.64 + 1 * 299) / 2,
    quantity: 2,
    exitPrice: 304.75,
    profitDollar: (304.75 - (1 * 301.64 + 1 * 299) / 2) * 2,
    fees: 3 * FEE_PER_TRANSACTION, // 2 buys + 1 sell
    openDate: '2026-02-17',
    closeDate: '2026-03-04',
  },
  {
    ticker: 'APP',
    status: 'closed',
    entryPrice: (1 * 556 + 1 * 526.54 + 1 * 499 + 1 * 470.77 + 1 * 383.85) / 5,
    quantity: 5,
    exitPrice: (1 * 450 + 2 * 436.47 + 2 * 435.42) / 5,
    profitDollar: ((1 * 450 + 2 * 436.47 + 2 * 435.42) / 5 - (1 * 556 + 1 * 526.54 + 1 * 499 + 1 * 470.77 + 1 * 383.85) / 5) * 5,
    fees: 9 * FEE_PER_TRANSACTION, // 4 buys + 1 buy + 1 sell + 2 sells + 1 sell (hint: not grouped, just 9 fills)
    openDate: '2026-01-30',
    closeDate: '2026-02-26',
  },
  {
    ticker: 'AMZN',
    status: 'closed',
    entryPrice: 208.20,
    quantity: 3,
    exitPrice: 207.40,
    profitDollar: (207.40 - 208.20) * 3,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-02-20',
    closeDate: '2026-02-27',
  },
  {
    ticker: 'ADSK',
    status: 'closed',
    entryPrice: (4 * 235.4 + 2 * 246.82) / 6,
    quantity: 6,
    exitPrice: 252.92,
    profitDollar: (252.92 - (4 * 235.4 + 2 * 246.82) / 6) * 6,
    fees: 3 * FEE_PER_TRANSACTION, // 2 buys + 1 sell
    openDate: '2026-02-27',
    closeDate: '2026-03-03',
  },
  {
    ticker: 'ALSTI',
    status: 'closed',
    entryPrice: (15 * 65.51333 + 8 * 64.1) / 23,
    quantity: 23,
    exitPrice: (4 * 55 + 2 * 55.9 + 2 * 57 + 2 * 58 + 2 * 59 + 11 * 55.6) / 23,
    profitDollar: ((4 * 55 + 2 * 55.9 + 2 * 57 + 2 * 58 + 2 * 59 + 11 * 55.6) / 23 - (15 * 65.51333 + 8 * 64.1) / 23) * 23,
    fees: 8 * FEE_PER_TRANSACTION, // 2 buys + 6 sells
    openDate: '2025-10-13',
    closeDate: '2026-01-14',
    currency: 'EUR',
  },
  {
    ticker: 'AUGO',
    status: 'closed',
    entryPrice: (3 * 73.945 + 1 * 73.64) / 4,
    quantity: 4,
    exitPrice: 74,
    profitDollar: (74 - (3 * 73.945 + 1 * 73.64) / 4) * 4,
    fees: 3 * FEE_PER_TRANSACTION, // 2 buys + 1 sell
    openDate: '2026-01-29',
    closeDate: '2026-01-29',
  },
  {
    ticker: 'AU',
    status: 'closed',
    entryPrice: 88.82,
    quantity: 10,
    exitPrice: 104.02,
    profitDollar: (104.02 - 88.82) * 10,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-02-02',
    closeDate: '2026-02-06',
  },
  {
    ticker: 'BE',
    status: 'closed',
    entryPrice: (2 * 146.7 + 2 * 140 + 2 * 136.5 + 2 * 150.73 + 6 * 145 + 2 * 157 + 3 * 174.32 + 2 * 165.13) / 21,
    quantity: 21,
    exitPrice: (7 * 159.61 + 14 * 165.36) / 21,
    profitDollar: ((7 * 159.61 + 14 * 165.36) / 21 - (2 * 146.7 + 2 * 140 + 2 * 136.5 + 2 * 150.73 + 6 * 145 + 2 * 157 + 3 * 174.32 + 2 * 165.13) / 21) * 21,
    fees: 10 * FEE_PER_TRANSACTION, // 8 buys + 2 sells
    openDate: '2026-02-12',
    closeDate: '2026-02-26',
  },
  {
    ticker: 'APH',
    status: 'closed',
    entryPrice: (2 * 149 + 33 * 145.3) / 35,
    quantity: 35,
    exitPrice: (15 * 148.02 + 20 * 146.001) / 35,
    profitDollar: ((15 * 148.02 + 20 * 146.001) / 35 - (2 * 149 + 33 * 145.3) / 35) * 35,
    fees: 5 * FEE_PER_TRANSACTION, // 3 buys + 2 sells
    openDate: '2026-01-14',
    closeDate: '2026-01-28',
  },
  {
    ticker: 'APH',
    status: 'closed',
    entryPrice: (2 * 145 + 4 * 141.5) / 6,
    quantity: 6,
    exitPrice: 143.78,
    profitDollar: (143.78 - (2 * 145 + 4 * 141.5) / 6) * 6,
    fees: 3 * FEE_PER_TRANSACTION, // 2 buys + 1 sell
    openDate: '2026-01-28',
    closeDate: '2026-01-28',
  },
  {
    ticker: 'APH',
    status: 'closed',
    entryPrice: (1 * 144.24 + 2 * 145.1) / 3,
    quantity: 3,
    exitPrice: 146.4,
    profitDollar: (146.4 - (1 * 144.24 + 2 * 145.1) / 3) * 3,
    fees: 3 * FEE_PER_TRANSACTION, // 2 buys + 1 sell
    openDate: '2026-01-30',
    closeDate: '2026-02-03',
  },
  {
    ticker: 'APH',
    status: 'closed',
    entryPrice: (10 * 141.75 + 5 * 130.1 + 2 * 135.6 + 2 * 130) / 19,
    quantity: 19,
    exitPrice: (9 * 130.37 + 10 * 136.56) / 19,
    profitDollar: ((9 * 130.37 + 10 * 136.56) / 19 - (10 * 141.75 + 5 * 130.1 + 2 * 135.6 + 2 * 130) / 19) * 19,
    fees: 6 * FEE_PER_TRANSACTION, // 4 buys + 2 sells
    openDate: '2026-02-04',
    closeDate: '2026-03-05',
  },
  {
    ticker: 'ASML',
    status: 'closed',
    entryPrice: 1455.42,
    quantity: 1,
    exitPrice: 1489.38,
    profitDollar: (1489.38 - 1455.42) * 1,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-02-20',
    closeDate: '2026-02-24',
  },
  {
    ticker: 'ASML',
    status: 'closed',
    entryPrice: 1405.5,
    quantity: 2,
    exitPrice: 1403,
    profitDollar: (1403 - 1405.5) * 2,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-03-04',
    closeDate: '2026-03-04',
  },
  {
    ticker: 'CRML',
    status: 'closed',
    entryPrice: (260 * 11.8 + 220 * 13.65) / 480,
    quantity: 480,
    exitPrice: (240 * 14.455 + 240 * 13.64) / 480,
    profitDollar: ((240 * 14.455 + 240 * 13.64) - (260 * 11.8 + 220 * 13.65)),
    fees: 4 * FEE_PER_TRANSACTION, // 2 buys + 2 sells
    openDate: '2026-01-06',
    closeDate: '2026-01-13',
  },
  {
    ticker: 'CRML',
    status: 'closed',
    entryPrice: (10 * 18.5 + 10 * 18.3 + 10 * 17.93 + 50 * 18.555 + 20 * 19.05 + 20 * 17.55 + 65 * 16.04) / 185,
    quantity: 185,
    exitPrice: (80 * 14.5 + 38 * 15 + 67 * 14.5) / 185,
    profitDollar: ((80 * 14.5 + 38 * 15 + 67 * 14.5) - (10 * 18.5 + 10 * 18.3 + 10 * 17.93 + 50 * 18.555 + 20 * 19.05 + 20 * 17.55 + 65 * 16.04)),
    fees: 10 * FEE_PER_TRANSACTION, // 7 buys + 3 sells
    openDate: '2026-01-22',
    closeDate: '2026-02-03',
  },
  {
    ticker: 'COLL',
    status: 'closed',
    entryPrice: 47.7,
    quantity: 100,
    exitPrice: 44.4,
    profitDollar: (44.4 - 47.7) * 100,
    fees: 3 * FEE_PER_TRANSACTION, // 2 buys + 1 sell
    openDate: '2026-01-20',
    closeDate: '2026-01-27',
  },
  {
    ticker: 'DUOL',
    status: 'closed',
    entryPrice: (2 * 148.9 + 5 * 153.55) / 7,
    quantity: 7,
    exitPrice: 135.23,
    profitDollar: (135.23 - (2 * 148.9 + 5 * 153.55) / 7) * 7,
    fees: 3 * FEE_PER_TRANSACTION, // 2 buys + 1 sell
    openDate: '2026-01-20',
    closeDate: '2026-01-30',
  },
  {
    ticker: 'BWXT',
    status: 'closed',
    entryPrice: 212,
    quantity: 5,
    exitPrice: 199.78,
    profitDollar: (199.78 - 212) * 5,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-01-29',
    closeDate: '2026-02-10',
  },
  {
    ticker: 'CLS',
    status: 'closed',
    entryPrice: (308.85 + 293 + 283.35 + 284 + 276.15 + 268.82 + 298.17 + 297.64 + 276.06 + 2 * 275.88) / 11,
    quantity: 11,
    exitPrice: (3 * 311.45 + 6 * 292.77 + 2 * 278.7) / 11,
    profitDollar: ((3 * 311.45 + 6 * 292.77 + 2 * 278.7) - (308.85 + 293 + 283.35 + 284 + 276.15 + 268.82 + 298.17 + 297.64 + 276.06 + 2 * 275.88)),
    fees: 11 * FEE_PER_TRANSACTION, // 8 buys + 3 sells
    openDate: '2026-01-26',
    closeDate: '2026-02-26',
  },
  {
    ticker: 'CPRX',
    status: 'closed',
    entryPrice: 24.88,
    quantity: 30,
    exitPrice: 23.67,
    profitDollar: (23.67 - 24.88) * 30,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-02-03',
    closeDate: '2026-02-11',
  },
  {
    ticker: 'ASTS',
    status: 'closed',
    entryPrice: 80.89,
    quantity: 5,
    exitPrice: 86.69,
    profitDollar: (86.69 - 80.89) * 5,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-02-17',
    closeDate: '2026-02-26',
  },
  {
    ticker: 'CRM',
    status: 'closed',
    entryPrice: 186,
    quantity: 4,
    exitPrice: 192.88,
    profitDollar: (192.88 - 186) * 4,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-02-25',
    closeDate: '2026-03-02',
  },
  {
    ticker: 'CSCO',
    status: 'closed',
    entryPrice: (3 * 85.48 + 1 * 78.9) / 4,
    quantity: 4,
    exitPrice: 78.85,
    profitDollar: (78.85 - (3 * 85.48 + 1 * 78.9) / 4) * 4,
    fees: 3 * FEE_PER_TRANSACTION, // 2 buys + 1 sell
    openDate: '2026-02-11',
    closeDate: '2026-03-03',
  },
  {
    ticker: 'DUOL',
    status: 'closed',
    entryPrice: (5 * 86 + 5 * 89.27) / 10,
    quantity: 10,
    exitPrice: 100,
    profitDollar: (100 - (5 * 86 + 5 * 89.27) / 10) * 10,
    fees: 3 * FEE_PER_TRANSACTION, // 2 buys + 1 sell
    openDate: '2026-02-27',
    closeDate: '2026-02-27',
  },
  {
    ticker: 'ZETA',
    status: 'closed',
    entryPrice: 23.66,
    quantity: 50,
    exitPrice: 22.853,
    profitDollar: (22.853 - 23.66) * 50,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-01-13',
    closeDate: '2026-01-14',
  },
  {
    ticker: 'ZETA',
    status: 'closed',
    entryPrice: 21.4,
    quantity: 10,
    exitPrice: 20,
    profitDollar: (20 - 21.4) * 10,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-01-22',
    closeDate: '2026-01-27',
  },
  {
    ticker: 'WDC',
    status: 'closed',
    entryPrice: 265,
    quantity: 1,
    exitPrice: 283.5,
    profitDollar: (283.5 - 265) * 1,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-01-29',
    closeDate: '2026-01-29',
  },
  {
    ticker: 'WDC',
    status: 'closed',
    entryPrice: (265 + 259.34 + 283.67 + 267) / 4,
    quantity: 4,
    exitPrice: 272,
    profitDollar: (272 - (265 + 259.34 + 283.67 + 267) / 4) * 4,
    fees: 5 * FEE_PER_TRANSACTION, // 4 buys + 1 sell
    openDate: '2026-01-30',
    closeDate: '2026-02-06',
  },
  {
    ticker: 'W',
    status: 'closed',
    entryPrice: (10 * 94.4 + 2 * 89.8) / 12,
    quantity: 12,
    exitPrice: 92.3,
    profitDollar: (92.3 - (10 * 94.4 + 2 * 89.8) / 12) * 12,
    fees: 3 * FEE_PER_TRANSACTION, // 2 buys + 1 sell
    openDate: '2026-02-04',
    closeDate: '2026-02-09',
  },
  {
    ticker: 'WWD',
    status: 'closed',
    entryPrice: 388.5,
    quantity: 2,
    exitPrice: 392.86,
    profitDollar: (392.86 - 388.5) * 2,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-02-11',
    closeDate: '2026-02-18',
  },
  {
    ticker: 'WDAY',
    status: 'closed',
    entryPrice: (4 * 126 + 4 * 122.15 + 4 * 116) / 12,
    quantity: 12,
    exitPrice: 131.07,
    profitDollar: (131.07 - (4 * 126 + 4 * 122.15 + 4 * 116) / 12) * 12,
    fees: 4 * FEE_PER_TRANSACTION, // 3 buys + 1 sell
    openDate: '2026-02-24',
    closeDate: '2026-02-27',
  },
  {
    ticker: 'WGR',
    status: 'closed',
    entryPrice: (6000 * 0.16 + 930 * 0.155 + 8000 * 0.17) / 14930,
    quantity: 14930,
    exitPrice: 0.17,
    profitDollar: (0.17 * 14930 - (6000 * 0.16 + 930 * 0.155 + 8000 * 0.17)),
    fees: 4 * FEE_PER_TRANSACTION, // 3 buys + 1 sell
    openDate: '2025-10-13',
    closeDate: '2025-10-27',
    currency: 'AUD',
  },
  {
    ticker: 'WGR',
    status: 'closed',
    entryPrice: 0.16,
    quantity: 12000,
    exitPrice: 0.215,
    profitDollar: (0.215 - 0.16) * 12000,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2025-11-07',
    closeDate: '2026-01-06',
    currency: 'AUD',
  },
  {
    ticker: 'VRT',
    status: 'closed',
    entryPrice: 244.22,
    quantity: 2,
    exitPrice: 257.2,
    profitDollar: (257.2 - 244.22) * 2,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-02-26',
    closeDate: '2026-03-02',
  },
  {
    ticker: 'VIK',
    status: 'closed',
    entryPrice: (10 * 77.17 + 10 * 76.04) / 20,
    quantity: 20,
    exitPrice: 77.5,
    profitDollar: (77.5 - (10 * 77.17 + 10 * 76.04) / 20) * 20,
    fees: 3 * FEE_PER_TRANSACTION, // 2 buys + 1 sell
    openDate: '2026-02-10',
    closeDate: '2026-02-17',
  },
  {
    ticker: 'SPY PS',
    status: 'closed',
    entryPrice: 4.20,   // net debit: bought 680P @ 7.58, sold 660P @ 3.38
    quantity: 100,       // 1 options contract = 100 units
    exitPrice: 5.62,     // net credit: sold 680P @ 7.39, bought 660P @ 1.77
    profitDollar: (5.62 - 4.20) * 100,
    fees: 3.50, // 4 option fills
    openDate: '2026-02-04',
    closeDate: '2026-02-17',
  },
  {
    ticker: 'TMUS',
    status: 'closed',
    entryPrice: (1 * 197.7 + 2 * 200.53) / 3,
    quantity: 3,
    exitPrice: 218.28,
    profitDollar: (218.28 - (1 * 197.7 + 2 * 200.53) / 3) * 3,
    fees: 3 * FEE_PER_TRANSACTION, // 2 buys + 1 sell
    openDate: '2026-02-02',
    closeDate: '2026-02-13',
  },
  {
    ticker: 'SPXC',
    status: 'closed',
    entryPrice: 235.5,
    quantity: 2,
    exitPrice: 230.51,
    profitDollar: (230.51 - 235.5) * 2,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-02-12',
    closeDate: '2026-02-12',
  },
  {
    ticker: 'TOI',
    status: 'closed',
    entryPrice: 135.22,
    quantity: 30,
    exitPrice: 85.78,
    profitDollar: -1483.13,
    fees: 0.93,
    openDate: '2025-11-15',
    closeDate: '2026-02-11',
    currency: 'CAD',
  },
  {
    ticker: 'TOI',
    status: 'closed',
    entryPrice: 153.81,
    quantity: 30,
    exitPrice: 111.52,
    profitDollar: -1268.63,
    fees: 1,
    openDate: '2025-10-15',
    closeDate: '2026-01-16',
    currency: 'CAD',
  },
  {
    ticker: 'VAL',
    status: 'closed',
    entryPrice: 59,
    quantity: 10,
    exitPrice: 62.06,
    profitDollar: (62.06 - 59) * 10,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-02-05',
    closeDate: '2026-02-06',
  },
  {
    ticker: 'USAR',
    status: 'closed',
    entryPrice: 22.45,
    quantity: 30,
    exitPrice: 24.85,
    profitDollar: (24.85 - 22.45) * 30,
    fees: 2 * FEE_PER_TRANSACTION, // 1 buy + 1 sell
    openDate: '2026-01-29',
    closeDate: '2026-02-03',
  },
  {
    ticker: 'TRMD',
    status: 'closed',
    entryPrice: (20 * 24.4 + 40 * 24.46) / 60,
    quantity: 60,
    exitPrice: 24.8,
    profitDollar: (24.8 - (20 * 24.4 + 40 * 24.46) / 60) * 60,
    fees: 3 * FEE_PER_TRANSACTION, // 2 buys + 1 sell
    openDate: '2026-01-28',
    closeDate: '2026-02-03',
  },
  {
    ticker: 'TBPH',
    status: 'closed',
    entryPrice: 20.41,
    quantity: 100,
    exitPrice: 19.34,
    profitDollar: (19.34 - 20.41) * 100,
    fees: 0.55, // $0.16 buy + $0.39 sell
    openDate: '2026-01-20',
    closeDate: '2026-01-28',
  },
  {
    ticker: 'TWLO',
    status: 'closed',
    entryPrice: 140.68,
    quantity: 3,
    exitPrice: 138.25,
    profitDollar: -7.29,
    fees: 0.35,
    openDate: '2025-12-20',
    closeDate: '2026-01-09',
  },
]

const defaultClosedShortPositions = [
  {
    ticker: 'DELL',
    status: 'closed',
    entryPrice: (4 * 142 + 4 * 145.06) / 8,
    quantity: 8,
    exitPrice: 147.28,
    profitDollar: ((4 * 142 + 4 * 145.06) / 8 - 147.28) * 8,
    fees: 3 * FEE_PER_TRANSACTION, // 2 sells(open) + 1 buy(close)
    openDate: '2026-02-27',
    closeDate: '2026-02-27',
  },
  {
    ticker: 'COHR',
    status: 'closed',
    entryPrice: 298.71,
    quantity: 1,
    exitPrice: 264.85,
    profitDollar: 33.86,
    openDate: '2026-03-02',
    closeDate: '2026-03-04',
  },
  {
    ticker: 'FCX',
    status: 'closed',
    entryPrice: 67.57,
    quantity: 4,
    exitPrice: 66.47,
    profitPercent: 1.63,
    profitDollar: 4.40,
    fees: 0.70,
    openDate: '2026-02-26',
    closeDate: '2026-03-04',
  },
  {
    ticker: 'HYMC',
    status: 'closed',
    entryPrice: 51.28,
    quantity: 10,
    exitPrice: 47.87,
    profitPercent: 6.65,
    profitDollar: 34.08,
    fees: 1.40,
    openDate: '2026-03-02',
    closeDate: '2026-03-05',
  },
  {
    ticker: 'CCJ',
    status: 'closed',
    entryPrice: 121.49,
    quantity: 4,
    exitPrice: 112.94,
    profitPercent: 7.04,
    profitDollar: 34.20,
    fees: 0.70,
    openDate: '2026-03-02',
    closeDate: '2026-03-05',
  },
]

// ── Calculation helpers (used by Header) ────────────────────────────────
// setPositionData, calcMyCapital, calcCurrentlyInvested, calcProfit, calcDailyPnL
// live in ../utils/positionCalcs. setPositionData is imported here to keep
// module-level state in sync; the calc functions are consumed by Header.jsx.

// ── Helper: calculate % gain/loss ───────────────────────────────────────

function calcPnlPercent(position, isShort = false) {
  if (position.profitPercent != null && position.profitPercent !== 0) {
    return position.profitPercent
  }
  if (position.status === 'closed' && position.exitPrice && position.entryPrice) {
    const raw = ((position.exitPrice - position.entryPrice) / position.entryPrice) * 100
    return isShort ? -raw : raw
  }
  const totalCost = (position.entryPrice || 0) * (position.quantity || 0)
  if (totalCost > 0) {
    // Use unrealizedPnL, realizedPnL, or profitDollar
    const pnl = position.unrealizedPnL || position.realizedPnL || position.profitDollar
    if (pnl != null) return (pnl / totalCost) * 100
    // Derive from marketValue if available
    if (position.marketValue) return ((position.marketValue - totalCost) / totalCost) * 100
  }
  return null
}

// ── Group into trades ────────────────────────────────────────────────
// A "trade" = positions with same ticker opened on the same date.
// Closed positions are already complete trades — keep as individual cards.

function groupFills(positions) {
  const grouped = {}
  for (const p of positions) {
    const key = `${p.ticker}|${p.openDate || ''}`
    if (!grouped[key]) {
      grouped[key] = {
        ...p,
        _totalCost: p.entryPrice * p.quantity,
        _totalExitCost: (p.exitPrice || 0) * p.quantity,
        _totalQty: p.quantity,
        _totalDailyPnL: p.dailyPnL || 0,
        _totalUnrealizedPnL: p.unrealizedPnL || 0,
        _totalRealizedPnL: p.realizedPnL || 0,
        _totalProfitDollar: p.profitDollar || 0,
        _totalFees: p.fees || 0,
        _totalMarketValue: p.marketValue || 0,
        _hasExit: p.exitPrice != null,
        _hasProfitDollar: p.profitDollar != null,
      }
    } else {
      const g = grouped[key]
      g._totalCost += p.entryPrice * p.quantity
      g._totalExitCost += (p.exitPrice || 0) * p.quantity
      g._totalQty += p.quantity
      g._totalDailyPnL += p.dailyPnL || 0
      g._totalUnrealizedPnL += p.unrealizedPnL || 0
      g._totalRealizedPnL += p.realizedPnL || 0
      g._totalProfitDollar += p.profitDollar || 0
      g._totalFees += p.fees || 0
      g._totalMarketValue += p.marketValue || 0
      if (p.exitPrice != null) g._hasExit = true
      if (p.profitDollar != null) g._hasProfitDollar = true
    }
  }
  return Object.values(grouped).map(g => ({
    ...g,
    entryPrice: g._totalCost / g._totalQty,
    exitPrice: g._hasExit ? g._totalExitCost / g._totalQty : undefined,
    quantity: g._totalQty,
    dailyPnL: g._totalDailyPnL || undefined,
    unrealizedPnL: g._totalUnrealizedPnL || undefined,
    realizedPnL: g._totalRealizedPnL || undefined,
    profitDollar: g._hasProfitDollar ? g._totalProfitDollar : undefined,
    profitPercent: undefined, // recalculated from aggregated values
    fees: g._totalFees || undefined,
    marketValue: g._totalMarketValue || undefined,
  }))
}

function groupIntoTrades(openPositions, closedPositions) {
  return [...groupFills(closedPositions), ...groupFills(openPositions)]
}

// ── Components ──────────────────────────────────────────────────────────

function GlowDot({ color }) {
  const colors = {
    green: 'bg-emerald-400 shadow-emerald-400/60',
    red: 'bg-red-400 shadow-red-400/60',
    pink: 'bg-pink-400 shadow-pink-400/60',
    blue: 'bg-blue-400 shadow-blue-400/60',
  }
  return (
    <span className="relative flex h-3 w-3 shrink-0">
      <span className={`glow-dot absolute inline-flex h-full w-full rounded-full opacity-75 ${colors[color]}`} />
      <span className={`relative inline-flex h-3 w-3 rounded-full ${colors[color]}`} />
    </span>
  )
}

// ── Sparkline SVG ────────────────────────────────────────────────────────

function Sparkline({ data, width = 200, height = 32 }) {
  if (!data || data.length < 2) return null
  const values = data.map(d => d.avg_cost)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')

  const lastVal = values[values.length - 1]
  const firstVal = values[0]
  const color = lastVal >= firstVal ? '#34d399' : '#f87171'

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Expanded detail panel ────────────────────────────────────────────────

function ExpandedDetail({ history }) {
  if (!history) {
    return (
      <div className="px-4 pb-3 sm:px-5 sm:pb-4">
        <span className="text-[11px] text-slate-600 italic">Loading history...</span>
      </div>
    )
  }

  if (history.length < 2) {
    return (
      <div className="px-4 pb-3 sm:px-5 sm:pb-4">
        <span className="text-[11px] text-slate-600 italic">Not enough snapshots yet — history builds with each IBKR sync</span>
      </div>
    )
  }

  // Compute a fun stat: biggest single-day move
  let biggestMove = 0
  let biggestDate = ''
  for (let i = 1; i < history.length; i++) {
    const move = Math.abs(history[i].avg_cost - history[i - 1].avg_cost)
    if (move > biggestMove) {
      biggestMove = move
      biggestDate = history[i].fetched_at?.slice(0, 10) || ''
    }
  }

  const firstPrice = history[0].avg_cost
  const lastPrice = history[history.length - 1].avg_cost
  const totalChange = lastPrice - firstPrice
  const totalPct = firstPrice ? ((totalChange / firstPrice) * 100).toFixed(1) : '0'

  return (
    <div className="flex items-center gap-4 px-4 pb-3 sm:px-5 sm:pb-4 border-t border-slate-800/40 mt-1 pt-2">
      <Sparkline data={history} width={160} height={28} />
      <span className="text-[11px] text-slate-500">
        {history.length} syncs tracked · avg cost moved {totalChange >= 0 ? '+' : ''}{totalPct}%
        {biggestDate && ` · biggest swing $${biggestMove.toFixed(2)} on ${formatDate(biggestDate)}`}
      </span>
    </div>
  )
}

// ── Position card ────────────────────────────────────────────────────────

function FireIcon() {
  return (
    <span className="relative flex h-5 w-5 shrink-0 fire-icon">
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="#3B82F6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2c0 4.5-5 7-5 11a5 5 0 0 0 10 0c0-4-5-6.5-5-11z" />
        <path d="M12 9c0 2.5-2 4-2 6a2 2 0 0 0 4 0c0-2-2-3.5-2-6z" />
      </svg>
    </span>
  )
}

function PositionRow({ position, type, expanded, onToggle, hidden, isTopGainer }) {
  const isLong = type === 'long'
  const isShort = type === 'short'
  const isClosed = position.status === 'closed'
  const sym = ccySym(position.currency)
  const pct = calcPnlPercent(position, isShort)

  const borderColor = isShort
    ? 'border-pink-500/20 hover:border-pink-500/40'
    : 'border-blue-500/20 hover:border-blue-500/40'

  // Current market price (derived from marketValue / quantity, or from unrealizedPnL)
  let currentPrice = null
  if (!isClosed && position.quantity) {
    if (position.marketValue) {
      currentPrice = position.marketValue / position.quantity
    } else if (position.unrealizedPnL != null && position.entryPrice) {
      currentPrice = isShort
        ? position.entryPrice - position.unrealizedPnL / position.quantity
        : position.entryPrice + position.unrealizedPnL / position.quantity
    }
  }

  // PnL dollar amount
  const pnlDollar = position.unrealizedPnL || position.realizedPnL || position.profitDollar
    || (currentPrice ? (currentPrice - position.entryPrice) * position.quantity : null)

  // Days holding
  const days = isClosed
    ? daysBetween(position.openDate, position.closeDate)
    : daysBetween(position.openDate, TODAY)

  // History for expanded view
  const [history, setHistory] = useState(null)

  useEffect(() => {
    if (!expanded) return
    let cancelled = false
    fetch(`${API_BASE}/api/history/ticker/${position.ticker}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!cancelled) setHistory(data) })
      .catch(() => { if (!cancelled) setHistory([]) })
    return () => { cancelled = true }
  }, [expanded, position.ticker])

  const sectionBase = `rounded-xl bg-slate-900/60 px-3 py-2 sm:px-4 sm:py-2.5`
  const displayPrice = isClosed && position.exitPrice != null
    ? position.exitPrice
    : currentPrice

  return (
    <div className={`${hidden ? 'scale-95 opacity-0 max-h-0 overflow-hidden !p-0 !m-0' : 'scale-100 opacity-100'} transition-all duration-300 ease-in-out w-full`}>
      <div>
        {/* 3-section card */}
        <div
          className={`group cursor-pointer rounded-2xl border transition-all duration-300 ease-in-out ${isTopGainer ? 'top-gainer-card border-blue-500 hover:border-blue-400' : borderColor} ${expanded ? 'ring-1 ring-slate-700/50' : ''}`}
          onClick={onToggle}
        >
          <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-[1px] bg-slate-700/30 rounded-2xl overflow-hidden">
            {/* Section 1: Status + Ticker + Quantity + Date (mobile) */}
            <div className={`${sectionBase} flex flex-col gap-1`}>
              <div className="flex items-center gap-2">
                {isClosed ? (
                  <svg className={`h-3 w-3 shrink-0 ${isShort ? 'text-pink-400' : 'text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : isTopGainer ? (
                  <FireIcon />
                ) : (
                  <GlowDot color={isLong ? 'blue' : 'pink'} />
                )}
                <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-100 whitespace-nowrap">
                  {position.ticker}
                </span>
                <span className={`text-xs font-normal ${isShort ? 'text-pink-400/70' : 'text-blue-400/70'}`}>
                  x{position.quantity}
                </span>
              </div>
              {/* Date badge - visible on mobile only */}
              <div className="sm:hidden">
                {!isClosed && days !== null && days <= 1 ? (
                  <span className="rounded-md bg-pink-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pink-400">
                    NEW
                  </span>
                ) : (
                  <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                    {days !== null ? `${days}d` : position.openDate ? formatDate(position.openDate) : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Section 2: Entry Price → Current/Exit Price + PnL (mobile) */}
            <div className={`${sectionBase} flex flex-col gap-1 whitespace-nowrap`}>
              <div className="flex items-center gap-1.5">
                <span className={`text-sm font-bold ${isShort ? 'text-pink-400' : 'text-blue-400'}`}>
                  {sym}{position.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {displayPrice != null && (
                  <>
                    <span className="text-xs text-slate-500">→</span>
                    <span className={`text-sm font-bold ${(pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {sym}{displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </>
                )}
              </div>
              {/* PnL badge - visible on mobile only */}
              {(pct || pnlDollar) ? (
                <div className="sm:hidden">
                  <span className={`rounded-md px-1.5 py-0.5 text-sm font-bold ${(pct ?? 0) >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    {pct !== null && <>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</>}
                    {pct !== null && pnlDollar !== null && ' '}
                    {pnlDollar !== null && <>{pnlDollar >= 0 ? '+' : '-'}{sym}{Math.abs(pnlDollar).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>}
                  </span>
                </div>
              ) : null}
            </div>

            {/* Section 3: PnL + Date - desktop only */}
            <div className={`${sectionBase} hidden sm:flex items-center justify-end gap-2 whitespace-nowrap`}>
              {!isClosed && days !== null && days <= 1 ? (
                <span className="rounded-md bg-pink-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pink-400">
                  NEW
                </span>
              ) : (
                <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                  {days !== null ? `${days}d` : position.openDate ? formatDate(position.openDate) : ''}
                </span>
              )}
              {(pct || pnlDollar) ? (
                <span className={`rounded-md px-1.5 py-0.5 text-sm font-bold ${(pct ?? 0) >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {pct !== null && <>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</>}
                  {pct !== null && pnlDollar !== null && ' '}
                  {pnlDollar !== null && <>{pnlDollar >= 0 ? '+' : '-'}{sym}{Math.abs(pnlDollar).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>}
                </span>
              ) : null}
            </div>
          </div>
        </div>

      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className={`mt-1 rounded-2xl border ${borderColor} bg-slate-900/60 overflow-hidden`}>
          <ExpandedDetail ticker={position.ticker} history={history} />
        </div>
      )}
    </div>
  )
}

// ── Portfolio Overview Charts ──────────────────────────────────────────

function ActivityHeatmap({ allTrades }) {
  // Count activity per day: each open or close event counts as 1
  const activityMap = {}
  for (const p of allTrades) {
    if (p.openDate) activityMap[p.openDate] = (activityMap[p.openDate] || 0) + 1
    if (p.closeDate) activityMap[p.closeDate] = (activityMap[p.closeDate] || 0) + 1
  }

  // Build weekday-only (Mon–Fri) grid: Jan 1 – Dec 31
  const year = 2026
  const jan1 = new Date(year, 0, 1)
  const dec31 = new Date(year, 11, 31)
  // Walk to the Monday on or before Jan 1
  const startDay = new Date(jan1)
  while (startDay.getDay() !== 1) startDay.setDate(startDay.getDate() - 1)
  // Walk to the Friday on or after Dec 31
  const endDay = new Date(dec31)
  while (endDay.getDay() !== 5) endDay.setDate(endDay.getDate() + 1)

  const weeks = []
  const cursor = new Date(startDay)
  while (cursor <= endDay) {
    const week = []
    for (let d = 0; d < 5; d++) { // Mon–Fri only
      const dateStr = cursor.toISOString().slice(0, 10)
      const inYear = cursor.getFullYear() === year && cursor >= jan1 && cursor <= dec31
      week.push({ date: dateStr, count: activityMap[dateStr] || 0, inYear })
      cursor.setDate(cursor.getDate() + 1)
    }
    cursor.setDate(cursor.getDate() + 2) // skip Sat & Sun
    weeks.push(week)
  }

  const maxCount = Math.max(1, ...Object.values(activityMap))
  const cellSize = 18, gap = 3

  const getColor = (count, inYear) => {
    if (!inYear) return 'transparent'
    if (count === 0) return 'rgba(30,41,59,0.18)'
    const intensity = Math.min(count / maxCount, 1)
    if (intensity <= 0.25) return '#064e3b'
    if (intensity <= 0.5) return '#059669'
    if (intensity <= 0.75) return '#34d399'
    return '#6ee7b7'
  }

  // Month labels
  const months = []
  let lastMonth = -1
  for (let w = 0; w < weeks.length; w++) {
    const firstValid = weeks[w].find(d => d.inYear)
    if (firstValid) {
      const m = new Date(firstValid.date).getMonth()
      if (m !== lastMonth) {
        months.push({ label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m], week: w })
        lastMonth = m
      }
    }
  }

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const labelW = 36
  const svgW = weeks.length * (cellSize + gap) + labelW
  const svgH = 5 * (cellSize + gap) + 26

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-2">Trading Activity — {year}</h3>
      <div className="overflow-x-auto">
        <svg width={svgW} height={svgH} className="block">
          {/* Day labels */}
          {dayLabels.map((label, i) => (
            <text key={i} x={0} y={24 + i * (cellSize + gap) + cellSize / 2 + 1}
              fill="#94a3b8" fontSize="11" fontFamily="system-ui" dominantBaseline="middle">{label}</text>
          ))}
          {/* Month labels */}
          {months.map(({ label, week }) => (
            <text key={label} x={labelW + week * (cellSize + gap)} y={11}
              fill="#94a3b8" fontSize="11" fontWeight="500" fontFamily="system-ui">{label}</text>
          ))}
          {/* Grid cells */}
          {weeks.map((week, wi) =>
            week.map((day, di) => (
              <rect key={`${wi}-${di}`}
                x={labelW + wi * (cellSize + gap)}
                y={20 + di * (cellSize + gap)}
                width={cellSize} height={cellSize} rx={3}
                fill={getColor(day.count, day.inYear)}
                stroke={day.count > 0 && day.inYear ? 'rgba(52,211,153,0.2)' : 'none'}
                strokeWidth={0.5}
              >
                {day.inYear && <title>{day.date}: {day.count} trade{day.count !== 1 ? 's' : ''}</title>}
              </rect>
            ))
          )}
        </svg>
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[11px] text-slate-400">Less</span>
        {['rgba(30,41,59,0.18)', '#064e3b', '#059669', '#34d399', '#6ee7b7'].map((c, i) => (
          <div key={i} className="rounded-sm" style={{ width: cellSize, height: cellSize, background: c }} />
        ))}
        <span className="text-[11px] text-slate-400">More</span>
      </div>
    </div>
  )
}


function CumulativePnLChart({ closedPositions, width = 500, height = 120 }) {
  if (!closedPositions || closedPositions.length < 2) {
    return (
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Cumulative P&L — Closed Trades</h3>
        <span className="text-[11px] text-slate-600 italic">Need more closed trades to chart</span>
      </div>
    )
  }

  // Sort by close date, build cumulative P&L
  const sorted = [...closedPositions]
    .filter(p => p.closeDate)
    .sort((a, b) => (a.closeDate || '').localeCompare(b.closeDate || ''))
  const points = sorted.reduce((acc, p) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].value : 0
    const value = prev + toUSD((p.profitDollar || 0) - (p.fees || 0), p.currency)
    return [...acc, { date: p.closeDate, value, ticker: p.ticker }]
  }, [])

  const values = points.map(p => p.value)
  const min = Math.min(0, ...values)
  const max = Math.max(0, ...values)
  const range = max - min || 1
  const padTop = 8
  const padBottom = 20

  const chartH = height - padTop - padBottom
  const yForVal = v => padTop + chartH - ((v - min) / range) * chartH
  const zeroY = yForVal(0)

  const pathPoints = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width
    const y = yForVal(p.value)
    return { x, y }
  })

  const linePath = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaPath = `${linePath} L${pathPoints[pathPoints.length - 1].x},${zeroY} L${pathPoints[0].x},${zeroY} Z`

  const lastVal = values[values.length - 1]
  const isUp = lastVal >= 0
  const strokeColor = isUp ? '#34d399' : '#f472b6'
  const fillColor = isUp ? 'rgba(52,211,153,0.12)' : 'rgba(244,114,182,0.10)'

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cumulative P&L — Closed Trades</h3>
        <span className="text-sm font-bold tabular-nums" style={{ color: strokeColor }}>
          {lastVal >= 0 ? '+' : '-'}${Math.abs(lastVal).toFixed(0)}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full">
        {/* Zero line */}
        <line x1="0" y1={zeroY} x2={width} y2={zeroY} stroke="#334155" strokeWidth="1" strokeDasharray="4,4" />
        {/* Area fill */}
        <path d={areaPath} fill={fillColor} />
        {/* Line */}
        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots for each trade */}
        {pathPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2" fill={strokeColor} opacity="0.7" />
        ))}
        {/* Labels */}
        <text x="4" y={height - 4} fill="#475569" fontSize="9" fontFamily="monospace">{formatDate(points[0].date)}</text>
        <text x={width - 4} y={height - 4} fill="#475569" fontSize="9" fontFamily="monospace" textAnchor="end">{formatDate(points[points.length - 1].date)}</text>
      </svg>
    </div>
  )
}

function QuickStats({ allTrades, closedPositions }) {
  const closed = closedPositions.filter(p => p.profitDollar != null)
  const wins = closed.filter(p => (p.profitDollar - (p.fees || 0)) > 0)
  const losses = closed.filter(p => (p.profitDollar - (p.fees || 0)) <= 0)
  const winRate = closed.length > 0 ? ((wins.length / closed.length) * 100).toFixed(0) : '—'

  // Best and worst trade
  const best = closed.length > 0
    ? closed.reduce((a, b) => (toUSD(a.profitDollar - (a.fees || 0), a.currency) > toUSD(b.profitDollar - (b.fees || 0), b.currency) ? a : b))
    : null
  const worst = closed.length > 0
    ? closed.reduce((a, b) => (toUSD(a.profitDollar - (a.fees || 0), a.currency) < toUSD(b.profitDollar - (b.fees || 0), b.currency) ? a : b))
    : null

  // Avg holding period for closed trades
  const holdDays = closed.map(p => daysBetween(p.openDate, p.closeDate)).filter(d => d != null)
  const avgHold = holdDays.length > 0 ? (holdDays.reduce((a, b) => a + b, 0) / holdDays.length).toFixed(0) : '—'

  // Long vs Short exposure
  const openTrades = allTrades.filter(p => p.status !== 'closed')
  const longExposure = openTrades.filter(p => p._type === 'long').reduce((s, p) => s + toUSD(p.entryPrice * p.quantity, p.currency), 0)
  const shortExposure = openTrades.filter(p => p._type === 'short').reduce((s, p) => s + toUSD(p.entryPrice * p.quantity, p.currency), 0)
  const totalExposure = longExposure + shortExposure || 1

  const stats = [
    { label: 'Win Rate', value: `${winRate}%`, sub: `${wins.length}W / ${losses.length}L`, color: 'text-emerald-400' },
    { label: 'Avg Hold', value: `${avgHold}d`, sub: `${closed.length} trades`, color: 'text-blue-400' },
    {
      label: 'Best Trade',
      value: best ? best.ticker : '—',
      sub: best ? `+$${toUSD(best.profitDollar - (best.fees || 0), best.currency).toFixed(0)}` : '',
      color: 'text-emerald-400',
    },
    {
      label: 'Worst Trade',
      value: worst ? worst.ticker : '—',
      sub: worst ? `${toUSD(worst.profitDollar - (worst.fees || 0), worst.currency) >= 0 ? '+' : '-'}$${Math.abs(toUSD(worst.profitDollar - (worst.fees || 0), worst.currency)).toFixed(0)}` : '',
      color: 'text-red-400',
    },
  ]

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Performance Stats</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl bg-slate-800/50 border border-slate-700/30 px-3 py-2.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 block">{s.label}</span>
            <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
            {s.sub && <span className="text-[11px] text-slate-500 ml-1.5">{s.sub}</span>}
          </div>
        ))}
      </div>

      {/* Long vs Short exposure bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          <span>Long ${longExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((longExposure / totalExposure) * 100).toFixed(0)}%)</span>
          <span>Short ${shortExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((shortExposure / totalExposure) * 100).toFixed(0)}%)</span>
        </div>
        <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-800/60">
          <div className="bg-emerald-500/60 rounded-l-full" style={{ width: `${(longExposure / totalExposure) * 100}%` }} />
          <div className="bg-pink-500/60 rounded-r-full" style={{ width: `${(shortExposure / totalExposure) * 100}%` }} />
        </div>
      </div>
    </div>
  )
}

function PortfolioOverview({ allTrades, closedPositions }) {
  return (
    <div className="flex flex-col gap-7 px-2 sm:px-4">
      <QuickStats allTrades={allTrades} closedPositions={closedPositions} />
      <CumulativePnLChart closedPositions={closedPositions} />
      <ActivityHeatmap allTrades={allTrades} />
    </div>
  )
}

function PositionList({ longs, shorts, expandedTicker, onToggleTicker, filter, newPositionKeys }) {
  const [showOthers, setShowOthers] = useState(false)
  // Auto-collapse the expanded list when switching tabs
  useEffect(() => {
    setShowOthers(false)
  }, [filter])
  const allPositions = [
    ...longs.map(p => ({ ...p, _type: 'long' })),
    ...shorts.map(p => ({ ...p, _type: 'short' })),
  ].filter(p => {
    if (filter === 'long') return p._type === 'long' && p.status !== 'closed'
    if (filter === 'short') return p._type === 'short' && p.status !== 'closed'
    if (filter === 'closed') return p.status === 'closed'
    return true
  }).sort((a, b) => {
    const pctA = calcPnlPercent(a, a._type === 'short') ?? 0
    const pctB = calcPnlPercent(b, b._type === 'short') ?? 0
    return pctB - pctA // biggest gainer first, biggest loser last
  })

  // Find the open position with the highest profit
  const topGainerTicker = allPositions.reduce((best, p) => {
    if (p.status === 'closed') return best
    const pct = calcPnlPercent(p, p._type === 'short') ?? 0
    if (pct > 0 && pct > (best.pct ?? 0)) return { key: `${p._type}-${p.ticker}-${p.openDate}`, pct }
    return best
  }, { key: null, pct: 0 }).key

  // For closed tab, show only the top 10 most significant trades by default (reduced from 15 for a more concise view)
  const MAX_VISIBLE_CLOSED = 10
  const isClosed = filter === 'closed'
  const canCollapse = isClosed && allPositions.length > MAX_VISIBLE_CLOSED
  const hiddenCount = canCollapse ? allPositions.length - MAX_VISIBLE_CLOSED : 0
  const visiblePositions = canCollapse && !showOthers
    ? (() => {
        // Sort by absolute PnL% descending to pick the most significant trades
        const sorted = [...allPositions].sort((a, b) => {
          const absA = Math.abs(calcPnlPercent(a, a._type === 'short') ?? 0)
          const absB = Math.abs(calcPnlPercent(b, b._type === 'short') ?? 0)
          return absB - absA
        })
        const topSet = new Set(sorted.slice(0, MAX_VISIBLE_CLOSED))
        // Return in original sort order (biggest gainer first)
        return allPositions.filter(p => topSet.has(p))
      })()
    : allPositions

  return (
    <div className="flex flex-col gap-2 px-2 sm:px-4 sm:max-w-3xl sm:mx-auto w-full">
      {visiblePositions.map((position, i) => {
        const tradeKey = `${position._type}-${position.ticker}-${position.openDate || i}`
        const closedPrefix = position.status === 'closed' ? `closed-${position._type}` : position._type
        const newKey = `${closedPrefix}|${position.ticker}|${position.openDate}`
        return (
          <PositionRow
            key={tradeKey}
            position={position}
            type={position._type}
            expanded={expandedTicker === tradeKey}
            hidden={false}
            onToggle={() => onToggleTicker(tradeKey)}
            isNew={newPositionKeys?.has(newKey)}
            isTopGainer={tradeKey === topGainerTicker}
          />
        )
      })}
      {canCollapse && !showOthers && (
        <button
          onClick={() => setShowOthers(true)}
          className="w-full py-3 rounded-xl border border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-700/40 text-zinc-400 hover:text-zinc-200 text-sm font-medium transition-colors"
        >
          OTHERS ({hiddenCount} more)
        </button>
      )}
      {canCollapse && showOthers && (
        <button
          onClick={() => setShowOthers(false)}
          className="w-full py-2 rounded-xl border border-zinc-700/50 bg-zinc-800/40 hover:bg-zinc-700/40 text-zinc-500 hover:text-zinc-300 text-xs font-medium transition-colors"
        >
          Hide others
        </button>
      )}
    </div>
  )
}

// Filter to only include 2026 closed positions
function filterClosed2026(positions) {
  return positions.filter((p) => {
    const date = p.closeDate || p.openDate || ''
    return date.startsWith('2026')
  })
}

function mergePositions(defaults, livePositions) {
  if (!livePositions || livePositions.length === 0) return defaults.filter(p => !IGNORED_TICKERS.has(p.ticker))

  const cachedPrices = loadCachedPrices()
  const liveByTicker = {}
  for (const pos of livePositions) {
    if (IGNORED_TICKERS.has(pos.ticker)) continue
    if (!liveByTicker[pos.ticker]) liveByTicker[pos.ticker] = []
    liveByTicker[pos.ticker].push(pos)
  }

  const merged = []
  const usedLiveTickers = new Set()

  for (const def of defaults) {
    const liveEntries = liveByTicker[def.ticker]
    if (liveEntries && liveEntries.length > 0) {
      if (!usedLiveTickers.has(def.ticker)) {
        for (const live of liveEntries) {
          const entry = {
            ...def,
            ...live,
            openDate: def.openDate || live.openDate || '',
          }
          const liveQty = live.quantity || def.quantity || 0
          const liveEntry = live.entryPrice || def.entryPrice || 0

          if (live.marketValue && liveQty && liveEntry) {
            // IBKR delivered fresh data — use it and cache the price
            const currentPrice = live.marketValue / liveQty
            cachedPrices[live.ticker] = { price: currentPrice, marketValue: live.marketValue, qty: liveQty, updatedAt: TODAY }
            recordPriceSnapshot(live.ticker, currentPrice)
            if (!live.unrealizedPnL) {
              entry.unrealizedPnL = (currentPrice - liveEntry) * liveQty
            }
            if (!live.profitPercent) {
              entry.profitPercent = ((currentPrice - liveEntry) / liveEntry) * 100
            }
          } else if (cachedPrices[live.ticker || def.ticker] && liveQty && liveEntry) {
            // IBKR returned null/zero — restore last known price
            const cached = cachedPrices[live.ticker || def.ticker]
            const restoredPrice = cached.price
            entry.marketValue = restoredPrice * liveQty
            if (!entry.unrealizedPnL) {
              entry.unrealizedPnL = (restoredPrice - liveEntry) * liveQty
            }
            if (!entry.profitPercent) {
              entry.profitPercent = ((restoredPrice - liveEntry) / liveEntry) * 100
            }
          }
          // Still fall back to manual defaults if nothing else available
          if (!entry.profitPercent && def.profitPercent) entry.profitPercent = def.profitPercent
          if (!entry.unrealizedPnL && def.unrealizedPnL) entry.unrealizedPnL = def.unrealizedPnL
          merged.push(entry)
        }
        usedLiveTickers.add(def.ticker)
      }
    } else {
      merged.push(def)
    }
  }

  for (const [ticker, entries] of Object.entries(liveByTicker)) {
    if (!usedLiveTickers.has(ticker)) {
      merged.push(...entries)
    }
  }

  // Persist updated price cache
  saveCachedPrices(cachedPrices)

  return merged
}

function Positions({ ibkrData }) {
  const hasLive = ibkrData && (ibkrData.longPositions || ibkrData.shortPositions)

  const longPositions = hasLive
    ? mergePositions(defaultLongPositions, ibkrData.longPositions)
    : defaultLongPositions.filter(p => !IGNORED_TICKERS.has(p.ticker))
  const shortPositions = hasLive
    ? mergePositions(defaultShortPositions, ibkrData.shortPositions)
    : defaultShortPositions.filter(p => !IGNORED_TICKERS.has(p.ticker))

  const liveClosedLong = filterClosed2026(ibkrData?.closedLongPositions || [])
  const liveClosedShort = filterClosed2026(ibkrData?.closedShortPositions || [])
  const closedLongKeys = new Set(liveClosedLong.map(p => `${p.ticker}|${p.openDate}`))
  const closedShortKeys = new Set(liveClosedShort.map(p => `${p.ticker}|${p.openDate}`))
  const closedLongPositions = [
    ...liveClosedLong,
    ...filterClosed2026(defaultClosedLongPositions).filter(p => !closedLongKeys.has(`${p.ticker}|${p.openDate}`)),
  ]
  const closedShortPositions = [
    ...liveClosedShort,
    ...filterClosed2026(defaultClosedShortPositions).filter(p => !closedShortKeys.has(`${p.ticker}|${p.openDate}`)),
  ]

  // Keep the calculation helpers in sync (use raw positions for accuracy)
  setPositionData({ longPositions, shortPositions, closedLongPositions, closedShortPositions })

  // Group into individual trades for display
  const tradeLongs = groupIntoTrades(longPositions, closedLongPositions)
  const tradeShorts = groupIntoTrades(shortPositions, closedShortPositions)

  // ── NEW tag tracking ──────────────────────────────────────────────────
  // Compare current position keys against what was stored from the previous
  // page load / sync. Positions not seen before get a pink "NEW" badge.
  // On the next reload or sync, the tag goes away (keys are saved to localStorage).
  const prevKeysRef = useRef(null)
  if (prevKeysRef.current === null) {
    const raw = localStorage.getItem('knownPositionKeys')
    prevKeysRef.current = raw ? new Set(JSON.parse(raw)) : null
  }

  const newPositionKeys = useMemo(() => {
    const allCurrent = [
      ...longPositions.map(p => `long|${p.ticker}|${p.openDate}`),
      ...shortPositions.map(p => `short|${p.ticker}|${p.openDate}`),
      ...closedLongPositions.map(p => `closed-long|${p.ticker}|${p.openDate}`),
      ...closedShortPositions.map(p => `closed-short|${p.ticker}|${p.openDate}`),
    ]
    const prev = prevKeysRef.current
    // Save current keys for the next session
    localStorage.setItem('knownPositionKeys', JSON.stringify(allCurrent))
    // On very first load (no prev data), nothing is "new"
    if (!prev) return new Set()
    return new Set(allCurrent.filter(k => !prev.has(k)))
  }, [longPositions, shortPositions, closedLongPositions, closedShortPositions])

  const [expandedTicker, setExpandedTicker] = useState(null)
  const [filter, setFilter] = useState('overview')
  const contentRef = useRef(null)

  // Scroll to top when switching tabs so cards are visible
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollIntoView({ behavior: 'instant', block: 'start' })
    } else {
      window.scrollTo(0, 0)
    }
  }, [filter])

  function handleToggleTicker(ticker) {
    setExpandedTicker((prev) => (prev === ticker ? null : ticker))
  }

  const allTrades = [
    ...tradeLongs.map(p => ({ ...p, _type: 'long' })),
    ...tradeShorts.map(p => ({ ...p, _type: 'short' })),
  ]
  const longCount = allTrades.filter(p => p._type === 'long' && p.status !== 'closed').length
  const shortCount = allTrades.filter(p => p._type === 'short' && p.status !== 'closed').length
  const closedCount = allTrades.filter(p => p.status === 'closed').length

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'long', label: 'Long', count: longCount },
    { key: 'short', label: 'Short', count: shortCount },
    { key: 'closed', label: 'Closed', count: closedCount },
  ]

  // ── Swipe navigation between tabs ──────────────────────────────────────
  const touchStart = useRef(null)
  const touchStartY = useRef(null)

  const handleTouchStart = useCallback((e) => {
    touchStart.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback((e) => {
    if (touchStart.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStart.current
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    touchStart.current = null
    touchStartY.current = null

    // Only trigger if horizontal swipe is dominant and exceeds threshold
    if (Math.abs(deltaX) < 50 || Math.abs(deltaY) > Math.abs(deltaX)) return

    const tabKeys = tabs.map(t => t.key)
    const currentIdx = tabKeys.indexOf(filter)
    if (deltaX < 0 && currentIdx < tabKeys.length - 1) {
      setFilter(tabKeys[currentIdx + 1])
    } else if (deltaX > 0 && currentIdx > 0) {
      setFilter(tabKeys[currentIdx - 1])
    }
  }, [filter, tabs])

  return (
    <div
      ref={contentRef}
      className="mx-auto max-w-5xl pb-20 min-h-[calc(100dvh-8rem)]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {filter === 'overview' ? (
        <PortfolioOverview allTrades={allTrades} closedPositions={[...closedLongPositions, ...closedShortPositions]} />
      ) : (
        <PositionList
          longs={tradeLongs}
          shorts={tradeShorts}
          expandedTicker={expandedTicker}
          onToggleTicker={handleToggleTicker}
          filter={filter}
          newPositionKeys={newPositionKeys}
        />
      )}

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-slate-950/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-5xl items-stretch justify-around sm:justify-center sm:gap-2">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`relative flex flex-1 sm:flex-none flex-col items-center gap-0.5 py-3 sm:px-5 text-xs font-semibold transition-colors ${
                filter === tab.key
                  ? 'text-emerald-400'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {filter === tab.key && (
                <span className="absolute top-0 h-0.5 w-10 rounded-b bg-emerald-400" />
              )}
              <span className="text-sm">{tab.label}</span>
              {tab.count != null && (
                <span className={`text-[10px] font-normal ${filter === tab.key ? 'text-emerald-400/70' : 'text-slate-600'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default Positions
