import { SupabaseClient } from '@supabase/supabase-js';
import { UUID } from '../types';

export const createServicesApi = (supabase: SupabaseClient) => ({
  getServicesByTag: async (tagName: string) => {
    // First get the tag ID - case insensitive search might be safer but exact match is fine for now
    const { data: tagData, error: tagError } = await supabase
      .from('tags')
      .select('id')
      .ilike('name', tagName)
      .single();

    if (tagError) return { data: null, error: tagError };
    if (!tagData) return { data: [], error: null };

    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('tag_id', tagData.id);

    return { data, error };
  },

  addOrderPackageService: async (
    orderPackageId: UUID,
    serviceId: UUID,
    result: any,
    isFinal: boolean = true
  ) => {
    const { data, error } = await supabase
      .from('order_package_services')
      .insert({
        order_package_id: orderPackageId,
        service_id: serviceId,
        result,
        is_final: isFinal,
      })
      .select()
      .single();

    return { data, error };
  },

  getOrderPackageServices: async (orderPackageId: UUID) => {
    const { data, error } = await supabase
      .from('order_package_services')
      .select(`
        *,
        service:services (
          id,
          service,
          ui_code
        )
      `)
      .eq('order_package_id', orderPackageId)
      .order('created_at', { ascending: true });

    return { data, error };
  },

  deleteOrderPackageService: async (id: UUID) => {
    const { error } = await supabase
      .from('order_package_services')
      .delete()
      .eq('id', id);

    return { error };
  },
});
