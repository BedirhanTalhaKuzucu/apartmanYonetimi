-- 007_notifications_system.sql
-- Uygulama içi bildirim sistemi için RLS politikaları ve yardımcı RPC fonksiyonları

-- 1. Bildirimler tablosuna INSERT izni (Giriş yapmış kullanıcıların bildirim oluşturabilmesi için)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'notifications' AND policyname = 'Authenticated users can insert notifications'
  ) THEN
    CREATE POLICY "Authenticated users can insert notifications"
      ON public.notifications FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- 2. Apartman yöneticilerine bildirim gönderen RPC fonksiyonu
CREATE OR REPLACE FUNCTION public.notify_apartment_managers(
  p_apartment_id uuid,
  p_title text,
  p_body text,
  p_type text,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  mgr_record RECORD;
BEGIN
  FOR mgr_record IN
    SELECT DISTINCT u_id FROM (
      SELECT user_id AS u_id FROM public.apartment_managers WHERE apartment_id = p_apartment_id
      UNION
      SELECT created_by AS u_id FROM public.apartments WHERE id = p_apartment_id AND created_by IS NOT NULL
    ) sub
  LOOP
    INSERT INTO public.notifications (
      user_id,
      apartment_id,
      title,
      body,
      type,
      reference_type,
      reference_id,
      is_read,
      created_at
    ) VALUES (
      mgr_record.u_id,
      p_apartment_id,
      p_title,
      p_body,
      p_type,
      p_reference_type,
      p_reference_id,
      false,
      now()
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'notified_count', v_count);
END;
$$;

-- 3. Belirli bir dairenin sakinlerine bildirim gönderen RPC fonksiyonu
CREATE OR REPLACE FUNCTION public.notify_unit_residents(
  p_unit_id uuid,
  p_title text,
  p_body text,
  p_type text,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_apartment_id uuid;
  res_record RECORD;
BEGIN
  SELECT apartment_id INTO v_apartment_id FROM public.units WHERE id = p_unit_id;

  FOR res_record IN
    SELECT DISTINCT user_id FROM public.unit_residents
    WHERE unit_id = p_unit_id AND user_id IS NOT NULL AND is_active = true
  LOOP
    INSERT INTO public.notifications (
      user_id,
      apartment_id,
      title,
      body,
      type,
      reference_type,
      reference_id,
      is_read,
      created_at
    ) VALUES (
      res_record.user_id,
      v_apartment_id,
      p_title,
      p_body,
      p_type,
      p_reference_type,
      p_reference_id,
      false,
      now()
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'notified_count', v_count);
END;
$$;

-- 4. Apartmandaki tüm aktif sakinlere bildirim gönderen RPC fonksiyonu (ör: genel duyurular)
CREATE OR REPLACE FUNCTION public.notify_apartment_residents(
  p_apartment_id uuid,
  p_title text,
  p_body text,
  p_type text,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  res_record RECORD;
BEGIN
  FOR res_record IN
    SELECT DISTINCT ur.user_id
    FROM public.unit_residents ur
    JOIN public.units u ON u.id = ur.unit_id
    WHERE u.apartment_id = p_apartment_id AND ur.user_id IS NOT NULL AND ur.is_active = true
  LOOP
    INSERT INTO public.notifications (
      user_id,
      apartment_id,
      title,
      body,
      type,
      reference_type,
      reference_id,
      is_read,
      created_at
    ) VALUES (
      res_record.user_id,
      p_apartment_id,
      p_title,
      p_body,
      p_type,
      p_reference_type,
      p_reference_id,
      false,
      now()
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object('success', true, 'notified_count', v_count);
END;
$$;

-- 5. Belirli bir kullanıcıya doğrudan bildirim gönderen RPC fonksiyonu
CREATE OR REPLACE FUNCTION public.create_notification_for_user(
  p_user_id uuid,
  p_apartment_id uuid,
  p_title text,
  p_body text,
  p_type text,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (
    user_id,
    apartment_id,
    title,
    body,
    type,
    reference_type,
    reference_id,
    is_read,
    created_at
  ) VALUES (
    p_user_id,
    p_apartment_id,
    p_title,
    p_body,
    p_type,
    p_reference_type,
    p_reference_id,
    false,
    now()
  );

  RETURN json_build_object('success', true);
END;
$$;

-- Yetkileri ver
GRANT EXECUTE ON FUNCTION public.notify_apartment_managers TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.notify_unit_residents TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.notify_apartment_residents TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_notification_for_user TO authenticated, anon;
