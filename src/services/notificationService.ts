import { supabase } from '@/lib/supabase';

export interface NotificationPayload {
  title: string;
  body: string;
  type:
    | 'announcement'
    | 'request_created'
    | 'request_update'
    | 'payment_notification'
    | 'payment_received'
    | 'payment_approved'
    | 'payment_rejected'
    | 'due_reminder'
    | 'invitation_accepted';
  referenceType?: 'announcement' | 'request' | 'payment' | 'payment_notification' | 'due' | 'unit';
  referenceId?: string;
}

/**
 * Sakin adı (varsa) ve daire bilgisini okunabilir bir etikete dönüştürür.
 * Sakin atanmışsa: "Ahmet Yılmaz (A Blok Daire 5)" veya "Ahmet Yılmaz (Daire 5)"
 * Sakin atanmamışsa: "A Blok Daire 5" veya "Daire 5"
 */
export async function getUnitAndResidentLabel(
  unitId?: string | null,
  userId?: string | null,
  fallbackName?: string | null
): Promise<string> {
  let unitLabel = '';
  let residentName = fallbackName?.trim() || '';

  try {
    if (unitId) {
      const { data: unit } = await supabase
        .from('units')
        .select('unit_number, block')
        .eq('id', unitId)
        .maybeSingle();

      if (unit) {
        unitLabel = unit.block
          ? `${unit.block} Blok Daire ${unit.unit_number}`
          : `Daire ${unit.unit_number}`;
      }
    }

    if (!residentName && userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.full_name) {
        residentName = profile.full_name.trim();
      }
    }

    if (!residentName && unitId && userId) {
      const { data: ur } = await supabase
        .from('unit_residents')
        .select('full_name')
        .eq('unit_id', unitId)
        .eq('user_id', userId)
        .maybeSingle();

      if (ur?.full_name) {
        residentName = ur.full_name.trim();
      }
    }
  } catch {
    // non-critical
  }

  if (residentName && unitLabel) return `${residentName} (${unitLabel})`;
  return residentName || unitLabel || '';
}

/**
 * Web Push Edge Function'ını sessizce tetikler (deploy edilmişse telefona push gönderir)
 */
async function triggerPushNotification(payload: {
  userId?: string;
  userIds?: string[];
  title: string;
  body: string;
  type?: string;
  referenceId?: string;
}) {
  try {
    await supabase.functions.invoke('send-push', { body: payload });
  } catch {
    // Edge function deploy edilmediyse veya başarısız olursa ana akışı engellemez
  }
}

/**
 * Apartman yöneticilerine bildirim gönderir.
 */
export async function notifyManagers(params: {
  apartmentId: string;
} & NotificationPayload): Promise<void> {
  const { apartmentId, title, body, type, referenceType, referenceId } = params;

  try {
    // 1. Önce RPC'yi dene
    const { data, error } = await supabase.rpc('notify_apartment_managers', {
      p_apartment_id: apartmentId,
      p_title: title,
      p_body: body,
      p_type: type,
      p_reference_type: referenceType || null,
      p_reference_id: referenceId || null,
    });

    if (!error && data?.success) {
      // Yöneticilerin cihazlarına push gönder
      triggerPushNotificationForApartmentManagers(apartmentId, { title, body, type, referenceId });
      return;
    }
  } catch {
    // RPC başarısız olursa fallback'e geç
  }

  // 2. Fallback: İstemci taraflı sorgu ve ekleme
  try {
    const { data: managers } = await supabase
      .from('apartment_managers')
      .select('user_id')
      .eq('apartment_id', apartmentId);

    const { data: apt } = await supabase
      .from('apartments')
      .select('created_by')
      .eq('id', apartmentId)
      .single();

    const targetUserIds = new Set<string>();
    if (apt?.created_by) targetUserIds.add(apt.created_by);
    managers?.forEach((m) => {
      if (m.user_id) targetUserIds.add(m.user_id);
    });

    if (targetUserIds.size === 0) return;

    const rows = Array.from(targetUserIds).map((uid) => ({
      user_id: uid,
      apartment_id: apartmentId,
      title,
      body,
      type,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
      is_read: false,
    }));

    await supabase.from('notifications').insert(rows);
    triggerPushNotification({
      userIds: Array.from(targetUserIds),
      title,
      body,
      type,
      referenceId,
    });
  } catch (err) {
    console.warn('notifyManagers hatası (önemsiz):', err);
  }
}

async function triggerPushNotificationForApartmentManagers(
  apartmentId: string,
  payload: { title: string; body: string; type: string; referenceId?: string }
) {
  try {
    const { data: managers } = await supabase
      .from('apartment_managers')
      .select('user_id')
      .eq('apartment_id', apartmentId);

    const { data: apt } = await supabase
      .from('apartments')
      .select('created_by')
      .eq('id', apartmentId)
      .single();

    const targetUserIds = new Set<string>();
    if (apt?.created_by) targetUserIds.add(apt.created_by);
    managers?.forEach((m) => {
      if (m.user_id) targetUserIds.add(m.user_id);
    });

    if (targetUserIds.size > 0) {
      triggerPushNotification({
        userIds: Array.from(targetUserIds),
        ...payload,
      });
    }
  } catch {
    // non-critical
  }
}

/**
 * Belirli bir dairenin aktif sakinlerine bildirim gönderir.
 */
export async function notifyUnitResidents(params: {
  unitId: string;
  apartmentId?: string;
} & NotificationPayload): Promise<void> {
  const { unitId, apartmentId, title, body, type, referenceType, referenceId } = params;

  try {
    const { data, error } = await supabase.rpc('notify_unit_residents', {
      p_unit_id: unitId,
      p_title: title,
      p_body: body,
      p_type: type,
      p_reference_type: referenceType || null,
      p_reference_id: referenceId || null,
    });

    if (!error && data?.success) {
      triggerPushNotificationForUnitResidents(unitId, { title, body, type, referenceId });
      return;
    }
  } catch {
    // Fallback
  }

  try {
    const { data: residents } = await supabase
      .from('unit_residents')
      .select('user_id, unit_id')
      .eq('unit_id', unitId)
      .eq('is_active', true)
      .not('user_id', 'is', null);

    if (!residents || residents.length === 0) return;

    const rows = residents.map((r) => ({
      user_id: r.user_id!,
      apartment_id: apartmentId || null,
      title,
      body,
      type,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
      is_read: false,
    }));

    await supabase.from('notifications').insert(rows);
    triggerPushNotification({
      userIds: residents.map((r) => r.user_id!).filter(Boolean),
      title,
      body,
      type,
      referenceId,
    });
  } catch (err) {
    console.warn('notifyUnitResidents hatası (önemsiz):', err);
  }
}

async function triggerPushNotificationForUnitResidents(
  unitId: string,
  payload: { title: string; body: string; type: string; referenceId?: string }
) {
  try {
    const { data: residents } = await supabase
      .from('unit_residents')
      .select('user_id')
      .eq('unit_id', unitId)
      .eq('is_active', true)
      .not('user_id', 'is', null);

    const userIds = residents?.map((r) => r.user_id).filter(Boolean) as string[];
    if (userIds && userIds.length > 0) {
      triggerPushNotification({
        userIds,
        ...payload,
      });
    }
  } catch {
    // non-critical
  }
}

/**
 * Apartmandaki tüm aktif sakinlere toplu bildirim gönderir (örn: genel duyurular).
 */
export async function notifyApartmentResidents(params: {
  apartmentId: string;
} & NotificationPayload): Promise<void> {
  const { apartmentId, title, body, type, referenceType, referenceId } = params;

  try {
    const { data, error } = await supabase.rpc('notify_apartment_residents', {
      p_apartment_id: apartmentId,
      p_title: title,
      p_body: body,
      p_type: type,
      p_reference_type: referenceType || null,
      p_reference_id: referenceId || null,
    });

    if (!error && data?.success) {
      triggerPushNotificationForApartmentResidents(apartmentId, { title, body, type, referenceId });
      return;
    }
  } catch {
    // Fallback
  }

  try {
    const { data: units } = await supabase
      .from('units')
      .select('id, unit_residents(user_id, is_active)')
      .eq('apartment_id', apartmentId);

    const userIds = new Set<string>();
    units?.forEach((u: any) => {
      (u.unit_residents || []).forEach((r: any) => {
        if (r.user_id && r.is_active) {
          userIds.add(r.user_id);
        }
      });
    });

    if (userIds.size === 0) return;

    const rows = Array.from(userIds).map((uid) => ({
      user_id: uid,
      apartment_id: apartmentId,
      title,
      body,
      type,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
      is_read: false,
    }));

    await supabase.from('notifications').insert(rows);
    triggerPushNotification({
      userIds: Array.from(userIds),
      title,
      body,
      type,
      referenceId,
    });
  } catch (err) {
    console.warn('notifyApartmentResidents hatası (önemsiz):', err);
  }
}

async function triggerPushNotificationForApartmentResidents(
  apartmentId: string,
  payload: { title: string; body: string; type: string; referenceId?: string }
) {
  try {
    const { data: units } = await supabase
      .from('units')
      .select('id, unit_residents(user_id, is_active)')
      .eq('apartment_id', apartmentId);

    const userIds = new Set<string>();
    units?.forEach((u: any) => {
      (u.unit_residents || []).forEach((r: any) => {
        if (r.user_id && r.is_active) {
          userIds.add(r.user_id);
        }
      });
    });

    if (userIds.size > 0) {
      triggerPushNotification({
        userIds: Array.from(userIds),
        ...payload,
      });
    }
  } catch {
    // non-critical
  }
}

/**
 * Belirli bir kullanıcıya doğrudan bildirim gönderir.
 */
export async function createNotificationForUser(params: {
  userId: string;
  apartmentId?: string;
} & NotificationPayload): Promise<void> {
  const { userId, apartmentId, title, body, type, referenceType, referenceId } = params;

  // Cihaz push bildirimini tetikle
  triggerPushNotification({
    userId,
    title,
    body,
    type,
    referenceId,
  });

  try {
    const { data, error } = await supabase.rpc('create_notification_for_user', {
      p_user_id: userId,
      p_apartment_id: apartmentId || null,
      p_title: title,
      p_body: body,
      p_type: type,
      p_reference_type: referenceType || null,
      p_reference_id: referenceId || null,
    });

    if (!error && data?.success) {
      return;
    }
  } catch {
    // Fallback
  }

  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      apartment_id: apartmentId || null,
      title,
      body,
      type,
      reference_type: referenceType || null,
      reference_id: referenceId || null,
      is_read: false,
    });
  } catch (err) {
    console.warn('createNotificationForUser hatası (önemsiz):', err);
  }
}
