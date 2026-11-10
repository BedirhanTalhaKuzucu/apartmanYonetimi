-- ============================================================
-- Apartman Yönetim Sistemi - Veritabanı Şeması
-- Supabase (PostgreSQL) Migration
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TRIGGER FUNCTIONS (tablo referansı gerektirmeyen fonksiyonlar)
-- ============================================================

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Auto-create profile when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLES
-- ============================================================

-- 1. Profiles
CREATE TABLE public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone      text NOT NULL,
  full_name  text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_profiles_phone ON public.profiles (phone) WHERE phone <> '';
COMMENT ON TABLE public.profiles IS 'Kullanıcı profilleri – auth.users tablosunu genişletir';

-- 2. Apartments
CREATE TABLE public.apartments (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            text NOT NULL,
  address         text,
  description     text,
  bank_name       text,
  iban            text,
  account_holder  text,
  initial_balance numeric(12,2) NOT NULL DEFAULT 0,
  created_by      uuid REFERENCES public.profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.apartments IS 'Apartman binaları';

-- 3. Apartment Managers
CREATE TABLE public.apartment_managers (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  apartment_id uuid NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'manager',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (apartment_id, user_id)
);
CREATE INDEX idx_apt_managers_user ON public.apartment_managers(user_id);
COMMENT ON TABLE public.apartment_managers IS 'Apartman-yönetici ilişkisi';

-- 4. Units
CREATE TABLE public.units (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  apartment_id uuid NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  unit_number  text NOT NULL,
  floor        text,
  block        text,
  monthly_due  numeric(12,2),
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (apartment_id, unit_number)
);
CREATE INDEX idx_units_apartment ON public.units(apartment_id);
COMMENT ON TABLE public.units IS 'Daireler';

-- 5. Unit Residents
CREATE TABLE public.unit_residents (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id    uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name  text NOT NULL DEFAULT '',
  phone      text,
  role       text NOT NULL DEFAULT 'tenant' CHECK (role IN ('owner', 'tenant')),
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_unit_residents_unit ON public.unit_residents(unit_id);
CREATE INDEX idx_unit_residents_user ON public.unit_residents(user_id);
COMMENT ON TABLE public.unit_residents IS 'Daire sakinleri – bir dairede birden fazla sakin (ev sahibi + kiracı) olabilir';

-- 6. Invitations
CREATE TABLE public.invitations (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  apartment_id  uuid NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  unit_id       uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  token         text NOT NULL UNIQUE,
  invited_name  text,
  invited_phone text,
  resident_role text NOT NULL DEFAULT 'tenant' CHECK (resident_role IN ('owner', 'tenant')),
  created_by    uuid NOT NULL REFERENCES public.profiles(id),
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  accepted_by   uuid REFERENCES public.profiles(id),
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_apartment ON public.invitations(apartment_id);
COMMENT ON TABLE public.invitations IS 'Sakin davet bağlantıları – süreli, tek kullanımlık';

-- 7. Dues (aidatlar / borçlar)
CREATE TABLE public.dues (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  apartment_id uuid NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  unit_id      uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  period       text,
  description  text NOT NULL,
  amount       numeric(12,2) NOT NULL CHECK (amount > 0),
  due_date     date,
  due_type     text NOT NULL DEFAULT 'monthly' CHECK (due_type IN ('monthly', 'one_time')),
  status       text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid')),
  created_by   uuid REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dues_apartment ON public.dues(apartment_id);
CREATE INDEX idx_dues_unit ON public.dues(unit_id);
CREATE INDEX idx_dues_period ON public.dues(apartment_id, period);
CREATE INDEX idx_dues_status ON public.dues(status);
-- Prevent duplicate monthly dues for the same unit+period+description
CREATE UNIQUE INDEX idx_dues_unique_monthly
  ON public.dues (apartment_id, unit_id, period, description)
  WHERE due_type = 'monthly';
COMMENT ON TABLE public.dues IS 'Aidat ve borç kayıtları';

-- 8. Payments
CREATE TABLE public.payments (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  apartment_id      uuid NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  unit_id           uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  due_id            uuid REFERENCES public.dues(id),
  amount            numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date      date NOT NULL,
  payment_method    text NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('cash', 'bank_transfer', 'other')),
  description       text,
  receipt_no        text,
  recorded_by       uuid REFERENCES public.profiles(id),
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  cancelled_at      timestamptz,
  cancelled_by      uuid REFERENCES public.profiles(id),
  cancellation_reason text,
  idempotency_key   text UNIQUE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_apartment ON public.payments(apartment_id);
CREATE INDEX idx_payments_unit ON public.payments(unit_id);
CREATE INDEX idx_payments_due ON public.payments(due_id);
-- Receipt number unique within an apartment
CREATE UNIQUE INDEX idx_payments_receipt_no
  ON public.payments (apartment_id, receipt_no)
  WHERE receipt_no IS NOT NULL;
COMMENT ON TABLE public.payments IS 'Onaylanmış ödeme kayıtları';

-- 9. Payment Notifications (sakin ödeme bildirimleri)
CREATE TABLE public.payment_notifications (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  apartment_id     uuid NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  unit_id          uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  due_id           uuid REFERENCES public.dues(id),
  amount           numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_date     date,
  description      text,
  receipt_url      text,
  notified_by      uuid NOT NULL REFERENCES public.profiles(id),
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by      uuid REFERENCES public.profiles(id),
  reviewed_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pay_notif_apartment ON public.payment_notifications(apartment_id);
CREATE INDEX idx_pay_notif_status ON public.payment_notifications(status);
COMMENT ON TABLE public.payment_notifications IS 'Sakin ödeme bildirimleri – yönetici onayı bekler';

-- 10. Incomes (aidat dışı gelirler)
CREATE TABLE public.incomes (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  apartment_id uuid NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  amount       numeric(12,2) NOT NULL CHECK (amount > 0),
  income_date  date NOT NULL,
  category     text,
  description  text,
  recorded_by  uuid REFERENCES public.profiles(id),
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_incomes_apartment ON public.incomes(apartment_id);
COMMENT ON TABLE public.incomes IS 'Aidat dışı gelirler';

-- 11. Expenses
CREATE TABLE public.expenses (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  apartment_id   uuid NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  amount         numeric(12,2) NOT NULL CHECK (amount > 0),
  expense_date   date NOT NULL,
  category       text NOT NULL,
  description    text,
  attachment_url text,
  recorded_by    uuid REFERENCES public.profiles(id),
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_apartment ON public.expenses(apartment_id);
COMMENT ON TABLE public.expenses IS 'Apartman giderleri';

-- 12. Announcements
CREATE TABLE public.announcements (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  apartment_id   uuid NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  title          text NOT NULL,
  content        text NOT NULL,
  attachment_url text,
  is_pinned      boolean NOT NULL DEFAULT false,
  is_published   boolean NOT NULL DEFAULT true,
  created_by     uuid REFERENCES public.profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_announcements_apartment ON public.announcements(apartment_id);
COMMENT ON TABLE public.announcements IS 'Duyurular';

-- 13. Maintenance Requests
CREATE TABLE public.maintenance_requests (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  apartment_id uuid NOT NULL REFERENCES public.apartments(id) ON DELETE CASCADE,
  unit_id      uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  category     text,
  status       text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved')),
  photo_urls   text[] DEFAULT '{}',
  created_by   uuid REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_maint_req_apartment ON public.maintenance_requests(apartment_id);
CREATE INDEX idx_maint_req_unit ON public.maintenance_requests(unit_id);
COMMENT ON TABLE public.maintenance_requests IS 'Arıza ve talepler';

-- 14. Request Comments
CREATE TABLE public.request_comments (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id uuid NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id),
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_req_comments_request ON public.request_comments(request_id);
COMMENT ON TABLE public.request_comments IS 'Talep yorumları';

-- 15. Notifications (uygulama içi bildirim merkezi)
CREATE TABLE public.notifications (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  apartment_id   uuid REFERENCES public.apartments(id) ON DELETE CASCADE,
  title          text NOT NULL,
  body           text,
  type           text NOT NULL,
  reference_type text,
  reference_id   uuid,
  is_read        boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
COMMENT ON TABLE public.notifications IS 'Uygulama içi bildirimler';

-- 16. Push Subscriptions
CREATE TABLE public.push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX idx_push_subs_user ON public.push_subscriptions(user_id);
COMMENT ON TABLE public.push_subscriptions IS 'Web Push abonelikleri – cihaz bazlı';

-- 17. Notification Log (duplicate prevention)
CREATE TABLE public.notification_log (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           uuid NOT NULL,
  notification_type text NOT NULL,
  reference_id      uuid NOT NULL,
  sent_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, notification_type, reference_id)
);
CREATE INDEX idx_notif_log_lookup ON public.notification_log(user_id, notification_type, reference_id);
COMMENT ON TABLE public.notification_log IS 'Gönderilmiş bildirim kaydı – tekrar gönderimi önler';

-- 18. Audit Log
CREATE TABLE public.audit_log (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  apartment_id uuid,
  user_id      uuid,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    uuid,
  details      jsonb DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_apartment ON public.audit_log(apartment_id);
CREATE INDEX idx_audit_entity ON public.audit_log(entity_type, entity_id);
COMMENT ON TABLE public.audit_log IS 'Finansal işlem denetim kaydı';

-- ============================================================
-- HELPER FUNCTIONS (tablolar oluşturulduktan sonra tanımlanır)
-- ============================================================

-- Check if a user is a manager of a given apartment
CREATE OR REPLACE FUNCTION public.is_apartment_manager(apt_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.apartment_managers
    WHERE apartment_id = apt_id AND user_id = uid
  );
$$;

-- Check if a user is a resident of a given unit
CREATE OR REPLACE FUNCTION public.is_unit_resident(u_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unit_residents
    WHERE unit_id = u_id AND user_id = uid AND is_active = true
  );
$$;

-- Get all apartment IDs a user belongs to (as manager or resident)
CREATE OR REPLACE FUNCTION public.get_user_apartment_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT apartment_id FROM public.apartment_managers WHERE user_id = uid
  UNION
  SELECT u.apartment_id
  FROM public.unit_residents ur
  JOIN public.units u ON u.id = ur.unit_id
  WHERE ur.user_id = uid AND ur.is_active = true;
$$;

-- Get all unit IDs a user is a resident of
CREATE OR REPLACE FUNCTION public.get_user_unit_ids(uid uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT unit_id FROM public.unit_residents
  WHERE user_id = uid AND is_active = true;
$$;

-- Generate next receipt number for an apartment (format: APT-YYYYMMDD-NNNN)
CREATE OR REPLACE FUNCTION public.generate_receipt_no(apt_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_seq int;
  date_part text;
BEGIN
  date_part := to_char(now() AT TIME ZONE 'Europe/Istanbul', 'YYYYMMDD');

  SELECT COALESCE(MAX(
    CAST(
      NULLIF(split_part(receipt_no, '-', 3), '') AS int
    )
  ), 0) + 1
  INTO next_seq
  FROM public.payments
  WHERE apartment_id = apt_id
    AND receipt_no LIKE '%-' || date_part || '-%';

  RETURN 'MKB-' || date_part || '-' || lpad(next_seq::text, 4, '0');
END;
$$;

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_apartments_updated_at
  BEFORE UPDATE ON public.apartments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_unit_residents_updated_at
  BEFORE UPDATE ON public.unit_residents
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_dues_updated_at
  BEFORE UPDATE ON public.dues
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_maintenance_requests_updated_at
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto-create profile on new auth user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apartment_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- ---------- profiles ----------
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Managers can view resident profiles"
  ON public.profiles FOR SELECT
  USING (
    id IN (
      SELECT ur.user_id FROM public.unit_residents ur
      JOIN public.units u ON u.id = ur.unit_id
      WHERE public.is_apartment_manager(u.apartment_id, auth.uid())
        AND ur.user_id IS NOT NULL
    )
  );

-- ---------- apartments ----------
CREATE POLICY "Managers can view own apartments"
  ON public.apartments FOR SELECT
  USING (public.is_apartment_manager(id, auth.uid()));

CREATE POLICY "Residents can view their apartment"
  ON public.apartments FOR SELECT
  USING (id IN (SELECT public.get_user_apartment_ids(auth.uid())));

CREATE POLICY "Authenticated users can create apartments"
  ON public.apartments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view apartments they created"
  ON public.apartments FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Managers can update own apartments"
  ON public.apartments FOR UPDATE
  USING (public.is_apartment_manager(id, auth.uid()));

CREATE POLICY "Managers can delete own apartments"
  ON public.apartments FOR DELETE
  USING (public.is_apartment_manager(id, auth.uid()));

-- ---------- apartment_managers ----------
CREATE POLICY "Managers can view own records"
  ON public.apartment_managers FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Managers can insert manager records"
  ON public.apartment_managers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Managers can delete own manager records"
  ON public.apartment_managers FOR DELETE
  USING (user_id = auth.uid());

-- ---------- units ----------
CREATE POLICY "Managers can manage units"
  ON public.units FOR ALL
  USING (public.is_apartment_manager(apartment_id, auth.uid()));

CREATE POLICY "Residents can view units in their apartment"
  ON public.units FOR SELECT
  USING (apartment_id IN (SELECT public.get_user_apartment_ids(auth.uid())));

-- ---------- unit_residents ----------
CREATE POLICY "Managers can manage residents"
  ON public.unit_residents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = unit_id
        AND public.is_apartment_manager(u.apartment_id, auth.uid())
    )
  );

CREATE POLICY "Users can view own resident records"
  ON public.unit_residents FOR SELECT
  USING (user_id = auth.uid());

-- ---------- invitations ----------
CREATE POLICY "Managers can manage invitations"
  ON public.invitations FOR ALL
  USING (public.is_apartment_manager(apartment_id, auth.uid()));

-- Invitations are also looked up by token via a service-role function
-- for the invite acceptance flow (no RLS bypass needed for anonymous access;
-- we expose a server function instead).

-- ---------- dues ----------
CREATE POLICY "Managers can manage dues"
  ON public.dues FOR ALL
  USING (public.is_apartment_manager(apartment_id, auth.uid()));

CREATE POLICY "Residents can view own unit dues"
  ON public.dues FOR SELECT
  USING (unit_id IN (SELECT public.get_user_unit_ids(auth.uid())));

-- ---------- payments ----------
CREATE POLICY "Managers can manage payments"
  ON public.payments FOR ALL
  USING (public.is_apartment_manager(apartment_id, auth.uid()));

CREATE POLICY "Residents can view own unit payments"
  ON public.payments FOR SELECT
  USING (unit_id IN (SELECT public.get_user_unit_ids(auth.uid())));

-- ---------- payment_notifications ----------
CREATE POLICY "Managers can view/update payment notifications"
  ON public.payment_notifications FOR SELECT
  USING (public.is_apartment_manager(apartment_id, auth.uid()));

CREATE POLICY "Managers can update payment notifications"
  ON public.payment_notifications FOR UPDATE
  USING (public.is_apartment_manager(apartment_id, auth.uid()));

CREATE POLICY "Residents can create payment notifications"
  ON public.payment_notifications FOR INSERT
  WITH CHECK (notified_by = auth.uid());

CREATE POLICY "Residents can view own payment notifications"
  ON public.payment_notifications FOR SELECT
  USING (notified_by = auth.uid());

-- ---------- incomes ----------
CREATE POLICY "Managers can manage incomes"
  ON public.incomes FOR ALL
  USING (public.is_apartment_manager(apartment_id, auth.uid()));

-- Residents see income summary via an RPC or aggregated view, not direct table access

-- ---------- expenses ----------
CREATE POLICY "Managers can manage expenses"
  ON public.expenses FOR ALL
  USING (public.is_apartment_manager(apartment_id, auth.uid()));

CREATE POLICY "Residents can view expenses summary"
  ON public.expenses FOR SELECT
  USING (apartment_id IN (SELECT public.get_user_apartment_ids(auth.uid())));

-- ---------- announcements ----------
CREATE POLICY "Managers can manage announcements"
  ON public.announcements FOR ALL
  USING (public.is_apartment_manager(apartment_id, auth.uid()));

CREATE POLICY "Residents can view published announcements"
  ON public.announcements FOR SELECT
  USING (
    is_published = true
    AND apartment_id IN (SELECT public.get_user_apartment_ids(auth.uid()))
  );

-- ---------- maintenance_requests ----------
CREATE POLICY "Managers can view/update requests"
  ON public.maintenance_requests FOR SELECT
  USING (public.is_apartment_manager(apartment_id, auth.uid()));

CREATE POLICY "Managers can update request status"
  ON public.maintenance_requests FOR UPDATE
  USING (public.is_apartment_manager(apartment_id, auth.uid()));

CREATE POLICY "Residents can create requests"
  ON public.maintenance_requests FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND unit_id IN (SELECT public.get_user_unit_ids(auth.uid()))
  );

CREATE POLICY "Residents can view own unit requests"
  ON public.maintenance_requests FOR SELECT
  USING (unit_id IN (SELECT public.get_user_unit_ids(auth.uid())));

-- ---------- request_comments ----------
CREATE POLICY "Users can view comments on accessible requests"
  ON public.request_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.maintenance_requests mr
      WHERE mr.id = request_id
        AND (
          public.is_apartment_manager(mr.apartment_id, auth.uid())
          OR mr.unit_id IN (SELECT public.get_user_unit_ids(auth.uid()))
        )
    )
  );

CREATE POLICY "Users can add comments to accessible requests"
  ON public.request_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.maintenance_requests mr
      WHERE mr.id = request_id
        AND (
          public.is_apartment_manager(mr.apartment_id, auth.uid())
          OR mr.unit_id IN (SELECT public.get_user_unit_ids(auth.uid()))
        )
    )
  );

-- ---------- notifications ----------
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Notifications are inserted by server-side functions (service role)

-- ---------- push_subscriptions ----------
CREATE POLICY "Users can manage own push subscriptions"
  ON public.push_subscriptions FOR ALL
  USING (user_id = auth.uid());

-- ---------- notification_log ----------
-- Only accessed by server-side functions (service role)
CREATE POLICY "Service role only"
  ON public.notification_log FOR ALL
  USING (false);

-- ---------- audit_log ----------
CREATE POLICY "Managers can view own apartment audit log"
  ON public.audit_log FOR SELECT
  USING (public.is_apartment_manager(apartment_id, auth.uid()));

-- Audit log inserts happen via service role or SECURITY DEFINER functions

-- ============================================================
-- SERVER-SIDE RPC FUNCTIONS
-- ============================================================

-- Look up an invitation by token (used during invite acceptance)
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
    i.resident_role, i.status, i.expires_at,
    a.name AS apartment_name,
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
    RETURN json_build_object('error', 'Bu davet artık geçerli değil');
  END IF;

  IF inv.expires_at < now() THEN
    -- Mark as expired
    UPDATE invitations SET status = 'expired' WHERE token = invite_token;
    RETURN json_build_object('error', 'Davet süresi dolmuş');
  END IF;

  RETURN row_to_json(inv);
END;
$$;

-- Accept an invitation
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

  -- Mark invitation as accepted
  UPDATE invitations
  SET status = 'accepted', accepted_by = uid
  WHERE id = inv.id;

  -- Link user to the unit as a resident
  INSERT INTO unit_residents (unit_id, user_id, full_name, phone, role)
  SELECT
    inv.unit_id,
    uid,
    COALESCE(inv.invited_name, p.full_name, ''),
    COALESCE(inv.invited_phone, p.phone, ''),
    inv.resident_role
  FROM profiles p WHERE p.id = uid
  ON CONFLICT DO NOTHING;

  RETURN json_build_object(
    'success', true,
    'apartment_id', inv.apartment_id,
    'unit_id', inv.unit_id
  );
END;
$$;

-- Record a payment and update due status (atomic)
CREATE OR REPLACE FUNCTION public.record_payment(
  p_apartment_id uuid,
  p_unit_id uuid,
  p_due_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_description text,
  p_idempotency_key text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_payment_id uuid;
  new_receipt_no text;
  due_record record;
  total_paid numeric;
BEGIN
  -- Verify manager
  IF NOT public.is_apartment_manager(p_apartment_id, uid) THEN
    RETURN json_build_object('error', 'Yetkiniz yok');
  END IF;

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO new_payment_id
    FROM payments WHERE idempotency_key = p_idempotency_key;
    IF new_payment_id IS NOT NULL THEN
      RETURN json_build_object('payment_id', new_payment_id, 'duplicate', true);
    END IF;
  END IF;

  -- Generate receipt number
  new_receipt_no := public.generate_receipt_no(p_apartment_id);

  -- Insert payment
  INSERT INTO payments (
    apartment_id, unit_id, due_id, amount, payment_date,
    payment_method, description, receipt_no, recorded_by, idempotency_key
  ) VALUES (
    p_apartment_id, p_unit_id, p_due_id, p_amount, p_payment_date,
    p_payment_method, p_description, new_receipt_no, uid, p_idempotency_key
  ) RETURNING id INTO new_payment_id;

  -- Update due status if linked
  IF p_due_id IS NOT NULL THEN
    SELECT * INTO due_record FROM dues WHERE id = p_due_id;
    IF due_record IS NOT NULL THEN
      SELECT COALESCE(SUM(amount), 0) INTO total_paid
      FROM payments
      WHERE due_id = p_due_id AND status = 'active';

      IF total_paid >= due_record.amount THEN
        UPDATE dues SET status = 'paid' WHERE id = p_due_id;
      ELSIF total_paid > 0 THEN
        UPDATE dues SET status = 'partially_paid' WHERE id = p_due_id;
      END IF;
    END IF;
  END IF;

  -- Audit log
  INSERT INTO audit_log (apartment_id, user_id, action, entity_type, entity_id, details)
  VALUES (p_apartment_id, uid, 'payment_created', 'payment', new_payment_id,
    jsonb_build_object('amount', p_amount, 'due_id', p_due_id, 'receipt_no', new_receipt_no));

  RETURN json_build_object('payment_id', new_payment_id, 'receipt_no', new_receipt_no);
END;
$$;

-- Cancel a payment (reverse, don't delete)
CREATE OR REPLACE FUNCTION public.cancel_payment(
  p_payment_id uuid,
  p_reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  pay record;
  total_paid numeric;
BEGIN
  SELECT * INTO pay FROM payments WHERE id = p_payment_id AND status = 'active';
  IF pay IS NULL THEN
    RETURN json_build_object('error', 'Ödeme bulunamadı');
  END IF;

  IF NOT public.is_apartment_manager(pay.apartment_id, uid) THEN
    RETURN json_build_object('error', 'Yetkiniz yok');
  END IF;

  -- Cancel the payment
  UPDATE payments
  SET status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = uid,
      cancellation_reason = p_reason
  WHERE id = p_payment_id;

  -- Recalculate due status
  IF pay.due_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO total_paid
    FROM payments
    WHERE due_id = pay.due_id AND status = 'active';

    IF total_paid <= 0 THEN
      UPDATE dues SET status = 'unpaid' WHERE id = pay.due_id;
    ELSIF total_paid < (SELECT amount FROM dues WHERE id = pay.due_id) THEN
      UPDATE dues SET status = 'partially_paid' WHERE id = pay.due_id;
    END IF;
  END IF;

  -- Audit log
  INSERT INTO audit_log (apartment_id, user_id, action, entity_type, entity_id, details)
  VALUES (pay.apartment_id, uid, 'payment_cancelled', 'payment', p_payment_id,
    jsonb_build_object('amount', pay.amount, 'reason', p_reason));

  RETURN json_build_object('success', true);
END;
$$;

-- Approve a payment notification → creates a real payment
CREATE OR REPLACE FUNCTION public.approve_payment_notification(
  p_notification_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  notif record;
  result json;
BEGIN
  SELECT * INTO notif
  FROM payment_notifications
  WHERE id = p_notification_id AND status = 'pending'
  FOR UPDATE;

  IF notif IS NULL THEN
    RETURN json_build_object('error', 'Bildirim bulunamadı veya zaten işlenmiş');
  END IF;

  IF NOT public.is_apartment_manager(notif.apartment_id, uid) THEN
    RETURN json_build_object('error', 'Yetkiniz yok');
  END IF;

  -- Mark notification as approved
  UPDATE payment_notifications
  SET status = 'approved', reviewed_by = uid, reviewed_at = now()
  WHERE id = p_notification_id;

  -- Create real payment using idempotency key to prevent duplicates
  result := public.record_payment(
    notif.apartment_id,
    notif.unit_id,
    notif.due_id,
    notif.amount,
    COALESCE(notif.payment_date, CURRENT_DATE),
    'bank_transfer',
    COALESCE(notif.description, 'Sakin ödeme bildirimi'),
    'pn-' || p_notification_id::text
  );

  RETURN result;
END;
$$;

-- Reject a payment notification
CREATE OR REPLACE FUNCTION public.reject_payment_notification(
  p_notification_id uuid,
  p_reason text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  notif record;
BEGIN
  SELECT * INTO notif
  FROM payment_notifications
  WHERE id = p_notification_id AND status = 'pending'
  FOR UPDATE;

  IF notif IS NULL THEN
    RETURN json_build_object('error', 'Bildirim bulunamadı veya zaten işlenmiş');
  END IF;

  IF NOT public.is_apartment_manager(notif.apartment_id, uid) THEN
    RETURN json_build_object('error', 'Yetkiniz yok');
  END IF;

  UPDATE payment_notifications
  SET status = 'rejected', reviewed_by = uid, reviewed_at = now(), rejection_reason = p_reason
  WHERE id = p_notification_id;

  RETURN json_build_object('success', true);
END;
$$;

-- Financial summary for an apartment in a given period
CREATE OR REPLACE FUNCTION public.get_financial_summary(
  p_apartment_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  total_income numeric;
  total_payment_income numeric;
  total_other_income numeric;
  total_expense numeric;
  apt_initial_balance numeric;
  all_time_income numeric;
  all_time_expense numeric;
BEGIN
  -- Check access: must be manager or resident
  IF NOT (
    public.is_apartment_manager(p_apartment_id, uid)
    OR p_apartment_id IN (SELECT public.get_user_apartment_ids(uid))
  ) THEN
    RETURN json_build_object('error', 'Yetkiniz yok');
  END IF;

  -- Period payment income (from dues payments)
  SELECT COALESCE(SUM(amount), 0) INTO total_payment_income
  FROM payments
  WHERE apartment_id = p_apartment_id
    AND status = 'active'
    AND payment_date BETWEEN p_start_date AND p_end_date;

  -- Period other income
  SELECT COALESCE(SUM(amount), 0) INTO total_other_income
  FROM incomes
  WHERE apartment_id = p_apartment_id
    AND status = 'active'
    AND income_date BETWEEN p_start_date AND p_end_date;

  total_income := total_payment_income + total_other_income;

  -- Period expenses
  SELECT COALESCE(SUM(amount), 0) INTO total_expense
  FROM expenses
  WHERE apartment_id = p_apartment_id
    AND status = 'active'
    AND expense_date BETWEEN p_start_date AND p_end_date;

  -- Current balance calculation (all-time)
  SELECT initial_balance INTO apt_initial_balance
  FROM apartments WHERE id = p_apartment_id;

  SELECT COALESCE(SUM(amount), 0) INTO all_time_income
  FROM (
    SELECT amount FROM payments WHERE apartment_id = p_apartment_id AND status = 'active'
    UNION ALL
    SELECT amount FROM incomes WHERE apartment_id = p_apartment_id AND status = 'active'
  ) AS all_inc;

  SELECT COALESCE(SUM(amount), 0) INTO all_time_expense
  FROM expenses WHERE apartment_id = p_apartment_id AND status = 'active';

  RETURN json_build_object(
    'period_payment_income', total_payment_income,
    'period_other_income', total_other_income,
    'period_total_income', total_income,
    'period_total_expense', total_expense,
    'period_net', total_income - total_expense,
    'initial_balance', apt_initial_balance,
    'all_time_income', all_time_income,
    'all_time_expense', all_time_expense,
    'current_balance', apt_initial_balance + all_time_income - all_time_expense
  );
END;
$$;

-- Get overdue dues (for scheduled notifications)
CREATE OR REPLACE FUNCTION public.get_overdue_dues(p_apartment_id uuid)
RETURNS SETOF public.dues
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT d.*
  FROM public.dues d
  WHERE d.apartment_id = p_apartment_id
    AND d.status IN ('unpaid', 'partially_paid')
    AND d.due_date < CURRENT_DATE
  ORDER BY d.due_date ASC;
$$;

-- Get remaining amount for a due
CREATE OR REPLACE FUNCTION public.get_due_remaining(p_due_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT d.amount - COALESCE(
    (SELECT SUM(p.amount) FROM public.payments p WHERE p.due_id = d.id AND p.status = 'active'),
    0
  )
  FROM public.dues d
  WHERE d.id = p_due_id;
$$;

-- Bulk create monthly dues for all active units in an apartment
CREATE OR REPLACE FUNCTION public.create_bulk_dues(
  p_apartment_id uuid,
  p_period text,
  p_description text,
  p_due_date date,
  p_overrides jsonb DEFAULT '[]'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  unit_rec record;
  override_amount numeric;
  created_count int := 0;
  skipped_count int := 0;
BEGIN
  IF NOT public.is_apartment_manager(p_apartment_id, uid) THEN
    RETURN json_build_object('error', 'Yetkiniz yok');
  END IF;

  FOR unit_rec IN
    SELECT id, monthly_due FROM units
    WHERE apartment_id = p_apartment_id AND is_active = true
  LOOP
    -- Check for override amount
    SELECT (elem->>'amount')::numeric INTO override_amount
    FROM jsonb_array_elements(p_overrides) AS elem
    WHERE (elem->>'unit_id')::uuid = unit_rec.id;

    BEGIN
      INSERT INTO dues (apartment_id, unit_id, period, description, amount, due_date, due_type, created_by)
      VALUES (
        p_apartment_id,
        unit_rec.id,
        p_period,
        p_description,
        COALESCE(override_amount, unit_rec.monthly_due, 0),
        p_due_date,
        'monthly',
        uid
      );
      created_count := created_count + 1;
    EXCEPTION WHEN unique_violation THEN
      skipped_count := skipped_count + 1;
    END;
  END LOOP;

  -- Audit
  INSERT INTO audit_log (apartment_id, user_id, action, entity_type, entity_id, details)
  VALUES (p_apartment_id, uid, 'bulk_dues_created', 'due', NULL,
    jsonb_build_object('period', p_period, 'created', created_count, 'skipped', skipped_count));

  RETURN json_build_object(
    'created', created_count,
    'skipped', skipped_count,
    'message', CASE
      WHEN skipped_count > 0 THEN 'Bazı daireler için bu dönem aidatı zaten tanımlıydı.'
      ELSE 'Tüm aidatlar oluşturuldu.'
    END
  );
END;
$$;

-- ============================================================
-- STORAGE BUCKETS (run via Supabase Dashboard or supabase CLI)
-- These are documented here for reference.
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('request-photos', 'request-photos', false);
--
-- Storage RLS policies would restrict access per apartment/user.
-- See README for Supabase Dashboard setup steps.
