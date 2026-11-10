import { Outlet } from 'react-router-dom';
import { Building2 } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary-50 to-white px-4 py-8">
      {/* Logo / Başlık */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg">
          <Building2 className="h-8 w-8" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Apartman Yönetim</h1>
          <p className="text-sm text-gray-500">Kolay ve güvenilir apartman yönetimi</p>
        </div>
      </div>

      {/* İçerik */}
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  );
}
