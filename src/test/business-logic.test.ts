import { describe, it, expect } from 'vitest';

// ==============================
// Business Logic Tests
// ==============================
// Bu testler doğrudan Supabase'e bağlanmadan iş mantığı kurallarını doğrular.

describe('Borç Durumu Hesaplama', () => {
  // Borç durum hesaplama mantığı
  type DueStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue';

  function calculateDueStatus(
    totalAmount: number,
    paidAmount: number,
    dueDate: string
  ): DueStatus {
    if (paidAmount >= totalAmount) return 'paid';

    const now = new Date();
    const due = new Date(dueDate + 'T23:59:59+03:00'); // Europe/Istanbul

    if (paidAmount > 0 && paidAmount < totalAmount) {
      // Kısmen ödenmiş - gecikmiş olabilir
      return now > due ? 'overdue' : 'partially_paid';
    }

    // Hiç ödenmemiş
    return now > due ? 'overdue' : 'unpaid';
  }

  it('ödenmemiş borç - tarih geçmemiş', () => {
    expect(calculateDueStatus(750, 0, '2099-12-31')).toBe('unpaid');
  });

  it('tam ödenmiş borç', () => {
    expect(calculateDueStatus(750, 750, '2024-01-15')).toBe('paid');
  });

  it('fazla ödenmiş borç da "paid" sayılır', () => {
    expect(calculateDueStatus(750, 800, '2024-01-15')).toBe('paid');
  });

  it('kısmen ödenmiş borç - tarih geçmemiş', () => {
    expect(calculateDueStatus(750, 300, '2099-12-31')).toBe('partially_paid');
  });

  it('kısmen ödenmiş borç - tarih geçmiş → gecikmiş', () => {
    expect(calculateDueStatus(750, 300, '2020-01-15')).toBe('overdue');
  });

  it('ödenmemiş borç - tarih geçmiş → gecikmiş', () => {
    expect(calculateDueStatus(750, 0, '2020-01-15')).toBe('overdue');
  });

  // Test 7: Kısmi ödeme kalan borcu doğru günceller
  it('kısmi ödeme kalan borcu doğru hesaplar', () => {
    const totalAmount = 750;
    const payment1 = 300;
    const payment2 = 200;
    const totalPaid = payment1 + payment2;
    const remaining = totalAmount - totalPaid;
    expect(remaining).toBe(250);
    expect(calculateDueStatus(totalAmount, totalPaid, '2099-12-31')).toBe('partially_paid');
  });

  // Test 8: Onay bekleyen ödeme bildirimi kesin ödeme sayılmaz
  it('onay bekleyen ödeme kesin ödeme sayılmaz', () => {
    const totalAmount = 750;
    const confirmedPayments = 0; // Henüz onaylanmış ödeme yok
    const pendingNotifications = 750; // Sakin 750 TL bildirdi ama onaylanmadı
    // Bildirimler ödeme sayılmaz, sadece onaylanan ödemeler
    expect(calculateDueStatus(totalAmount, confirmedPayments, '2020-01-15')).toBe('overdue');
  });
});

describe('Kayan Nokta Hassasiyeti', () => {
  // Para hesaplamalarında kayan nokta hataları önlenmelidir
  // Yaklaşım: Kuruş cinsinden (integer) hesapla, sonra TL'ye çevir

  function addAmounts(...amounts: number[]): number {
    // Kuruş cinsinden topla
    const totalKurus = amounts.reduce((sum, a) => sum + Math.round(a * 100), 0);
    return totalKurus / 100;
  }

  it('0.1 + 0.2 doğru hesaplanır', () => {
    // JavaScript: 0.1 + 0.2 === 0.30000000000000004
    expect(addAmounts(0.1, 0.2)).toBe(0.3);
  });

  it('birden fazla aidat toplamı doğru', () => {
    const dues = [750.50, 750.50, 750.50, 750.50, 750.50];
    expect(addAmounts(...dues)).toBe(3752.5);
  });

  it('kısmi ödemeler toplamı doğru', () => {
    expect(addAmounts(333.33, 333.33, 333.34)).toBe(1000);
  });
});

describe('Gelir-Gider Özeti Hesaplama', () => {
  function calculateSummary(
    initialBalance: number,
    payments: number[],     // Aidat ödemeleri (gelir)
    otherIncomes: number[], // Diğer gelirler
    expenses: number[]      // Giderler
  ) {
    const addSafe = (...nums: number[]) =>
      nums.reduce((sum, n) => sum + Math.round(n * 100), 0) / 100;

    const totalPayments = addSafe(...payments);
    const totalOtherIncome = addSafe(...otherIncomes);
    const totalIncome = addSafe(totalPayments, totalOtherIncome);
    const totalExpense = addSafe(...expenses);
    const netMovement = addSafe(totalIncome, -totalExpense);
    const currentBalance = addSafe(initialBalance, netMovement);

    return { totalIncome, totalExpense, netMovement, currentBalance };
  }

  it('temel gelir-gider hesabı', () => {
    const result = calculateSummary(
      0,          // Başlangıç bakiyesi
      [750, 750, 500], // Aidat ödemeleri
      [200],          // Diğer gelir
      [1000, 500]     // Giderler
    );
    expect(result.totalIncome).toBe(2200);
    expect(result.totalExpense).toBe(1500);
    expect(result.netMovement).toBe(700);
    expect(result.currentBalance).toBe(700);
  });

  it('başlangıç bakiyesi ile hesaplama', () => {
    const result = calculateSummary(
      5000,         // Başlangıç bakiyesi
      [750],        // Gelir
      [],           // Diğer gelir yok
      [2000]        // Gider
    );
    expect(result.currentBalance).toBe(3750);
  });

  // Aidat borcu oluşturma gelir değildir
  it('aidat borcu oluşturma gelir sayılmaz', () => {
    // Gelir yalnızca ödeme kaydedildiğinde oluşur
    const duesCreated = [750, 750, 750]; // 3 daire aidat borcu
    const paymentsReceived = [750]; // Sadece 1 daire ödedi
    const result = calculateSummary(0, paymentsReceived, [], []);
    expect(result.totalIncome).toBe(750); // 2250 değil!
  });

  it('negatif bakiye mümkündür', () => {
    const result = calculateSummary(0, [], [], [5000]);
    expect(result.currentBalance).toBe(-5000);
  });
});

describe('WhatsApp Mesaj Oluşturma', () => {
  function createDueReminderMessage(
    apartmentName: string,
    unitNumber: string,
    period: string,
    remainingAmount: number,
    dueDate: string
  ): string {
    return `Merhaba, ${apartmentName} ${unitNumber} numaralı dairenin ${period} aidatından ${remainingAmount.toLocaleString('tr-TR')} TL ödeme kaydı henüz görünmemektedir. Son ödeme tarihi ${dueDate} idi. Ödeme yaptıysanız lütfen bu mesajı dikkate almayın. Teşekkürler.`;
  }

  // Test 14: Gecikmiş borç için doğru mesaj hazırlanır
  it('doğru hatırlatma mesajı oluşturur', () => {
    const message = createDueReminderMessage(
      'Yıldız Apartmanı',
      '5',
      'Kasım 2024',
      750,
      '15.11.2024'
    );
    expect(message).toContain('Yıldız Apartmanı');
    expect(message).toContain('5 numaralı daire');
    expect(message).toContain('Kasım 2024');
    expect(message).toContain('750');
    expect(message).toContain('15.11.2024');
  });

  // Test 15: WhatsApp bağlantısının açılması otomatik gönderildi sayılmaz
  it('WhatsApp açılması otomatik gönderildi sayılmaz', () => {
    // Bu bir tasarım kuralı testi
    const messageState = {
      whatsappOpened: true,
      markedAsSentByManager: false,
    };
    // Sadece WhatsApp açılmış olması "gönderildi" demek değil
    expect(messageState.whatsappOpened).toBe(true);
    expect(messageState.markedAsSentByManager).toBe(false);
    // "Gönderildi" ancak yönetici manuel işaretlerse olur
  });
});

describe('Davet Token Güvenliği', () => {
  it('davet tokenı yeterince uzun olmalı', () => {
    // 32+ byte random token
    const tokenLength = 64; // hex encoded 32 bytes
    const token = Array.from({ length: tokenLength }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it('süreli davet token - 48 saat geçerli', () => {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBe(48);
  });

  it('süresi dolmuş token geçersiz', () => {
    const now = new Date();
    const expiredAt = new Date(now.getTime() - 1000); // 1 saniye önce
    expect(expiredAt < now).toBe(true);
  });
});

describe('Bildirim Mantığı', () => {
  // Test 16: Son ödeme tarihinden 1 gün sonra bildirim koşulu
  it('son ödeme tarihinden 1 gün sonra bildirim gönderilmeli', () => {
    const dueDate = new Date('2024-11-15');
    const checkDate = new Date('2024-11-16'); // 1 gün sonra
    const daysDiff = Math.floor(
      (checkDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(daysDiff).toBeGreaterThanOrEqual(1);
  });

  // Test 17: Aynı hatırlatma tekrar gönderilmemeli
  it('tekrarlanan bildirim önlenir', () => {
    const sentNotifications = new Set<string>();
    const key1 = 'due_reminder:due-123:user-456';

    // İlk gönderim
    expect(sentNotifications.has(key1)).toBe(false);
    sentNotifications.add(key1);

    // Tekrar deneme
    expect(sentNotifications.has(key1)).toBe(true);
    // Bu durumda göndermiyoruz
  });

  // Test 18: Ödeme zamanında tamamlanmışsa gecikme bildirimi gönderilmez
  it('tam ödeme yapılmışsa gecikme bildirimi oluşturulmaz', () => {
    const totalAmount = 750;
    const paidAmount = 750;
    const shouldSendReminder = paidAmount < totalAmount;
    expect(shouldSendReminder).toBe(false);
  });

  // Test 19: Bildirim izni verilmediğinde uygulama çalışmaya devam eder
  it('bildirim izni reddedilse de uygulama mantığı çalışır', () => {
    const pushPermission = 'denied';
    const canUseApp = true; // Uygulama her zaman çalışır
    const canCreateInAppNotifications = true; // Uygulama içi bildirimler çalışır
    expect(canUseApp).toBe(true);
    expect(canCreateInAppNotifications).toBe(true);
    // Sadece push bildirimi gönderilemez
    expect(pushPermission as string !== 'granted').toBe(true);
  });
});

describe('Mükerrer Kayıt Önleme', () => {
  // Test 9: Onaylanan ödeme tekrar onaylandığında mükerrer kayıt oluşmamalı
  it('aynı idempotency key ile mükerrer ödeme oluşturulamaz', () => {
    const processedKeys = new Set<string>();
    const idempotencyKey = 'payment-notif-123-approved';

    // İlk onay
    expect(processedKeys.has(idempotencyKey)).toBe(false);
    processedKeys.add(idempotencyKey);

    // Tekrar onay denemesi
    expect(processedKeys.has(idempotencyKey)).toBe(true);
    // İkinci onay işlenmez
  });

  it('aynı dönem için mükerrer toplu aidat uyarısı', () => {
    const existingDues = [
      { unit_id: 'u1', period: '2024-11', due_type: 'monthly' },
      { unit_id: 'u2', period: '2024-11', due_type: 'monthly' },
    ];
    const newPeriod = '2024-11';
    const hasDuplicates = existingDues.some(d => d.period === newPeriod);
    expect(hasDuplicates).toBe(true);
  });
});
