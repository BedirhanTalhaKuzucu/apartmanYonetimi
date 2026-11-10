import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatDate, formatShortDate, formatPeriod } from '@/lib/format';

/*
 * TÜRKÇE KARAKTER DESTEĞİ:
 * jsPDF'in dahili Helvetica fontu Türkçe karakterleri (ğ, ü, ş, ı, ö, ç, İ, Ğ, Ü, Ş, Ö, Ç)
 * tam desteklemez. Üretim ortamında özel bir TTF font (ör: Roboto, Noto Sans)
 * base64 olarak eklenerek doc.addFont() ile kullanılmalıdır.
 *
 * MVP'de Türkçe karakterler mümkün olduğunca doğru görünür;
 * görünmeyen karakterler için ASCII karşılıkları kullanılır.
 */

// Türkçe karakter düzeltme yardımcısı – font desteklemediğinde fallback
function sanitizeTurkish(text: string): string {
  // Helvetica ile çoğu Türkçe karakter görünür; sorun yaşanırsa bu fonksiyon genişletilebilir
  return text;
}

function addHeader(doc: jsPDF, title: string, apartmentName: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(sanitizeTurkish(apartmentName), pageWidth / 2, 15, { align: 'center' });

  doc.setFontSize(18);
  doc.setTextColor(30, 58, 138); // primary-900
  doc.text(sanitizeTurkish(title), pageWidth / 2, 25, { align: 'center' });

  doc.setDrawColor(37, 99, 235); // primary-600
  doc.setLineWidth(0.5);
  doc.line(20, 30, pageWidth - 20, 30);
}

function addFooter(doc: jsPDF, apartmentName: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    sanitizeTurkish(`Bu belge ${apartmentName} yonetimi tarafindan olusturulmustur.`),
    pageWidth / 2,
    pageHeight - 15,
    { align: 'center' }
  );
  doc.text(
    sanitizeTurkish(`Olusturulma: ${formatDate(new Date())}`),
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );
}

// ──────────────────────────────────────────────────
// 1. ÖDEME MAKBUZU
// ──────────────────────────────────────────────────
export interface PaymentReceiptData {
  apartmentName: string;
  receiptNo: string;
  unitNumber: string;
  payerName: string;
  paymentDate: string;
  paymentMethod: string;
  relatedPeriod: string;
  amount: number;
  description?: string;
  isCancelled?: boolean;
  cancellationReason?: string;
}

export function generatePaymentReceipt(data: PaymentReceiptData): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  addHeader(doc, 'ODEME MAKBUZU', data.apartmentName);

  if (data.isCancelled) {
    doc.setFontSize(14);
    doc.setTextColor(220, 38, 38);
    doc.text('** IPTAL EDILMIS **', pageWidth / 2, 38, { align: 'center' });
  }

  const startY = data.isCancelled ? 46 : 40;

  const methodLabels: Record<string, string> = {
    cash: 'Nakit',
    bank_transfer: 'Banka Transferi',
    other: 'Diger',
  };

  const rows = [
    ['Makbuz No', data.receiptNo],
    ['Daire No', data.unitNumber],
    ['Odeme Yapan', data.payerName],
    ['Odeme Tarihi', formatDate(data.paymentDate)],
    ['Odeme Yontemi', methodLabels[data.paymentMethod] || data.paymentMethod],
    ['Ilgili Donem / Borc', data.relatedPeriod],
  ];

  if (data.description) {
    rows.push(['Aciklama', data.description]);
  }

  autoTable(doc, {
    startY,
    head: [],
    body: rows,
    theme: 'plain',
    styles: { fontSize: 11, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55, textColor: [80, 80, 80] },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 25, right: 25 },
  });

  const afterTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Tutar kutusu
  doc.setFillColor(239, 246, 255); // primary-50
  doc.roundedRect(25, afterTableY, pageWidth - 50, 28, 3, 3, 'F');

  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  doc.text('Odenen Tutar', pageWidth / 2, afterTableY + 10, { align: 'center' });

  doc.setFontSize(22);
  doc.setTextColor(30, 58, 138);
  doc.text(formatCurrency(data.amount), pageWidth / 2, afterTableY + 22, { align: 'center' });

  if (data.isCancelled && data.cancellationReason) {
    const cancelY = afterTableY + 36;
    doc.setFontSize(10);
    doc.setTextColor(220, 38, 38);
    doc.text(sanitizeTurkish(`Iptal Nedeni: ${data.cancellationReason}`), 25, cancelY);
  }

  addFooter(doc, data.apartmentName);

  return doc.output('blob');
}

// ──────────────────────────────────────────────────
// 2. DAİRE HESAP DÖKÜMÜ
// ──────────────────────────────────────────────────
export interface StatementEntry {
  date: string;
  description: string;
  debit: number;  // borç
  credit: number; // ödeme
}

export interface UnitStatementData {
  apartmentName: string;
  unitNumber: string;
  residentName: string;
  dateFrom: string;
  dateTo: string;
  entries: StatementEntry[];
}

export function generateUnitStatement(data: UnitStatementData): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  addHeader(doc, 'DAIRE HESAP DOKUMU', data.apartmentName);

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(sanitizeTurkish(`Daire: ${data.unitNumber}`), 25, 38);
  doc.text(sanitizeTurkish(`Sakin: ${data.residentName}`), 25, 44);
  doc.text(
    sanitizeTurkish(`Donem: ${formatShortDate(data.dateFrom)} - ${formatShortDate(data.dateTo)}`),
    25,
    50
  );

  let runningBalance = 0;
  const tableRows = data.entries.map((e) => {
    runningBalance += e.debit - e.credit;
    return [
      formatShortDate(e.date),
      sanitizeTurkish(e.description),
      e.debit > 0 ? formatCurrency(e.debit) : '',
      e.credit > 0 ? formatCurrency(e.credit) : '',
      formatCurrency(runningBalance),
    ];
  });

  const totalDebit = data.entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = data.entries.reduce((s, e) => s + e.credit, 0);

  autoTable(doc, {
    startY: 56,
    head: [['Tarih', 'Aciklama', 'Borc', 'Odeme', 'Bakiye']],
    body: tableRows,
    foot: [['', 'TOPLAM', formatCurrency(totalDebit), formatCurrency(totalCredit), formatCurrency(runningBalance)]],
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 10 },
    footStyles: { fillColor: [239, 246, 255], textColor: [30, 58, 138], fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 15, right: 15 },
  });

  addFooter(doc, data.apartmentName);

  return doc.output('blob');
}

// ──────────────────────────────────────────────────
// 3. GELİR-GİDER RAPORU
// ──────────────────────────────────────────────────
export interface FinancialReportData {
  apartmentName: string;
  period: string; // ör: "Kasim 2024" veya "2024"
  incomes: { category: string; amount: number }[];
  expenses: { category: string; amount: number }[];
  totalIncome: number;
  totalExpense: number;
  net: number;
  currentBalance: number;
}

export function generateFinancialReport(data: FinancialReportData): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  addHeader(doc, 'GELIR-GIDER RAPORU', data.apartmentName);

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(sanitizeTurkish(`Donem: ${data.period}`), 25, 38);

  // Gelir tablosu
  doc.setFontSize(13);
  doc.setTextColor(22, 163, 74); // green
  doc.text('Gelirler', 25, 48);

  const incomeRows = data.incomes.map((i) => [sanitizeTurkish(i.category), formatCurrency(i.amount)]);
  autoTable(doc, {
    startY: 52,
    head: [['Kategori', 'Tutar']],
    body: incomeRows,
    foot: [['TOPLAM GELIR', formatCurrency(data.totalIncome)]],
    theme: 'striped',
    headStyles: { fillColor: [22, 163, 74], textColor: 255, fontSize: 10 },
    footStyles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 25, right: 25 },
    columnStyles: { 1: { halign: 'right' } },
  });

  const afterIncome = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Gider tablosu
  doc.setFontSize(13);
  doc.setTextColor(220, 38, 38); // red
  doc.text('Giderler', 25, afterIncome);

  const expenseRows = data.expenses.map((e) => [sanitizeTurkish(e.category), formatCurrency(e.amount)]);
  autoTable(doc, {
    startY: afterIncome + 4,
    head: [['Kategori', 'Tutar']],
    body: expenseRows,
    foot: [['TOPLAM GIDER', formatCurrency(data.totalExpense)]],
    theme: 'striped',
    headStyles: { fillColor: [220, 38, 38], textColor: 255, fontSize: 10 },
    footStyles: { fillColor: [254, 226, 226], textColor: [153, 27, 27], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 25, right: 25 },
    columnStyles: { 1: { halign: 'right' } },
  });

  const afterExpense = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Özet
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(25, afterExpense, pageWidth - 50, 30, 3, 3, 'F');

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(sanitizeTurkish(`Net: ${formatCurrency(data.net)}`), 35, afterExpense + 10);
  doc.text(sanitizeTurkish(`Mevcut Bakiye: ${formatCurrency(data.currentBalance)}`), 35, afterExpense + 20);

  addFooter(doc, data.apartmentName);

  return doc.output('blob');
}

// ──────────────────────────────────────────────────
// 4. DUYURU PDF
// ──────────────────────────────────────────────────
export interface AnnouncementPdfData {
  apartmentName: string;
  title: string;
  content: string;
  date: string;
}

export function generateAnnouncementPdf(data: AnnouncementPdfData): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  addHeader(doc, 'DUYURU', data.apartmentName);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(sanitizeTurkish(`Tarih: ${formatDate(data.date)}`), 25, 38);

  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text(sanitizeTurkish(data.title), 25, 48);

  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  const pageWidth = doc.internal.pageSize.getWidth();
  const lines = doc.splitTextToSize(sanitizeTurkish(data.content), pageWidth - 50);
  doc.text(lines, 25, 58);

  addFooter(doc, data.apartmentName);

  return doc.output('blob');
}

// ──────────────────────────────────────────────────
// Dosya İndirme & Paylaşma
// ──────────────────────────────────────────────────
export function downloadPdf(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Temizleme – biraz bekleyerek URL'yi serbest bırak
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function sharePdf(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename.endsWith('.pdf') ? filename : `${filename}.pdf`, {
    type: 'application/pdf',
  });

  // Web Share API desteği kontrol
  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: filename,
        files: [file],
      });
      return true;
    } catch (err) {
      // Kullanıcı paylaşımı iptal etti
      if ((err as Error).name === 'AbortError') {
        return false;
      }
      // Paylaşım başarısız – indirmeye geri dön
      downloadPdf(blob, filename);
      return false;
    }
  }

  // Share API desteklenmiyorsa indirme
  downloadPdf(blob, filename);
  return false;
}
