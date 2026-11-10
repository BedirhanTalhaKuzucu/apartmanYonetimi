import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

// ==============================
// UI Component Tests
// ==============================

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Kaydet</Button>);
    expect(screen.getByText('Kaydet')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Tıkla</Button>);
    fireEvent.click(screen.getByText('Tıkla'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('disables when loading', () => {
    render(<Button loading>Yükleniyor</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('disables when disabled prop is true', () => {
    render(<Button disabled>Devre Dışı</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});

describe('Badge', () => {
  it('renders with text', () => {
    render(<Badge variant="success">Ödenmiş</Badge>);
    expect(screen.getByText('Ödenmiş')).toBeInTheDocument();
  });

  it('renders different variants', () => {
    const { rerender } = render(<Badge variant="danger">Gecikmiş</Badge>);
    expect(screen.getByText('Gecikmiş')).toBeInTheDocument();

    rerender(<Badge variant="warning">Kısmen</Badge>);
    expect(screen.getByText('Kısmen')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(
      <EmptyState
        title="Daire bulunamadı"
        description="Henüz daire eklenmemiş"
      />
    );
    expect(screen.getByText('Daire bulunamadı')).toBeInTheDocument();
    expect(screen.getByText('Henüz daire eklenmemiş')).toBeInTheDocument();
  });
});

describe('LoadingSpinner', () => {
  it('renders spinner', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
