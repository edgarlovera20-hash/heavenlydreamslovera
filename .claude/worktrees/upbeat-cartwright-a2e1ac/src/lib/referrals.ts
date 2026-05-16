export interface Referral {
  id: string;
  referidoPor: string;        // nombre del cliente que refirió
  telefonoReferidor: string;  // teléfono del cliente referidor
  nombreProspecto: string;    // nombre del prospecto referido
  telefonoProspecto: string;
  comision: number;           // en pesos MXN
  estado: 'pendiente' | 'convertido' | 'cancelado';
  folioVenta?: string;        // folio de la venta si se concretó
  fechaRegistro: string;
  asesorId: string;
}

const KEY = 'adhdreams_referrals';
const COMISION_POR_REFERIDO = 150; // MXN

export function getReferrals(): Referral[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function addReferral(data: Omit<Referral, 'id' | 'fechaRegistro' | 'comision' | 'estado'>): Referral {
  const ref: Referral = {
    ...data,
    id: `REF-${Date.now()}`,
    comision: COMISION_POR_REFERIDO,
    estado: 'pendiente',
    fechaRegistro: new Date().toISOString(),
  };
  const all = getReferrals();
  all.push(ref);
  localStorage.setItem(KEY, JSON.stringify(all));
  return ref;
}

export function updateReferralStatus(id: string, estado: Referral['estado'], folioVenta?: string) {
  const all = getReferrals().map(r =>
    r.id === id ? { ...r, estado, ...(folioVenta ? { folioVenta } : {}) } : r
  );
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function getReferralStats(asesorId?: string) {
  const refs = asesorId ? getReferrals().filter(r => r.asesorId === asesorId) : getReferrals();
  const convertidos = refs.filter(r => r.estado === 'convertido');
  return {
    total: refs.length,
    pendientes: refs.filter(r => r.estado === 'pendiente').length,
    convertidos: convertidos.length,
    comisionTotal: convertidos.reduce((s, r) => s + r.comision, 0),
  };
}
