import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';

describe('Modal', () => {
  it('renders when open is true', () => {
    render(
      <Modal open={true} onClose={() => {}} title="Test Modal">
        <p>Modal içeriği</p>
      </Modal>
    );
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal içeriği')).toBeInTheDocument();
  });

  it('renders when isOpen is true (alias)', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="İsOpen Modal">
        <p>İçerik</p>
      </Modal>
    );
    expect(screen.getByText('İsOpen Modal')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Gizli Modal">
        <p>Gizli içerik</p>
      </Modal>
    );
    expect(screen.queryByText('Gizli Modal')).not.toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const handleClose = vi.fn();
    render(
      <Modal open={true} onClose={handleClose} title="Kapatılabilir">
        <p>İçerik</p>
      </Modal>
    );
    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalled();
  });
});
