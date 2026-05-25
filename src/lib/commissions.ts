import { CommissionsAPI, QuotasAPI, ReferralsAPI, UsersAPI, VentasAPI } from '../services/db';

export interface CommissionRule {
  id?: string;
  minSales: number;
  maxSales: number | null;
  ratePerSale: number;
  bonusOnGoal: number;
}

export interface CommissionResult {
  userId: string;
  userName: string;
  period: string;
  salesApproved: number;
  salesTotal: number;
  baseCommission: number;
  goalBonus: number;
  referralBonus: number;
  total: number;
  quotaMet: boolean;
}

const DEFAULT_RULES: CommissionRule[] = [
  { minSales: 0, maxSales: 4, ratePerSale: 150, bonusOnGoal: 0 },
  { minSales: 5, maxSales: 9, ratePerSale: 200, bonusOnGoal: 500 },
  { minSales: 10, maxSales: 19, ratePerSale: 250, bonusOnGoal: 1000 },
  { minSales: 20, maxSales: null, ratePerSale: 300, bonusOnGoal: 2000 },
];

const REFERRAL_BONUS_PER = 150;
let ruleCache: CommissionRule[] = DEFAULT_RULES;

function normalizeRule(row: any): CommissionRule {
  return {
    id: row.id,
    minSales: Number(row.min_ventas ?? row.minSales ?? 0),
    maxSales: row.max_ventas == null ? null : Number(row.max_ventas),
    ratePerSale: Number(row.tasa ?? row.ratePerSale ?? 0),
    bonusOnGoal: Number(row.bono_meta ?? row.bonusOnGoal ?? 0),
  };
}

function getRule(rules: CommissionRule[], count: number): CommissionRule {
  return rules.find(r => count >= r.minSales && (r.maxSales === null || count <= r.maxSales)) ?? rules[0] ?? DEFAULT_RULES[0];
}

export function getCommissionRules(): CommissionRule[] {
  return ruleCache;
}

export async function refreshCommissionRules(): Promise<CommissionRule[]> {
  const rows = await CommissionsAPI.getAll();
  ruleCache = (Array.isArray(rows) && rows.length ? rows.map(normalizeRule) : DEFAULT_RULES);
  return ruleCache;
}

export async function saveCommissionRules(rules: CommissionRule[]) {
  for (const existing of await CommissionsAPI.getAll().catch(() => [])) {
    if (existing?.id) await CommissionsAPI.delete(existing.id).catch(() => {});
  }
  for (const rule of rules) {
    await CommissionsAPI.create({
      min_ventas: rule.minSales,
      max_ventas: rule.maxSales,
      tasa: rule.ratePerSale,
      bono_meta: rule.bonusOnGoal,
    });
  }
  ruleCache = rules;
}

export async function calculateCommissions(period?: string): Promise<CommissionResult[]> {
  const targetPeriod = period || new Date().toISOString().slice(0, 7);
  const [sales, users, quotas, referrals, rules] = await Promise.all([
    VentasAPI.getAll(),
    UsersAPI.getAll(),
    QuotasAPI.getAll().catch(() => []),
    ReferralsAPI.getAll().catch(() => []),
    refreshCommissionRules().catch(() => ruleCache),
  ]);

  const quotaMap = new Map((Array.isArray(quotas) ? quotas : []).map((q: any) => [q.user_id || q.userId, Number(q.meta || 10)]));
  const referralMap = new Map<string, number>();
  for (const ref of Array.isArray(referrals) ? referrals : []) {
    const uid = ref.referred_by || ref.asesorId;
    if ((ref.status || '').toLowerCase() === 'convertido' || ref.convertido) {
      referralMap.set(uid, (referralMap.get(uid) || 0) + REFERRAL_BONUS_PER);
    }
  }

  const byUser = new Map<string, { name: string; approved: number; total: number }>();
  for (const sale of sales) {
    if ((sale.fechaSolicitud || '').slice(0, 7) !== targetPeriod) continue;
    const uid = sale.asesorId || 'anonymous';
    const user = Array.isArray(users) ? users.find((u: any) => u.uid === uid) : null;
    if (!byUser.has(uid)) byUser.set(uid, { name: user?.displayName || user?.nombre || user?.email || uid, approved: 0, total: 0 });
    const entry = byUser.get(uid)!;
    entry.total++;
    const status = String(sale.status || '').toUpperCase();
    if (status === 'APROBADA' || status === 'PROCEDIO') entry.approved++;
  }

  return [...byUser.entries()].map(([uid, data]) => {
    const rule = getRule(rules, data.approved);
    const quota = quotaMap.get(uid) || 10;
    const quotaMet = data.approved >= quota;
    const base = data.approved * rule.ratePerSale;
    const goalBonus = quotaMet ? rule.bonusOnGoal : 0;
    const referralBonus = referralMap.get(uid) || 0;
    return {
      userId: uid,
      userName: data.name,
      period: targetPeriod,
      salesApproved: data.approved,
      salesTotal: data.total,
      baseCommission: base,
      goalBonus,
      referralBonus,
      total: base + goalBonus + referralBonus,
      quotaMet,
    };
  }).sort((a, b) => b.total - a.total);
}
