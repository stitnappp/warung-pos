import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RestaurantSettings {
  id: string;
  restaurant_name: string;
  address_line1: string | null;
  address_line2: string | null;
  address_line3: string | null;
  whatsapp_number: string | null;
  instagram_handle: string | null;
  footer_message: string | null;
}

export function useRestaurantSettings() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['restaurant-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as RestaurantSettings | null;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (newSettings: Partial<RestaurantSettings>) => {
      if (!settings?.id) throw new Error('No settings found');

      const { error } = await supabase
        .from('restaurant_settings')
        .update(newSettings)
        .eq('id', settings.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant-settings'] });
      toast.success('Pengaturan berhasil disimpan');
    },
    onError: () => {
      toast.error('Gagal menyimpan pengaturan');
    },
  });

  return {
    settings,
    isLoading,
    updateSettings: updateSettings.mutate,
    isUpdating: updateSettings.isPending,
  };
}
