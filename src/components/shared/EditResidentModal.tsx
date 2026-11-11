import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import PhoneInput from '@/components/ui/PhoneInput';
import { useUpdateResident } from '@/hooks/useUnits';
import toast from 'react-hot-toast';

export interface EditResidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  resident: {
    id: string;
    unit_id?: string;
    full_name: string;
    phone?: string | null;
    role: 'owner' | 'tenant';
    is_active?: boolean;
    profiles?: {
      full_name?: string;
      phone?: string;
    } | null;
  } | null;
  unitInfo?: string;
}

export default function EditResidentModal({
  isOpen,
  onClose,
  resident,
  unitInfo,
}: EditResidentModalProps) {
  const updateResident = useUpdateResident();

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    role: 'tenant' as 'owner' | 'tenant',
    is_active: true,
  });

  useEffect(() => {
    if (resident) {
      setForm({
        full_name: resident.full_name || resident.profiles?.full_name || '',
        phone: resident.phone || resident.profiles?.phone || '',
        role: resident.role || 'tenant',
        is_active: resident.is_active !== false,
      });
    }
  }, [resident]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resident) return;

    if (!form.full_name.trim()) {
      toast.error('Lütfen sakinin adını ve soyadını giriniz.');
      return;
    }

    try {
      await updateResident.mutateAsync({
        id: resident.id,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        role: form.role,
        is_active: form.is_active,
      });
      onClose();
    } catch {
      // Error handled by mutation hook
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sakin Bilgilerini Düzenle">
      <form onSubmit={handleSubmit} className="space-y-4">
        {unitInfo && (
          <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
            <strong>Daire:</strong> {unitInfo}
          </div>
        )}

        <Input
          label="Ad Soyad *"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          placeholder="Örn: Ahmet Yılmaz"
          required
        />

        <PhoneInput
          label="Telefon Numarası"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          helper="WhatsApp hatırlatmaları ve bildirimler için kullanılır"
        />

        <Select
          label="Rol *"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as 'owner' | 'tenant' })}
          options={[
            { value: 'owner', label: 'Ev Sahibi' },
            { value: 'tenant', label: 'Kiracı' },
          ]}
          required
        />

        <div className="pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
            />
            <span>Aktif Sakin</span>
          </label>
          <p className="text-xs text-gray-400 mt-1 pl-6.5">
            İşareti kaldırırsanız bu sakin pasife alınır ve borç hatırlatmalarında listelenmez.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={updateResident.isPending}>
            Vazgeç
          </Button>
          <Button type="submit" loading={updateResident.isPending}>
            Kaydet
          </Button>
        </div>
      </form>
    </Modal>
  );
}
