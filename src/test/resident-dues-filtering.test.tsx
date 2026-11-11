import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import MyDuesPage from '@/pages/resident/MyDuesPage';
import { currentPeriod } from '@/lib/utils';
import { formatPeriod } from '@/lib/format';
import * as duesHook from '@/hooks/useDues';
import * as residentContext from '@/hooks/useResidentContext';

// Mock dependencies
vi.mock('@/hooks/useResidentContext', () => ({
  useResidentUnitIds: vi.fn(),
  useMyUnitId: vi.fn(() => 'unit-1'),
}));

vi.mock('@/hooks/useDues', () => ({
  useMyDues: vi.fn(),
  useUnitPayments: vi.fn(() => ({ data: [], isLoading: false })),
}));

describe('Resident Dues & Debt Filtering Suite (Sakin Borç ve Aidat Filtreleme)', () => {
  const curPeriod = currentPeriod(); // e.g. "2026-11"
  const [curYearStr, curMonthStr] = curPeriod.split('-');
  const curYear = parseInt(curYearStr, 10);
  const curMonth = parseInt(curMonthStr, 10);

  // Past period (1 month ago)
  const pastYear = curMonth === 1 ? curYear - 1 : curYear;
  const pastMonth = curMonth === 1 ? 12 : curMonth - 1;
  const pastPeriod = `${pastYear}-${String(pastMonth).padStart(2, '0')}`;

  // Future period (1 month later)
  const futureYear = curMonth === 12 ? curYear + 1 : curYear;
  const futureMonth = curMonth === 12 ? 1 : curMonth + 1;
  const futurePeriod = `${futureYear}-${String(futureMonth).padStart(2, '0')}`;

  const mockDues = [
    {
      id: 'due-past-unpaid',
      unit_id: 'unit-1',
      period: pastPeriod,
      description: 'Geçmiş Ay Aidatı (Ödenmemiş)',
      amount: 500,
      paid_amount: 0,
      due_date: `${pastPeriod}-15`,
      due_type: 'monthly',
      status: 'unpaid',
    },
    {
      id: 'due-current-unpaid',
      unit_id: 'unit-1',
      period: curPeriod,
      description: 'Güncel Ay Aidatı',
      amount: 600,
      paid_amount: 0,
      due_date: `${curPeriod}-20`,
      due_type: 'monthly',
      status: 'unpaid',
    },
    {
      id: 'due-future-upcoming',
      unit_id: 'unit-1',
      period: futurePeriod,
      description: 'Gelecek Ay Aidatı',
      amount: 700,
      paid_amount: 0,
      due_date: `${futurePeriod}-15`,
      due_type: 'monthly',
      status: 'unpaid',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(residentContext.useResidentUnitIds).mockReturnValue(['unit-1']);
    vi.mocked(duesHook.useMyDues).mockReturnValue({
      data: mockDues,
      isLoading: false,
    } as any);
  });

  it('1. Defaults to current month ("Bu Ay") in the month/year selection', () => {
    render(
      <MemoryRouter>
        <MyDuesPage />
      </MemoryRouter>
    );

    const monthSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    const yearSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement;

    expect(monthSelect.value).toBe(String(curMonth));
    expect(yearSelect.value).toBe(String(curYear));
  });

  it('2. Shows unpaid debt from past months regardless of date selection, with clear period prominence', () => {
    render(
      <MemoryRouter>
        <MyDuesPage />
      </MemoryRouter>
    );

    // Current month is selected by default, but the past unpaid debt MUST still be visible!
    expect(screen.getByText('Geçmiş Ay Aidatı (Ödenmemiş)')).toBeInTheDocument();

    // Prominent section banner explaining past unpaid debt
    expect(
      screen.getByText(/Geçmiş Aylardan Kalan Ödenmemiş Borçlarınız/i)
    ).toBeInTheDocument();

    // Hangi tarihe ait olduğu açıkça belirtilmiş olmalı:
    // "Geçmiş Dönem Borcu (Ekim 2026)" or similar formatted period
    const pastPeriodFormatted = formatPeriod(pastPeriod);
    expect(
      screen.getByText(new RegExp(`Geçmiş Dönem Borcu \\(${pastPeriodFormatted}\\)`, 'i'))
    ).toBeInTheDocument();

    // Current month's due is also displayed
    expect(screen.getByText('Güncel Ay Aidatı')).toBeInTheDocument();
  });

  it('3. Total debt sums accrued debts (past 500 + current 600 = 1100), EXCLUDES future dues (700)', () => {
    render(
      <MemoryRouter>
        <MyDuesPage />
      </MemoryRouter>
    );

    // Total debt: 500 + 600 = 1100 TL
    const totalDebtMatches = screen.getAllByText(/1\.100/);
    expect(totalDebtMatches.length).toBeGreaterThan(0);

    // Future due 700 TL should NOT be included in total debt (1100 + 700 = 1800 should not exist)
    expect(screen.queryByText(/1\.800/)).toBeNull();
  });

  it('4. Even if user selects a future month, past unpaid debt is still prominently displayed', () => {
    render(
      <MemoryRouter>
        <MyDuesPage />
      </MemoryRouter>
    );

    // Switch to future month
    const monthSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(monthSelect, { target: { value: String(futureMonth) } });

    const yearSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(yearSelect, { target: { value: String(futureYear) } });

    // Future due is in selected period list with "Vadesi Gelmedi"
    expect(screen.getByText('Gelecek Ay Aidatı')).toBeInTheDocument();
    expect(screen.getByText('Vadesi Gelmedi')).toBeInTheDocument();

    // BUT past unpaid debt is STILL shown regardless of future date selection!
    expect(screen.getByText('Geçmiş Ay Aidatı (Ödenmemiş)')).toBeInTheDocument();
  });

  it('5. "Tüm Dönemler" button displays all dues without duplicating past debts', () => {
    render(
      <MemoryRouter>
        <MyDuesPage />
      </MemoryRouter>
    );

    const allPeriodsButton = screen.getByRole('button', { name: /Tüm Dönemler/i });
    fireEvent.click(allPeriodsButton);

    const monthSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    const yearSelect = screen.getAllByRole('combobox')[1] as HTMLSelectElement;

    expect(monthSelect.value).toBe('all');
    expect(yearSelect.value).toBe('all');

    // All dues are present
    expect(screen.getByText('Geçmiş Ay Aidatı (Ödenmemiş)')).toBeInTheDocument();
    expect(screen.getByText('Güncel Ay Aidatı')).toBeInTheDocument();
    expect(screen.getByText('Gelecek Ay Aidatı')).toBeInTheDocument();
  });
});
