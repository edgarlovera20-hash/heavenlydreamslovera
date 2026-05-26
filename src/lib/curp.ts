export const CURP_REGEX = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

export const CURP_STATE_NAMES: Record<string, string> = {
  AS: 'Aguascalientes',
  BC: 'Baja California',
  BS: 'Baja California Sur',
  CC: 'Campeche',
  CL: 'Coahuila',
  CM: 'Colima',
  CS: 'Chiapas',
  CH: 'Chihuahua',
  DF: 'Ciudad de Mexico',
  DG: 'Durango',
  GT: 'Guanajuato',
  GR: 'Guerrero',
  HG: 'Hidalgo',
  JC: 'Jalisco',
  MC: 'Estado de Mexico',
  MN: 'Michoacan',
  MS: 'Morelos',
  NT: 'Nayarit',
  NL: 'Nuevo Leon',
  OC: 'Oaxaca',
  PL: 'Puebla',
  QT: 'Queretaro',
  QR: 'Quintana Roo',
  SP: 'San Luis Potosi',
  SL: 'Sinaloa',
  SR: 'Sonora',
  TC: 'Tabasco',
  TS: 'Tamaulipas',
  TL: 'Tlaxcala',
  VZ: 'Veracruz',
  YN: 'Yucatan',
  ZS: 'Zacatecas',
  NE: 'Nacido en el extranjero',
};

export const CURP_STATE_OPTIONS = Object.entries(CURP_STATE_NAMES).map(([code, name]) => ({ code, name }));

export type CurpGenerationInput = {
  nombres?: string | null;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
  fechaNacimiento?: string | null;
  sexo?: string | null;
  estadoNacimiento?: string | null;
};

export type CurpGenerationResult = {
  ok: boolean;
  curp: string;
  curp17: string;
  homoclave: string;
  checkDigit: string;
  missing: string[];
  warnings: string[];
  metadata: {
    normalizedName: string;
    normalizedPaternal: string;
    normalizedMaternal: string;
    givenNameUsed: string;
    stateCode: string;
    year: number | null;
    yy: string;
    mm: string;
    dd: string;
    sex: string;
    preliminary: boolean;
    officialNote: string;
  };
};

const PARTICLES = new Set([
  'DA', 'DAS', 'DE', 'DEL', 'DER', 'DI', 'DIE', 'DD', 'EL', 'LA', 'LOS', 'LAS', 'LE', 'LES',
  'MAC', 'MC', 'VAN', 'VON', 'Y',
]);

const COMMON_NAME_PREFIXES = new Set(['MARIA', 'MA', 'MA.', 'JOSE', 'J', 'J.']);

const INCONVENIENT_WORDS = new Set([
  'BACA', 'BAKA', 'BUEI', 'BUEY', 'CACA', 'CACO', 'CAGA', 'CAGO', 'CAKA', 'CAKO',
  'COGE', 'COGI', 'COJA', 'COJE', 'COJI', 'COJO', 'COLA', 'CULO', 'FALO', 'FETO',
  'GETA', 'GUEI', 'GUEY', 'JETA', 'JOTO', 'KACA', 'KACO', 'KAGA', 'KAGO', 'KOGE',
  'KOGI', 'KOJA', 'KOJE', 'KOJI', 'KOJO', 'KOLA', 'KULO', 'LILO', 'LOCA', 'LOCO',
  'LOKA', 'LOKO', 'MAME', 'MAMO', 'MEAR', 'MEAS', 'MEON', 'MIAR', 'MION', 'MOCO',
  'MOKO', 'MULA', 'MULO', 'NACA', 'NACO', 'PEDA', 'PEDO', 'PENE', 'PIPI', 'PITO',
  'POPO', 'PUTA', 'PUTO', 'QULO', 'RATA', 'ROBA', 'ROBE', 'ROBO', 'RUIN', 'SENO',
  'TETA', 'VACA', 'VAGA', 'VAGO', 'VAKA', 'VUEI', 'VUEY', 'WUEI', 'WUEY',
]);

const STATE_ALIASES: Record<string, string> = {
  AGUASCALIENTES: 'AS',
  BAJA_CALIFORNIA: 'BC',
  BAJA_CALIFORNIA_SUR: 'BS',
  CAMPECHE: 'CC',
  COAHUILA: 'CL',
  COAHUILA_DE_ZARAGOZA: 'CL',
  COLIMA: 'CM',
  CHIAPAS: 'CS',
  CHIHUAHUA: 'CH',
  CIUDAD_DE_MEXICO: 'DF',
  CDMX: 'DF',
  DISTRITO_FEDERAL: 'DF',
  DF: 'DF',
  DURANGO: 'DG',
  GUANAJUATO: 'GT',
  GUERRERO: 'GR',
  HIDALGO: 'HG',
  JALISCO: 'JC',
  ESTADO_DE_MEXICO: 'MC',
  ESTADO_MEXICO: 'MC',
  EDO_MEX: 'MC',
  MEXICO: 'MC',
  EDOMEX: 'MC',
  MEX: 'MC',
  MICHOACAN: 'MN',
  MICHOACAN_DE_OCAMPO: 'MN',
  MORELOS: 'MS',
  NAYARIT: 'NT',
  NUEVO_LEON: 'NL',
  OAXACA: 'OC',
  PUEBLA: 'PL',
  QUERETARO: 'QT',
  QUERETARO_DE_ARTEAGA: 'QT',
  QUINTANA_ROO: 'QR',
  SAN_LUIS_POTOSI: 'SP',
  SINALOA: 'SL',
  SONORA: 'SR',
  TABASCO: 'TC',
  TAMAULIPAS: 'TS',
  TLAXCALA: 'TL',
  VERACRUZ: 'VZ',
  VERACRUZ_DE_IGNACIO_DE_LA_LLAVE: 'VZ',
  YUCATAN: 'YN',
  ZACATECAS: 'ZS',
  NACIDO_EN_EL_EXTRANJERO: 'NE',
  NACIDO_EXTRANJERO: 'NE',
  NACIMIENTO_EXTRANJERO: 'NE',
  EXTRANJERO: 'NE',
};

const CHECKSUM_CHARS = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const OFFICIAL_NOTE = 'CURP preliminar calculada localmente. Los ultimos dos caracteres oficiales pueden variar por homonimia y RENAPO/gob.mx debe confirmarla.';

function normalizeBase(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function normalizeToken(value: unknown) {
  return String(value || '')
    .replace(/[Ññ]/g, 'X')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactNamePart(value: unknown, options: { removeParticles?: boolean } = {}) {
  const words = normalizeToken(value)
    .split(/\s+/)
    .map(word => word.replace(/\./g, ''))
    .filter(Boolean)
    .filter(word => !options.removeParticles || !PARTICLES.has(word));
  return words.join('');
}

function significantGivenName(value: unknown) {
  const words = normalizeToken(value)
    .split(/\s+/)
    .map(word => word.replace(/\./g, ''))
    .filter(Boolean)
    .filter(word => !PARTICLES.has(word));
  if (words.length > 1 && COMMON_NAME_PREFIXES.has(words[0])) {
    return words[1];
  }
  return words[0] || '';
}

function firstInternalVowel(value: string) {
  return value.slice(1).match(/[AEIOU]/)?.[0] || 'X';
}

function firstInternalConsonant(value: string) {
  return value.slice(1).match(/[BCDFGHJKLMNPQRSTVWXYZ]/)?.[0] || 'X';
}

function safeInitial(value: string) {
  return value[0] || 'X';
}

function normalizeSex(value: unknown) {
  const raw = normalizeBase(value);
  if (['H', 'HOMBRE', 'MASCULINO', 'MASC'].includes(raw)) return 'H';
  if (['M', 'MUJER', 'FEMENINO', 'FEM'].includes(raw)) return 'M';
  return '';
}

function normalizeAliasKey(value: unknown) {
  return normalizeBase(value)
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeStateCode(value: unknown) {
  const raw = normalizeBase(value).replace(/[^A-Z]/g, '');
  if (CURP_STATE_NAMES[raw]) return raw;
  const key = normalizeAliasKey(value);
  return STATE_ALIASES[key] || '';
}

export function normalizeCurpValue(value: unknown) {
  return String(value || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 18);
}

function parseBirthDate(value: unknown) {
  const raw = String(value || '').trim();
  let year = 0;
  let month = 0;
  let day = 0;

  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const mx = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (mx) {
    day = Number(mx[1]);
    month = Number(mx[2]);
    year = Number(mx[3]);
  }

  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    year < 1900 ||
    year > new Date().getFullYear()
  ) {
    return null;
  }

  return {
    year,
    yy: String(year).slice(-2),
    mm: String(month).padStart(2, '0'),
    dd: String(day).padStart(2, '0'),
  };
}

function avoidInconvenientWord(prefix: string) {
  if (!INCONVENIENT_WORDS.has(prefix)) return prefix;
  return `${prefix[0]}X${prefix.slice(2)}`;
}

export function calculateCurpCheckDigit(curp17: string) {
  const normalized = curp17.toUpperCase().slice(0, 17);
  if (normalized.length !== 17) return '';
  let sum = 0;
  for (let i = 0; i < normalized.length; i++) {
    const value = CHECKSUM_CHARS.indexOf(normalized[i]);
    if (value < 0) return '';
    sum += value * (18 - i);
  }
  return String((10 - (sum % 10)) % 10);
}

export function validateCurpChecksum(curp: unknown) {
  const normalized = normalizeCurpValue(curp);
  return CURP_REGEX.test(normalized) && calculateCurpCheckDigit(normalized.slice(0, 17)) === normalized[17];
}

export function generateCurpCandidate(input: CurpGenerationInput): CurpGenerationResult {
  const normalizedPaternal = compactNamePart(input.apellidoPaterno, { removeParticles: true });
  const normalizedMaternal = compactNamePart(input.apellidoMaterno, { removeParticles: true });
  const givenNameUsed = significantGivenName(input.nombres);
  const normalizedName = compactNamePart(input.nombres, { removeParticles: true });
  const birth = parseBirthDate(input.fechaNacimiento);
  const sex = normalizeSex(input.sexo);
  const stateCode = normalizeStateCode(input.estadoNacimiento);
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!normalizedName || !givenNameUsed) missing.push('nombres');
  if (!normalizedPaternal && !normalizedMaternal) missing.push('apellidoPaterno');
  if (!birth) missing.push('fechaNacimiento');
  if (!sex) missing.push('sexo');
  if (!stateCode) missing.push('estadoNacimiento');
  if (!normalizedPaternal && normalizedMaternal) warnings.push('Apellido paterno vacio: se usa XX en las dos primeras posiciones.');
  if (!normalizedMaternal) warnings.push('Apellido materno vacio: se usa X en la posicion correspondiente.');

  const metadata = {
    normalizedName,
    normalizedPaternal,
    normalizedMaternal,
    givenNameUsed,
    stateCode,
    year: birth?.year ?? null,
    yy: birth?.yy || '',
    mm: birth?.mm || '',
    dd: birth?.dd || '',
    sex,
    preliminary: true,
    officialNote: OFFICIAL_NOTE,
  };

  if (missing.length) {
    return {
      ok: false,
      curp: '',
      curp17: '',
      homoclave: '',
      checkDigit: '',
      missing,
      warnings,
      metadata,
    };
  }

  const paternalPair = normalizedPaternal
    ? `${safeInitial(normalizedPaternal)}${firstInternalVowel(normalizedPaternal)}`
    : 'XX';
  const prefix = avoidInconvenientWord(`${paternalPair}${safeInitial(normalizedMaternal)}${safeInitial(givenNameUsed)}`);
  const internal = `${firstInternalConsonant(normalizedPaternal)}${firstInternalConsonant(normalizedMaternal)}${firstInternalConsonant(givenNameUsed)}`;
  const homoclave = (birth!.year >= 2000 ? 'A' : '0');
  const curp17 = `${prefix}${birth!.yy}${birth!.mm}${birth!.dd}${sex}${stateCode}${internal}${homoclave}`;
  const checkDigit = calculateCurpCheckDigit(curp17);

  return {
    ok: Boolean(checkDigit),
    curp: `${curp17}${checkDigit}`,
    curp17,
    homoclave,
    checkDigit,
    missing,
    warnings: [
      ...warnings,
      OFFICIAL_NOTE,
    ],
    metadata,
  };
}
