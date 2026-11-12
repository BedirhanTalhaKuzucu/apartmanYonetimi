-- 008_fix_invitations_and_duplicate_residents.sql
-- Davet kabulünde mükerrer sakin oluşmasını engelleme ve var olan offline sakin ile eşleme

-- 1. Mevcut mükerrer sakin kayıtlarını temizle (aynı daire ve aynı user_id için)
DELETE FROM public.unit_residents a
WHERE a.id NOT IN (
  SELECT DISTINCT ON (unit_id, user_id) id
  FROM public.unit_residents
  WHERE user_id IS NOT NULL
  ORDER BY unit_id, user_id, is_active DESC, created_at ASC
)
AND a.user_id IS NOT NULL;

-- 2. unit_residents tablosunda aynı dairede aynı user_id'nin tekrar eklenmesini engelleyen unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_unit_residents_unit_user_unique
ON public.unit_residents (unit_id, user_id)
WHERE user_id IS NOT NULL;

-- 3. Davet kabul RPC fonksiyonunu güncelle:
-- Var olan kullanıcıyı veya offline (user_id IS NULL) oluşturulmuş sakini eşle, asla mükerrer oluşturma!
CREATE OR REPLACE FUNCTION public.accept_invitation(invite_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
  uid uuid := auth.uid();
  v_offline_id uuid;
  v_existing_id uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN json_build_object('error', 'Giriş yapmalısınız');
  END IF;

  SELECT * INTO inv
  FROM invitations
  WHERE token = invite_token
    AND status = 'pending'
    AND expires_at > now()
  FOR UPDATE;

  IF inv IS NULL THEN
    RETURN json_build_object('error', 'Geçersiz veya süresi dolmuş davet');
  END IF;

  -- 1. Kullanıcı bu dairede zaten sakin mi?
  SELECT id INTO v_existing_id
  FROM unit_residents
  WHERE unit_id = inv.unit_id AND user_id = uid
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE unit_residents
    SET is_active = true,
        role = COALESCE(inv.resident_role, role),
        updated_at = now()
    WHERE id = v_existing_id;
  ELSE
    -- 2. user_id'si NULL olup telefon veya isim eşleşen offline sakin var mı?
    SELECT id INTO v_offline_id
    FROM unit_residents
    WHERE unit_id = inv.unit_id
      AND user_id IS NULL
      AND (
        (inv.invited_phone IS NOT NULL AND NULLIF(phone, '') = inv.invited_phone)
        OR (inv.invited_name IS NOT NULL AND LOWER(full_name) = LOWER(inv.invited_name))
      )
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_offline_id IS NOT NULL THEN
      -- Var olan offline sakini bu kullanıcıya bağla
      UPDATE unit_residents
      SET user_id = uid,
          is_active = true,
          role = COALESCE(inv.resident_role, role),
          phone = COALESCE(NULLIF(phone, ''), inv.invited_phone),
          full_name = COALESCE(NULLIF(full_name, ''), inv.invited_name),
          updated_at = now()
      WHERE id = v_offline_id;
    ELSE
      -- 3. Eşleşen kayıt yoksa yeni bir sakin oluştur
      INSERT INTO unit_residents (unit_id, user_id, full_name, phone, role, is_active)
      SELECT
        inv.unit_id,
        uid,
        COALESCE(NULLIF(inv.invited_name, ''), p.full_name, ''),
        COALESCE(NULLIF(inv.invited_phone, ''), p.phone, ''),
        COALESCE(inv.resident_role, 'tenant'),
        true
      FROM profiles p WHERE p.id = uid;
    END IF;
  END IF;

  -- Daveti kabul edildi olarak işaretle
  UPDATE invitations
  SET status = 'accepted', accepted_by = uid, accepted_at = now()
  WHERE id = inv.id;

  -- Aynı daire için bekleyen diğer mükerrer davetleri de kapat
  IF inv.invited_phone IS NOT NULL THEN
    UPDATE invitations
    SET status = 'accepted', accepted_by = uid, accepted_at = now()
    WHERE unit_id = inv.unit_id AND invited_phone = inv.invited_phone AND status = 'pending';
  END IF;

  RETURN json_build_object(
    'success', true,
    'apartment_id', inv.apartment_id,
    'unit_id', inv.unit_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;
