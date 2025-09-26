import { supabase } from './supabase';

// Types for our inventory system
export interface Material {
  id: string;
  name: string;
  description?: string;
  unit_id?: string;
  created_at?: string;
  unit?: {
    id: string;
    name: string;
    description?: string;
  };
  material_variants?: MaterialVariant[];
  material_tags?: MaterialTag[];
}

export interface MaterialVariant {
  id: string;
  material_id: string;
  variant_name: string;
  description?: string;
  attributes?: Record<string, any>;
  created_at?: string;
  material?: Material;
  supplier_pricing?: SupplierPricing[];
}

export interface SupplierPricing {
  id: string;
  material_variant_id: string;
  supplier_id: string;
  price: number;
  unit_id: string;
  stock_level?: number | null;
  updated_at?: string;
  suppliers?: Supplier;  // API returns 'suppliers' not 'supplier'
  units_of_measure?: UnitOfMeasure;  // API returns 'units_of_measure' not 'unit'
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  other_info?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Tag {
  id: string;
  name: string;
  created_at?: string;
}

export interface MaterialTag {
  material_id: string;
  tag_id: string;
  material?: Material;
  tags?: Tag;  // API returns 'tags' not 'tag'
}

export interface UnitOfMeasure {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

// Database operations for Materials
export const materialOperations = {
  // Get all materials with their units, variants, and tags
  getAll: async () => {
    try {
      // Fetch minimal shapes to avoid PostgREST 400s on missing relationships
      const { data: mats, error: matsErr } = await supabase
        .from('materials')
        .select('id, name, description, unit_id')
        .order('name');
      if (matsErr) return { data: null, error: matsErr };

      const matIds = (mats || []).map((m: any) => m.id);
      let variants: any[] = [];
      let variantPricing: any[] = [];
      if (matIds.length) {
        // Load variants
        const { data: vars, error: varsErr } = await supabase
          .from('material_variants')
          .select('id, material_id, variant_name, description, attributes, created_at')
          .in('material_id', matIds);
        if (varsErr) return { data: null, error: varsErr };
        variants = vars || [];
        
        // Load supplier pricing for all variants
        const variantIds = variants.map(v => v.id);
        if (variantIds.length > 0) {
          const { data: pricing, error: pricingErr } = await supabase
            .from('supplier_pricing')
            .select(`
              id,
              material_variant_id,
              price,
              stock_level,
              updated_at,
              suppliers (
                id,
                name,
                contact_person
              ),
              units_of_measure:unit_id (
                id,
                name,
                description
              )
            `)
            .in('material_variant_id', variantIds)
            .order('price');
          if (!pricingErr) {
            variantPricing = pricing || [];
          }
        }
      }

      const { data: units, error: unitsErr } = await supabase
        .from('units_of_measure')
        .select('id, name, description');
      if (unitsErr) return { data: null, error: unitsErr };
      const unitMap = new Map((units || []).map((u: any) => [u.id, u]));

      const { data: matsTags, error: tagsErr } = await supabase
        .from('material_tags')
        .select('material_id, tag_id, tags(id, name)');
      if (tagsErr) return { data: null, error: tagsErr };
      const tagsByMat = new Map<string, any[]>([]);
      (matsTags || []).forEach((r: any) => {
        const arr = tagsByMat.get(r.material_id) || [];
        arr.push(r.tags);
        tagsByMat.set(r.material_id, arr);
      });

      // Assemble materials with variants and pricing
      const materialRows = (mats || []).map((m: any) => {
        const materialVariants = variants.filter((v: any) => v.material_id === m.id).map((v: any) => ({
          ...v,
          supplier_pricing: variantPricing.filter((p: any) => p.material_variant_id === v.id)
        }));
        
        return {
          id: m.id,
          name: m.name,
          description: m.description,
          unit_id: m.unit_id,
          unit: m.unit_id ? unitMap.get(m.unit_id) || null : null,
          material_variants: materialVariants,
          material_tags: (tagsByMat.get(m.id) || []).map((t: any) => ({ tag_id: t?.id, tags: t }))
        };
      });

      return { data: materialRows, error: null };
    } catch (exception) {
      console.error('Exception in materialOperations.getAll:', exception);
      return { data: null, error: exception };
    }
  },

  // Get material by ID with full details
  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('materials')
      .select(`
        *,
        units_of_measure:unit_id (
          id,
          name,
          description
        ),
        material_variants (
          id,
          variant_name,
          attributes,
          created_at,
          supplier_pricing (
            id,
            price,
            stock_level,
            updated_at,
            suppliers (
              id,
              name,
              contact_person,
              email,
              phone
            ),
            units_of_measure:unit_id (
              id,
              name,
              description
            )
          )
        ),
        material_tags (
          tag_id,
          tags (
            id,
            name
          )
        )
      `)
      .eq('id', id)
      .single();

    return { data, error };
  },

  // Create new material
  create: async (material: Omit<Material, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('materials')
      .insert([material])
      .select()
      .single();

    return { data, error };
  },

  // Update material
  update: async (id: string, material: Partial<Material>) => {
    const { data, error } = await supabase
      .from('materials')
      .update(material)
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  // Delete material (with cascading deletes)
  delete: async (id: string) => {
    console.log('🗑️ materialOperations.delete called with id:', id);
    try {
      // Step 1: Get all material variants for this material
      const { data: variants, error: variantsError } = await supabase
        .from('material_variants')
        .select('id')
        .eq('material_id', id);
      
      if (variantsError) {
        console.error('Error fetching variants:', variantsError);
        return { data: null, error: variantsError };
      }

      // Step 2: Delete supplier pricing for all variants
      if (variants && variants.length > 0) {
        const variantIds = variants.map(v => v.id);
        console.log('💰 Deleting supplier pricing for variants:', variantIds);
        
        const { error: pricingError } = await supabase
          .from('supplier_pricing')
          .delete()
          .in('material_variant_id', variantIds);
        
        if (pricingError) {
          console.error('Error deleting supplier pricing:', pricingError);
          return { data: null, error: pricingError };
        }
      }

      // Step 3: Delete material variants
      console.log('🧩 Deleting material variants...');
      const { error: variantsDeleteError } = await supabase
        .from('material_variants')
        .delete()
        .eq('material_id', id);
      
      if (variantsDeleteError) {
        console.error('Error deleting material variants:', variantsDeleteError);
        return { data: null, error: variantsDeleteError };
      }

      // Step 4: Delete material tags
      console.log('🏷️ Deleting material tags...');
      const { error: tagsDeleteError } = await supabase
        .from('material_tags')
        .delete()
        .eq('material_id', id);
      
      if (tagsDeleteError) {
        console.error('Error deleting material tags:', tagsDeleteError);
        return { data: null, error: tagsDeleteError };
      }

      // Step 5: Finally delete the material
      console.log('🧾 Deleting material...');
      const { data, error } = await supabase
        .from('materials')
        .delete()
        .eq('id', id);

      console.log('🗑️ materialOperations.delete result:', { data, error });
      return { data, error };
    } catch (exception) {
      console.error('💥 Exception in materialOperations.delete:', exception);
      return { data: null, error: exception };
    }
  },

  // Search materials
  search: async (query: string) => {
    const { data, error } = await supabase
      .from('materials')
      .select(`
        *,
        units_of_measure:unit_id (
          id,
          name,
          description
        ),
        material_variants (
          id,
          variant_name,
          attributes
        )
      `)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .order('name');

    return { data, error };
  }
};

// Database operations for Material Variants
export const variantOperations = {
  // Get all variants for a material
  getByMaterialId: async (materialId: string) => {
    const { data, error } = await supabase
      .from('material_variants')
      .select(`
        *,
        materials (
          id,
          name,
          description
        ),
        supplier_pricing (
          id,
          price,
          stock_level,
          updated_at,
          suppliers (
            id,
            name,
            contact_person
          ),
          units_of_measure:unit_id (
            id,
            name,
            description
          )
        )
      `)
      .eq('material_id', materialId)
      .order('variant_name');

    return { data, error };
  },

  // Create new variant
  create: async (variant: Omit<MaterialVariant, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('material_variants')
      .insert([variant])
      .select()
      .single();

    return { data, error };
  },

  // Update variant
  update: async (id: string, variant: Partial<MaterialVariant>) => {
    const { data, error } = await supabase
      .from('material_variants')
      .update(variant)
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  // Delete variant
  delete: async (id: string) => {
    const { data, error } = await supabase
      .from('material_variants')
      .delete()
      .eq('id', id);

    return { data, error };
  },

  // Get variant with tags
  getWithTags: async (variantId: string) => {
    const { data, error } = await supabase
      .from('material_variants')
      .select(`
        *,
        material_variant_tags (
          tag_id,
          tags (
            id,
            name
          )
        )
      `)
      .eq('id', variantId)
      .single();

    return { data, error };
  },

  // Add tags to variant
  addTags: async (variantId: string, tagIds: string[]) => {
    const entries = tagIds.map(tagId => ({
      material_variant_id: variantId,
      tag_id: tagId
    }));

    const { data, error } = await supabase
      .from('material_variant_tags')
      .insert(entries);

    return { data, error };
  },

  // Remove tags from variant
  removeTags: async (variantId: string, tagIds?: string[]) => {
    let query = supabase
      .from('material_variant_tags')
      .delete()
      .eq('material_variant_id', variantId);

    if (tagIds && tagIds.length > 0) {
      query = query.in('tag_id', tagIds);
    }

    const { data, error } = await query;
    return { data, error };
  },

  // Update variant tags (replace all tags)
  updateTags: async (variantId: string, tagIds: string[]) => {
    // First remove all existing tags
    await variantOperations.removeTags(variantId);
    
    // Then add new tags if any
    if (tagIds.length > 0) {
      return await variantOperations.addTags(variantId, tagIds);
    }
    
    return { data: null, error: null };
  }
};

// Database operations for Suppliers
export const supplierOperations = {
  // Get all suppliers
  getAll: async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .order('name');

    return { data, error };
  },

  // Get all variants for a specific supplier with pricing details
  getSupplierVariants: async (supplierId: string) => {
    const { data, error } = await supabase
      .from('supplier_pricing')
      .select(`
        id,
        price,
        stock_level,
        updated_at,
        units_of_measure:unit_id (
          id,
          name,
          description
        ),
        material_variants:material_variant_id (
          id,
          variant_name,
          description,
          attributes,
          materials:material_id (
            id,
            name,
            description
          )
        )
      `)
      .eq('supplier_id', supplierId)
      .order('price');

    return { data, error };
  },

  // Get supplier by ID
  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();

    return { data, error };
  },

  // Create new supplier
  create: async (supplier: Omit<Supplier, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('suppliers')
      .insert([supplier])
      .select()
      .single();

    return { data, error };
  },

  // Update supplier
  update: async (id: string, supplier: Partial<Supplier>) => {
    const { data, error } = await supabase
      .from('suppliers')
      .update({ ...supplier, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  // Delete supplier
  delete: async (id: string) => {
    const { data, error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);

    return { data, error };
  }
};

// Database operations for Supplier Pricing
export const pricingOperations = {
  // Get pricing for a variant
  getByVariantId: async (variantId: string) => {
    const { data, error } = await supabase
      .from('supplier_pricing')
      .select(`
        *,
        suppliers (
          id,
          name,
          contact_person,
          email,
          phone
        ),
        units_of_measure:unit_id (
          id,
          name,
          description
        )
      `)
      .eq('material_variant_id', variantId)
      .order('price');

    return { data, error };
  },

  // Create new pricing
  create: async (pricing: Omit<SupplierPricing, 'id' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('supplier_pricing')
      .insert([pricing])
      .select(`
        *,
        suppliers (
          id,
          name,
          contact_person
        ),
        units_of_measure:unit_id (
          id,
          name,
          description
        )
      `)
      .single();

    return { data, error };
  },

  // Update pricing
  update: async (id: string, pricing: Partial<SupplierPricing>) => {
    const { data, error } = await supabase
      .from('supplier_pricing')
      .update({ ...pricing, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  // Delete pricing
  delete: async (id: string) => {
    const { data, error } = await supabase
      .from('supplier_pricing')
      .delete()
      .eq('id', id);

    return { data, error };
  }
};

// Database operations for Tags
export const tagOperations = {
  // Get all tags
  getAll: async () => {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('name');

    return { data, error };
  },

  // Create new tag
  create: async (tagName: string) => {
    const { data, error } = await supabase
      .from('tags')
      .insert([{ name: tagName }])
      .select()
      .single();

    return { data, error };
  },

  // Delete tag
  delete: async (id: string) => {
    const { data, error } = await supabase
      .from('tags')
      .delete()
      .eq('id', id);

    return { data, error };
  }
};

// Database operations for Material Tags
export const materialTagOperations = {
  // Add tag to material
  addTagToMaterial: async (materialId: string, tagId: string) => {
    const { data, error } = await supabase
      .from('material_tags')
      .insert([{ material_id: materialId, tag_id: tagId }])
      .select();

    return { data, error };
  },

  // Remove tag from material
  removeTagFromMaterial: async (materialId: string, tagId: string) => {
    const { data, error } = await supabase
      .from('material_tags')
      .delete()
      .eq('material_id', materialId)
      .eq('tag_id', tagId);

    return { data, error };
  },

  // Get materials by tag
  getMaterialsByTag: async (tagId: string) => {
    const { data, error } = await supabase
      .from('material_tags')
      .select(`
        materials (
          *,
          units_of_measure:unit_id (
            id,
            name,
            description
          )
        )
      `)
      .eq('tag_id', tagId);

    return { data, error };
  }
};

// Database operations for Units of Measure
export const unitOperations = {
  // Get all units
  getAll: async () => {
    const { data, error } = await supabase
      .from('units_of_measure')
      .select('*')
      .order('name');

    return { data, error };
  },

  // Create new unit
  create: async (unit: Omit<UnitOfMeasure, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('units_of_measure')
      .insert([unit])
      .select()
      .single();

    return { data, error };
  }
};
