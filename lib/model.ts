// Token Radar — model "radar-2": a calibrated implied-value model.
//
// The board ranks every pre-token protocol in the sealed snapshot by an implied
// value that is computed from the snapshot's own figures, never from a hand-made
// list of names. The one thing the model learns from the data is the value of a
// dollar of TVL in each category: for every category with at least three
// live-token protocols in the snapshot, the base multiple is the MEDIAN
// market-cap / TVL of those live protocols. Categories with fewer live comps
// fall back to the global median across all live protocols. The multiple is
// clamped to [0.05, 0.60] so a thin category cannot produce an absurd value.
//
//   multiple     = median(mcap_usd / tvl_usd) over live-token comps in the
//                  protocol's category (n >= 3), else the global median;
//                  clamped to [0.05, 0.60]
//   growth       = clamp(change_7d, -60, 120) per cent
//   growthMult   = 1 + (growth / 100) * 0.5
//   maturity     = 0.6 + min(age_days, 1095) / 1095 * 0.4
//                  (age unknown: 365 days; age is listed_at -> as_of)
//   chainMult    = 1 + 0.02 * (chains - 1), capped at 1.20
//   implied      = max(1, round(tvl_usd * multiple * growthMult
//                        * maturity * chainMult))
//
// A protocol is pre-token when the snapshot records no token for it at all
// (no market cap, no CoinGecko id, no symbol). The board covers the whole
// watchlist (40 slugs) plus every other rankable pre-token protocol below the
// floor (186 slugs) — 226 rows, the whole rankable universe. Bridged products
// (Bridge / Canonical Bridge / Cross Chain Bridge) are ranked too, because the
// gate counts the whole universe, but they are flagged: a bridged product is a
// token that already trades on another chain, not a token waiting to launch.
// Live-token protocols are kept apart and shown with their market cap, never
// mixed into the ranking.
//
// Farm plans are derived per protocol from its own record (category, chains,
// TVL, age). They never promise an airdrop: the wording is "if the protocol
// runs a points or rewards program". Three records need honest wording that no
// category rule can express, so they are handled explicitly and documented in
// farmSteps: USDD (a stablecoin that already circulates), Lightning Network
// (a payment network that rarely issues a token) and Bittensor dTAO (TAO
// itself already trades; dTAO is a subnet mechanism).

/** One protocol entry of the sealed snapshot: exactly its ten fields. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole sealed snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** One category's calibrated multiple, with how it was derived. */
export interface CategoryMultiple {
  category: string;
  multiple: number;
  comps: number;
  source: 'category-median' | 'global-median';
}

/** The calibration: the multiples the model actually used. */
export interface Calibration {
  global_multiple: number;
  global_comps: number;
  clamp_min: number;
  clamp_max: number;
  min_comps: number;
  by_category: CategoryMultiple[];
}

/** The model's constants, stated in the dashboard. */
export interface ModelSpec {
  version: string;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_step: number;
  chain_cap: number;
}

export const MODEL_VERSION = 'radar-2';

export const MODEL: ModelSpec = {
  version: MODEL_VERSION,
  growth_weight: 0.5,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
  chain_step: 0.02,
  chain_cap: 1.2,
};

/** How many live-token protocols the dashboard's Live view carries, by market cap. */
export const LIVE_ROWS = 24;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  /** 'bridged' when the row is a bridged product, else null. */
  flag: 'bridged' | null;
  model: {
    base_multiple: number;
    base_multiple_exact: number;
    multiple_source: 'category-median' | 'global-median';
    multiple_comps: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    chain_count: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** A board row's compact form for data.js. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  base_multiple: number;
  base_multiple_exact: number;
  multiple_source: 'category-median' | 'global-median';
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  flag: 'bridged' | null;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  mcap_tvl: number | null;
}

/** A flagged row for the dashboard's Flagged view: why it is not a token candidate. */
export interface FlaggedRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  rank: number;
  implied_value_usd: number;
  reason: string;
}

/** Everything the dashboard needs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelSpec;
  model_version: string;
  calibration: Calibration;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  flagged_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  flagged: FlaggedRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  if (n % 2 === 1) return sorted[(n - 1) / 2]!;
  return (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The calibration, learned from the snapshot's own live-token protocols. */
export function calibrate(snapshot: Snapshot): Calibration {
  const clamp = (x: number): number => Math.min(0.6, Math.max(0.05, x));
  const liveRatios: number[] = [];
  const byCategory = new Map<string, number[]>();
  for (const p of snapshot.protocols) {
    if (isPreToken(p)) continue;
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    liveRatios.push(ratio);
    const key = p.category ?? 'Other';
    const list = byCategory.get(key) ?? [];
    list.push(ratio);
    byCategory.set(key, list);
  }
  const globalMultiple = clamp(median(liveRatios));
  const rows: CategoryMultiple[] = [];
  for (const [category, ratios] of [...byCategory.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (ratios.length >= 3) {
      rows.push({ category, multiple: clamp(median(ratios)), comps: ratios.length, source: 'category-median' });
    } else {
      rows.push({ category, multiple: globalMultiple, comps: ratios.length, source: 'global-median' });
    }
  }
  return {
    global_multiple: globalMultiple,
    global_comps: liveRatios.length,
    clamp_min: 0.05,
    clamp_max: 0.6,
    min_comps: 3,
    by_category: rows,
  };
}

/** The multiple one category gets under a calibration. */
function multipleFor(category: string | null, calibration: Calibration): CategoryMultiple {
  const key = category ?? 'Other';
  const found = calibration.by_category.find((c) => c.category === key);
  if (found !== undefined) return found;
  return { category: key, multiple: calibration.global_multiple, comps: 0, source: 'global-median' };
}

/** The multipliers and the implied value one protocol gets. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  calibration: Calibration,
  model: ModelSpec = MODEL,
): {
  implied: number;
  multiple: CategoryMultiple;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  chainMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const multiple = multipleFor(protocol.category, calibration);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const chainCount = protocol.chains.length;
  const chainMult = Math.min(model.chain_cap, 1 + model.chain_step * Math.max(0, chainCount - 1));
  const implied = Math.max(
    1,
    Math.round(protocol.tvl_usd * multiple.multiple * growthMult * maturityMult * chainMult),
  );
  return { implied, multiple, growthPct, growthMult, maturityMult, chainMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && p.category !== 'CEX' && !VERSIONED.test(p.name);
}

/** Whether a row is a bridged product: a token that already trades, on another chain. */
export function isBridged(p: SnapshotProtocol): boolean {
  const c = (p.category ?? '').toLowerCase();
  return c === 'bridge' || c === 'canonical bridge' || c === 'cross chain bridge';
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, calibration: Calibration, model: ModelSpec = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every rankable pre-token protocol below the watchlist
  // floor, not just the top slice — the whole universe the radar exists to find.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, calibration, model);
    return { p, ...v };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    age_days: s.age,
    implied_value_usd: s.implied,
    flag: isBridged(s.p) ? ('bridged' as const) : null,
    model: {
      base_multiple: round4(s.multiple.multiple),
      base_multiple_exact: s.multiple.multiple,
      multiple_source: s.multiple.source,
      multiple_comps: s.multiple.comps,
      growth_pct: round4(s.growthPct),
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      chain_count: s.p.chains.length,
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/**
 * One category's farm playbook: the primary action, the weekly recurring
 * action, and what to watch while holding. Matched on the category's words,
 * in order — the first match wins.
 */
interface Playbook {
  primary: string;
  weekly: string;
  watch: string;
}

const PLAYBOOKS: Array<{ test: RegExp; book: Playbook }> = [
  {
    test: /curator|allocator/,
    book: {
      primary: 'Deposit ${capital} into a ${name} vault on ${chain} and hold the vault shares; pick the vault with the largest TVL in the protocol’s own app.',
      weekly: 'Read the curator’s weekly vault report and top up or rebalance only when it posts a new strategy.',
      watch: 'curator strategy updates and vault reports',
    },
  },
  {
    test: /rwa/,
    book: {
      primary: 'Mint ${capital} of the yield-bearing asset ${name} offers on ${chain} and hold it in the farming wallet.',
      weekly: 'Claim or compound the yield the asset pays out, once a week.',
      watch: 'asset backing reports and redemption terms',
    },
  },
  {
    test: /liquid staking|liquid restaking|restak|staking pool|anchor btc|decentralized btc/,
    book: {
      primary: 'Stake ${capital} of the chain’s staking asset through ${name} on ${chain} and keep the receipt token.',
      weekly: 'Check the staking rewards and restake them once a week.',
      watch: 'validator performance and the unbonding period',
    },
  },
  {
    test: /lend|uncollateralized|cdp|collateral/,
    book: {
      primary: 'Supply ${capital} of USDC to ${name} on ${chain} and keep the supply position open; borrow a small amount against it only if the market allows.',
      weekly: 'Adjust the supply or the borrow once a week so the position stays in the active range.',
      watch: 'interest rates and liquidation thresholds',
    },
  },
  {
    test: /bridge/,
    book: {
      primary: 'Bridge ${capital} of USDC to ${chain} through ${name}, then use the bridged funds in one app on the destination chain.',
      weekly: 'Use the destination-chain app once a week so the bridged funds show real activity.',
      watch: 'bridge fees and destination-chain activity',
    },
  },
  {
    test: /dex|yield|leveraged farm|liquidity manager|^farm$/,
    book: {
      primary: 'Provide ${capital} of liquidity to ${name}’s main pool on ${chain} and keep the position in range.',
      weekly: 'Collect the pool fees and re-center the range once a week if the price drifts.',
      watch: 'pool volume and fee APR',
    },
  },
  {
    test: /yield aggregator/,
    book: {
      primary: 'Deposit ${capital} into a ${name} vault on ${chain} and hold the vault shares.',
      weekly: 'Harvest or compound the vault yield once a week.',
      watch: 'vault strategy changes and APY',
    },
  },
  {
    test: /perpetual|derivative|basis trading|interest rate/,
    book: {
      primary: 'Deposit ${capital} of USDC as margin on ${name} and open one small hedged position on ${chain}.',
      weekly: 'Rebalance the hedge once a week and keep the margin above the maintenance level.',
      watch: 'funding rates and the margin ratio',
    },
  },
  {
    test: /prediction/,
    book: {
      primary: 'Fund ${capital} and place one small prediction-market position on ${name}.',
      weekly: 'Settle or roll one position a week; never chase a loss with a bigger one.',
      watch: 'market resolution dates',
    },
  },
  {
    test: /stable|dual-token/,
    book: {
      primary: 'Mint or deposit ${capital} of the stable asset through ${name} on ${chain} and hold it.',
      weekly: 'Check the peg and the yield the stable asset pays, once a week.',
      watch: 'peg stability and collateral reports',
    },
  },
  {
    test: /insurance/,
    book: {
      primary: 'Buy ${capital} of cover from ${name} on ${chain} and keep the policy active.',
      weekly: 'Check open claims and the covered protocols once a week.',
      watch: 'claim payouts and cover expiry',
    },
  },
  {
    test: /chain/,
    book: {
      primary: 'Bridge ${capital} into ${chain} and use one native app on the network, keeping the funds there.',
      weekly: 'Use one native app a week so the wallet shows real activity on the chain.',
      watch: 'network upgrades and native app launches',
    },
  },
  {
    test: /payment/,
    book: {
      primary: 'Open a payment channel or route ${capital} through ${name} on ${chain} and keep it funded.',
      weekly: 'Route one payment a week through the channel.',
      watch: 'channel capacity and routing fees',
    },
  },
  {
    test: /index/,
    book: {
      primary: 'Buy ${capital} of the ${name} index on ${chain} and hold it.',
      weekly: 'Check the index rebalance once a week.',
      watch: 'index composition changes',
    },
  },
  {
    test: /governance/,
    book: {
      primary: 'Stake ${capital} in ${name}’s governance pool on ${chain} and vote on one live proposal.',
      weekly: 'Vote on new proposals once a week.',
      watch: 'proposal outcomes',
    },
  },
  {
    test: /card issuer/,
    book: {
      primary: 'Order the ${name} card, load ${capital} onto it and spend through it on ${chain}.',
      weekly: 'Spend through the card once a week.',
      watch: 'the cashback or rewards program',
    },
  },
  {
    test: /cedefi/,
    book: {
      primary: 'Deposit ${capital} into ${name} on ${chain} and use its CeDeFi yield product.',
      weekly: 'Read the yield product’s weekly report.',
      watch: 'custody and yield reports',
    },
  },
];

/** The playbook for a category, or the generic deposit playbook. */
function playbookFor(p: SnapshotProtocol): Playbook {
  const c = (p.category ?? '').toLowerCase();
  for (const entry of PLAYBOOKS) {
    if (entry.test.test(c)) return entry.book;
  }
  return {
    primary: 'Deposit ${capital} of USDC into ${name} on ${chain} and keep the position open.',
    weekly: 'Make one qualifying action each week, such as a deposit, a swap or a vote.',
    watch: 'the protocol’s own announcements and activity page',
  };
}

/** Fill the ${capital}, ${name} and ${chain} placeholders of a playbook line. */
function fill(line: string, p: SnapshotProtocol, capital: number, chain: string): string {
  return line
    .replaceAll('${capital}', `$${capital}`)
    .replaceAll('${name}', p.name)
    .replaceAll('${chain}', chain);
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains, TVL,
 * age). Three records need honest wording no category rule can express, so
 * they are handled explicitly here and nowhere else:
 * - USDD: the stablecoin already circulates; farming it means using the
 *   stablecoin, not waiting on a new token.
 * - Lightning Network: a payment network that rarely issues a token; farm the
 *   network usage, not a token launch.
 * - Bittensor dTAO: TAO itself already trades; dTAO is a subnet mechanism,
 *   so this is a subnet position, not a new-token wait.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const book = playbookFor(p);
  let primary = fill(book.primary, p, capital, chain);
  let honesty = '';
  let weeklyOverride: string | null = null;
  let watchOverride: string | null = null;
  if (p.slug === 'usdd') {
    primary = `Use $${capital} of USDD on ${chain}: the stablecoin already circulates, so farm it by holding and using it — this is not a wait for a new token launch.`;
    honesty = ' USDD already circulates as a stablecoin; the record shows no separate token.';
    weeklyOverride = 'Use USDD in one app a week — pay, lend, or provide liquidity — so the wallet shows real stablecoin activity.';
    watchOverride = 'the USDD peg and the yield it pays';
  } else if (p.slug === 'lightning-network') {
    primary = `Open a Lightning channel with $${capital} of capacity on Bitcoin and keep it online and routing.`;
    honesty = ' Lightning is a payment network and rarely issues a token; farm the network usage, not a token launch.';
  } else if (p.slug === 'bittensor-dtao') {
    primary = `Stake $${capital} of TAO into a dTAO subnet on Bittensor and hold the subnet stake.`;
    honesty = ' TAO itself already trades; dTAO is a subnet mechanism, so this is a subnet position, not a new-token wait.';
    weeklyOverride = 'Check the subnet’s rewards and your stake once a week; restake the rewards if the subnet allows it.';
    watchOverride = 'subnet emission and your stake weight';
  }
  const weekly = weeklyOverride ?? fill(book.weekly, p, capital, chain);
  const watch = watchOverride ?? book.watch;
  return [
    {
      text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.',
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: primary,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: weekly,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot, and watch ${watch}.${honesty}`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: 'Before you withdraw, open the protocol’s own points or rewards page — if it runs one — and claim only from the link it publishes; never pay to claim, and never trust a link from a chat or an ad.',
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: 'Write the wallet, the dates and every transaction hash in a farm log; unwind by withdrawing in small steps and checking the gas cost first.',
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      mcap_tvl:
        p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** The flagged rows for the dashboard's Flagged view. */
export function flaggedRows(board: BoardRow[]): FlaggedRow[] {
  return board
    .filter((r) => r.flag === 'bridged')
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      category: r.category,
      chains: r.chains,
      tvl_usd: r.tvl_usd,
      rank: r.rank,
      implied_value_usd: r.implied_value_usd,
      reason:
        'A bridged product: the token it moves already trades on another chain, so it is not a token waiting to launch. Ranked for completeness, flagged here.',
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    base_multiple: row.model.base_multiple,
    base_multiple_exact: row.model.base_multiple_exact,
    multiple_source: row.model.multiple_source,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    flag: row.flag,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(
  snapshot: Snapshot,
  calibration: Calibration,
  model: ModelSpec = MODEL,
): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, calibration, model);
  const live = liveRows(snapshot);
  const flagged = flaggedRows(board);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    calibration,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    flagged_size: flagged.length,
    rows: board.map(radarRow),
    live,
    flagged,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
