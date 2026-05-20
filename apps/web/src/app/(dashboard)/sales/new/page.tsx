'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, User, Phone, MapPin, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import { post } from '@/lib/api';

interface SaleFormData {
  nombres: string;
  apellidos: string;
  telefono: string;
  email: string;
  curp: string;
  plan: string;
  rentaMensual: string;
  zona: string;
  direccion: string;
  colonia: string;
  municipio: string;
  estado: string;
  notas: string;
}

const PLANES = ['BASIC', 'PLUS', 'PRO', 'ENTERPRISE'];
const ESTADOS_MX = [
  'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas',
  'Chihuahua','Ciudad de México','Coahuila','Colima','Durango','Guanajuato',
  'Guerrero','Hidalgo','Jalisco','México','Michoacán','Morelos','Nayarit',
  'Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí',
  'Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas',
];

const STEPS = ['Cliente', 'Dirección', 'Contrato', 'Confirmar'];

export default function NewSalePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<SaleFormData>({
    nombres: '', apellidos: '', telefono: '', email: '', curp: '',
    plan: '', rentaMensual: '', zona: '', direccion: '', colonia: '',
    municipio: '', estado: '', notas: '',
  });

  const update = (key: keyof SaleFormData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await post('/sales', {
        ...form,
        rentaMensual: form.rentaMensual ? parseFloat(form.rentaMensual) : undefined,
      });
      toast.success('Venta creada exitosamente');
      router.push('/sales');
    } catch {
      toast.error('Error al crear la venta');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
  const labelCls = 'block text-xs font-medium text-gray-400 mb-1';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-700 p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-white">Nueva Venta</h2>
          <p className="text-sm text-gray-400 mt-0.5">Registrar nuevo contrato de cliente</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              className={clsx(
                'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                i === step
                  ? 'bg-indigo-600 text-white'
                  : i < step
                  ? 'bg-indigo-600/20 text-indigo-400 cursor-pointer'
                  : 'bg-gray-800 text-gray-500 cursor-default',
              )}
            >
              <span className={clsx(
                'flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold',
                i <= step ? 'bg-white/20' : 'bg-gray-700',
              )}>
                {i + 1}
              </span>
              {label}
            </button>
            {i < STEPS.length - 1 && (
              <div className={clsx('flex-1 h-px', i < step ? 'bg-indigo-600' : 'bg-gray-700')} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-indigo-400" />
              <h3 className="text-lg font-semibold text-white">Datos del Cliente</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Nombres *</label>
                <input className={inputCls} value={form.nombres} onChange={(e) => update('nombres', e.target.value)} placeholder="Juan Carlos" />
              </div>
              <div>
                <label className={labelCls}>Apellidos *</label>
                <input className={inputCls} value={form.apellidos} onChange={(e) => update('apellidos', e.target.value)} placeholder="García López" />
              </div>
              <div>
                <label className={labelCls}>Teléfono</label>
                <input className={inputCls} value={form.telefono} onChange={(e) => update('telefono', e.target.value)} placeholder="5512345678" maxLength={10} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input className={inputCls} type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="cliente@email.com" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>CURP</label>
                <input className={inputCls} value={form.curp} onChange={(e) => update('curp', e.target.value.toUpperCase())} placeholder="XXXX000000XXXXXX00" maxLength={18} />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="h-5 w-5 text-indigo-400" />
              <h3 className="text-lg font-semibold text-white">Dirección</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={labelCls}>Dirección (calle y número)</label>
                <input className={inputCls} value={form.direccion} onChange={(e) => update('direccion', e.target.value)} placeholder="Calle Principal #123" />
              </div>
              <div>
                <label className={labelCls}>Colonia</label>
                <input className={inputCls} value={form.colonia} onChange={(e) => update('colonia', e.target.value)} placeholder="Col. Centro" />
              </div>
              <div>
                <label className={labelCls}>Municipio</label>
                <input className={inputCls} value={form.municipio} onChange={(e) => update('municipio', e.target.value)} placeholder="Guadalajara" />
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <select className={inputCls} value={form.estado} onChange={(e) => update('estado', e.target.value)}>
                  <option value="">Seleccionar estado</option>
                  {ESTADOS_MX.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Zona</label>
                <input className={inputCls} value={form.zona} onChange={(e) => update('zona', e.target.value)} placeholder="Zona Norte" />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-indigo-400" />
              <h3 className="text-lg font-semibold text-white">Datos del Contrato</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Plan</label>
                <select className={inputCls} value={form.plan} onChange={(e) => update('plan', e.target.value)}>
                  <option value="">Seleccionar plan</option>
                  {PLANES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Renta Mensual (MXN)</label>
                <input className={inputCls} type="number" value={form.rentaMensual} onChange={(e) => update('rentaMensual', e.target.value)} placeholder="499.00" />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Notas adicionales</label>
                <textarea
                  className={clsx(inputCls, 'resize-none')}
                  rows={3}
                  value={form.notas}
                  onChange={(e) => update('notas', e.target.value)}
                  placeholder="Observaciones del promotor..."
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Save className="h-5 w-5 text-indigo-400" />
              <h3 className="text-lg font-semibold text-white">Confirmar y Guardar</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Nombres', form.nombres],
                ['Apellidos', form.apellidos],
                ['Teléfono', form.telefono],
                ['Email', form.email],
                ['CURP', form.curp],
                ['Plan', form.plan],
                ['Renta', form.rentaMensual ? `$${form.rentaMensual}` : '—'],
                ['Estado', form.estado],
                ['Municipio', form.municipio],
                ['Zona', form.zona],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-xs text-gray-500">{label}</span>
                  <span className="text-gray-200 font-medium">{value || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 0}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors"
        >
          Anterior
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
          >
            Siguiente
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60 transition-colors"
          >
            {isSubmitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar Venta
          </button>
        )}
      </div>
    </div>
  );
}
