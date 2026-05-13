import { getReferralStats } from './referrals';

export interface CommissionRule {
  minSales: number;
  maxSales: number | null;
  ratePerSale: number;   // MXN per approved sale
  bonusOnGoal: number;   // extra bonus if quota met
}

export interface CommissionResult {
  userId: string;
  userName: string;
  period: string;          // YYYY-MM
  salesApproved: number;
  salesTotal: number;
  baseCommission: number;
  goalBonus: number;
  referralBonus: number;
  total: number;
  quotaMet: boolean;
}

const DEFAULT_RULES: CommissionRule[] = [
  { minSales: 0,  maxSales: 4,   ratePerSale: 150, bonusOnGoal: 0    },
  { minSales: 5,  maxSales: 9,   ratePerSale: 200, bonusOnGoal: 500  },
  { minSales: 10, maxSales: 19,  ratePerSale: 250, bonusOnGoal: 1000 },
  { minSales: 20, maxSales: null, ratePerSale: 300, bonusOnGoal: 2000 },
];

const RULES_KEY = 'adhdreams_commission_rules';
const REFERRAL_BONUS_PER = 150; // MXN per converted referral

export function getCommissionRules(): CommissionRule[] {
  try {
    const stored = localStorage.getItem(RULES_KEY);
    return stored ? JSON.parse(stored) : DEFAULT_RULES;
  } catch { return DEFAULT_RULES; }
}

export function saveCommissionRules(rules: CommissionRule[]) {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}

function getRule(rules: CommissionRule[], count: number): CommissionRule {
  return rules.find(r => count >= r.minSales && (r.maxSales === null || count <= r.maxSales)) ?? rules[0];
}

export function calculateCommissions(period?: string): CommissionResult[] {
  const targetPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM
  const sales: any[] = JSON.parse(localStorage.getItem('adhdreams_sales') || '[]');
  const users: any[] = JSON.parse(localStorage.getItem('adhdreams_users') || '[]');
  const quotas: Record<string, number> = JSON.parse(localStorage.getItem('adhdreams_quotas') || '{}');
  const rules = getCommissionRules();

  const byUser = new Map<string, { name: string; approved: number; total: number }>();

  for (const s of sales) {
    const sDate = (s.fechaSolicitud || '').slice(0, 7);
    if (sDate !== targetPeriod) continue;
    const uid = s.asesorId || 'anonymous';
    if (!byUser.has(uid)) {
      const user = users.find((u: any) => u.uid === uid);
      byUser.set(uid, { name: user?.displayName || user?.email || uid, approved: 0, total: 0 });
    }
    const entry = byUser.get(uid)!;
    entry.total++;
    const st = (s.status || '').toUpperCase();
    if (st === 'APROBADA' || st === 'PROCEDIO') entry.approved++;
  }

  const results: CommissionResult[] = [];
  byUser.forEach((data, uid) => {
    const rule = getRule(rules, data.approved);
    const quota = quotas[uid] || 10;
    const quotaMet = data.approved >= quota;
    const base = data.approved * rule.ratePerSale;
    const goalBonus = quotaMet ? rule.bonusOnGoal : 0;
    const refStats = getReferralStats(uid);
    const referralBonus = refStats.convertidos * REFERRAL_BONUS_PER;
    results.push({
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
    });
  });

  return results.sort((a, b) => b.total - a.total);
}
