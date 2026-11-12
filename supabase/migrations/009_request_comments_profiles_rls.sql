-- ============================================================
-- 009: Request Comments Author Profiles & Manager Visibility RLS
-- Sakinlerin talep yorumlarında yönetici ad-soyadını ve (Yönetici)
-- bilgisini görebilmesi için profiles ve apartment_managers RLS kuralları.
-- ============================================================

-- 1. Apartman sakinleri (ve diğer yöneticiler), aynı apartmandaki yöneticilerin
--    profil bilgilerini (ad-soyad / e-posta) okuyabilmeli.
DROP POLICY IF EXISTS "Apartment members can view manager profiles" ON public.profiles;
CREATE POLICY "Apartment members can view manager profiles"
  ON public.profiles FOR SELECT
  USING (
    id IN (
      SELECT am.user_id
      FROM public.apartment_managers am
      WHERE am.apartment_id IN (
        SELECT u.apartment_id
        FROM public.unit_residents ur
        JOIN public.units u ON u.id = ur.unit_id
        WHERE ur.user_id = auth.uid()
          AND ur.is_active = true
      )
      OR public.is_apartment_manager(am.apartment_id, auth.uid())
    )
    OR id IN (
      SELECT a.created_by
      FROM public.apartments a
      WHERE a.id IN (
        SELECT u.apartment_id
        FROM public.unit_residents ur
        JOIN public.units u ON u.id = ur.unit_id
        WHERE ur.user_id = auth.uid()
          AND ur.is_active = true
      )
    )
  );

-- 2. Apartman sakinleri, kendi apartmanlarının yönetici listesini (user_id)
--    görebilmeli (talep yorumlarında "(Yönetici)" etiketi için).
DROP POLICY IF EXISTS "Apartment residents can view apartment managers" ON public.apartment_managers;
CREATE POLICY "Apartment residents can view apartment managers"
  ON public.apartment_managers FOR SELECT
  USING (
    apartment_id IN (
      SELECT u.apartment_id
      FROM public.unit_residents ur
      JOIN public.units u ON u.id = ur.unit_id
      WHERE ur.user_id = auth.uid()
        AND ur.is_active = true
    )
  );
