import { supabase } from './supabase';

// Team Lead Management Functions
export const teamLead = {
  // Assign a team lead to an order
  assignTeamLead: async (orderId: string, packerId: string) => {
    const { data, error } = await supabase
      .rpc('assign_team_lead', {
        order_uuid: orderId,
        packer_uuid: packerId
      });
    
    return { data, error };
  },

  // Check if a user is team lead for an order
  isTeamLeadForOrder: async (userId: string, orderId: string) => {
    const { data, error } = await supabase
      .rpc('is_team_lead_for_order', {
        user_id: userId,
        order_uuid: orderId
      });
    
    return { data, error };
  },

  // Get team lead for an order
  getOrderTeamLead: async (orderId: string) => {
    const { data, error } = await supabase
      .from('order_team_members')
      .select(`
        packer_id,
        profiles (
          id,
          full_name,
          username
        )
      `)
      .eq('order_id', orderId)
      .eq('is_team_lead', true)
      .single();
    
    return { data, error };
  },

  // Remove team lead status (but keep them as team member)
  removeTeamLead: async (orderId: string) => {
    const { data, error } = await supabase
      .from('order_team_members')
      .update({ is_team_lead: false })
      .eq('order_id', orderId)
      .eq('is_team_lead', true);
    
    return { data, error };
  },

  // Get all orders where a user is team lead
  getUserTeamLeadOrders: async (userId: string) => {
    const { data, error } = await supabase
      .from('order_team_members')
      .select(`
        order_id,
        orders (
          id,
          order_name,
          description,
          production_status,
          clients (
            name
          )
        )
      `)
      .eq('packer_id', userId)
      .eq('is_team_lead', true);
    
    return { data, error };
  },
};

export default teamLead;
