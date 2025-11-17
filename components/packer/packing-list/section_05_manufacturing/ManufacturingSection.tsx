import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import GroupBox from '../common/GroupBox';
import TwoTierEditableCard from '../common/TwoTierEditableCard';
import OrderPackageMaterialsSection, { VariantSource } from '../shared/materials/OrderPackageMaterialsSection';
import { db } from '../../../../utils/api/supabase';
import { useTextSize } from '../../../../utils/TextSizeContext';

interface DimensionTriple {
  length: number | null;
  width: number | null;
  height: number | null;
}

interface InternalDimensionsProp {
  original: DimensionTriple | null;
  final: DimensionTriple | null;
}

interface ManufacturingSectionProps {
  orderPackageId: string;
  internalDimensions?: InternalDimensionsProp | null;
}

 type Side = 'big_sides' | 'small_sides' | 'lid' | 'base';

const SIDE_LABELS: Record<Side, string> = {
  big_sides: 'Big Sides',
  small_sides: 'Small Sides',
  lid: 'Lid',
  base: 'Base',
};

const ADDITIONAL_WOOD_MATERIAL_TYPES: Record<Side, string> = {
  big_sides: SIDE_LABELS.big_sides,
  small_sides: SIDE_LABELS.small_sides,
  lid: SIDE_LABELS.lid,
  base: SIDE_LABELS.base,
};

const MEDIA_DESIGNATION_MAP: Record<Side, string> = {
  big_sides: 'big_side',
  small_sides: 'small_side',
  lid: 'lid',
  base: 'base',
};

const ADDITIONAL_WOOD_THRESHOLD = 400;
const ADDITIONAL_WOOD_VARIANT_SOURCES: VariantSource[] = [{ type: 'variantTag', value: 'Wood' }];

const dimensionExceedsThreshold = (dims: DimensionTriple | null | undefined) => {
  if (!dims) return false;
  return [dims.length, dims.width, dims.height].some(
    (value) => typeof value === 'number' && value >= ADDITIONAL_WOOD_THRESHOLD
  );
};
 
 const smallWidth = 160;
 const typeWideWidth = 240;
 
 const ManufacturingSection: React.FC<ManufacturingSectionProps & { editTarget?: 'original' | 'final'; editable?: boolean; autoSave?: boolean }> = ({ orderPackageId, editTarget = 'final', editable = true, autoSave = true, internalDimensions }) => {
  const { size } = useTextSize();
  const [fetchedDimensions, setFetchedDimensions] = useState<InternalDimensionsProp | null>(internalDimensions ?? null);
  const effectiveDimensions = internalDimensions ?? fetchedDimensions;
  const dimensionBasis = effectiveDimensions?.final ?? effectiveDimensions?.original ?? null;
  const shouldShowAdditionalWood = useMemo(() => dimensionExceedsThreshold(dimensionBasis), [dimensionBasis]);
  // Separate variant lists for different sections
  const [bodyVariants, setBodyVariants] = useState<{ label: string; value: string }[]>([]);
  const [barVariants, setBarVariants] = useState<{ label: string; value: string }[]>([]);
  const [woodVariants, setWoodVariants] = useState<{ label: string; value: string }[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Side>('big_sides');
  // Simplified tabs: remove horizontal ScrollView state to avoid jitter
  // Pending changes when autoSave is disabled (keyed by side)
  const [pending, setPending] = useState<Partial<Record<Side, { template?: any; beams?: Partial<Record<'horizontal_bar' | 'vertical_bar' | 'skids', any>> }>>>({});

  useEffect(() => {
    if (internalDimensions) return;
    let isMounted = true;
    const loadDimensions = async () => {
      const { data, error } = await db.getOrderPackageInternalDimensions(orderPackageId);
      if (!isMounted) return;
      if (error) {
        console.warn('➡️ Manufacturing: unable to load internal dimensions', error);
        setFetchedDimensions(null);
        return;
      }
      setFetchedDimensions(data || { original: null, final: null });
    };
    loadDimensions();
    return () => {
      isMounted = false;
    };
  }, [orderPackageId, internalDimensions]);

  const handleCameraPress = async () => {
    Alert.alert('Attach image', 'Choose source', [
      { text: 'Gallery', onPress: pickFromGallery },
      { text: 'Camera', onPress: takePhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Media library access is needed.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ 
      mediaTypes: ImagePicker.MediaTypeOptions.Images, 
      quality: 0.8 
    });
    if (!res.canceled && res.assets && res.assets.length) {
      await uploadAsset(res.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!res.canceled && res.assets && res.assets.length) {
      await uploadAsset(res.assets[0].uri);
    }
  };

  const uploadAsset = async (uri: string) => {
    try {
      const designation = MEDIA_DESIGNATION_MAP[activeTab];
      const sideLabel = activeTab.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
      const notes = `Manufacturing - ${sideLabel}`;
      
      const { data, error } = await db.uploadMediaToStorage(orderPackageId, uri, designation, notes);
      if (error) {
        Alert.alert('Upload failed', 'Could not upload image to storage.');
      } else {
        Alert.alert('Uploaded', 'Image uploaded successfully.');
      }
    } catch (e) {
      Alert.alert('Upload error', 'Unexpected error while uploading.');
    }
  };

  // Compute pending state by side for unsaved indicator
  const pendingBySide = useMemo(() => {
    const sides: Side[] = ['big_sides','small_sides','lid','base'];
    const map: Record<Side, boolean> = { big_sides: false, small_sides: false, lid: false, base: false };
    sides.forEach((s) => {
      const p = (pending as any)[s];
      if (!p) return;
      const hasTemplate = p.template && Object.keys(p.template).length > 0;
      const hasBeams = p.beams && Object.values(p.beams).some((b: any) => b && Object.keys(b).length > 0);
      map[s] = !!(hasTemplate || hasBeams);
    });
    return map;
  }, [pending]);
  const anyPending = useMemo(() => Object.values(pendingBySide).some(Boolean), [pendingBySide]);

  useEffect(() => {
    const init = async () => {
      // Load variants by their respective variant tags
      const [bodyRes, barRes, woodRes, securingData] = await Promise.all([
        db.getMaterialVariantsByVariantTag('Body'),
        db.getMaterialVariantsByVariantTag('Bar'),
        db.getMaterialVariantsByVariantTag('Wood'),
        db.getSecuringForPackage(orderPackageId)
      ]);
      
      setBodyVariants((bodyRes.data || []).map((v: any) => ({ label: v.label, value: v.id || v.value })));
      setBarVariants((barRes.data || []).map((v: any) => ({ label: v.label, value: v.id || v.value })));
      setWoodVariants((woodRes.data || []).map((v: any) => ({ label: v.label, value: v.id || v.value })));
      setData(securingData.data || []);
    };
    init();
  }, [orderPackageId]);

  const bySide = useMemo(() => {
    const map: Record<Side, { original: any | null; final: any | null }> = {
      big_sides: { original: null, final: null },
      small_sides: { original: null, final: null },
      lid: { original: null, final: null },
      base: { original: null, final: null },
    };
    (data || []).forEach((row: any) => {
      const key = row.securing_side as Side;
      if (!key) return;
      if (row.is_final) map[key].final = row;
      else map[key].original = row;
    });
    return map;
  }, [data]);

  const templateField = (row: any, field: string) => row?.securing_template ? row.securing_template[field] : null;
  
  // Helper to find variant label from any of the three variant lists
  const variantLabelById = (id: string | null | undefined, variantList?: { label: string; value: string }[]) => {
    if (!id) return '—';
    // If specific list provided, search only that list
    if (variantList) {
      const item = variantList.find(m => m.value === id);
      return item?.label || '—';
    }
    // Otherwise search all lists
    const allVariants = [...bodyVariants, ...barVariants, ...woodVariants];
    const item = allVariants.find(m => m.value === id);
    return item?.label || '—';
  };

  const handleTabPress = (tab: Side, index: number) => {
    // With simplified content rendering, just switch the tab
    setActiveTab(tab);
  };

  // Add keyboard navigation support for web
  useEffect(() => {
    const currentTabs = [
      { key: 'big_sides', label: 'Big Sides' },
      { key: 'small_sides', label: 'Small Sides' },
      { key: 'lid', label: 'Lid' },
      { key: 'base', label: 'Base' },
    ];
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const currentIndex = currentTabs.findIndex(tab => tab.key === activeTab);
        let newIndex;
        
        if (event.key === 'ArrowLeft') {
          newIndex = Math.max(0, currentIndex - 1);
        } else {
          newIndex = Math.min(currentTabs.length - 1, currentIndex + 1);
        }
        
        if (newIndex !== currentIndex && newIndex >= 0) {
          handleTabPress(currentTabs[newIndex].key as Side, newIndex);
        }
      }
    };

    // Only add keyboard listener on web platforms (avoid RN where window.addEventListener is undefined)
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      typeof (window as any).addEventListener === 'function'
    ) {
      window.addEventListener('keydown', handleKeyDown as any);
      return () => window.removeEventListener('keydown', handleKeyDown as any);
    }
  }, [activeTab]);

  const renderSideContent = (side: Side) => {
  const orig = bySide[side].original;
  const fin = bySide[side].final;
    const tmplOrig = orig?.securing_template;
    const tmplFin = fin?.securing_template;
  const horizontalTitle = side === 'base' ? 'Beams Length' : 'Horizontal bars';
  const verticalTitle = side === 'base' ? 'Beams Filling' : 'Vertical bars';

    const saveTemplate = async (fields: any) => {
      if (!editable) return;
      const isFinal = editTarget === 'final';

      if (!autoSave) {
        // Stage pending template fields for this side
        setPending(prev => ({
          ...prev,
          [side]: { ...(prev[side] || {}), template: { ...(prev[side]?.template || {}), ...fields } }
        }));
        return;
      }

      // Auto-save path
      try { await db.ensureSecuringRowForSide(orderPackageId, side, isFinal); } catch (_) {}
      await db.ensureUniqueTemplateForSide(orderPackageId, side, isFinal);

      const { data: fresh } = await db.getSecuringForPackage(orderPackageId);
      setData(fresh || []);
  const target = (fresh || []).find((r: any) => r.securing_side === side && r.is_final === isFinal);
  const templateData = target?.securing_template as any;
  const currentTemplateId = templateData?.id || null;
      if (!currentTemplateId) return;

      await db.updateSecuringTemplate(currentTemplateId, fields);
      const { data: updated } = await db.getSecuringForPackage(orderPackageId);
      setData(updated || []);
    };

    const saveBeam = async (beamKey: 'horizontal_bar' | 'vertical_bar' | 'skids', fields: any) => {
      if (!editable) return;
      const isFinal = editTarget === 'final';

      if (!autoSave) {
        // Stage pending beam fields for this side
        setPending(prev => ({
          ...prev,
          [side]: { ...(prev[side] || {}), beams: { ...(prev[side]?.beams || {}), [beamKey]: { ...(prev[side]?.beams?.[beamKey] || {}), ...fields } } }
        }));
        return;
      }

      // Auto-save path
      try { await db.ensureSecuringRowForSide(orderPackageId, side, isFinal); } catch (_) {}
      await db.ensureUniqueTemplateForSide(orderPackageId, side, isFinal);

      const { data: fresh } = await db.getSecuringForPackage(orderPackageId);
      setData(fresh || []);
  const target = (fresh || []).find((r: any) => r.securing_side === side && r.is_final === isFinal);
  const templateData = target?.securing_template as any;
  const beamId = templateData?.[beamKey]?.id || null;
      if (!beamId) return;

      await db.updateBeam(beamId, fields);
      const { data: updated } = await db.getSecuringForPackage(orderPackageId);
      setData(updated || []);
    };

    return (
      <View className="px-4">
        {/* Top row: Quantity | Type | Thickness */}
        <View className="flex-row flex-wrap">
          <TwoTierEditableCard key={`${side}-quantity-${editTarget}`} editTarget={editTarget} editable={editable} compact label="Quantity" original={tmplOrig?.quantity ?? null} final={tmplFin?.quantity ?? null} type="number" onChange={(v) => saveTemplate({ quantity: v })} width={smallWidth} draftValue={(pending as any)[side]?.template?.quantity} />
          <TwoTierEditableCard key={`${side}-type-${editTarget}`} editTarget={editTarget} editable={editable} compact label="Type" original={variantLabelById(tmplOrig?.type_id, bodyVariants)} final={variantLabelById(tmplFin?.type_id, bodyVariants)} type="select" selectItems={bodyVariants} onChange={(v) => saveTemplate({ type_id: v })} width={typeWideWidth} finalSelectValue={tmplFin?.type_id || null} defaultSelectValue={tmplOrig?.type_id || null} draftValue={(pending as any)[side]?.template?.type_id} />
          <TwoTierEditableCard key={`${side}-thickness-${editTarget}`} editTarget={editTarget} editable={editable} compact label="Thickness" original={tmplOrig?.thickness ?? null} final={tmplFin?.thickness ?? null} type="number" onChange={(v) => saveTemplate({ thickness: v })} width={smallWidth} draftValue={(pending as any)[side]?.template?.thickness} />
        </View>

  {/* Horizontal/Beams */}
  <GroupBox title={horizontalTitle}>
          <View className="flex-row flex-wrap">
            <TwoTierEditableCard key={`${side}-hb-qty-${editTarget}`} editTarget={editTarget} editable={editable} compact label="Quantity" original={tmplOrig?.horizontal_bar?.quantity ?? null} final={tmplFin?.horizontal_bar?.quantity ?? null} type="number" onChange={(v) => saveBeam('horizontal_bar', { quantity: v })} width={smallWidth} draftValue={(pending as any)[side]?.beams?.horizontal_bar?.quantity} />
            <TwoTierEditableCard key={`${side}-hb-type-${editTarget}`} editTarget={editTarget} editable={editable} compact label="Type" original={variantLabelById(tmplOrig?.horizontal_bar?.type, barVariants)} final={variantLabelById(tmplFin?.horizontal_bar?.type, barVariants)} type="select" selectItems={barVariants} onChange={(v) => saveBeam('horizontal_bar', { type: v })} width={smallWidth} finalSelectValue={tmplFin?.horizontal_bar?.type || null} defaultSelectValue={tmplOrig?.horizontal_bar?.type || null} draftValue={(pending as any)[side]?.beams?.horizontal_bar?.type} />
            <TwoTierEditableCard key={`${side}-hb-space-${editTarget}`} editTarget={editTarget} editable={editable} compact label="Space" original={tmplOrig?.horizontal_bar?.space ?? null} final={tmplFin?.horizontal_bar?.space ?? null} type="number" onChange={(v) => saveBeam('horizontal_bar', { space: v })} width={smallWidth} draftValue={(pending as any)[side]?.beams?.horizontal_bar?.space} />
            <TwoTierEditableCard key={`${side}-hb-width-${editTarget}`} editTarget={editTarget} editable={editable} compact label="Width" original={tmplOrig?.horizontal_bar?.width ?? null} final={tmplFin?.horizontal_bar?.width ?? null} type="number" onChange={(v) => saveBeam('horizontal_bar', { width: v })} width={smallWidth} draftValue={(pending as any)[side]?.beams?.horizontal_bar?.width} />
            <TwoTierEditableCard key={`${side}-hb-thick-${editTarget}`} editTarget={editTarget} editable={editable} compact label="Thickness" original={tmplOrig?.horizontal_bar?.thickness ?? null} final={tmplFin?.horizontal_bar?.thickness ?? null} type="number" onChange={(v) => saveBeam('horizontal_bar', { thickness: v })} width={smallWidth} draftValue={(pending as any)[side]?.beams?.horizontal_bar?.thickness} />
          </View>
        </GroupBox>

  {/* Vertical/Beams Filling */}
  <GroupBox title={verticalTitle}>
          <View className="flex-row flex-wrap">
            <TwoTierEditableCard key={`${side}-vb-qty-${editTarget}`} editTarget={editTarget} editable={editable} compact label="Quantity" original={tmplOrig?.vertical_bar?.quantity ?? null} final={tmplFin?.vertical_bar?.quantity ?? null} type="number" onChange={(v) => saveBeam('vertical_bar', { quantity: v })} width={smallWidth} draftValue={(pending as any)[side]?.beams?.vertical_bar?.quantity} />
            <TwoTierEditableCard key={`${side}-vb-type-${editTarget}`} editTarget={editTarget} editable={editable} compact label="Type" original={variantLabelById(tmplOrig?.vertical_bar?.type, barVariants)} final={variantLabelById(tmplFin?.vertical_bar?.type, barVariants)} type="select" selectItems={barVariants} onChange={(v) => saveBeam('vertical_bar', { type: v })} width={smallWidth} finalSelectValue={tmplFin?.vertical_bar?.type || null} defaultSelectValue={tmplOrig?.vertical_bar?.type || null} draftValue={(pending as any)[side]?.beams?.vertical_bar?.type} />
            <TwoTierEditableCard key={`${side}-vb-space-${editTarget}`} editTarget={editTarget} editable={editable} compact label="Space" original={tmplOrig?.vertical_bar?.space ?? null} final={tmplFin?.vertical_bar?.space ?? null} type="number" onChange={(v) => saveBeam('vertical_bar', { space: v })} width={smallWidth} draftValue={(pending as any)[side]?.beams?.vertical_bar?.space} />
            <TwoTierEditableCard key={`${side}-vb-width-${editTarget}`} editTarget={editTarget} editable={editable} compact label="Width" original={tmplOrig?.vertical_bar?.width ?? null} final={tmplFin?.vertical_bar?.width ?? null} type="number" onChange={(v) => saveBeam('vertical_bar', { width: v })} width={smallWidth} draftValue={(pending as any)[side]?.beams?.vertical_bar?.width} />
            <TwoTierEditableCard key={`${side}-vb-thick-${editTarget}`} editTarget={editTarget} editable={editable} compact label="Thickness" original={tmplOrig?.vertical_bar?.thickness ?? null} final={tmplFin?.vertical_bar?.thickness ?? null} type="number" onChange={(v) => saveBeam('vertical_bar', { thickness: v })} width={smallWidth} draftValue={(pending as any)[side]?.beams?.vertical_bar?.thickness} />
          </View>
        </GroupBox>

        {/* Skids for Base only */}
        {side === 'base' && (
          <GroupBox title="Skids">
            <View className="flex-row flex-wrap">
              <TwoTierEditableCard key={`${side}-sk-qty-${editTarget}`} editTarget={editTarget} editable={editable} compact label="Quantity" original={tmplOrig?.skids?.quantity ?? null} final={tmplFin?.skids?.quantity ?? null} type="number" onChange={(v) => saveBeam('skids', { quantity: v })} width={smallWidth} draftValue={(pending as any)[side]?.beams?.skids?.quantity} />
              <TwoTierEditableCard key={`${side}-sk-type-${editTarget}`} editTarget={editTarget} editable={editable} compact label="Type" original={variantLabelById(tmplOrig?.skids?.type, woodVariants)} final={variantLabelById(tmplFin?.skids?.type, woodVariants)} type="select" selectItems={woodVariants} onChange={(v) => saveBeam('skids', { type: v })} width={smallWidth} finalSelectValue={tmplFin?.skids?.type || null} defaultSelectValue={tmplOrig?.skids?.type || null} draftValue={(pending as any)[side]?.beams?.skids?.type} />
              <TwoTierEditableCard key={`${side}-sk-thick-${editTarget}`} editTarget={editTarget} editable={editable} compact label="Thickness" original={tmplOrig?.skids?.thickness ?? null} final={tmplFin?.skids?.thickness ?? null} type="number" onChange={(v) => saveBeam('skids', { thickness: v })} width={smallWidth} draftValue={(pending as any)[side]?.beams?.skids?.thickness} />
            </View>
          </GroupBox>
        )}

        {shouldShowAdditionalWood && (
          <View style={{ marginTop: 16 }}>
            <OrderPackageMaterialsSection
              orderPackageId={orderPackageId}
              title={`Additional Wood — ${SIDE_LABELS[side]}`}
              materialType={ADDITIONAL_WOOD_MATERIAL_TYPES[side]}
              variantSources={ADDITIONAL_WOOD_VARIANT_SOURCES}
              addButtonLabel="Add wood"
              quantityLabel="Qty"
              mediaDesignation="additional_wood"
              editable={editable}
              showDimensions={false}
            />
          </View>
        )}
      </View>
    );
  };

  const tabs: { key: Side; label: string }[] = [
    { key: 'big_sides', label: SIDE_LABELS.big_sides },
    { key: 'small_sides', label: SIDE_LABELS.small_sides },
    { key: 'lid', label: SIDE_LABELS.lid },
    { key: 'base', label: SIDE_LABELS.base },
  ];

  const titleFontSize = size === 'small' ? 16 : size === 'large' ? 20 : size === 'xl' ? 22 : size === 'xxl' ? 26 : 18;
  const tabFontSize = size === 'small' ? 13 : size === 'large' ? 16 : size === 'xl' ? 18 : size === 'xxl' ? 21 : 14;
  const buttonFontSize = size === 'small' ? 13 : size === 'large' ? 16 : size === 'xl' ? 18 : size === 'xxl' ? 20 : 14;
  const tabPadding = size === 'xxl' ? 12 : size === 'xl' ? 10 : 8;

  return (
    <View style={{ marginTop: 8, marginBottom: 24, borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 12, marginHorizontal: 16, backgroundColor: '#eff6ff' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={{ color: '#1e40af', fontWeight: '600', fontSize: titleFontSize }}>Manufacturing</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Camera button */}
          <TouchableOpacity
            onPress={handleCameraPress}
            style={{ padding: 8, borderRadius: 6, backgroundColor: '#2563eb' }}
            activeOpacity={0.7}
          >
            <Camera size={18} color="#ffffff" />
          </TouchableOpacity>
          {(editTarget === 'original' || !autoSave) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {!autoSave && (
              <Text style={{ color: anyPending ? '#b45309' : '#16a34a', fontSize: buttonFontSize - 2 }}>{anyPending ? 'Unsaved changes' : 'All changes saved'}</Text>
            )}
            <TouchableOpacity
              onPress={async () => {
              try {
                if (!autoSave) {
                  // Apply all pending changes (for current editTarget tier)
                  const sides: Side[] = ['big_sides','small_sides','lid','base'];
                  const isFinal = editTarget === 'final';
                  const failed: Side[] = [];
                  const succeeded: Side[] = [];

                  for (const s of sides) {
                    const pend = pending[s];
                    if (!pend) continue;

                    // Ensure row + unique template
                    const ensured = await db.ensureSecuringRowForSide(orderPackageId, s, isFinal);
                    if ((ensured as any)?.error) {
                      failed.push(s);
                      continue;
                    }
                    const uniq = await db.ensureUniqueTemplateForSide(orderPackageId, s, isFinal);
                    if ((uniq as any)?.error) {
                      failed.push(s);
                      continue;
                    }

                    // Fetch target ids
                    const freshRes = await db.getSecuringForPackage(orderPackageId);
                    const fresh = (freshRes as any)?.data || [];
                    const target = (fresh || []).find((r: any) => r.securing_side === s && r.is_final === isFinal);
                    const tmplId = target?.securing_template?.id || null;
                    if (!tmplId) {
                      failed.push(s);
                      continue;
                    }

                    // Perform minimal updates
                    if (pend.template && Object.keys(pend.template).length) {
                      const upd = await db.updateSecuringTemplate(tmplId, pend.template);
                      if ((upd as any)?.error) { failed.push(s); continue; }
                    }
                    if (pend.beams) {
                      for (const k of ['horizontal_bar','vertical_bar','skids'] as const) {
                        const fields: any = (pend.beams as any)[k];
                        if (!fields || !Object.keys(fields).length) continue;
                        const beamId = target?.securing_template?.[k]?.id || null;
                        if (!beamId) { failed.push(s); continue; }
                        const bu = await db.updateBeam(beamId, fields);
                        if ((bu as any)?.error) { failed.push(s); }
                      }
                    }

                    if (!failed.includes(s)) succeeded.push(s);
                  }

                  // Refresh view from DB
                  const { data: updated } = await db.getSecuringForPackage(orderPackageId);
                  setData(updated || []);

                  // Clear only succeeded sides from pending; keep failed so user doesn't lose edits
                  setPending(prev => {
                    const next = { ...prev } as any;
                    for (const s of succeeded) delete next[s as Side];
                    return next;
                  });

                  if (failed.length) {
                    Alert.alert('Save incomplete', `Could not save: ${failed.map(f => f.replace('_',' ')).join(', ')}. Please check your network and permissions, then try again.`);
                  }
                } else {
                  // Auto-save path retained for compatibility with older flows
                  await db.ensureOriginalSecuringForPackage(orderPackageId);
                  const { data: fresh } = await db.getSecuringForPackage(orderPackageId);
                  setData(fresh || []);
                }
              } catch (e) {
                Alert.alert('Save failed', 'Unexpected error while saving securing. Please try again.');
              }
            }}
            disabled={!editable || (!autoSave && !anyPending)}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: (!editable || (!autoSave && !anyPending)) ? '#d1d5db' : '#2563eb' }}
          >
            <Text style={{ color: 'white', fontSize: buttonFontSize }}>Save</Text>
          </TouchableOpacity>
          </View>
        )}
        </View>
      </View>
      
      {/* Tabs header (no className to avoid css-interop navigation checks) */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', columnGap: 24, paddingHorizontal: 16, marginTop: 8, borderBottomWidth: 1, borderBottomColor: '#bfdbfe' }}>
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.key;
          const showDot = !autoSave && pendingBySide[tab.key];
          return (
            <TouchableOpacity 
              key={tab.key} 
              onPress={() => handleTabPress(tab.key, index)} 
              activeOpacity={0.8}
            >
              <View style={{
                backgroundColor: isActive ? 'white' : 'transparent',
                borderWidth: isActive ? 1 : 0,
                borderColor: '#93c5fd',
                borderBottomWidth: 0,
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: isActive ? tabPadding : 0,
                marginBottom: isActive ? -1 : 0,
                shadowColor: isActive ? '#000' : 'transparent',
                shadowOpacity: isActive ? 0.05 : 0,
                shadowRadius: isActive ? 2 : 0,
                flexDirection: 'row',
                alignItems: 'center',
                columnGap: 6,
              }}>
                <Text style={{ color: isActive ? '#1d4ed8' : '#2563eb99', fontWeight: isActive ? '600' : '400', fontSize: tabFontSize }}>{tab.label}</Text>
                {showDot ? (<View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: '#f59e0b' }} />) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Simple tab content (no horizontal scroll to avoid jitter) */}
      <View style={{ paddingVertical: 16 }}>
        {renderSideContent(activeTab)}
      </View>
      
      {/* Tab position indicators */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8, columnGap: 8 }}>
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={`indicator-${tab.key}`}
              onPress={() => handleTabPress(tab.key, index)}
              activeOpacity={0.8}
            >
              <View style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: isActive ? '#3b82f6' : '#93c5fd' }} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

export default ManufacturingSection;
