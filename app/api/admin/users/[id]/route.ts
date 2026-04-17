// CocoaTrack V2 - Admin User Management API Route
// DELETE /api/admin/users/[id] - Désactive ou supprime un utilisateur (admin only)

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { addSecurityHeaders, getClientIP } from '@/lib/security/middleware';

function errorResponse(message: string, status: number) {
  const response = NextResponse.json({ success: false, error: message }, { status });
  addSecurityHeaders(response);
  return response;
}

/**
 * DELETE /api/admin/users/[id]
 * 
 * Désactive un utilisateur (is_active = false) et révoque sa session.
 * La suppression définitive est évitée car l'utilisateur peut avoir des données liées
 * (livraisons, parcelles, etc.) avec des FK NOT NULL sur created_by.
 * 
 * Un admin ne peut pas se désactiver lui-même.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: targetUserId } = await params;

    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) return errorResponse('Non authentifié', 401);

    // Vérifier que l'appelant est admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single<{ role: string }>();

    if (profile?.role !== 'admin') return errorResponse('Accès non autorisé', 403);

    // Empêcher l'auto-désactivation
    if (user.id === targetUserId) {
      return errorResponse('Vous ne pouvez pas supprimer votre propre compte', 400);
    }

    const adminClient = createAdminClient();

    // Vérifier que l'utilisateur cible existe
    const { data: targetUserData, error: fetchError } = await adminClient.auth.admin.getUserById(targetUserId);
    if (fetchError || !targetUserData.user) return errorResponse('Utilisateur non trouvé', 404);

    // Empêcher la désactivation d'un autre admin
    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', targetUserId)
      .single<{ role: string }>();

    if (targetProfile?.role === 'admin') {
      return errorResponse('Impossible de désactiver un autre administrateur', 403);
    }

    // 1. Désactiver le profil (soft delete)
    const { error: deactivateError } = await adminClient
      .from('profiles')
      .update({ is_active: false })
      .eq('id', targetUserId);

    if (deactivateError) {
      console.error('Error deactivating profile:', deactivateError);
      return errorResponse('Erreur lors de la désactivation', 500);
    }

    // 2. Révoquer toutes les sessions actives de l'utilisateur
    await adminClient.auth.admin.signOut(targetUserId, 'global').catch(() => {
      // Non bloquant si ça échoue
    });

    // 3. Log dans audit_logs
    const ipAddress = getClientIP(request);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient as any).from('audit_logs').insert({
        actor_id: user.id,
        actor_type: 'user',
        table_name: 'profiles',
        row_id: targetUserId,
        action: 'UPDATE',
        old_data: { is_active: true },
        new_data: { is_active: false, deactivated_by_admin: user.id },
        ip_address: ipAddress,
      });
    } catch {
      // Non bloquant
    }

    const response = NextResponse.json({ success: true, deactivated: true });
    addSecurityHeaders(response);
    return response;

  } catch (error) {
    console.error('Unexpected error in DELETE /api/admin/users/[id]:', error);
    return errorResponse('Erreur interne du serveur', 500);
  }
}
