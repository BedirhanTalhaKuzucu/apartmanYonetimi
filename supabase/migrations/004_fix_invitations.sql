-- 004_fix_invitations.sql
-- Davetiye linklerinin anonim/yeni kullanıcılar tarafından sorunsuz okunabilmesi
-- ve kabul edilebilmesi için RPC fonksiyonları ve RLS yetkileri

-- 1. Token ile daveti güvenli bir şekilde sorgulama (anon ve authenticated kullanıcılar için)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(invite_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
BEGIN
  SELECT
    i.id, i.apartment_id, i.unit_id, i.invited_name, i.invited_phone,
    i.resident_role, i.status, i.expires_at, i.created_at,
    a.name AS apartment_name,
    a.address AS apartment_address,
    u.unit_number, u.floor, u.block
  INTO inv
  FROM invitations i
  JOIN apartments a ON a.id = i.apartment_id
  JOIN units u ON u.id = i.unit_id
  WHERE i.token = invite_token;

  IF inv IS NULL THEN
    RETURN json_build_object('error', 'Davet bulunamadı');
  END IF;

  IF inv.status <> 'pending' THEN
    RETURN json_build_object(
      'error', 'Bu davet artık geçerli değil',
      'status', inv.status,
      'apartment_name', inv.apartment_name,
      'unit_number', inv.unit_number
    );
  END IF;

  IF inv.expires_at < now() THEN
    UPDATE invitations SET status = 'expired' WHERE token = invite_token;
    RETURN json_build_object(
      'error', 'Davet süresi dolmuş',
      'status', 'expired',
      'apartment_name', inv.apartment_name,
      'unit_number', inv.unit_number
    );
  END IF;

  RETURN row_to_json(inv);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;

-- 2. Giriş yapmış kullanıcının daveti kabul edip daireye atanması
CREATE OR REPLACE FUNCTION public.accept_invitation(invite_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
  uid uuid := auth.uid();
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

  -- Daveti kabul edildi olarak işaretle
  UPDATE invitations
  SET status = 'accepted', accepted_by = uid, accepted_at = now()
  WHERE id = inv.id;

  -- Kullanıcıyı daire sakini olarak ekle
  INSERT INTO unit_residents (unit_id, user_id, full_name, phone, role, is_active)
  SELECT
    inv.unit_id,
    uid,
    COALESCE(NULLIF(inv.invited_name, ''), p.full_name, ''),
    COALESCE(NULLIF(inv.invited_phone, ''), p.phone, ''),
    COALESCE(inv.resident_role, 'tenant'),
    true
  FROM profiles p WHERE p.id = uid
  ON CONFLICT (unit_id, user_id) DO UPDATE
  SET is_active = true,
      role = EXCLUDED.role;

  RETURN json_build_object(
    'success', true,
    'apartment_id', inv.apartment_id,
    'unit_id', inv.unit_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

-- 3. RLS İzinleri (Yedek olarak anon/authenticated SELECT erişimi)
DROP POLICY IF EXISTS "Public can view invitation by token" ON public.invitations;
CREATE POLICY "Public can view invitation by token"
  ON public.invitations FOR SELECT
  TO anon, authenticated
  USING (true);
