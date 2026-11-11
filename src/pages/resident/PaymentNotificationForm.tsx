import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Info } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useMyDues } from '@/hooks/useDues';
import { useCreatePaymentNotification } from '@/hooks/usePayments';
import { useResidentUnitIds, useMyUnitId } from '@/hooks/useResidentContext';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import FileUpload from '@/components/shared/FileUpload';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatPeriod } from '@/lib/format';
import { isDueEligibleForUnitDebts } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function PaymentNotificationForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preSelectedDueId = searchParams.get('due');

  const { currentApartment } = useAuthStore();
  const unitIds = useResidentUnitIds();
  const unitId = useMyUnitId();
  const { data: dues, isLoading: duesLoading } = useMyDues(unitIds);
  const createNotification = useCreatePaymentNotification();

  const [selectedDueId, setSelectedDueId] = useState(preSelectedDueId || '');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const unpaidDues = (dues || []).filter((d: any) => d.status !== 'paid');

  // Auto-fill amount when due is selected
  useEffect(() => {
    if (selectedDueId && selectedDueId !== 'general') {
      const due = (dues || []).find((d: any) => d.id === selectedDueId);
      if (due) {
        const remaining = Number(due.amount) - Number((due as any).paid_amount || 0);
        setAmount(remaining.toFixed(2));
      }
    }
  }, [selectedDueId, dues]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error('Geçerli bir tutar giriniz.');
      return;
    }

    if (!paymentDate) {
      toast.error('Ödeme tarihini seçiniz.');
      return;
    }

    setSubmitting(true);
    try {
      await createNotification.mutateAsync({
        apartment_id: currentApartment!.id,
        unit_id: unitId!,
        due_id: selectedDueId && selectedDueId !== 'general' ? selectedDueId : null,
        amount: numAmount,
        payment_date: paymentDate,
        description: description || null,
        receipt_url: receiptUrl || null,
      });

      toast.success('Ödeme bildiriminiz yöneticiye iletildi.');
      navigate('/sakin/odemelerim');
    } catch (err: any) {
      toast.error(err?.message || 'Ödeme bildirimi gönderilemedi.');
    } finally {
      setSubmitting(false);
    }
  };

  if (duesLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4 pb-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="w-4 h-4" />
        Geri
      </button>

      <h1 className="text-xl font-bold text-gray-900">Ödeme Bildirimi</h1>

      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-blue-50 rounded-xl p-4">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Bu bildirim yöneticinize iletilecek ve onay sonrası ödeme olarak kaydedilecektir.
          Ödemeniz otomatik olarak onaylanmaz.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Due Selection */}
        <Select
          label="İlgili Borç"
          value={selectedDueId}
          onChange={(e) => setSelectedDueId(e.target.value)}
        >
          <option value="">Borç seçiniz (isteğe bağlı)</option>
          <option value="general">Genel Ödeme</option>
          {unpaidDues.map((due: any) => {
            const remaining = Number(due.amount) - Number(due.paid_amount || 0);
            const isFuture = !isDueEligibleForUnitDebts(due);
            return (
              <option key={due.id} value={due.id}>
                {formatPeriod(due.period)} - {due.description} ({formatCurrency(remaining)} {isFuture ? '· Erken Ödeme' : 'kalan'})
              </option>
            );
          })}
        </Select>

        {/* Amount */}
        <Input
          label="Tutar (₺)"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0,00"
          required
        />

        {/* Payment Date */}
        <Input
          label="Ödeme Tarihi"
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          required
        />

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Açıklama (İsteğe Bağlı)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ödeme hakkında not ekleyebilirsiniz..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
          />
        </div>

        {/* Receipt Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Dekont (İsteğe Bağlı)
          </label>
          <FileUpload
            bucket="receipts"
            folder="payment-notifications"
            onUpload={(url) => setReceiptUrl(url)}
            onRemove={() => setReceiptUrl('')}
            currentUrl={receiptUrl || null}
            accept="all"
            label="Dekont Yükle"
          />
        </div>

        {/* Submit */}
        <Button type="submit" fullWidth loading={submitting} size="lg">
          Ödeme Bildirimini Gönder
        </Button>
      </form>
    </div>
  );
}
