import { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Plus, Upload, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatShortDate } from '@/lib/format';
import { useAuthStore } from '@/store/authStore';
import { useFinancialSummary, useIncomes, useExpenses, useCreateIncome, useCreateExpense } from '@/hooks/useFinancials';
import toast from 'react-hot-toast';

const EXPENSE_CATEGORIES = [
  'Bakım',
  'Temizlik',
  'Elektrik',
  'Su',
  'Doğalgaz',
  'Asansör',
  'Sigorta',
  'Güvenlik',
  'Bahçe',
  'Boya/Tadilat',
  'Diğer',
];

const INCOME_CATEGORIES = [
  'Aidat Geliri',
  'Kira Geliri',
  'Faiz Geliri',
  'Diğer',
];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth();

export default function FinancialsPage() {
  const { currentApartment } = useAuthStore();
  const [activeTab, setActiveTab] = useState('ozet');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);

  const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
  const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-31`;
  const periodFilter = { startDate, endDate };
  const { data: summary, isLoading: summaryLoading } = useFinancialSummary(currentApartment?.id, periodFilter);
  const { data: incomes, isLoading: incomesLoading } = useIncomes(currentApartment?.id, periodFilter);
  const { data: expenses, isLoading: expensesLoading } = useExpenses(currentApartment?.id, periodFilter);
  const createIncome = useCreateIncome();
  const createExpense = useCreateExpense();

  const [incomeForm, setIncomeForm] = useState({
    amount: '',
    income_date: new Date().toISOString().split('T')[0],
    category: 'Diğer',
    description: '',
  });

  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    category: 'Bakım',
    description: '',
  });

  const handleAddIncome = async () => {
    if (!incomeForm.amount) {
      toast.error('Tutar zorunludur');
      return;
    }
    try {
      await createIncome.mutateAsync({
        apartment_id: currentApartment!.id,
        amount: parseFloat(incomeForm.amount),
        income_date: incomeForm.income_date,
        category: incomeForm.category,
        description: incomeForm.description,
      });
      toast.success('Gelir kaydedildi');
      setShowAddIncome(false);
      setIncomeForm({ amount: '', income_date: new Date().toISOString().split('T')[0], category: 'Diğer', description: '' });
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const handleAddExpense = async () => {
    if (!expenseForm.amount || !expenseForm.description) {
      toast.error('Tutar ve açıklama zorunludur');
      return;
    }
    try {
      await createExpense.mutateAsync({
        apartment_id: currentApartment!.id,
        amount: parseFloat(expenseForm.amount),
        expense_date: expenseForm.expense_date,
        category: expenseForm.category,
        description: expenseForm.description,
      });
      toast.success('Gider kaydedildi');
      setShowAddExpense(false);
      setExpenseForm({ amount: '', expense_date: new Date().toISOString().split('T')[0], category: 'Bakım', description: '' });
    } catch (err: any) {
      toast.error(err.message || 'Bir hata oluştu');
    }
  };

  const MONTHS = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  const tabs = [
    { id: 'ozet', label: 'Özet' },
    { id: 'gelirler', label: 'Gelirler' },
    { id: 'giderler', label: 'Giderler' },
  ];

  return (
    <div className="p-4 space-y-4 pb-24">
      <h1 className="text-xl font-bold">Gelir - Gider</h1>

      {/* Period Selector */}
      <div className="flex gap-2">
        <Select
          value={selectedMonth.toString()}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          options={MONTHS.map((m, i) => ({ value: i.toString(), label: m }))}
        />
        <Select
          value={selectedYear.toString()}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          options={[currentYear - 1, currentYear, currentYear + 1].map((y) => ({
            value: y.toString(),
            label: y.toString(),
          }))}
        />
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Özet Tab */}
      {activeTab === 'ozet' && (
        <div className="space-y-4">
          {summaryLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-gray-500">Toplam Gelir</span>
                  </div>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(summary?.totalIncome ?? 0)}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    <span className="text-xs text-gray-500">Toplam Gider</span>
                  </div>
                  <p className="text-lg font-bold text-red-600">{formatCurrency(summary?.totalExpenses ?? 0)}</p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-gray-500">Net Hareket</span>
                  </div>
                  <p className={`text-lg font-bold ${(summary?.net ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(summary?.net ?? 0)}
                  </p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="w-4 h-4 text-purple-600" />
                    <span className="text-xs text-gray-500">Mevcut Bakiye</span>
                  </div>
                  <p className="text-lg font-bold text-purple-600">{formatCurrency(summary?.currentBalance ?? 0)}</p>
                </Card>
              </div>

              <Card className="p-4">
                <p className="text-xs text-gray-500 mb-2">Bakiye Hesaplama</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Başlangıç Bakiyesi</span>
                    <span>{formatCurrency(summary?.initialBalance ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>+ Toplam Gelirler</span>
                    <span>{formatCurrency(summary?.totalIncome ?? 0)}</span>
                  </div>
                  <div className="flex justify-between text-red-600">
                    <span>- Toplam Giderler</span>
                    <span>{formatCurrency(summary?.totalExpenses ?? 0)}</span>
                  </div>
                  <hr className="my-1" />
                  <div className="flex justify-between font-semibold">
                    <span>Mevcut Bakiye</span>
                    <span>{formatCurrency(summary?.currentBalance ?? 0)}</span>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Gelirler Tab */}
      {activeTab === 'gelirler' && (
        <div className="space-y-3">
          <Button size="sm" onClick={() => setShowAddIncome(true)}>
            <Plus className="w-4 h-4 mr-1" /> Gelir Ekle
          </Button>
          {incomesLoading ? (
            <LoadingSpinner />
          ) : incomes && incomes.length > 0 ? (
            incomes.map((inc: any) => (
              <Card key={inc.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{inc.description || inc.category}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="neutral">{inc.category}</Badge>
                      <span className="text-xs text-gray-500">{formatShortDate(inc.income_date)}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-green-600">{formatCurrency(inc.amount)}</span>
                </div>
              </Card>
            ))
          ) : (
            <EmptyState title="Gelir kaydı yok" description="Bu dönemde gelir kaydı bulunmuyor." />
          )}
        </div>
      )}

      {/* Giderler Tab */}
      {activeTab === 'giderler' && (
        <div className="space-y-3">
          <Button size="sm" onClick={() => setShowAddExpense(true)}>
            <Plus className="w-4 h-4 mr-1" /> Gider Ekle
          </Button>
          {expensesLoading ? (
            <LoadingSpinner />
          ) : expenses && expenses.length > 0 ? (
            expenses.map((exp: any) => (
              <Card key={exp.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{exp.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="neutral">{exp.category}</Badge>
                      <span className="text-xs text-gray-500">{formatShortDate(exp.expense_date)}</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-red-600">{formatCurrency(exp.amount)}</span>
                </div>
              </Card>
            ))
          ) : (
            <EmptyState title="Gider kaydı yok" description="Bu dönemde gider kaydı bulunmuyor." />
          )}
        </div>
      )}

      {/* Add Income Modal */}
      <Modal isOpen={showAddIncome} onClose={() => setShowAddIncome(false)} title="Gelir Ekle">
        <div className="space-y-4">
          <Input
            label="Tutar (₺) *"
            type="number"
            value={incomeForm.amount}
            onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
          />
          <Input
            label="Tarih"
            type="date"
            value={incomeForm.income_date}
            onChange={(e) => setIncomeForm({ ...incomeForm, income_date: e.target.value })}
          />
          <Select
            label="Kategori"
            value={incomeForm.category}
            onChange={(e) => setIncomeForm({ ...incomeForm, category: e.target.value })}
            options={INCOME_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <Input
            label="Açıklama"
            value={incomeForm.description}
            onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowAddIncome(false)}>İptal</Button>
            <Button onClick={handleAddIncome} loading={createIncome.isPending}>Kaydet</Button>
          </div>
        </div>
      </Modal>

      {/* Add Expense Modal */}
      <Modal isOpen={showAddExpense} onClose={() => setShowAddExpense(false)} title="Gider Ekle">
        <div className="space-y-4">
          <Input
            label="Tutar (₺) *"
            type="number"
            value={expenseForm.amount}
            onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
          />
          <Input
            label="Tarih"
            type="date"
            value={expenseForm.expense_date}
            onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
          />
          <Select
            label="Kategori"
            value={expenseForm.category}
            onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          <Input
            label="Açıklama *"
            value={expenseForm.description}
            onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
            placeholder="Gider açıklaması"
          />
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowAddExpense(false)}>İptal</Button>
            <Button onClick={handleAddExpense} loading={createExpense.isPending}>Kaydet</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
