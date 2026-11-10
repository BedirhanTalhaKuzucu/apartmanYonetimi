-- ============================================
-- 002: Auth Enhancements
-- Google OAuth desteği ve e-posta alanı iyileştirmeleri
-- ============================================

-- Invitations tablosunda invited_name ve invited_phone sütunları
-- zaten mevcut olabilir (001'de tanımlandıysa), yoksa ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invitations' AND column_name = 'invited_name'
  ) THEN
    ALTER TABLE invitations ADD COLUMN invited_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invitations' AND column_name = 'invited_phone'
  ) THEN
    ALTER TABLE invitations ADD COLUMN invited_phone TEXT;
  END IF;
END $$;

-- Profiles tablosuna email sütunu ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email TEXT;
  END IF;
END $$;

-- Google OAuth kullanıcıları için auth_provider takibi ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'auth_provider'
  ) THEN
    ALTER TABLE profiles ADD COLUMN auth_provider TEXT DEFAULT 'phone';
  END IF;
END $$;

-- Invitations tablosuna accepted_at sütunu ekle
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invitations' AND column_name = 'accepted_at'
  ) THEN
    ALTER TABLE invitations ADD COLUMN accepted_at TIMESTAMPTZ;
  END IF;
END $$;

-- Google ile giriş yapan kullanıcılar için profil otomatik oluşturma trigger'ını güncelle
-- Mevcut trigger handle_new_user fonksiyonunu güncelle
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, phone, full_name, email, auth_provider)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    CASE
      WHEN NEW.email LIKE '%@apartman.local' THEN NULL
      ELSE NEW.email
    END,
    COALESCE(NEW.raw_app_meta_data->>'provider', 'phone')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
    email = COALESCE(EXCLUDED.email, profiles.email),
    auth_provider = COALESCE(EXCLUDED.auth_provider, profiles.auth_provider);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Invitation kabul edildiğinde profili güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION accept_invitation_with_profile(
  p_token TEXT,
  p_user_id UUID
)
RETURNS void AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  -- Daveti bul
  SELECT * INTO v_invitation
  FROM invitations
  WHERE token = p_token
    AND status = 'pending'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Geçersiz veya süresi dolmuş davet.';
  END IF;

  -- Kullanıcıyı daireye bağla
  INSERT INTO unit_residents (unit_id, user_id, full_name, phone, role, is_active)
  VALUES (
    v_invitation.unit_id,
    p_user_id,
    COALESCE(v_invitation.invited_name, ''),
    v_invitation.invited_phone,
    COALESCE(v_invitation.resident_role, 'tenant'),
    true
  )
  ON CONFLICT DO NOTHING;

  -- Profili güncelle (eğer bilgiler eksikse)
  UPDATE profiles
  SET
    full_name = CASE WHEN full_name = '' OR full_name IS NULL
                     THEN COALESCE(v_invitation.invited_name, full_name)
                     ELSE full_name END,
    phone = CASE WHEN phone = '' OR phone IS NULL
                 THEN COALESCE(v_invitation.invited_phone, phone)
                 ELSE phone END
  WHERE id = p_user_id;

  -- Daveti kabul edildi olarak işaretle
  UPDATE invitations
  SET status = 'accepted',
      accepted_by = p_user_id,
      accepted_at = NOW()
  WHERE id = v_invitation.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
