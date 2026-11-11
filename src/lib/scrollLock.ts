/**
 * iOS Safari / WebKit ve tüm mobil tarayıcılarda modal ve alt çekmece (bottom sheet)
 * açıkken arka planın kaymasını (body scroll) %100 engelleyen yardımcı araç.
 *
 * Klasik `document.body.style.overflow = 'hidden'` iOS Safari'de tek başına çalışmaz.
 * iOS WebKit için `position: fixed` + dinamik negatif `top: -scrollY` yaklaşımı
 * sayfanın zıplamadan arka planda kilitlenmesini ve modal kapandığında
 * kullanıcının kaldığı tam dikey piksele geri dönmesini garanti eder.
 */

let lockCount = 0;
let previousScrollY = 0;
let previousBodyStyles = {
  position: '',
  top: '',
  left: '',
  right: '',
  width: '',
  overflow: '',
};

export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => {};

  lockCount++;
  if (lockCount === 1) {
    previousScrollY = typeof window !== 'undefined' ? window.scrollY || window.pageYOffset || 0 : 0;
    previousBodyStyles = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };

    document.body.style.position = 'fixed';
    document.body.style.top = `-${previousScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);

    if (lockCount === 0) {
      document.body.style.position = previousBodyStyles.position;
      document.body.style.top = previousBodyStyles.top;
      document.body.style.left = previousBodyStyles.left;
      document.body.style.right = previousBodyStyles.right;
      document.body.style.width = previousBodyStyles.width;
      document.body.style.overflow = previousBodyStyles.overflow;

      if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
        const isJsdom = typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('jsdom');
        if (!isJsdom) {
          try {
            window.scrollTo(0, previousScrollY);
          } catch {
            // sessizce geç
          }
        }
      }
    }
  };
}
