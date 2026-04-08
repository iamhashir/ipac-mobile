import type { SupabaseClient } from '@supabase/supabase-js';
import type { UUID } from '../types';

interface FinalDimensionInput {
  orderPackageId: UUID;
  finalInfoId?: UUID | null;
  originalInfoId?: UUID | null;
  scope: string;
  length: number | null;
  width: number | null;
  height: number | null;
}

interface PackageInfoLinkInput {
  orderPackageId: UUID;
  finalInfoId?: UUID | null;
  originalInfoId?: UUID | null;
}

interface PackageItemInput {
  order_package_id?: UUID;
  orderPackageId?: UUID;
  designation: string;
  quantity: number;
  reference?: string | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  net_weight?: number | null;
}

interface OrderPackageMaterialInput {
  order_package_id: UUID;
  material_variant_id: UUID | null;
  material_type: string;
  is_final?: boolean;
  quantity?: number | string | null;
  unit_id?: UUID | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  comment?: string | null;
  item_used?: boolean;
  original?: UUID | null;
  quantity_used?: number | null;
  variant_request_id?: UUID | null;
}

const roundToTwoDecimals = (value: number) => Math.round(value * 100) / 100;

const toNullableNumber = (value?: number | string | null) => {
  if (typeof value === 'number' && Number.isFinite(value)) return roundToTwoDecimals(value);
  if (value === null || value === undefined || value === '') return null;
  const cast = Number(value);
  return Number.isFinite(cast) ? roundToTwoDecimals(cast) : null;
};

const roundNumericFields = (fields: Record<string, unknown>) => {
  const numericFieldNames = new Set([
    'quantity',
    'tare',
    'net_weight',
    'gross_weight',
    'internal_length',
    'internal_width',
    'internal_height',
    'external_length',
    'external_width',
    'external_height',
  ]);

  const rounded: Record<string, unknown> = { ...fields };
  Object.entries(rounded).forEach(([key, value]) => {
    if (!numericFieldNames.has(key)) return;
    if (value === null || value === undefined || value === '') {
      rounded[key] = null;
      return;
    }
    const cast = Number(value);
    rounded[key] = Number.isFinite(cast) ? roundToTwoDecimals(cast) : value;
  });

  return rounded;
};

const normalizePackageItemInput = (input: PackageItemInput) => ({
  order_package_id: input.order_package_id ?? input.orderPackageId ?? null,
  designation: input.designation,
  quantity: input.quantity,
  reference: input.reference?.trim() || null,
  length: toNullableNumber(input.length),
  width: toNullableNumber(input.width),
  height: toNullableNumber(input.height),
  net_weight: toNullableNumber(input.net_weight),
});

const MATERIAL_TYPES = ['Accessories', 'Securing', 'Gas Packing', 'Vacuum Packing'];

const VARIANT_SELECT_WITH_TAGS = `
    id,
    variant_name,
    material_id,
    materials:material_id (
      id,
      unit_id,
      units_of_measure:unit_id ( id, name )
    ),
    material_variant_tags!inner (
      tag_id,
      tags!inner (
        id,
        name
      )
    )
  `;

const mapVariantRowsToOptions = (variants?: any[] | null) => {
  if (!variants || !Array.isArray(variants)) return [];
  const dedup = new Map<string, any>();
  variants.forEach((variant: any) => {
    const id = variant?.id;
    if (!id || dedup.has(id)) return;
    dedup.set(id, {
      id,
      value: id,
      label: variant?.variant_name || variant?.label || 'Unnamed',
      material_id: variant?.material_id || null,
      unit_id: variant?.materials?.unit_id || variant?.unit_id || null,
      unit_name: variant?.materials?.units_of_measure?.name || variant?.unit_name || null,
    });
  });
  return Array.from(dedup.values());
};

export const createPackingApi = (supabase: SupabaseClient) => ({
  getOrderPackages: async (orderId: UUID) => {
    const { data, error } = await supabase
      .from('order_packages')
      .select('*')
      .eq('order_id', orderId);
    return { data, error };
  },

  getPackageInfosByIds: async (ids: UUID[]) => {
    if (!ids || ids.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('package_info')
      .select('id, center_of_gravity, quantity, box_type_id, packing_type_id, sei_category, sei_protection, tare, net_weight, gross_weight, internal_length, internal_width, internal_height, external_length, external_width, external_height')
      .in('id', ids);
    return { data, error };
  },

  upsertFinalDimensions: async ({ orderPackageId, finalInfoId, originalInfoId, scope, length, width, height }: FinalDimensionInput) => {
    if (!finalInfoId && !originalInfoId) {
      return { data: null, error: new Error('Missing package info reference') };
    }

    const targetInfoId = finalInfoId ?? originalInfoId;
    const payload = scope === 'internal'
      ? {
          internal_length: toNullableNumber(length),
          internal_width: toNullableNumber(width),
          internal_height: toNullableNumber(height),
        }
      : {
          external_length: toNullableNumber(length),
          external_width: toNullableNumber(width),
          external_height: toNullableNumber(height),
        };

    const { data, error } = await supabase
      .from('package_info')
      .update(payload)
      .eq('id', targetInfoId as UUID)
      .select('id')
      .single();

    if (error) return { data: null, error };

    return {
      data: {
        orderPackageId,
        finalInfoId: finalInfoId ?? null,
        originalInfoId: originalInfoId ?? null,
      },
      error: null,
    };
  },

  getMaterialsByIds: async (ids: UUID[]) => {
    if (!ids || ids.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('materials')
      .select('id, name, unit_id')
      .in('id', ids);
    return { data, error };
  },

  getBoxTypesByIds: async (ids: UUID[]) => {
    if (!ids || ids.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('box_type')
      .select('id, name')
      .in('id', ids);
    return { data, error };
  },

  getPackingTypesByIds: async (ids: UUID[]) => {
    if (!ids || ids.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('packing_types')
      .select('id, code, name, includes_gas_protection, includes_vacuum_protection')
      .in('id', ids);
    return { data, error };
  },

  getAllBoxTypes: async () => {
    const { data, error } = await supabase
      .from('box_type')
      .select('id, name')
      .order('name');
    return { data, error };
  },

  getAllMaterials: async () => {
    const { data, error } = await supabase
      .from('materials')
      .select('id, name, unit_id')
      .order('name');
    return { data, error };
  },

  getAllUnits: async () => {
    const { data, error } = await supabase
      .from('units_of_measure')
      .select('id, name, description')
      .order('name');
    return { data, error };
  },

  getMaterialVariantsByTag: async (tagName: string) => {
    const { data, error } = await supabase
      .from('material_variants')
      .select(VARIANT_SELECT_WITH_TAGS)
      .ilike('material_variant_tags.tags.name', tagName)
      .order('variant_name');

    if (error) return { data: null, error };

    return { data: mapVariantRowsToOptions(data), error: null };
  },

  getMaterialVariantsByVariantTag: async (tagName: string) => {
    const { data, error } = await supabase
      .from('material_variants')
      .select(VARIANT_SELECT_WITH_TAGS)
      .ilike('material_variant_tags.tags.name', tagName)
      .order('variant_name');

    if (error) return { data: null, error };

    return { data: mapVariantRowsToOptions(data), error: null };
  },

  getMaterialVariantsByMaterialName: async (materialName: string) => {
    const { data, error } = await supabase
      .from('materials')
      .select('id')
      .ilike('name', `%${materialName}%`);

    if (error) return { data: null, error };

    const materialIds = Array.from(new Set((data || []).map((row: any) => row.id).filter(Boolean)));
    if (!materialIds.length) return { data: [], error: null };

    const { data: variants, error: variantsErr } = await supabase
      .from('material_variants')
      .select(`
        id,
        variant_name,
        material_id,
        materials:material_id (
          id,
          unit_id,
          units_of_measure:unit_id ( id, name )
        )
      `)
      .in('material_id', materialIds)
      .order('variant_name');

    if (variantsErr) return { data: null, error: variantsErr };

    const items = (variants || []).map((variant: any) => ({
      id: variant.id,
      value: variant.id,
      label: variant.variant_name,
      material_id: variant.material_id,
      unit_id: variant?.materials?.unit_id || null,
      unit_name: variant?.materials?.units_of_measure?.name || null,
    }));

    return { data: items, error: null };
  },

  getMaterialVariantsByMaterialExactName: async (materialName: string) => {
    const { data: materials, error: materialsErr } = await supabase
      .from('materials')
      .select('id, name, unit_id, units_of_measure:unit_id ( id, name )')
      .ilike('name', materialName);

    if (materialsErr) return { data: null, error: materialsErr };
    const materialIds = Array.from(new Set((materials || []).map((row: any) => row.id).filter(Boolean)));
    if (!materialIds.length) return { data: [], error: null };

    const { data: variants, error: variantsErr } = await supabase
      .from('material_variants')
      .select(`
        id,
        variant_name,
        material_id,
        materials:material_id (
          id,
          unit_id,
          units_of_measure:unit_id ( id, name )
        )
      `)
      .in('material_id', materialIds)
      .order('variant_name');

    if (variantsErr) return { data: null, error: variantsErr };

    const items = (variants || []).map((variant: any) => ({
      id: variant.id,
      value: variant.id,
      label: variant.variant_name,
      material_id: variant.material_id,
      unit_id: variant?.materials?.unit_id || null,
      unit_name: variant?.materials?.units_of_measure?.name || null,
    }));

    return { data: items, error: null };
  },

  getOrderPackageMaterials: async (orderPackageId: UUID) => {
    const { data, error } = await supabase
      .from('order_package_materials')
      .select('id, order_package_id, material_variant_id, variant_request_id, material_type, quantity, quantity_used, unit_id, length, width, height, comment, item_used')
      .eq('order_package_id', orderPackageId)
      .order('created_at', { ascending: true });
    return { data, error };
  },

  addOrderPackageMaterial: async (payload: OrderPackageMaterialInput) => {
    const canonType = (() => {
      const normalized = String(payload.material_type || '').trim().toLowerCase();
      const match = MATERIAL_TYPES.find((type) => type.toLowerCase() === normalized);
      return match || (payload.material_type || 'Accessories');
    })();

    const asNumber = (value?: number | string | null) => {
      if (typeof value === 'number' && Number.isFinite(value)) return roundToTwoDecimals(value);
      if (value === null || value === undefined || value === '') return null;
      const cast = Number(value);
      return Number.isFinite(cast) ? roundToTwoDecimals(cast) : null;
    };

    const row = {
      order_package_id: payload.order_package_id,
      material_variant_id: payload.material_variant_id ?? null,
      material_type: canonType,
      is_final: payload.is_final ?? false,
      quantity: asNumber(payload.quantity) ?? 0,
      unit_id: payload.unit_id ?? null,
      length: asNumber(payload.length),
      width: asNumber(payload.width),
      height: asNumber(payload.height),
      comment: payload.comment ?? null,
      item_used: payload.item_used ?? false,
      original: payload.original ?? null,
      quantity_used: asNumber(payload.quantity_used),
      variant_request_id: payload.variant_request_id ?? null,
    };

    const { data, error } = await supabase
      .from('order_package_materials')
      .insert(row)
      .select('id, order_package_id, material_variant_id, variant_request_id, material_type, quantity, quantity_used, unit_id, length, width, height, comment, item_used')
      .single();
    return { data, error };
  },

  updateOrderPackageMaterial: async (id: UUID, fields: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('order_package_materials')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .single();
    return { data, error };
  },

  deleteOrderPackageMaterial: async (id: UUID) => {
    const { data, error } = await supabase
      .from('order_package_materials')
      .delete()
      .eq('id', id)
      .select('id')
      .single();
    return { data, error };
  },

  uploadOrderPackageImage: async (orderPackageId: UUID, fileUri: string) => {
    try {
      const resp = await fetch(fileUri);
      const blob = await resp.blob();
      const extGuess = blob?.type?.includes('png') ? 'png' : 'jpg';
      const filename = `${orderPackageId}/${Date.now()}.${extGuess}`;
      const { data, error } = await supabase
        .storage
        .from('order_media')
        .upload(filename, blob, { contentType: blob?.type || 'image/jpeg', upsert: true });
      if (error) return { data: null, error };
      const { data: pub } = await supabase.storage.from('order_media').getPublicUrl(filename);
      return { data: { path: data?.path || filename, publicUrl: pub?.publicUrl || null }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },

  addPackageItem: async (input: PackageItemInput) => {
    const normalized = normalizePackageItemInput(input);
    if (!normalized.order_package_id) {
      return { data: null, error: new Error('order_package_id is required') };
    }

    const { data, error } = await supabase
      .from('package_items')
      .insert({
        order_package_id: normalized.order_package_id,
        designation: normalized.designation,
        quantity: normalized.quantity,
        reference: normalized.reference,
        length: normalized.length,
        width: normalized.width,
        height: normalized.height,
        net_weight: normalized.net_weight,
      })
      .select('id, order_package_id, designation, quantity, reference, length, width, height, net_weight')
      .single();
    return { data, error };
  },

  updatePackageInfo: async (id: UUID, fields: Record<string, unknown>) => {
    const normalized = roundNumericFields(fields);
    const { error } = await supabase
      .from('package_info')
      .update({ ...normalized })
      .eq('id', id);
    return { data: { id }, error };
  },

  ensureFinalPackageInfo: async ({ orderPackageId, finalInfoId }: PackageInfoLinkInput) => {
    if (finalInfoId) return { data: { id: finalInfoId }, error: null };

    const { data: created, error: createErr } = await supabase
      .from('package_info')
      .insert({
        quantity: null,
        center_of_gravity: null,
        box_type_id: null,
        packing_type_id: null,
        tare: null,
        net_weight: null,
        gross_weight: null,
        internal_length: null,
        internal_width: null,
        internal_height: null,
        external_length: null,
        external_width: null,
        external_height: null,
        boxes_completed: 0,
      })
      .select('id')
      .single();

    if (createErr || !created) {
      return { data: null, error: createErr };
    }

    const { error: linkErr } = await supabase
      .from('order_packages')
      .update({ final_pkg_info: created.id })
      .eq('id', orderPackageId);

    if (linkErr) {
      return { data: null, error: linkErr };
    }

    return { data: { id: created.id }, error: null };
  },

  ensureOriginalPackageInfo: async ({ orderPackageId, originalInfoId }: PackageInfoLinkInput) => {
    if (originalInfoId) return { data: { id: originalInfoId }, error: null };

    const { data: created, error: createErr } = await supabase
      .from('package_info')
      .insert({
        quantity: null,
        center_of_gravity: null,
        box_type_id: null,
        packing_type_id: null,
        tare: null,
        net_weight: null,
        gross_weight: null,
        internal_length: null,
        internal_width: null,
        internal_height: null,
        external_length: null,
        external_width: null,
        external_height: null,
        boxes_completed: 0,
      })
      .select('id')
      .single();

    if (createErr || !created) {
      return { data: null, error: createErr };
    }

    const { error: linkErr } = await supabase
      .from('order_packages')
      .update({ original_pkg_info: created.id })
      .eq('id', orderPackageId);

    if (linkErr) {
      return { data: null, error: linkErr };
    }

    return { data: { id: created.id }, error: null };
  },

  getSecuringForPackage: async (orderPackageId: UUID) => {
    const { data, error } = await supabase
      .from('order_package_securing')
      .select(`
        id,
        securing_side,
        is_final,
        securing_template:securing_template(
          id, quantity, type_id, thickness,
          horizontal_bar:beam!securing_template_horizontal_bar_fkey(id, quantity, type, width, thickness, space),
          vertical_bar:beam!securing_template_vertical_bar_fkey(id, quantity, type, width, thickness, space),
          skids:beam!securing_template_skids_fkey(id, quantity, type, width, thickness, space)
        )
      `)
      .eq('order_package_id', orderPackageId);
    return { data, error };
  },

  updateSecuringTemplate: async (templateId: UUID, fields: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('securing_template')
      .update({ ...fields })
      .eq('id', templateId)
      .select('id')
      .maybeSingle();

    if (error && (error as any).code === '409') {
      const { data: retryData, error: retryError } = await supabase
        .from('securing_template')
        .update({ ...fields })
        .eq('id', templateId)
        .select('id')
        .maybeSingle();
      return { data: retryData || { id: templateId }, error: retryError };
    }

    return { data: data || { id: templateId }, error };
  },

  updateBeam: async (beamId: UUID, fields: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from('beam')
      .update({ ...fields })
      .eq('id', beamId)
      .select('id')
      .maybeSingle();

    if (error && (error as any).code === '409') {
      const { data: retryData, error: retryError } = await supabase
        .from('beam')
        .update({ ...fields })
        .eq('id', beamId)
        .select('id')
        .maybeSingle();
      return { data: retryData || { id: beamId }, error: retryError };
    }

    return { data: data || { id: beamId }, error };
  },

  ensureUniqueTemplateForSide: async (orderPackageId: UUID, side: string, isFinal: boolean) => {
    const { data: rows, error } = await supabase
      .from('order_package_securing')
      .select(`
        id,
        securing_template_id,
        securing_template:securing_template(
          id, quantity, type_id, thickness,
          horizontal_bar:beam!securing_template_horizontal_bar_fkey(id, quantity, type, width, thickness, space),
          vertical_bar:beam!securing_template_vertical_bar_fkey(id, quantity, type, width, thickness, space),
          skids:beam!securing_template_skids_fkey(id, quantity, type, width, thickness, space)
        )
      `)
      .eq('order_package_id', orderPackageId)
      .eq('securing_side', side)
      .eq('is_final', isFinal)
      .limit(1);

    if (error || !rows || !rows.length) return { data: null, error };
    const current = rows[0] as any;
    const templateId = current.securing_template_id;

    if (!templateId) {
      const { data: hb } = await supabase.from('beam').insert({}).select('id').single();
      const { data: vb } = await supabase.from('beam').insert({}).select('id').single();
      let skId: UUID | null = null;
      if (side === 'base') {
        const { data: sk } = await supabase.from('beam').insert({}).select('id').single();
        skId = (sk?.id as UUID) || null;
      }
      const payload: Record<string, unknown> = {
        quantity: null,
        type_id: null,
        thickness: null,
        horizontal_bar: hb?.id || null,
        vertical_bar: vb?.id || null,
      };
      if (skId) payload.skids = skId;

      const { data: newTemplate, error: newErr } = await supabase
        .from('securing_template')
        .insert(payload)
        .select('id')
        .single();
      if (newErr || !newTemplate) return { data: null, error: newErr };

      const { error: linkErr } = await supabase
        .from('order_package_securing')
        .update({ securing_template_id: newTemplate.id })
        .eq('id', current.id);
      if (linkErr) return { data: null, error: linkErr };

      return { data: { id: newTemplate.id, created: true }, error: null };
    }

    const { data: refs, error: refErr } = await supabase
      .from('order_package_securing')
      .select('id')
      .eq('securing_template_id', templateId);
    if (refErr) return { data: null, error: refErr };
    if ((refs || []).length <= 1) return { data: { id: templateId, unchanged: true }, error: null };

    const cloneBeam = async (beam: any) => {
      if (!beam?.id) return null;
      const { data: newBeam, error: beamErr } = await supabase
        .from('beam')
        .insert({
          quantity: beam.quantity ?? null,
          type: beam.type ?? null,
          width: beam.width ?? null,
          thickness: beam.thickness ?? null,
          space: beam.space ?? null,
        })
        .select('id')
        .single();
      if (beamErr) throw beamErr;
      return newBeam?.id ?? null;
    };

    let horizontal: UUID | null = null;
    let vertical: UUID | null = null;
    let skids: UUID | null = null;
    try {
      horizontal = await cloneBeam(current.securing_template?.horizontal_bar);
      vertical = await cloneBeam(current.securing_template?.vertical_bar);
      if (side === 'base' && current.securing_template?.skids) {
        skids = await cloneBeam(current.securing_template.skids);
      }
    } catch (cloneError) {
      return { data: null, error: cloneError };
    }

    const payload: Record<string, unknown> = {
      quantity: current.securing_template?.quantity ?? null,
      type_id: current.securing_template?.type_id ?? null,
      thickness: current.securing_template?.thickness ?? null,
      horizontal_bar: horizontal,
      vertical_bar: vertical,
    };
    if (skids) payload.skids = skids;

    const { data: newTemplate, error: tmplErr } = await supabase
      .from('securing_template')
      .insert(payload)
      .select('id')
      .single();
    if (tmplErr || !newTemplate) return { data: null, error: tmplErr };

    const { error: updateErr } = await supabase
      .from('order_package_securing')
      .update({ securing_template_id: newTemplate.id })
      .eq('id', current.id);
    if (updateErr) return { data: null, error: updateErr };

    return { data: { id: newTemplate.id, cloned: true }, error: null };
  },

  ensureFinalSecuringForPackage: async (orderPackageId: UUID) => {
    const { data: rows, error } = await supabase
      .from('order_package_securing')
      .select('id, securing_side, is_final')
      .eq('order_package_id', orderPackageId);
    if (error) return { data: null, error };

    const sides = ['big_sides', 'small_sides', 'lid', 'base'] as const;
    const hasOriginal: Record<string, boolean> = {};
    const hasFinal: Record<string, boolean> = {};

    (rows || []).forEach((row: any) => {
      if (row.is_final) {
        hasFinal[row.securing_side] = true;
      } else {
        hasOriginal[row.securing_side] = true;
      }
    });

    for (const side of sides) {
      if (hasOriginal[side] && !hasFinal[side]) {
        const { data: hb } = await supabase.from('beam').insert({}).select('id').single();
        const { data: vb } = await supabase.from('beam').insert({}).select('id').single();
        let skId: UUID | null = null;
        if (side === 'base') {
          const { data: sk } = await supabase.from('beam').insert({}).select('id').single();
          skId = (sk?.id as UUID) || null;
        }

        const payload: Record<string, unknown> = {
          quantity: null,
          type_id: null,
          thickness: null,
          horizontal_bar: hb?.id || null,
          vertical_bar: vb?.id || null,
        };
        if (skId) payload.skids = skId;

        const { data: tmpl, error: tmplErr } = await supabase
          .from('securing_template')
          .insert(payload)
          .select('id')
          .single();
        if (tmplErr) return { data: null, error: tmplErr };

        const { error: secErr } = await supabase
          .from('order_package_securing')
          .insert({
            order_package_id: orderPackageId,
            securing_template_id: tmpl?.id,
            securing_side: side,
            is_final: true,
          })
          .select('id')
          .single();
        if (secErr) return { data: null, error: secErr };
      }
    }

    return { data: { ensured: true }, error: null };
  },

  decoupleAndClearFinalTemplates: async (orderPackageId: UUID) => {
    const { data: rows, error } = await supabase
      .from('order_package_securing')
      .select('id, securing_side, is_final, securing_template_id')
      .eq('order_package_id', orderPackageId);
    if (error) return { data: null, error };

    const counts: Record<string, number> = {};
    (rows || []).forEach((row: any) => {
      if (row.securing_template_id) {
        counts[row.securing_template_id] = (counts[row.securing_template_id] || 0) + 1;
      }
    });

    for (const row of rows || []) {
      if (!row.is_final) continue;
      const tmplId = row.securing_template_id;
      const needsNew = !tmplId || (counts[tmplId] || 0) > 1;
      if (!needsNew) continue;

      const { data: hb } = await supabase.from('beam').insert({}).select('id').single();
      const { data: vb } = await supabase.from('beam').insert({}).select('id').single();
      let skId: UUID | null = null;
      if (row.securing_side === 'base') {
        const { data: sk } = await supabase.from('beam').insert({}).select('id').single();
        skId = (sk?.id as UUID) || null;
      }

      const payload: Record<string, unknown> = {
        quantity: null,
        type_id: null,
        thickness: null,
        horizontal_bar: hb?.id || null,
        vertical_bar: vb?.id || null,
      };
      if (skId) payload.skids = skId;

      const { data: newTemplate, error: newErr } = await supabase
        .from('securing_template')
        .insert(payload)
        .select('id')
        .single();
      if (newErr || !newTemplate) return { data: null, error: newErr };

      const { error: linkErr } = await supabase
        .from('order_package_securing')
        .update({ securing_template_id: newTemplate.id })
        .eq('id', row.id);
      if (linkErr) return { data: null, error: linkErr };
    }

    return { data: { normalized: true }, error: null };
  },

  ensureSecuringRowForSide: async (orderPackageId: UUID, side: string, isFinal: boolean) => {
    const { data: existing, error } = await supabase
      .from('order_package_securing')
      .select('id, securing_template_id')
      .eq('order_package_id', orderPackageId)
      .eq('securing_side', side)
      .eq('is_final', isFinal)
      .limit(1);
    if (error) return { data: null, error };
    if (existing && existing.length) return { data: existing[0], error: null };

    const { data: hb } = await supabase.from('beam').insert({}).select('id').single();
    const { data: vb } = await supabase.from('beam').insert({}).select('id').single();
    let skId: UUID | null = null;
    if (side === 'base') {
      const { data: sk } = await supabase.from('beam').insert({}).select('id').single();
      skId = (sk?.id as UUID) || null;
    }

    const payload: Record<string, unknown> = {
      quantity: null,
      type_id: null,
      thickness: null,
      horizontal_bar: hb?.id || null,
      vertical_bar: vb?.id || null,
    };
    if (skId) payload.skids = skId;

    const { data: template, error: tmplErr } = await supabase
      .from('securing_template')
      .insert(payload)
      .select('id')
      .single();
    if (tmplErr) return { data: null, error: tmplErr };

    const { data: created, error: insertErr } = await supabase
      .from('order_package_securing')
      .insert({
        order_package_id: orderPackageId,
        securing_template_id: template?.id,
        securing_side: side,
        is_final: isFinal,
      })
      .select('id, securing_template_id')
      .single();
    return { data: created, error: insertErr };
  },

  ensureOriginalSecuringForPackage: async (orderPackageId: UUID) => {
    const { data: rows, error } = await supabase
      .from('order_package_securing')
      .select('id, securing_side, is_final')
      .eq('order_package_id', orderPackageId);
    if (error) return { data: null, error };

    const sides = ['big_sides', 'small_sides', 'lid', 'base'] as const;
    const hasOriginal: Record<string, boolean> = {};
    (rows || []).forEach((row: any) => {
      if (!row.is_final) hasOriginal[row.securing_side] = true;
    });

    for (const side of sides) {
      if (!hasOriginal[side]) {
        const { data: hb } = await supabase.from('beam').insert({}).select('id').single();
        const { data: vb } = await supabase.from('beam').insert({}).select('id').single();
        let skId: UUID | null = null;
        if (side === 'base') {
          const { data: sk } = await supabase.from('beam').insert({}).select('id').single();
          skId = (sk?.id as UUID) || null;
        }
        const payload: Record<string, unknown> = {
          quantity: null,
          type_id: null,
          thickness: null,
          horizontal_bar: hb?.id || null,
          vertical_bar: vb?.id || null,
        };
        if (skId) payload.skids = skId;
        const { data: template, error: tmplErr } = await supabase
          .from('securing_template')
          .insert(payload)
          .select('id')
          .single();
        if (tmplErr) return { data: null, error: tmplErr };

        const { error: secErr } = await supabase
          .from('order_package_securing')
          .insert({
            order_package_id: orderPackageId,
            securing_template_id: template?.id,
            securing_side: side,
            is_final: false,
          })
          .select('id')
          .single();
        if (secErr) return { data: null, error: secErr };
      }
    }

    return { data: { ensured: true }, error: null };
  },

  getPackageItemsByOrderPackageIds: async (orderPackageIds: UUID[]) => {
    if (!orderPackageIds || orderPackageIds.length === 0) return { data: [], error: null };
    const { data, error } = await supabase
      .from('package_items')
      .select('id, order_package_id, designation, quantity, reference, length, width, height, net_weight')
      .in('order_package_id', orderPackageIds);
    return { data, error };
  },

  deleteOrderPackage: async (packageId: UUID) => {
    const { data, error } = await supabase
      .rpc('delete_order_package_cascade', { package_id_param: packageId });
    return { data, error };
  },
});

export type PackingApi = ReturnType<typeof createPackingApi>;
