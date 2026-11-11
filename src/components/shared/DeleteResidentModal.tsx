import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertTriangle } from 'lucide-react';
import { useDeleteResident } from '@/hooks/useUnits';

export interface DeleteResidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  resident: {
    id: string;
    unit_id?: string;
    full_name?: string;
    profiles?: {
      full_name?: string;
    } | null;
  } | null;
  unitInfo?: string;
}

export default function DeleteResidentModal({
  isOpen,
  onClose,
  resident,
  unitInfo,
}: DeleteResidentModalProps) {
  const deleteResident = useDeleteResident();

  if (!resident) return null;

  const residentName =
    resident.full_name?.trim() || resident.profiles?.full_name?.trim() || 'Bu sakin';

  const handleDelete = async () => {
    try {
      await deleteResident.mutateAsync({
        id: resident.id,
        unit_id: resident.unit_id,
      });
      onClose();
    } catch {
      // Error handled by mutation hook
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sakini Sil" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-900">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="font-semibold">Bu işlem geri alınamaz.</p>
            <p className="mt-1 text-red-800">
              <strong>{residentName}</strong> adlı sakini{unitInfo ? ` (${unitInfo})` : ''} daireden kalıcı olarak silmek istediğinize emin misiniz?
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={deleteResident.isPending}
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            variant="primary"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={handleDelete}
            loading={deleteResident.isPending}
          >
            Evet, Sakini Sil
          </Button>
        </div>
      </div>
    </Modal>
  );
}
