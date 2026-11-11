import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Download, Share2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuthStore } from '@/store/authStore';
import { usePayments } from '@/hooks/usePayments';
import { useUnits } from '@/hooks/useUnits';
import { generatePaymentReceipt, generateUnitStatement, generateFinancialReport, generateAnnouncementPdf, downloadPdf, sharePdf } from '@/lib/pdf';
import { useAnnouncements } from '@/hooks/useAnnouncements';
import toast from 'react-hot-toast';
import type { PaymentReceiptData, UnitStatementData, FinancialReportData, AnnouncementPdfData } from '@/lib/pdf';

const MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];
const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();

export default function DocumentsPage() {
  const [searchParams] = useSearchParams();
  const { currentApartment } = useAuthStore();
  const { data: payments } = usePayments(currentApartment?.id);
  const { data: units } = useUnits(currentApartment?.id);
  const { data: announcements } = useAnnouncements(currentApartment?.id);

  const [receiptPaymentId, setReceiptPaymentId] = useState('');
  const [statementUnitId, setStatementUnitId] = useState('');
  const [statementStartDate, setStatementStartDate] = useState('');
  const [statementEndDate, setStatementEndDate] = useState('');
  const [reportMonth, setReportMonth] = useState(currentMonth);
  const [reportYear, setReportYear] = useState(currentYear);
  const [announcementId, setAnnouncementId] = useState('');
  const [generating, setGenerating] = useState('');

  useEffect(() => {
    const type = searchParams.get('type');
    if (type) {
      const el = document.getElementById(`doc-card-${type}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-primary-500', 'shadow-md');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-primary-500', 'shadow-md');
        }, 3000);
      }
    }
  }, [searchParams]);

  const activePayments = payments?.filter((p: any) => p.status === 'active') ?? [];

  const handleGenerateReceipt = async () => {
    if (!receiptPaymentId) {
      toast.error('Bir ödeme seçin');
      return;
    }
    const payment = activePayments.find((p: any) => p.id === receiptPaymentId);
    if (!payment) return;
    setGenerating('receipt');
    try {
      const blob = generatePaymentReceipt({
        apartmentName: currentApartment!.name,
        unitNumber: payment.units?.unit_number ?? '',
        payerName: payment.description ?? '',
        paymentDate: payment.payment_date,
        paymentMethod: payment.payment_method ?? 'other',
        relatedPeriod: payment.dues?.period ?? '',
        amount: payment.amount,
        receiptNo: payment.receipt_no ?? '',
        isCancelled: payment.status === 'cancelled',
      });
      downloadPdf(blob, `makbuz-${payment.receipt_no ?? payment.id}.pdf`);
      toast.success('Makbuz oluşturuldu');
    } catch (err: any) {
      toast.error('PDF oluşturulamadı');
    }
    setGenerating('');
  };

  const handleGenerateStatement = async () => {
    if (!statementUnitId) {
      toast.error('Bir daire seçin');
      return;
    }
    setGenerating('statement');
    try {
      const unit = units?.find((u: any) => u.id === statementUnitId);
      const blob = generateUnitStatement({
        apartmentName: currentApartment!.name,
        unitNumber: unit?.unit_number ?? '',
        residentName: '',
        dateFrom: statementStartDate || new Date().toISOString(),
        dateTo: statementEndDate || new Date().toISOString(),
        entries: [],
      });
      downloadPdf(blob, `hesap-dokumu-daire-${unit?.unit_number ?? ''}.pdf`);
      toast.success('Hesap dökümü oluşturuldu');
    } catch (err: any) {
      toast.error('PDF oluşturulamadı');
    }
    setGenerating('');
  };

  const handleGenerateReport = async () => {
    const period = `${reportYear}-${String(reportMonth + 1).padStart(2, '0')}`;
    setGenerating('report');
    try {
      const blob = generateFinancialReport({
        apartmentName: currentApartment!.name,
        period,
        incomes: [],
        expenses: [],
        totalIncome: 0,
        totalExpense: 0,
        net: 0,
        currentBalance: 0,
      });
      downloadPdf(blob, `gelir-gider-raporu-${period}.pdf`);
      toast.success('Rapor oluşturuldu');
    } catch (err: any) {
      toast.error('PDF oluşturulamadı');
    }
    setGenerating('');
  };

  const handleGenerateAnnouncementPdf = async () => {
    if (!announcementId) {
      toast.error('Bir duyuru seçin');
      return;
    }
    const announcement = announcements?.find((a: any) => a.id === announcementId);
    if (!announcement) return;
    setGenerating('announcement');
    try {
      const blob = generateAnnouncementPdf({
        apartmentName: currentApartment!.name,
        title: announcement.title,
        content: announcement.content,
        date: announcement.created_at,
      });
      downloadPdf(blob, `duyuru-${announcement.id}.pdf`);
      toast.success('Duyuru PDF oluşturuldu');
    } catch (err: any) {
      toast.error('PDF oluşturulamadı');
    }
    setGenerating('');
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <h1 className="text-xl font-bold">Belgeler</h1>

      {/* Payment Receipt */}
      <Card id="doc-card-receipt" className="p-4 space-y-3 transition-all duration-300">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary-600" />
          <h2 className="font-semibold">Ödeme Makbuzu</h2>
        </div>
        <p className="text-xs text-gray-500">Bir ödeme seçerek makbuz oluşturun.</p>
        <Select
          value={receiptPaymentId}
          onChange={(e) => setReceiptPaymentId(e.target.value)}
          options={[
            { value: '', label: 'Ödeme seçin...' },
            ...activePayments.map((p: any) => ({
              value: p.id,
              label: `Daire ${p.unit?.unit_number} - ${p.amount} ₺ - ${p.receipt_no ? '#' + p.receipt_no : p.payment_date}`,
            })),
          ]}
        />
        <Button
          size="sm"
          onClick={handleGenerateReceipt}
          loading={generating === 'receipt'}
          disabled={!receiptPaymentId}
        >
          <Download className="w-4 h-4 mr-1" /> Makbuz Oluştur
        </Button>
      </Card>

      {/* Unit Statement */}
      <Card id="doc-card-statement" className="p-4 space-y-3 transition-all duration-300">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-green-600" />
          <h2 className="font-semibold">Daire Hesap Dökümü</h2>
        </div>
        <p className="text-xs text-gray-500">Bir dairenin borç ve ödeme geçmişini PDF olarak oluşturun.</p>
        <Select
          value={statementUnitId}
          onChange={(e) => setStatementUnitId(e.target.value)}
          options={[
            { value: '', label: 'Daire seçin...' },
            ...(units?.map((u: any) => ({
              value: u.id,
              label: `Daire ${u.unit_number}${u.block ? ` (${u.block} Blok)` : ''}`,
            })) ?? []),
          ]}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Başlangıç"
            type="date"
            value={statementStartDate}
            onChange={(e) => setStatementStartDate(e.target.value)}
          />
          <Input
            label="Bitiş"
            type="date"
            value={statementEndDate}
            onChange={(e) => setStatementEndDate(e.target.value)}
          />
        </div>
        <Button
          size="sm"
          onClick={handleGenerateStatement}
          loading={generating === 'statement'}
          disabled={!statementUnitId}
        >
          <Download className="w-4 h-4 mr-1" /> Döküm Oluştur
        </Button>
      </Card>

      {/* Income/Expense Report */}
      <Card id="doc-card-report" className="p-4 space-y-3 transition-all duration-300">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-orange-600" />
          <h2 className="font-semibold">Gelir-Gider Raporu</h2>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Ay"
            value={reportMonth.toString()}
            onChange={(e) => setReportMonth(parseInt(e.target.value))}
            options={MONTHS.map((m, i) => ({ value: i.toString(), label: m }))}
          />
          <Select
            label="Yıl"
            value={reportYear.toString()}
            onChange={(e) => setReportYear(parseInt(e.target.value))}
            options={[currentYear - 1, currentYear, currentYear + 1].map((y) => ({
              value: y.toString(),
              label: y.toString(),
            }))}
          />
        </div>
        <Button size="sm" onClick={handleGenerateReport} loading={generating === 'report'}>
          <Download className="w-4 h-4 mr-1" /> Rapor Oluştur
        </Button>
      </Card>

      {/* Announcement PDF */}
      <Card id="doc-card-announcement" className="p-4 space-y-3 transition-all duration-300">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-600" />
          <h2 className="font-semibold">Duyuru PDF</h2>
        </div>
        <Select
          value={announcementId}
          onChange={(e) => setAnnouncementId(e.target.value)}
          options={[
            { value: '', label: 'Duyuru seçin...' },
            ...(announcements?.map((a: any) => ({
              value: a.id,
              label: a.title,
            })) ?? []),
          ]}
        />
        <Button
          size="sm"
          onClick={handleGenerateAnnouncementPdf}
          loading={generating === 'announcement'}
          disabled={!announcementId}
        >
          <Download className="w-4 h-4 mr-1" /> PDF Oluştur
        </Button>
      </Card>
    </div>
  );
}
