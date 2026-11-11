/* ────────────────────────────────────────
   Enum / literal types
   ──────────────────────────────────────── */

export type DueStatus = 'unpaid' | 'partially_paid' | 'paid' | 'overdue';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'other';
export type RequestStatus = 'new' | 'in_progress' | 'resolved';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';
export type UserRole = 'manager' | 'resident';
export type ResidentRole = 'owner' | 'tenant';
export type PaymentNotificationStatus = 'pending' | 'approved' | 'rejected';
export type ExpenseCategory =
  | 'maintenance'
  | 'cleaning'
  | 'electricity'
  | 'water'
  | 'gas'
  | 'elevator'
  | 'insurance'
  | 'personnel'
  | 'other';

/* ────────────────────────────────────────
   Database row types
   ──────────────────────────────────────── */

export type AuthProvider = 'phone' | 'google' | 'email';

export interface Profile {
  id: string; // auth.users id
  phone: string; // E.164
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  auth_provider: AuthProvider;
  created_at: string;
  updated_at: string;
}

export interface Apartment {
  id: string;
  name: string;
  address: string;
  description: string | null;
  bank_name: string | null;
  iban: string | null;
  account_holder: string | null;
  initial_balance: number;
  default_monthly_due?: number;
  auto_generate_dues?: boolean;
  due_day?: number;
  due_due_day?: number;
  last_dues_generated_period?: string | null;
  dues_end_period?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApartmentManager {
  id: string;
  apartment_id: string;
  user_id: string;
  created_at: string;
}

export interface Unit {
  id: string;
  apartment_id: string;
  unit_number: string;
  floor: string | null;
  block: string | null;
  monthly_due: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnitResident {
  id: string;
  unit_id: string;
  user_id: string | null;
  role: ResidentRole;
  full_name: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Invitation {
  id: string;
  apartment_id: string;
  unit_id: string;
  unit_resident_id: string | null;
  token: string;
  status: InvitationStatus;
  resident_role: ResidentRole;
  invited_phone: string | null;
  invited_name: string | null;
  expires_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  created_by: string;
  created_at: string;
}

export interface Due {
  id: string;
  apartment_id: string;
  unit_id: string;
  period: string; // "YYYY-MM"
  description: string;
  amount: number;
  paid_amount?: number;
  remaining_amount?: number;
  due_date: string; // "YYYY-MM-DD"
  due_type: 'monthly' | 'one_time';
  status: DueStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  apartment_id: string;
  unit_id: string;
  due_id: string | null;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  description: string | null;
  receipt_no: string | null;
  receipt_url?: string | null;
  status: 'active' | 'cancelled';
  cancellation_reason: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  recorded_by: string;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentNotification {
  id: string;
  apartment_id: string;
  unit_id: string;
  due_id: string | null;
  amount: number;
  payment_method: PaymentMethod | null;
  payment_date: string;
  description: string | null;
  receipt_url: string | null;
  status: PaymentNotificationStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notified_by: string;
  created_at: string;
}

export interface Income {
  id: string;
  apartment_id: string;
  amount: number;
  description: string;
  income_date: string;
  category: string;
  attachment_url?: string | null;
  recorded_by: string;
  status: 'active' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  apartment_id: string;
  amount: number;
  description: string;
  expense_date: string;
  category: string;
  attachment_url: string | null;
  recorded_by: string;
  status: 'active' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  apartment_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_published: boolean;
  attachment_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceRequest {
  id: string;
  apartment_id: string;
  unit_id: string;
  title: string;
  description: string;
  category: string;
  status: RequestStatus;
  photo_urls: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RequestComment {
  id: string;
  request_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  apartment_id: string;
  title: string;
  body: string;
  type: string; // 'due_reminder' | 'announcement' | 'request_update' | 'payment_notification' | etc.
  reference_type: string | null; // 'due' | 'announcement' | 'request' | 'payment'
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  apartment_id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

/* ────────────────────────────────────────
   Extended / joined types (for UI)
   ──────────────────────────────────────── */

export interface DueWithUnit extends Due {
  unit?: Unit;
  computed_status?: DueStatus;
}

export interface PaymentWithDetails extends Payment {
  unit?: Unit;
  due?: Due;
}

export interface UnitWithResidents extends Unit {
  residents?: UnitResident[];
}

export interface MaintenanceRequestWithComments extends MaintenanceRequest {
  comments?: (RequestComment & { profile?: Profile })[];
  unit?: Unit;
}

export interface AnnouncementWithAuthor extends Announcement {
  author?: Profile;
}
