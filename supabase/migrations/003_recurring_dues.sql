-- ============================================
-- 003: Recurring Dues & Batch Unit Management
-- ============================================

-- 1. Apartman tablosuna tekrarlayan aidat alanları ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'default_monthly_due'
  ) THEN
    ALTER TABLE public.apartments ADD COLUMN default_monthly_due numeric(12,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'auto_generate_dues'
  ) THEN
    ALTER TABLE public.apartments ADD COLUMN auto_generate_dues boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'due_day'
  ) THEN
    ALTER TABLE public.apartments ADD COLUMN due_day integer NOT NULL DEFAULT 1 CHECK (due_day >= 1 AND due_day <= 28);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'due_due_day'
  ) THEN
    ALTER TABLE public.apartments ADD COLUMN due_due_day integer NOT NULL DEFAULT 15 CHECK (due_due_day >= 1 AND due_due_day <= 28);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'last_dues_generated_period'
  ) THEN
    ALTER TABLE public.apartments ADD COLUMN last_dues_generated_period text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apartments' AND column_name = 'dues_end_period'
  ) THEN
    ALTER TABLE public.apartments ADD COLUMN dues_end_period text;
  END IF;
END $$;

-- 2. Toplu / Tekrarlayan Aidat Oluşturma RPC Fonksiyonu
CREATE OR REPLACE FUNCTION public.generate_monthly_dues(
  p_apartment_id uuid,
  p_period text,              -- 'YYYY-MM'
  p_due_date date,            -- 'YYYY-MM-DD'
  p_description text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_apt record;
  v_unit record;
  v_desc text;
  v_amount numeric;
  v_created_count integer := 0;
  v_skipped_count integer := 0;
  v_due_id uuid;
  v_resident record;
BEGIN
  -- Apartman ve yönetici yetki kontrolü
  SELECT * INTO v_apt FROM public.apartments WHERE id = p_apartment_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Apartman bulunamadı.');
  END IF;

  -- Eğer bitiş dönemi tanımlıysa ve aşıldıysa oluşturma
  IF v_apt.dues_end_period IS NOT NULL AND v_apt.dues_end_period <> '' AND p_period > v_apt.dues_end_period THEN
    RETURN json_build_object('success', false, 'error', 'Bu aidat planının geçerlilik süresi dolmuştur (' || v_apt.dues_end_period || ').');
  END IF;

  -- Eğer giriş yapan kullanıcı auth ise yönetici mi kontrol et (cron/service_role değilse)
  IF v_uid IS NOT NULL AND NOT public.is_apartment_manager(p_apartment_id, v_uid) THEN
    RETURN json_build_object('success', false, 'error', 'Bu işlem için yönetici yetkiniz bulunmuyor.');
  END IF;

  -- Varsayılan açıklama
  IF p_description IS NULL OR trim(p_description) = '' THEN
    v_desc := p_period || ' Ayı Aidatı';
  ELSE
    v_desc := trim(p_description);
  END IF;

  -- Aktif daireleri dön
  FOR v_unit IN
    SELECT id, unit_number, monthly_due
    FROM public.units
    WHERE apartment_id = p_apartment_id
      AND is_active = true
    ORDER BY unit_number ASC
  LOOP
    -- Bu dönem için zaten aidat var mı kontrol et
    IF EXISTS (
      SELECT 1 FROM public.dues
      WHERE apartment_id = p_apartment_id
        AND unit_id = v_unit.id
        AND period = p_period
        AND due_type = 'monthly'
    ) THEN
      v_skipped_count := v_skipped_count + 1;
      CONTINUE;
    END IF;

    -- Tutar: dairenin monthly_due varsa o, yoksa apartmanın default_monthly_due değeri
    v_amount := COALESCE(v_unit.monthly_due, v_apt.default_monthly_due, 0);

    -- Tutar > 0 ise aidat oluştur
    IF v_amount > 0 THEN
      INSERT INTO public.dues (
        apartment_id,
        unit_id,
        period,
        description,
        amount,
        due_date,
        due_type,
        status,
        created_by
      ) VALUES (
        p_apartment_id,
        v_unit.id,
        p_period,
        v_desc,
        v_amount,
        p_due_date,
        'monthly',
        'unpaid',
        v_uid
      ) RETURNING id INTO v_due_id;

      v_created_count := v_created_count + 1;

      -- Dairedeki aktif sakinlere bildirim oluştur
      FOR v_resident IN
        SELECT user_id, full_name
        FROM public.unit_residents
        WHERE unit_id = v_unit.id
          AND is_active = true
          AND user_id IS NOT NULL
      LOOP
        INSERT INTO public.notifications (
          user_id,
          apartment_id,
          title,
          body,
          type,
          reference_type,
          reference_id
        ) VALUES (
          v_resident.user_id,
          p_apartment_id,
          'Yeni Aidat Tanımlandı',
          v_desc || ' (' || v_amount::text || ' ₺) hesabınıza yansıtıldı. Son ödeme: ' || to_char(p_due_date, 'DD.MM.YYYY'),
          'due_created',
          'due',
          v_due_id
        );
      END LOOP;
    ELSE
      v_skipped_count := v_skipped_count + 1;
    END IF;
  END LOOP;

  -- Apartmanın son oluşturulan dönemini güncelle
  UPDATE public.apartments
  SET last_dues_generated_period = p_period,
      updated_at = now()
  WHERE id = p_apartment_id;

  RETURN json_build_object(
    'success', true,
    'period', p_period,
    'created_count', v_created_count,
    'skipped_count', v_skipped_count
  );
END;
$$;

-- 3. Toplu Daire Oluşturma RPC Fonksiyonu (1'den N'e kadar)
CREATE OR REPLACE FUNCTION public.create_units_batch(
  p_apartment_id uuid,
  p_start_number integer,
  p_end_number integer,
  p_block text DEFAULT NULL,
  p_monthly_due numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_i integer;
  v_unit_num text;
  v_created_count integer := 0;
  v_skipped_count integer := 0;
  v_apt record;
  v_due numeric;
BEGIN
  -- Yetki kontrolü
  IF NOT public.is_apartment_manager(p_apartment_id, v_uid) THEN
    RETURN json_build_object('success', false, 'error', 'Yetkiniz yok.');
  END IF;

  SELECT * INTO v_apt FROM public.apartments WHERE id = p_apartment_id;
  v_due := COALESCE(p_monthly_due, v_apt.default_monthly_due, NULL);

  FOR v_i IN p_start_number..p_end_number LOOP
    v_unit_num := v_i::text;

    -- Bu daire zaten var mı?
    IF EXISTS (
      SELECT 1 FROM public.units
      WHERE apartment_id = p_apartment_id
        AND unit_number = v_unit_num
        AND (block IS NOT DISTINCT FROM p_block)
    ) THEN
      v_skipped_count := v_skipped_count + 1;
    ELSE
      INSERT INTO public.units (
        apartment_id,
        unit_number,
        block,
        monthly_due,
        is_active
      ) VALUES (
        p_apartment_id,
        v_unit_num,
        NULLIF(trim(p_block), ''),
        v_due,
        true
      );
      v_created_count := v_created_count + 1;
    END IF;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'created_count', v_created_count,
    'skipped_count', v_skipped_count
  );
END;
$$;

-- 4. Audit Log tablosuna yöneticiler için ekleme izni (RLS INSERT Policy)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_log' AND policyname = 'Managers can insert own apartment audit log'
  ) THEN
    CREATE POLICY "Managers can insert own apartment audit log"
      ON public.audit_log FOR INSERT
      WITH CHECK (public.is_apartment_manager(apartment_id, auth.uid()));
  END IF;
END $$;
