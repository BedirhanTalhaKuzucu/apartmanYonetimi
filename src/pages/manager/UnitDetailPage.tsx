import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, UserPlus, Send, Link2, Phone, Copy, MessageCircle, CreditCard, Wallet, Download, FileText, Pencil, Trash2, Clock, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate, formatShortDate, formatPhone, formatPeriod, isOverdue } from '@/lib/format';
import { buildWhatsAppUrl, isDueEligibleForUnitDebts, generateIdempotencyKey, sortUnitResidents, formatUnitOptionLabel } from '@/lib/utils';
import { generatePaymentReceipt, downloadPdf } from '@/lib/pdf';
import { buildDebtReminderText, getSmartPortalUrl, type DebtItem } from '@/lib/debtReminder';
import { useUnitDetail, useUpdateUnit } from '@/hooks/useUnits';
import { useUnitResidents, useAddResident } from '@/hooks/useResidents';
import { useCreateInvitation, useUnitInvitations, useCancelInvitation } from '@/hooks/useInvitations';
import { useUnitDues } from '@/hooks/useDues';
import { useUnitPayments, useCreatePayment } from '@/hooks/usePayments';
import { useAuthStore } from '@/store/authStore';
import SelectResidentModal, { type SelectResidentItem } from '@/components/shared/SelectResidentModal';
import EditResidentModal from '@/components/shared/EditResidentModal';
import DeleteResidentModal from '@/components/shared/DeleteResidentModal';
import DeleteUnitModal from '@/components/shared/DeleteUnitModal';
import toast from 'react-hot-toast';

export default function UnitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentApartment, user } = useAuthStore();
  const { data: unit, isLoading } = useUnitDetail(id!);
  const updateUnit = useUpdateUnit();
  const [showDeleteUnitModal, setShowDeleteUnitModal] = useState(false);
  const { data: residents } = useUnitResidents(id!);
  const { data: unitInvitations } = useUnitInvitations(id);
  const addResident = useAddResident();
  const createInvitation = useCreateInvitation();
  const cancelInvitation = useCancelInvitation();
  const { data: dues } = useUnitDues(id!);
  const { data: payments } = useUnitPayments(id!);
  const createPayment = useCreatePayment();

  // Borçlar sekmesinde: Yalnızca ödenmemiş/kısmi ve tahakkuk etmiş borçlar gösterilir.
  // Ödenen borçlar artık bu sekmede yer almaz, "Ödemeler" sekmesinde listelenir.
  const openEligibleDues = useMemo(() => {
    return (dues ?? []).filter((d: any) => d.status !== 'paid' && isDueEligibleForUnitDebts(d));
  }, [dues]);

  const totalEligibleDebt = useMemo(() => {
    return openEligibleDues.reduce((sum: number, d: any) => {
      const remaining = d.remaining_amount ?? Math.max(0, Number(d.amount) - Number(d.paid_amount || 0));
      return sum + remaining;
    }, 0);
  }, [openEligibleDues]);

  const totalPaidAmount = useMemo(() => {
    return (payments ?? [])
      .filter((p: any) => p.status === 'active')
      .reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  }, [payments]);

  const primaryResident = useMemo(() => {
    if (!residents || residents.length === 0) return null;
    const sorted = sortUnitResidents(residents);
    return sorted[0];
  }, [residents]);

  const [editingResident, setEditingResident] = useState<any | null>(null);
  const [deletingResident, setDeletingResident] = useState<any | null>(null);
  const [residentSelectModal, setResidentSelectModal] = useState<{
    isOpen: boolean;
    title?: string;
    subtitle?: string;
    description?: string;
    actionLabel?: string;
    actionType?: 'whatsapp' | 'select';
    residents: SelectResidentItem[];
    onSelect: (resident: SelectResidentItem) => void;
  }>({
    isOpen: false,
    residents: [],
    onSelect: () => {},
  });

  const executeSendUnitDebtReminder = async (targetResident: any) => {
    if (!targetResident?.phone) {
      toast.error('Bu sakine ait kayıtlı bir telefon numarası bulunamadı.');
      return;
    }

    const items: DebtItem[] = openEligibleDues.map((d: any) => {
      const paid = Number(d.paid_amount || 0);
      const remaining = d.remaining_amount ?? Math.max(0, Number(d.amount) - paid);
      return {
        description: d.description || (d.period ? formatPeriod(d.period) : 'Aidat'),
        amount: remaining,
        dueDate: d.due_date,
        period: d.period,
        isOverdue: Boolean(d.due_date && isOverdue(d.due_date)),
      };
    });

    const overdueDebt = items
      .filter((i) => i.isOverdue)
      .reduce((sum, i) => sum + i.amount, 0);

    let smartLink: string | undefined;
    try {
      smartLink = await getSmartPortalUrl({
        apartmentId: currentApartment!.id,
        unitId: id!,
        userId: targetResident.user_id,
        residentName: targetResident.full_name,
        residentPhone: targetResident.phone,
        residentRole: targetResident.role,
        createdBy: user?.id,
      });
    } catch {
      smartLink = `${window.location.origin}/sakin/aidatlarim`;
    }

    const text = buildDebtReminderText({
      apartmentName: currentApartment?.name || 'Apartman',
      unitNumber: unit?.unit_number || '',
      block: unit?.block,
      residentName: targetResident.full_name,
      totalDebt: totalEligibleDebt,
      overdueDebt,
      items,
      smartLink,
    });

    const url = buildWhatsAppUrl(targetResident.phone, text);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSendUnitDebtReminderWhatsApp = () => {
    const candidates = (residents || [])
      .map((r: any) => ({
        ...r,
        full_name: r.full_name?.trim() || r.profiles?.full_name?.trim() || 'İsimsiz Sakin',
        phone: r.phone?.trim() || r.profiles?.phone?.trim(),
      }))
      .filter((r: any) => r.phone && r.is_active !== false);

    if (candidates.length === 0) {
      toast.error('Bu daireye ait kayıtlı bir telefon numarası bulunamadı. Lütfen önce Sakinler sekmesinden telefon numarası ekleyin.');
      return;
    }

    if (candidates.length === 1) {
      executeSendUnitDebtReminder(candidates[0]);
      return;
    }

    setResidentSelectModal({
      isOpen: true,
      title: 'Borç Bildirimi Gönderilecek Sakini Seçin',
      subtitle: `${unit?.block ? `${unit.block} Blok ` : ''}Daire ${unit?.unit_number || ''} - Toplam Borç: ${formatCurrency(totalEligibleDebt)}`,
      residents: candidates,
      onSelect: (chosen) => executeSendUnitDebtReminder(chosen),
    });
  };

  const executeSendSingleDueReminder = async (due: any, targetResident: any) => {
    if (!targetResident?.phone) {
      toast.error('Bu sakine ait kayıtlı bir telefon numarası bulunamadı.');
      return;
    }
    const paid = Number(due.paid_amount || 0);
    const remaining = due.remaining_amount ?? Math.max(0, Number(due.amount) - paid);
    const isLate = Boolean(due.due_date && isOverdue(due.due_date));

    let smartLink: string | undefined;
    try {
      smartLink = await getSmartPortalUrl({
        apartmentId: currentApartment!.id,
        unitId: id!,
        userId: targetResident.user_id,
        residentName: targetResident.full_name,
        residentPhone: targetResident.phone,
        residentRole: targetResident.role,
        createdBy: user?.id,
      });
    } catch {
      smartLink = `${window.location.origin}/sakin/aidatlarim`;
    }

    const text = buildDebtReminderText({
      apartmentName: currentApartment?.name || 'Apartman',
      unitNumber: unit?.unit_number || '',
      block: unit?.block,
      residentName: targetResident.full_name,
      totalDebt: remaining,
      overdueDebt: isLate ? remaining : 0,
      items: [
        {
          description: due.description || (due.period ? formatPeriod(due.period) : 'Aidat'),
          amount: remaining,
          dueDate: due.due_date,
          period: due.period,
          isOverdue: isLate,
        },
      ],
      smartLink,
    });

    const url = buildWhatsAppUrl(targetResident.phone, text);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSendSingleDueReminderWhatsApp = (due: any) => {
    const candidates = (residents || [])
      .map((r: any) => ({
        ...r,
        full_name: r.full_name?.trim() || r.profiles?.full_name?.trim() || 'İsimsiz Sakin',
        phone: r.phone?.trim() || r.profiles?.phone?.trim(),
      }))
      .filter((r: any) => r.phone && r.is_active !== false);

    if (candidates.length === 0) {
      toast.error('Bu daireye ait kayıtlı bir telefon numarası bulunamadı. Lütfen Sakinler sekmesinden telefon ekleyin.');
      return;
    }

    if (candidates.length === 1) {
      executeSendSingleDueReminder(due, candidates[0]);
      return;
    }

    const paid = Number(due.paid_amount || 0);
    const remaining = due.remaining_amount ?? Math.max(0, Number(due.amount) - paid);

    setResidentSelectModal({
      isOpen: true,
      title: `${due.description || 'Aidat'} Hatırlatması`,
      subtitle: `${unit?.block ? `${unit.block} Blok ` : ''}Daire ${unit?.unit_number || ''} - Kalan: ${formatCurrency(remaining)}`,
      residents: candidates,
      onSelect: (chosen) => executeSendSingleDueReminder(due, chosen),
    });
  };

  const executeDownloadReceipt = (payment: any, targetResident?: any) => {
    try {
      const receiptNo = payment.receipt_no || `MK-${payment.id.slice(0, 8).toUpperCase()}`;
      const payerName =
        targetResident?.full_name?.trim() ||
        primaryResident?.full_name?.trim() ||
        (unit?.unit_number ? `Daire ${unit.unit_number} Sakini` : 'Bina Sakini');
      const dueInfo = payment.dues
        ? `${payment.dues.description}${payment.dues.period ? ` (${formatPeriod(payment.dues.period)})` : ''}`
        : (payment.description || 'Aidat / Tahsilat');

      const blob = generatePaymentReceipt({
        apartmentName: currentApartment?.name || 'Apartman Yönetimi',
        unitNumber: `${unit?.block ? `${unit.block} Blok ` : ''}Daire ${unit?.unit_number || ''}`,
        payerName,
        paymentDate: payment.payment_date,
        paymentMethod: payment.payment_method ?? 'bank_transfer',
        relatedPeriod: dueInfo,
        amount: Number(payment.amount),
        receiptNo,
        description: payment.description,
        isCancelled: payment.status === 'cancelled',
        cancellationReason: payment.cancellation_reason,
      });

      downloadPdf(blob, `tahsilat-makbuzu-${receiptNo}.pdf`);
      toast.success('Tahsilat makbuzu indirildi');
    } catch (err: any) {
      toast.error('Makbuz oluşturulamadı: ' + (err.message || ''));
    }
  };

  const handleDownloadReceipt = (payment: any) => {
    const activeList = sortUnitResidents(residents || [])
      .filter((r: any) => r.is_active !== false)
      .map((r: any) => ({
        id: r.id,
        full_name: r.full_name?.trim() || r.profiles?.full_name?.trim() || 'İsimsiz Sakin',
        phone: r.phone?.trim() || r.profiles?.phone?.trim(),
        role: r.role,
        user_id: r.user_id,
        is_active: r.is_active,
      }));

    if (activeList.length > 1) {
      setResidentSelectModal({
        isOpen: true,
        title: 'Makbuz İçin Sakin Seçin',
        subtitle: `${unit?.block ? `${unit.block} Blok ` : ''}Daire ${unit?.unit_number || ''} — ${formatCurrency(payment.amount)}`,
        description:
          'Bu dairede kayıtlı birden fazla sakin bulunmaktadır. Makbuzu hangi sakin adına oluşturmak istersiniz?',
        actionLabel: 'Makbuz Oluştur',
        actionType: 'select',
        residents: activeList,
        onSelect: (chosen) => executeDownloadReceipt(payment, chosen),
      });
      return;
    }

    executeDownloadReceipt(payment, activeList[0]);
  };

  const executeShareReceiptWhatsApp = (payment: any, targetResident?: any) => {
    const targetPhone = targetResident?.phone || primaryResident?.phone;
    const payerName = targetResident?.full_name || primaryResident?.full_name || 'Sayın Sakinimiz';
    const receiptNo = payment.receipt_no || `MK-${payment.id.slice(0, 8).toUpperCase()}`;
    const unitStr = `${unit?.block ? `${unit.block} Blok ` : ''}Daire ${unit?.unit_number || ''}`;
    const dueInfo = payment.dues
      ? `${payment.dues.description}${payment.dues.period ? ` (${formatPeriod(payment.dues.period)})` : ''}`
      : (payment.description || 'Aidat / Tahsilat');

    const methodLabels: Record<string, string> = {
      bank_transfer: 'Havale / EFT',
      cash: 'Nakit',
      other: 'Diğer',
    };
    const methodStr = methodLabels[payment.payment_method] || 'Banka Transferi';

    const msg =
`Merhaba ${payerName} 👋

🏢 *${currentApartment?.name || 'Apartman'}* (${unitStr}) için ödemeniz onaylanmış ve kayıtlara geçmiştir.

🧾 *Tahsilat Makbuzu / Ödeme Bilgileri:*
• Makbuz No: *#${receiptNo}*
• Ödeme Tarihi: *${formatShortDate(payment.payment_date)}*
• Tutar: *${formatCurrency(payment.amount)}*
• Ödeme Yöntemi: ${methodStr}
• İlgili Borç: ${dueInfo}${payment.description && payment.description !== dueInfo ? `\n• Açıklama: ${payment.description}` : ''}

Ödemeniz için teşekkür eder, iyi günler dileriz. 🏡✨`;

    // Otomatik makbuz PDF'ini de indir
    try {
      executeDownloadReceipt(payment, targetResident);
    } catch {
      // ignore
    }

    if (targetPhone) {
      const url = buildWhatsAppUrl(targetPhone, msg);
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      navigator.clipboard.writeText(msg);
      toast.success('Kayıtlı telefon bulunamadı; makbuz metni panoya kopyalandı ve PDF indirildi.');
    }
  };

  const handleShareReceiptWhatsApp = (payment: any) => {
    const candidates = sortUnitResidents(residents || [])
      .filter((r: any) => r.is_active !== false)
      .map((r: any) => ({
        id: r.id,
        full_name: r.full_name?.trim() || r.profiles?.full_name?.trim() || 'İsimsiz Sakin',
        phone: r.phone?.trim() || r.profiles?.phone?.trim(),
        role: r.role,
        user_id: r.user_id,
        is_active: r.is_active,
      }));

    const phoneCandidates = candidates.filter((c) => c.phone);
    const listToChoose = phoneCandidates.length > 1 ? phoneCandidates : candidates;

    if (listToChoose.length > 1) {
      setResidentSelectModal({
        isOpen: true,
        title: 'Makbuz Gönderilecek Sakini Seçin',
        subtitle: `${unit?.block ? `${unit.block} Blok ` : ''}Daire ${unit?.unit_number || ''} — ${formatCurrency(payment.amount)}`,
        description:
          'Bu dairede kayıtlı birden fazla sakin bulunmaktadır. Makbuzu hangi sakin için oluşturup göndermek istersiniz?',
        actionLabel: 'Seç & Gönder',
        actionType: 'whatsapp',
        residents: listToChoose,
        onSelect: (chosen) => executeShareReceiptWhatsApp(payment, chosen),
      });
      return;
    }

    executeShareReceiptWhatsApp(payment, listToChoose[0]);
  };

  const [activeTab, setActiveTab] = useState('bilgi');
  const [showAddResident, setShowAddResident] = useState(false);
  const [showInviteLink, setShowInviteLink] = useState<string | null>(null);
  const [inviteTargetPhone, setInviteTargetPhone] = useState<string | null>(null);
  const [inviteTargetName, setInviteTargetName] = useState<string | null>(null);
  const [showDirectInvite, setShowDirectInvite] = useState(false);
  const [quickPayDue, setQuickPayDue] = useState<any | null>(null);
  const [quickPayForm, setQuickPayForm] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    description: '',
  });

  const handleOpenQuickPay = (due: any) => {
    const paid = Number(due.paid_amount || 0);
    const remaining = due.remaining_amount ?? Math.max(0, Number(due.amount) - paid);
    setQuickPayDue(due);
    setQuickPayForm({
      amount: remaining > 0 ? remaining.toString() : due.amount.toString(),
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
      description: `Daire ${unit?.unit_number} - ${due.description || 'Aidat'} tahsilatı`,
    });
  };

  const handleSaveQuickPay = async () => {
    if (!quickPayDue || !unit) return;
    const amt = parseFloat(quickPayForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast.error('Geçerli bir ödeme tutarı girin');
      return;
    }
    try {
      await createPayment.mutateAsync({
        apartment_id: currentApartment!.id,
        unit_id: unit.id,
        due_id: quickPayDue.id,
        amount: amt,
        payment_date: quickPayForm.payment_date,
        payment_method: quickPayForm.payment_method,
        description: quickPayForm.description.trim() || undefined,
        idempotency_key: generateIdempotencyKey(),
      });
      toast.success('Ödeme başarıyla kaydedildi');
      setQuickPayDue(null);
    } catch (err: any) {
      toast.error(err.message || 'Ödeme kaydedilemedi');
    }
  };
  const [inviteForm, setInviteForm] = useState({
    invited_name: '',
    invited_phone: '',
    resident_role: 'tenant' as 'owner' | 'tenant',
  });

  const [unitForm, setUnitForm] = useState({
    unit_number: '',
    floor: '',
    block: '',
    monthly_due: '',
    is_active: true,
  });

  const [residentForm, setResidentForm] = useState({
    full_name: '',
    phone: '',
    role: 'tenant' as 'owner' | 'tenant',
  });

  useEffect(() => {
    if (unit) {
      setUnitForm({
        unit_number: unit.unit_number || '',
        floor: unit.floor || '',
        block: unit.block || '',
        monthly_due: unit.monthly_due?.toString() || '',
        is_active: unit.is_active ?? true,
      });
    }
  }, [unit]);

  const handleSaveUnit = async () => {
    if (!unitForm.unit_number.trim()) {
      toast.error('Daire numarası zorunludur');
      return;
    }
    try {
      await updateUnit.mutateAsync({
        id: id!,
        unit_number: unitForm.unit_number.trim(),
        floor: unitForm.floor.trim() || null,
        block: unitForm.block.trim() || null,
        monthly_due: unitForm.monthly_due ? parseFloat(unitForm.monthly_due) : null,
        is_active: unitForm.is_active,
      });
      toast.success('Daire bilgileri güncellendi');
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const handleAddResident = async () => {
    if (addResident.isPending) return;
    if (!residentForm.full_name.trim()) {
      toast.error('İsim zorunludur');
      return;
    }
    try {
      await addResident.mutateAsync({
        unit_id: id!,
        full_name: residentForm.full_name.trim(),
        phone: residentForm.phone.trim() || null,
        role: residentForm.role,
      });
      setShowAddResident(false);
      setResidentForm({ full_name: '', phone: '', role: 'tenant' });
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const handleCreateInvite = async (resident: any) => {
    if (createInvitation.isPending) return;
    try {
      const invitation = await createInvitation.mutateAsync({
        apartment_id: currentApartment!.id,
        unit_id: id!,
        invited_name: resident.full_name,
        invited_phone: resident.phone,
        resident_role: resident.role,
      });
      const inviteUrl = `${window.location.origin}/davet/${invitation.token}`;
      setShowInviteLink(inviteUrl);
      setInviteTargetPhone(resident.phone || null);
      setInviteTargetName(resident.full_name || null);
    } catch (err: any) {
      toast.error(err.message || 'Davet oluşturulamadı');
    }
  };

  const handleDirectInvite = async () => {
    if (createInvitation.isPending) return;
    try {
      const invitation = await createInvitation.mutateAsync({
        apartment_id: currentApartment!.id,
        unit_id: id!,
        invited_name: inviteForm.invited_name.trim() || undefined,
        invited_phone: inviteForm.invited_phone.trim() || undefined,
        resident_role: inviteForm.resident_role,
      });
      const inviteUrl = `${window.location.origin}/davet/${invitation.token}`;
      setShowInviteLink(inviteUrl);
      setInviteTargetPhone(inviteForm.invited_phone.trim() || null);
      setInviteTargetName(inviteForm.invited_name.trim() || null);
      setShowDirectInvite(false);
      setInviteForm({ invited_name: '', invited_phone: '', resident_role: 'tenant' });
    } catch (err: any) {
      toast.error(err.message || 'Davet oluşturulamadı');
    }
  };

  const getInviteWhatsAppMessage = () => {
    if (!showInviteLink) return '';
    const aptName = currentApartment?.name || 'Apartman';
    const unitInfo = unit?.unit_number ? `${unit.block ? `${unit.block} Blok ` : ''}Daire ${unit.unit_number}` : '';
    const greeting = inviteTargetName ? `Merhaba ${inviteTargetName} 👋` : 'Merhaba 👋';

    return (
`${greeting}

🏢 *${aptName}*${unitInfo ? ` (${unitInfo})` : ''} dijital apartman yönetim uygulamamıza davet edildiniz!

Artık apartmanımızla ilgili tüm işlemleri cep telefonunuzdan kolayca, hızlı ve %100 şeffaf şekilde takip edebilirsiniz:

✨ *Uygulamamızla Neler Yapabilirsiniz?*
• 💳 Aidat ve geçmiş borçlarınızı anlık görüntüleyin
• 🧾 Dekont yükleyerek ödemelerinizi tek tıkla bildirin
• 🔧 Arıza ve bakım taleplerinizi fotoğraflı iletin ve canlı izleyin
• 📢 Apartman duyurularından anında haberdar olun
• 📱 Dilerseniz ana ekranınıza ekleyip mobil uygulama (PWA) olarak kullanın

👉 *Dairenize hemen katılmak için davet bağlantınız:*
${showInviteLink}

_(Not: Bu bağlantı size özeldir ve 7 gün geçerlidir.)_

Aramıza hoş geldiniz! 🏡✨`
    );
  };

  const copyInviteLink = () => {
    if (showInviteLink) {
      navigator.clipboard.writeText(showInviteLink);
      toast.success('Bağlantı kopyalandı');
    }
  };

  const copyInviteMessage = () => {
    const message = getInviteWhatsAppMessage();
    if (message) {
      navigator.clipboard.writeText(message);
      toast.success('Tüm davet mesajı kopyalandı');
    }
  };

  const shareInviteWhatsApp = (phone?: string) => {
    if (!showInviteLink) return;
    const targetPhone = phone || inviteTargetPhone;
    const message = getInviteWhatsAppMessage();
    const url = buildWhatsAppUrl(targetPhone || '', message);
    window.open(url, '_blank');
  };

  if (isLoading) return <LoadingSpinner />;
  if (!unit) return <div className="p-4 text-center text-gray-500">Daire bulunamadı</div>;

  const pendingInvitations = unitInvitations || [];

  const tabs = [
    { id: 'bilgi', label: 'Bilgi' },
    {
      id: 'sakinler',
      label: `Sakinler (${residents?.length ?? 0}${pendingInvitations.length > 0 ? ` + ${pendingInvitations.length} Davet` : ''})`,
    },
    { id: 'borclar', label: `Borçlar (${openEligibleDues.length})` },
    { id: 'odemeler', label: `Ödemeler (${payments?.length ?? 0})` },
  ];

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {formatUnitOptionLabel({ ...unit, unit_residents: residents || (unit as any).unit_residents })}
          </h1>
          <p className="text-sm text-gray-500">
            {unit.floor && `${unit.floor}. Kat`}
            {!unit.is_active && ' · Pasif'}
          </p>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Bilgi Tab */}
      {activeTab === 'bilgi' && (
        <Card className="p-4 space-y-4">
          <Input
            label="Daire Numarası *"
            value={unitForm.unit_number}
            onChange={(e) => setUnitForm({ ...unitForm, unit_number: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Kat"
              value={unitForm.floor}
              onChange={(e) => setUnitForm({ ...unitForm, floor: e.target.value })}
            />
            <Input
              label="Blok"
              value={unitForm.block}
              onChange={(e) => setUnitForm({ ...unitForm, block: e.target.value })}
            />
          </div>
          <Input
            label="Aylık Aidat (₺)"
            type="number"
            value={unitForm.monthly_due}
            onChange={(e) => setUnitForm({ ...unitForm, monthly_due: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={unitForm.is_active}
              onChange={(e) => setUnitForm({ ...unitForm, is_active: e.target.checked })}
              className="rounded border-gray-300"
            />
            Aktif daire
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-gray-100">
            <Button onClick={handleSaveUnit} loading={updateUnit.isPending}>
              <Save className="w-4 h-4 mr-2" /> Değişiklikleri Kaydet
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 font-medium justify-center"
              onClick={() => setShowDeleteUnitModal(true)}
              title="Daireyi Sil"
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Daireyi Sil
            </Button>
          </div>
        </Card>
      )}

      {/* Sakinler Tab */}
      {activeTab === 'sakinler' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setShowAddResident(true)}>
              <UserPlus className="w-4 h-4 mr-1" /> Sakin Ekle
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowDirectInvite(true)}>
              <Link2 className="w-4 h-4 mr-1" /> Davet Linki Oluştur
            </Button>
          </div>

          {residents && residents.length > 0 ? (
            sortUnitResidents(residents).map((resident: any, idx: number) => {
              const resName = resident.full_name?.trim() || resident.profiles?.full_name?.trim() || 'İsimsiz Sakin';
              const resPhone = resident.phone?.trim() || resident.profiles?.phone?.trim();
              const isPrimary = idx === 0 && resident.is_active !== false;

              return (
                <Card
                  key={resident.id}
                  className="p-3.5 sm:p-4 bg-white border border-gray-200 rounded-xl shadow-2xs hover:border-gray-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Sakin Bilgileri */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm sm:text-base">
                          {resName}
                        </span>
                        <Badge variant={resident.role === 'owner' ? 'info' : 'neutral'} className="text-[11px] px-2 py-0.5">
                          {resident.role === 'owner' ? 'Ev Sahibi' : 'Kiracı'}
                        </Badge>
                        {isPrimary && (
                          <Badge variant="success" className="text-[10px] px-1.5 py-0.5">
                            Ana Sakin
                          </Badge>
                        )}
                        {!resident.is_active && (
                          <Badge variant="neutral" className="text-[11px] px-2 py-0.5">
                            Pasif
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 flex-wrap text-xs text-gray-500">
                        {resPhone ? (
                          <div className="flex items-center gap-1 font-mono text-gray-700 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                            <Phone className="w-3 h-3 text-gray-400 shrink-0" />
                            <span>{formatPhone(resPhone)}</span>
                            <a
                              href={buildWhatsAppUrl(resPhone, `Merhaba ${resName} 👋`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 ml-1 inline-flex items-center p-0.5"
                              title="WhatsApp ile sohbet et"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <span className="italic text-gray-400">Telefon kayıtlı değil</span>
                        )}

                        <span className="text-gray-300 hidden sm:inline">•</span>

                        {resident.user_id ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Uygulamada Kayıtlı
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                            Henüz Katılmadı
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Aksiyon Butonları (Geniş & Rahat) */}
                    <div className="flex items-center justify-end gap-1.5 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-gray-100 shrink-0">
                      {!resident.user_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCreateInvite({ ...resident, full_name: resName, phone: resPhone })}
                          loading={createInvitation.isPending}
                          className="text-xs h-8 px-2.5 font-medium text-primary-700 hover:bg-primary-50 border-primary-200 shadow-2xs"
                          title="Davet Linki Oluştur"
                        >
                          <Send className="w-3.5 h-3.5 mr-1" /> Davet
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setEditingResident({
                            ...resident,
                            full_name: resName,
                            phone: resPhone,
                          })
                        }
                        className="text-xs h-8 px-2.5 font-medium text-gray-700 hover:text-gray-900 shadow-2xs"
                        title="Sakini Düzenle"
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" /> Düzenle
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 px-2.5 font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 shadow-2xs"
                        onClick={() =>
                          setDeletingResident({
                            ...resident,
                            full_name: resName,
                            phone: resPhone,
                            unit_id: id,
                          })
                        }
                        title="Sakini Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Sil
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          ) : !pendingInvitations.length ? (
            <EmptyState
              icon={<UserPlus className="w-10 h-10" />}
              title="Sakin kaydı yok"
              description="Bu daireye sakin ekleyin veya davet bağlantısı oluşturun."
            />
          ) : null}

          {/* Bekleyen Davetler (Kayıt Bekleniyor) */}
          {pendingInvitations.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Bekleyen Davetler ({pendingInvitations.length})</span>
                </h3>
                <span className="text-[11px] text-gray-500 hidden sm:inline">
                  Kayıt olduklarında otomatik sakin listesine eklenecektir
                </span>
              </div>
              <div className="space-y-2">
                {pendingInvitations.map((inv) => (
                  <Card key={inv.id} className="p-3.5 bg-amber-50/40 border border-amber-200/80 rounded-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 text-sm">
                            {inv.invited_name || 'İsimsiz Davet'}
                          </span>
                          <Badge variant="warning" className="text-[10px] px-1.5 py-0.5">
                            Kayıt Bekleniyor
                          </Badge>
                          <Badge variant={inv.resident_role === 'owner' ? 'info' : 'neutral'} className="text-[10px] px-1.5 py-0.5">
                            {inv.resident_role === 'owner' ? 'Ev Sahibi' : 'Kiracı'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          {inv.invited_phone ? (
                            <span className="font-mono">{formatPhone(inv.invited_phone)}</span>
                          ) : (
                            <span className="text-gray-400 italic">Telefon belirtilmemiş</span>
                          )}
                          <span className="text-gray-300">•</span>
                          <span className="text-gray-500 text-[11px]">
                            {formatShortDate(inv.created_at)} tarihinde oluşturuldu
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7.5 px-2.5 text-xs text-gray-700 bg-white"
                          onClick={() => {
                            const url = `${window.location.origin}/davet/${inv.token}`;
                            navigator.clipboard.writeText(url);
                            toast.success('Davet linki kopyalandı');
                          }}
                          title="Davet linkini kopyala"
                        >
                          <Copy className="w-3 h-3 mr-1" /> Kopyala
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7.5 px-2.5 text-xs text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                          onClick={() => {
                            const url = `${window.location.origin}/davet/${inv.token}`;
                            const aptName = currentApartment?.name || 'Apartman';
                            const msg = `🏢 *${aptName}* davet bağlantınız:\n${url}`;
                            window.open(buildWhatsAppUrl(inv.invited_phone || '', msg), '_blank');
                          }}
                          title="WhatsApp ile tekrar gönder"
                        >
                          <MessageCircle className="w-3 h-3 mr-1" /> WhatsApp
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7.5 px-2 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                          onClick={async () => {
                            if (window.confirm('Bu davet bağlantısını iptal etmek istediğinize emin misiniz?')) {
                              await cancelInvitation.mutateAsync(inv.id);
                            }
                          }}
                          loading={cancelInvitation.isPending}
                          title="Daveti İptal Et"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Borçlar Tab (Yalnızca ödenmemiş/kısmi ödenmiş aktif borçlar listelenir) */}
      {activeTab === 'borclar' && (
        <div className="space-y-3">
          {totalEligibleDebt > 0 && (
            <div className="p-3.5 sm:p-4 bg-red-50/90 border border-red-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-red-950 block text-sm sm:text-base">Aktif Toplam Borç</span>
                  <span className="text-xs text-red-700">
                    Bu ayın aidatı, gecikmiş borçlar ve gider payları
                  </span>
                </div>
                <span className="text-lg sm:text-xl font-black text-red-700 shrink-0">
                  {formatCurrency(totalEligibleDebt)}
                </span>
              </div>
              <div className="pt-2.5 border-t border-red-200/70 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-red-900 font-medium truncate max-w-full">
                  {primaryResident?.full_name ? (
                    <>Muhatap Sakin: <strong>{primaryResident.full_name}</strong></>
                  ) : (
                    'Sakin bilgisi kayıtlı'
                  )}
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
                  onClick={handleSendUnitDebtReminderWhatsApp}
                  title="Tüm borç kalemlerini ve portal bağlantısını WhatsApp ile gönder"
                >
                  <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                  WhatsApp ile Borç Bildirimi Gönder
                </Button>
              </div>
            </div>
          )}

          {openEligibleDues.length > 0 ? (
            openEligibleDues.map((due: any) => {
              const paid = Number(due.paid_amount || 0);
              const remaining = due.remaining_amount ?? Math.max(0, Number(due.amount) - paid);
              const isDueLate = due.due_date && isOverdue(due.due_date);

              return (
                <Card key={due.id} className="p-3.5 sm:p-4 hover:border-gray-300 transition-colors">
                  {/* Üst Satır: Borç Başlığı, Rozetler ve Tutar */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm sm:text-base font-bold text-gray-900 leading-snug">
                          {due.description}
                        </h4>
                        <Badge
                          variant={
                            due.status === 'partially_paid'
                              ? 'warning'
                              : isDueLate
                              ? 'danger'
                              : 'neutral'
                          }
                        >
                          {due.status === 'partially_paid'
                            ? 'Kısmi'
                            : isDueLate
                            ? 'Gecikmiş'
                            : 'Ödenmemiş'}
                        </Badge>
                        {due.due_type === 'monthly' ? (
                          <span className="text-[10px] text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded font-medium">
                            {due.period ? formatPeriod(due.period) : 'Aylık Aidat'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                            Gider Payı / Ek Borç
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1.5">
                        <span>Vade: <strong className="text-gray-700">{due.due_date ? formatShortDate(due.due_date) : '-'}</strong></span>
                        <span>·</span>
                        <span>Tutar: <strong className="text-gray-700">{formatCurrency(due.amount)}</strong></span>
                        {paid > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-700 font-medium">Ödenen: {formatCurrency(paid)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Sağ Üst: Kalan Tutar Kutusu */}
                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-gray-500 block leading-tight">Kalan Borç</span>
                      <span className="text-sm sm:text-base font-black text-rose-700 block mt-0.5">
                        {formatCurrency(remaining)}
                      </span>
                    </div>
                  </div>

                  {/* Alt Satır: İşlem Butonları (Tamamen ayrı satırda, metinleri asla sıkıştırmaz) */}
                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-end gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-3 text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-semibold"
                      onClick={() => handleSendSingleDueReminderWhatsApp(due)}
                      title="Bu borç için WhatsApp hatırlatması gönder"
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      Hatırlat
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs px-3 text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 font-semibold"
                      onClick={() => handleOpenQuickPay(due)}
                    >
                      <CreditCard className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      Ödeme Kaydet
                    </Button>
                  </div>
                </Card>
              );
            })
          ) : (
            <EmptyState
              title="Aktif borç kaydı yok"
              description="Bu daireye ait ödenmemiş herhangi bir borç bulunmuyor. Yapılan ödemeleri 'Ödemeler' sekmesinden görüntüleyebilirsiniz."
            />
          )}
        </div>
      )}

      {/* Ödemeler Tab (Ödenmiş aidatlar ve yapılan tahsilatlar burada listelenir) */}
      {activeTab === 'odemeler' && (
        <div className="space-y-3">
          {totalPaidAmount > 0 && (
            <div className="flex items-center justify-between p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-xl">
              <div>
                <span className="font-bold text-emerald-950 block text-sm sm:text-base">Toplam Yapılan Ödeme</span>
                <span className="text-xs text-emerald-700">
                  Bu daireye ait kaydedilmiş tüm onaylı tahsilatlar
                </span>
              </div>
              <span className="text-base sm:text-lg font-extrabold text-emerald-700">
                {formatCurrency(totalPaidAmount)}
              </span>
            </div>
          )}

          {payments && payments.length > 0 ? (
            payments.map((payment: any) => {
              const dueInfo = payment.dues
                ? `${payment.dues.description}${payment.dues.period ? ` (${formatPeriod(payment.dues.period)})` : ''}`
                : null;

              const methodLabel =
                payment.payment_method === 'bank_transfer'
                  ? 'Havale / EFT'
                  : payment.payment_method === 'cash'
                  ? 'Nakit'
                  : 'Diğer';

              return (
                <Card key={payment.id} className="p-3.5 sm:p-4 hover:border-gray-300 transition-colors">
                  {/* Üst Satır: Ödeme Bilgileri ve Tutar */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-bold text-gray-900 leading-snug">
                          {dueInfo || payment.description || 'Tahsilat / Ödeme'}
                        </span>
                        <Badge variant={payment.status === 'active' ? 'success' : 'danger'} className="text-[11px]">
                          {payment.status === 'active' ? 'Ödendi' : 'İptal'}
                        </Badge>
                        <span className="text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded font-medium">
                          {methodLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1.5">
                        <span>Tarih: <strong className="text-gray-700">{formatShortDate(payment.payment_date)}</strong></span>
                        {payment.receipt_no && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-gray-600">Makbuz: #{payment.receipt_no}</span>
                          </>
                        )}
                        {dueInfo && payment.description && payment.description !== dueInfo && (
                          <>
                            <span>·</span>
                            <span className="text-gray-500 italic">{payment.description}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Sağ Üst: Tahsil Edilen Tutar */}
                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-gray-500 block leading-tight">Tahsil Edilen</span>
                      <span className="text-sm sm:text-base font-black text-emerald-700 block mt-0.5">
                        + {formatCurrency(payment.amount)}
                      </span>
                    </div>
                  </div>

                  {/* Alt Satır: Makbuz ve WhatsApp Butonları (Ayrı satır, ferah yerleşim) */}
                  {payment.status === 'active' && (
                    <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-end gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-3 text-gray-700 border-gray-300 hover:bg-gray-50 font-medium"
                        onClick={() => handleDownloadReceipt(payment)}
                        title="Ödeme makbuzu / dekont PDF belgesi indir"
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                        Makbuz PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs px-3 text-emerald-700 border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/60 font-semibold"
                        onClick={() => handleShareReceiptWhatsApp(payment)}
                        title="Tahsilat makbuzunu WhatsApp üzerinden sakine ilet"
                      >
                        <MessageCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                        WhatsApp ile Paylaş
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })
          ) : (
            <EmptyState
              icon={<Wallet className="w-10 h-10 text-gray-300" />}
              title="Ödeme kaydı yok"
              description="Bu daireye ait henüz kaydedilmiş bir ödeme bulunmuyor."
            />
          )}
        </div>
      )}

      {/* Add Resident Modal */}
      <Modal isOpen={showAddResident} onClose={() => setShowAddResident(false)} title="Sakin Ekle">
        <div className="space-y-4">
          <Input
            label="Ad Soyad *"
            value={residentForm.full_name}
            onChange={(e) => setResidentForm({ ...residentForm, full_name: e.target.value })}
          />
          <PhoneInput
            label="Telefon"
            value={residentForm.phone}
            onChange={(e) => setResidentForm({ ...residentForm, phone: e.target.value })}
          />
          <Select
            label="Rol"
            value={residentForm.role}
            onChange={(e) => setResidentForm({ ...residentForm, role: e.target.value as 'owner' | 'tenant' })}
            options={[
              { value: 'tenant', label: 'Kiracı' },
              { value: 'owner', label: 'Ev Sahibi' },
            ]}
          />
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="outline" onClick={() => setShowAddResident(false)}>İptal</Button>
            <Button onClick={handleAddResident} loading={addResident.isPending}>Ekle</Button>
          </div>
        </div>
      </Modal>

      {/* Direct Invite Modal */}
      <Modal isOpen={showDirectInvite} onClose={() => setShowDirectInvite(false)} title="Davet Linki Oluştur">
        <div className="space-y-4">
          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 space-y-1">
            <p className="font-semibold">ℹ️ Davet Bağlantısı Nasıl Çalışır?</p>
            <p>
              Davet bağlantısı oluşturmak sakini hemen eklemez. Sakin bu bağlantıyla kaydolup daireye katıldığında, <strong>otomatik olarak</strong> daire sakini olarak eklenecektir.
            </p>
          </div>
          <Input
            label="Ad Soyad (İsteğe Bağlı)"
            value={inviteForm.invited_name}
            onChange={(e) => setInviteForm({ ...inviteForm, invited_name: e.target.value })}
            placeholder="Sakinin adı soyadı"
          />
          <PhoneInput
            label="Telefon (İsteğe Bağlı)"
            value={inviteForm.invited_phone}
            onChange={(e) => setInviteForm({ ...inviteForm, invited_phone: e.target.value })}
          />
          <Select
            label="Rol"
            value={inviteForm.resident_role}
            onChange={(e) => setInviteForm({ ...inviteForm, resident_role: e.target.value as 'owner' | 'tenant' })}
            options={[
              { value: 'tenant', label: 'Kiracı' },
              { value: 'owner', label: 'Ev Sahibi' },
            ]}
          />
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="outline" onClick={() => setShowDirectInvite(false)}>İptal</Button>
            <Button onClick={handleDirectInvite} loading={createInvitation.isPending} disabled={createInvitation.isPending}>
              <Send className="w-4 h-4 mr-1" /> Davet Oluştur
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invite Link Modal */}
      <Modal
        isOpen={!!showInviteLink}
        onClose={() => {
          setShowInviteLink(null);
          setInviteTargetPhone(null);
          setInviteTargetName(null);
        }}
        title="Davet Bağlantısı"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Aşağıdaki bağlantıyı sakinle paylaşın. Bağlantı 7 gün geçerlidir ve yalnızca bir kez kullanılabilir.
          </p>
          {inviteTargetPhone && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
              <span className="font-semibold flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-700" />
                {inviteTargetName ? `${inviteTargetName} • ` : ''}{formatPhone(inviteTargetPhone)}
              </span>
              <span className="text-emerald-700 font-bold bg-emerald-100/90 px-2 py-0.5 rounded-full text-[11px]">
                Direkt Mesaj Hazır
              </span>
            </div>
          )}
          <div className="bg-gray-50 p-3 rounded-lg break-all text-sm text-gray-700 font-mono">
            {showInviteLink}
          </div>
          {typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
              <p className="font-semibold">⚠️ Mobil Cihaz / Telefon Testi Uyarısı:</p>
              <p>
                Şu an bilgisayarınızda <code>localhost</code> üzerindesiniz. Bu bağlantıyı telefonunuza gönderirseniz, telefon <code>localhost</code> adresine bağlanamaz. Telefondan test etmek için paneli bilgisayarınızın yerel IP adresiyle (örn: <code>http://192.168.0.205:3000</code>) veya Cloudflare / Ngrok tünel adresiyle açıp davetiye oluşturmalısınız.
              </p>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 [&>*]:w-full sm:[&>*]:w-auto">
            <Button variant="outline" size="sm" onClick={copyInviteLink} title="Yalnızca davet bağlantısını kopyala">
              <Copy className="w-4 h-4 mr-1" /> Linki Kopyala
            </Button>
            <Button variant="outline" size="sm" onClick={copyInviteMessage} title="Tüm davet metnini kopyala">
              <Copy className="w-4 h-4 mr-1" /> Mesajı Kopyala
            </Button>
            <Button variant="primary" size="sm" onClick={() => shareInviteWhatsApp()}>
              <MessageCircle className="w-4 h-4 mr-1" /> {inviteTargetPhone ? 'WhatsApp ile Gönder' : 'WhatsApp ile Paylaş'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Hızlı Ödeme Kaydetme Modalı */}
      <Modal
        isOpen={!!quickPayDue}
        onClose={() => setQuickPayDue(null)}
        title={`Ödeme Kaydet - Daire ${unit.unit_number}`}
      >
        {quickPayDue && (
          <div className="space-y-4">
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-emerald-800 font-medium">Daire:</span>
                <span className="font-bold text-emerald-950">
                  {unit.block ? `${unit.block} Blok ` : ''}Daire {unit.unit_number}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800 font-medium">Borç / Kalem:</span>
                <span className="font-semibold text-emerald-950">{quickPayDue.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-emerald-800 font-medium">Toplam Tutar:</span>
                <span className="font-bold text-emerald-950">{formatCurrency(quickPayDue.amount)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Ödenen Tutar (₺) *"
                type="number"
                placeholder="0.00"
                value={quickPayForm.amount}
                onChange={(e) => setQuickPayForm({ ...quickPayForm, amount: e.target.value })}
              />
              <Input
                label="Ödeme Tarihi *"
                type="date"
                value={quickPayForm.payment_date}
                onChange={(e) => setQuickPayForm({ ...quickPayForm, payment_date: e.target.value })}
              />
            </div>

            <Select
              label="Ödeme Yöntemi *"
              value={quickPayForm.payment_method}
              onChange={(e) => setQuickPayForm({ ...quickPayForm, payment_method: e.target.value })}
              options={[
                { value: 'bank_transfer', label: 'Havale / EFT' },
                { value: 'cash', label: 'Nakit' },
                { value: 'other', label: 'Diğer' },
              ]}
            />

            <Input
              label="Açıklama (İsteğe bağlı)"
              value={quickPayForm.description}
              onChange={(e) => setQuickPayForm({ ...quickPayForm, description: e.target.value })}
              placeholder="Dekont no, not vb."
            />

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2 border-t border-gray-100 [&>*]:w-full sm:[&>*]:w-auto">
              <Button variant="outline" onClick={() => setQuickPayDue(null)}>
                İptal
              </Button>
              <Button
                onClick={handleSaveQuickPay}
                loading={createPayment.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CreditCard className="w-4 h-4 mr-1.5" />
                Ödemeyi Kaydet
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Sakin Düzenle Modalı */}
      <EditResidentModal
        isOpen={!!editingResident}
        onClose={() => setEditingResident(null)}
        resident={editingResident}
        unitInfo={`${unit?.block ? `${unit.block} Blok ` : ''}Daire ${unit?.unit_number || ''}`}
      />

      {/* Sakin Sil Onay Modalı */}
      <DeleteResidentModal
        isOpen={!!deletingResident}
        onClose={() => setDeletingResident(null)}
        resident={deletingResident}
        unitInfo={`${unit?.block ? `${unit.block} Blok ` : ''}Daire ${unit?.unit_number || ''}`}
      />

      {/* Hatırlatma / Makbuz Sakin Seçim Modalı */}
      <SelectResidentModal
        isOpen={residentSelectModal.isOpen}
        onClose={() => setResidentSelectModal((prev) => ({ ...prev, isOpen: false }))}
        title={residentSelectModal.title}
        subtitle={residentSelectModal.subtitle}
        description={residentSelectModal.description}
        actionLabel={residentSelectModal.actionLabel}
        actionType={residentSelectModal.actionType}
        residents={residentSelectModal.residents}
        onSelect={residentSelectModal.onSelect}
      />

      {/* Daire Sil Onay Modalı */}
      <DeleteUnitModal
        isOpen={showDeleteUnitModal}
        onClose={() => setShowDeleteUnitModal(false)}
        unit={unit || null}
        residents={residents}
        totalDebt={totalEligibleDebt}
        onDeleted={() => navigate('/yonetici/daireler')}
      />
    </div>
  );
}
