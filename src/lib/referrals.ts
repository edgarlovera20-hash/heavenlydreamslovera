import { ReferralsAPI } from '../services/db';

export interface Referral {
  id: string;
  referidoPor: string;
  telefonoReferidor: string;
  nombreProspecto: string;
  telefonoProspecto: string;
  comision: number;
  estado: 'pendiente' | 'convertido' | 'cancelado';
  folioVenta?: string;
  fechaRegistro: string;
  asesorId: string;
}

const COMISION_POR_REFERIDO = 150;
let cache: Referral[] = [];

function normalize(row: any): Referral {
  const metadata = (() => {
    try { return typeof row?.metadata === 'string' ? JSON.parse(row.metadata) : row?.metadata || {}; } catch { return {}; }
  })();
  return {
    id: row.id,
    referidoPor: metadata.referidoPor || metadata.telefonoReferidor || row.referred_by || '',
    telefonoReferidor: metadata.telefonoReferidor || '',
    nombreProspecto: metadata.nombreProspecto || row.nombre || '',
    telefonoProspecto: metadata.telefonoProspecto || row.telefono || '',
    comision: Number(metadata.comision || COMISION_POR_REFERIDO),
    estado: (row.status || metadata.estado || (row.convertido ? 'convertido' : 'pendiente')) as Referral['estado'],
    folioVenta: metadata.folioVenta,
    fechaRegistro: row.created_at || metadata.fechaRegistro || new Date().toISOString(),
    asesorId: row.referred_by || metadata.asesorId || '',
  };
}

export function getReferrals(): Referral[] {
  return cache;
}

export async function refreshReferrals(): Promise<Referral[]> {
  const rows = await ReferralsAPI.getAll();
  cache = (Array.isArray(rows) ? rows : []).map(normalize);
  return cache;
}

export async function addReferral(data: Omit<Referral, 'id' | 'fechaRegistro' | 'comision' | 'estado'>): Promise<Referral> {
  const payload = {
    referred_by: data.asesorId,
    nombre: data.nombreProspecto,
    telefono: data.telefonoProspecto,
    status: 'pendiente',
    convertido: 0,
    metadata: {
      ...data,
      comision: COMISION_POR_REFERIDO,
      estado: 'pendiente',
      fechaRegistro: new Date().toISOString(),
    },
  };
  const created = await ReferralsAPI.create(payload);
  await refreshReferrals();
  return cache.find(r => r.id === created.id) || cache[0];
}

export async function updateReferralStatus(id: string, estado: Referral['estado'], folioVenta?: string) {
  const current = cache.find(r => r.id === id);
  await ReferralsAPI.update(id, {
    status: estado,
    convertido: estado === 'convertido' ? 1 : 0,
    metadata: {
      ...(current || {}),
      estado,
      folioVenta: folioVenta || current?.folioVenta,
    },
  });
  await refreshReferrals();
}

export function getReferralStats(asesorId?: string) {
  const refs = asesorId ? cache.filter(r => r.asesorId === asesorId) : cache;
  const convertidos = refs.filter(r => r.estado === 'convertido');
  return {
    total: refs.length,
    pendientes: refs.filter(r => r.estado === 'pendiente').length,
    convertidos: convertidos.length,
    comisionTotal: convertidos.reduce((s, r) => s + r.comision, 0),
  };
}
