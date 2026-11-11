import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, Plus, XCircle, CheckCircle, Eye, ImageIcon, Ban } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatShortDate, formatPeriod } from '@/lib/format';
import { isDueEligibleForUnitDebts } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { usePayments, useCreatePayment, useCancelPayment } from '@/hooks/usePayments';
import { usePaymentNotifications, useApproveNotification, useRejectNotification } from '@/hooks/usePaymentNotifications';
import { useUnits } from '@/hooks/useUnits';
import { useUnitDues } from '@/hooks/useDues';
import toast from 'react-hot-toast';

export default function PaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentApartment } = useAuthStore();
  const { data: payments, isLoading } = usePayments(currentApartment?.id);
  const { data: notifications, isLoading: notiLoading } = usePaymentNotifications(currentApartment?.id);
  const { data: units } = useUnits(currentApartment?.id);
  const createPayment = useCreatePayment();
  const cancelPayment = useCancelPayment();
  const approveNotification = useApproveNotification();
  const rejectNotification = useRejectNotification();

  const unitParam = searchParams.get('unit');
  const actionParam = searchParams.get('action');
  const tabParam = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState(tabParam === 'bildirimler' ? 'bildirimler' : 'odemeler');
  const [showCreate, setShowCreate] = useState(actionParam === 'create');
  const [showCancel, setShowCancel] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showReject, setShowReject] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');

  const [form, setForm] = useState({
    unit_id: unitParam || '',
    due_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    description: '',
  });

  // URL üzerinden action=create, tab ve unit parametresi gelirse modalı ve sekmeyi hazırla
  useEffect(() => {
    const tParam = searchParams.get('tab');
    if (tParam === 'bildirimler' || tParam === 'odemeler') {
      setActiveTab(tParam);
    }
    const uParam = searchParams.get('unit');
    const aParam = searchParams.get('action');
    if (aParam === 'create') {
      setShowCreate(true);
      if (uParam) {
        setForm((prev) => ({
          ...prev,
          unit_id: uParam,
        }));
      }
    }
  }, [searchParams]);

  const handleCloseCreate = () => {
    setShowCreate(false);
    if (searchParams.get('action') || searchParams.get('unit')) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('action');
          next.delete('unit');
          return next;
        },
        { replace: true }
      );
    }
  };

  // Fetch dues for selected unit (henüz vadesi gelmemiş gelecek dönemler filtrelenir)
  const { data: unitDues } = useUnitDues(form.unit_id || undefined);
  const openDues = useMemo(() => {
    return (unitDues ?? []).filter((d: any) => d.status !== 'paid' && isDueEligibleForUnitDebts(d));
  }, [unitDues]);

  const handleSelectDue = (dueId: string) => {
    const due = openDues.find((d: any) => d.id === dueId);
    if (due) {
      const paid = Number(due.paid_amount || 0);
      const remaining = due.remaining_amount ?? Math.max(0, Number(due.amount) - paid);
      setForm({ ...form, due_id: dueId, amount: remaining.toString() });
    } else {
      setForm({ ...form, due_id: dueId });
    }
  };

  const handleCreate = async () => {
    if (!form.unit_id || !form.amount || !form.payment_date) {
      toast.error('Daire, tutar ve tarih zorunludur');
      return;
    }
    try {
      await createPayment.mutateAsync({
        apartment_id: currentApartment!.id,
        unit_id: form.unit_id,
        due_id: form.due_id || null,
        amount: parseFloat(form.amount),
        payment_date: form.payment_date,
        payment_method: form.payment_method,
        description: form.description,
        idempotency_key: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
      toast.success('Ödeme kaydedildi');
      handleCloseCreate();
      setForm({
        unit_id: '',
        due_id: '',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'bank_transfer',
        description: '',
      });
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const handleCancel = async () => {
    if (!showCancel || !cancelReason.trim()) {
      toast.error('İptal gerekçesi zorunludur');
      return;
    }
    try {
      await cancelPayment.mutateAsync({ id: showCancel, cancellation_reason: cancelReason });
      toast.success('Ödeme iptal edildi');
      setShowCancel(null);
      setCancelReason('');
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const handleApprove = async (notifId: string) => {
    try {
      const notif = notifications?.find((n: any) => n.id === notifId);
      if (notif) await approveNotification.mutateAsync(notif as any);
      toast.success('Ödeme bildirimi onaylandı ve ödeme kaydedildi');
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const handleReject = async () => {
    if (!showReject) return;
    try {
      await rejectNotification.mutateAsync({ id: showReject, rejection_reason: rejectReason });
      toast.success('Bildirim reddedildi');
      setShowReject(null);
      setRejectReason('');
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const pendingCount = notifications?.filter((n: any) => n.status === 'pending').length ?? 0;

  const tabs = [
    { id: 'odemeler', label: 'Ödemeler' },
    { id: 'bildirimler', label: `Bildirimler${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
  ];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ödemeler</h1>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" /> Ödeme Kaydet
        </Button>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Payments List */}
      {activeTab === 'odemeler' && (
        <div className="space-y-2">
          {payments && payments.length > 0 ? (
            payments.map((p: any) => (
              <Card key={p.id} className="p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Daire {p.unit?.unit_number}</span>
                      <Badge variant={p.status === 'active' ? 'success' : 'danger'}>
                        {p.status === 'active' ? 'Aktif' : 'İptal'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatShortDate(p.payment_date)} ·{' '}
                      {p.payment_method === 'cash' ? 'Nakit' : p.payment_method === 'bank_transfer' ? 'Havale/EFT' : 'Diğer'}
                    </p>
                    {p.description && <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>}
                    {p.receipt_no && <p className="text-xs text-gray-400">Makbuz: #{p.receipt_no}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-600">{formatCurrency(p.amount)}</p>
                    {p.status === 'active' && (
                      <button
                        onClick={() => setShowCancel(p.id)}
                        className="text-xs text-red-500 hover:text-red-700 mt-1 flex items-center gap-1"
                      >
                        <Ban className="w-3 h-3" /> İptal
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <EmptyState
              icon={<CreditCard className="w-12 h-12" />}
              title="Ödeme kaydı yok"
              description="İlk ödemeyi kaydederek başlayın."
            />
          )}
        </div>
      )}

      {/* Payment Notifications */}
      {activeTab === 'bildirimler' && (
        <div className="space-y-2">
          {notifications && notifications.length > 0 ? (
            notifications.map((n: any) => (
              <Card key={n.id} className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Daire {n.unit?.unit_number}</span>
                      <Badge
                        variant={
                          n.status === 'pending' ? 'warning' :
                          n.status === 'approved' ? 'success' : 'danger'
                        }
                      >
                        {n.status === 'pending' ? 'Bekliyor' :
                         n.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatCurrency(n.amount)} · {formatShortDate(n.payment_date)}
                    </p>
                    {n.description && <p className="text-xs text-gray-400 mt-0.5">{n.description}</p>}
                    {n.receipt_url && (
                      <a
                        href={n.receipt_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary-600 mt-1"
                      >
                        <ImageIcon className="w-3 h-3" /> Dekont Görüntüle
                      </a>
                    )}
                  </div>
                  {n.status === 'pending' && (
                    <div className="flex gap-2 ml-2">
                      <button
                        onClick={() => handleApprove(n.id)}
                        className="p-2 rounded-lg text-green-600 hover:bg-green-50"
                        title="Onayla"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setShowReject(n.id)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50"
                        title="Reddet"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            ))
          ) : (
            <EmptyState
              icon={<Bell className="w-12 h-12" />}
              title="Bildirim yok"
              description="Sakinlerden gelen ödeme bildirimleri burada görünecek."
            />
          )}
        </div>
      )}

      {/* Create Payment Modal */}
      <Modal isOpen={showCreate} onClose={handleCloseCreate} title="Ödeme Kaydet">
        <div className="space-y-4">
          <Select
            label="Daire *"
            value={form.unit_id}
            onChange={(e) => setForm({ ...form, unit_id: e.target.value, due_id: '', amount: '' })}
            options={[
              { value: '', label: 'Daire seçin...' },
              ...(units?.map((u: any) => ({
                value: u.id,
                label: `Daire ${u.unit_number}${u.block ? ` (${u.block} Blok)` : ''}`,
              })) ?? []),
            ]}
          />

          {form.unit_id && openDues.length > 0 && (
            <Select
              label="İlgili Borç"
              value={form.due_id}
              onChange={(e) => handleSelectDue(e.target.value)}
              options={[
                { value: '', label: 'Diğer / Genel Tahsilat' },
                ...openDues.map((d: any) => {
                  const paid = Number(d.paid_amount || 0);
                  const remaining = d.remaining_amount ?? Math.max(0, Number(d.amount) - paid);
                  return {
                    value: d.id,
                    label: `${d.description}${d.period ? ` (${formatPeriod(d.period)})` : ''} - Kalan: ${formatCurrency(remaining)}`,
                  };
                }),
              ]}
            />
          )}

          <Input
            label="Tutar (₺) *"
            type="number"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <Input
            label="Ödeme Tarihi *"
            type="date"
            value={form.payment_date}
            onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
          />
          <Select
            label="Ödeme Yöntemi"
            value={form.payment_method}
            onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
            options={[
              { value: 'bank_transfer', label: 'Havale / EFT' },
              { value: 'cash', label: 'Nakit' },
              { value: 'other', label: 'Diğer' },
            ]}
          />
          <Input
            label="Açıklama"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="İsteğe bağlı"
          />
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="outline" onClick={() => setShowCreate(false)}>İptal</Button>
            <Button onClick={handleCreate} loading={createPayment.isPending}>Kaydet</Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Payment Modal */}
      <Modal isOpen={!!showCancel} onClose={() => setShowCancel(null)} title="Ödeme İptali">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Bu ödemeyi iptal etmek istediğinize emin misiniz? İptal edilen ödeme ilgili borcun bakiyesini güncelleyecektir.
          </p>
          <Input
            label="İptal Gerekçesi *"
            type="textarea"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="İptal nedenini açıklayın"
          />
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="outline" onClick={() => setShowCancel(null)}>Vazgeç</Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelPayment.isPending}>İptal Et</Button>
          </div>
        </div>
      </Modal>

      {/* Reject Notification Modal */}
      <Modal isOpen={!!showReject} onClose={() => setShowReject(null)} title="Bildirim Reddi">
        <div className="space-y-4">
          <Input
            label="Red Gerekçesi"
            type="textarea"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="İsteğe bağlı gerekçe"
          />
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="outline" onClick={() => setShowReject(null)}>Vazgeç</Button>
            <Button variant="danger" onClick={handleReject} loading={rejectNotification.isPending}>Reddet</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Import Bell for empty state
import { Bell } from 'lucide-react';
