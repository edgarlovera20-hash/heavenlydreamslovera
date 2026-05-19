// ============================================================
// Role enum (matches Prisma schema)
// ============================================================
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  GERENTE = 'GERENTE',
  ADMINISTRACION = 'ADMINISTRACION',
  SUPERVISOR = 'SUPERVISOR',
  PROMOTOR = 'PROMOTOR',
  COBRANZA = 'COBRANZA',
  SOPORTE = 'SOPORTE',
}

// ============================================================
// SaleStatus enum
// ============================================================
export enum SaleStatus {
  PENDIENTE = 'PENDIENTE',
  EN_PROCESO = 'EN_PROCESO',
  VALIDACION = 'VALIDACION',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
  INSTALADA = 'INSTALADA',
  CANCELADA = 'CANCELADA',
}

// ============================================================
// ConversationState enum
// ============================================================
export enum ConversationState {
  IDLE = 'IDLE',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_NAME = 'WAITING_NAME',
  WAITING_PHONE = 'WAITING_PHONE',
  WAITING_EMAIL = 'WAITING_EMAIL',
  WAITING_ADDRESS = 'WAITING_ADDRESS',
  WAITING_CURP = 'WAITING_CURP',
  WAITING_INE = 'WAITING_INE',
  WAITING_COMPROBANTE = 'WAITING_COMPROBANTE',
  WAITING_CONFIRMATION = 'WAITING_CONFIRMATION',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  TRANSFERRED = 'TRANSFERRED',
}

// ============================================================
// FraudRisk enum
// ============================================================
export enum FraudRisk {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

// ============================================================
// WhatsApp session status
// ============================================================
export enum WhatsAppSessionStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  QR_READY = 'QR_READY',
  INITIALIZING = 'INITIALIZING',
  ERROR = 'ERROR',
}

// ============================================================
// Interfaces
// ============================================================

export interface User {
  id: string;
  nombre: string;
  email: string;
  username: string;
  role: Role;
  companyId: string;
  zona?: string;
  puesto?: string;
  active: boolean;
}

export interface Sale {
  id: string;
  companyId: string;
  folio?: string;
  asesorId: string;
  asesor?: User;
  nombres: string;
  apellidos: string;
  telefono?: string;
  plan?: string;
  status: SaleStatus;
  rentaMensual?: number;
  zona?: string;
  direccion?: string;
  colonia?: string;
  municipio?: string;
  estado?: string;
  curp?: string;
  fraudScore?: number;
  fraudRisk?: FraudRisk;
  createdAt: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  companyId: string;
  nombres: string;
  apellidos: string;
  telefono?: string;
  email?: string;
  plan?: string;
  status: string;
  score: number;
  fraudRisk?: FraudRisk;
  createdAt?: string;
}

export interface WhatsAppSession {
  id: string;
  companyId: string;
  name: string;
  phoneNumber?: string;
  status: WhatsAppSessionStatus;
  purpose: string;
  qrCode?: string;
  lastSeen?: string;
  createdAt?: string;
}

export interface Conversation {
  id: string;
  companyId: string;
  channel: 'WHATSAPP' | 'TELEGRAM' | 'WEB';
  state: ConversationState;
  externalId?: string;
  context?: Record<string, unknown>;
  assignedTo?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  companyId?: string;
  accion: string;
  entidad?: string;
  entidadId?: string;
  userId?: string;
  userNombre?: string;
  detalles?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export interface Company {
  id: string;
  nombre: string;
  rfc?: string;
  plan: string;
  active: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  createdAt: string;
}

// ============================================================
// API Response types
// ============================================================

export type ApiResponse<T> = {
  data: T;
  message?: string;
  statusCode: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};

export type AuthResponse = {
  access_token: string;
  user: User;
};
