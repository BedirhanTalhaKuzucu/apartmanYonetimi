import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { lockBodyScroll } from '@/lib/scrollLock';

describe('scrollLock utility', () => {
  beforeEach(() => {
    // Reset body styles and mock scroll
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollY = 0;
  });

  afterEach(() => {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
  });

  it('locks body scroll by setting position fixed and negative top matching scrollY', () => {
    window.scrollY = 250;
    const unlock = lockBodyScroll();

    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-250px');
    expect(document.body.style.width).toBe('100%');
    expect(document.body.style.overflow).toBe('hidden');

    unlock();

    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
    expect(document.body.style.overflow).toBe('');
  });

  it('handles nested lock calls with reference counting', () => {
    window.scrollY = 100;
    const unlock1 = lockBodyScroll();
    const unlock2 = lockBodyScroll();

    expect(document.body.style.position).toBe('fixed');
    expect(document.body.style.top).toBe('-100px');

    unlock1();
    // Still locked because unlock2 has not been called
    expect(document.body.style.position).toBe('fixed');

    unlock2();
    // Now fully unlocked
    expect(document.body.style.position).toBe('');
    expect(document.body.style.top).toBe('');
  });
});
