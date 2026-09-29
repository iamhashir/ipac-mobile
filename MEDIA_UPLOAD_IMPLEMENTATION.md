# Media Upload Feature Implementation Summary

## Overview
This document summarizes the implementation of the comprehensive media upload feature for the IPAC Operations App. The feature allows users to capture and upload images/videos at various stages of the packing process, with proper organization and metadata tracking.

## Database Schema

### Media Table Structure
- **Table**: `media`
- **Columns**:
  - `id` (UUID, Primary Key)
  - `image_url` (text) - Stores the storage path
  - `notes` (text) - Context about the image (item name, task name, etc.)
  - `created_at` (timestamptz) - Auto-generated with `now()`
  - `order_package_id` (UUID, Foreign Key) - Links to `order_packages` table
  - `designation` (enum: media_category) - Categorizes the image

### Media Category Enum Values
```sql
enum media_category {
  package,
  task,
  accessory,
  service,
  big_side,
  small_side,
  lid,
  base,
  item,
  vacuum_packing,
  gas_packing
}
```

## Storage Structure

### Bucket Configuration
- **Bucket Name**: `media`
- **Privacy**: Private (requires authentication)
- **Access**: Via signed URLs (valid for 1 year)

### Folder Structure
```
orders/
  └── {order_uuid}/
      └── {package_number}/
          └── {designation}/
              └── {timestamp}.{ext}
```

**Example path**: `orders/abc123-def456/1/package/1698765432.jpg`

## Implementation Details

### Core Upload Function
**Location**: `utils/api/supabase.ts`

**Function**: `uploadMediaToStorage(orderPackageId, fileUri, designation, notes)`

**Features**:
- Fetches order_id and package_number from order_package table
- Creates structured folder path
- Supports images (jpg, png, gif, webp) and videos (mp4, mov, avi)
- Generates signed URLs for private bucket access
- Inserts metadata record into media table
- Automatic cleanup on error

### Camera Icons Added To:

1. **Package Level** (`BoxDetailsTab.tsx`)
   - Designation: `package`
   - Location: Next to "Mark box as complete" button
   - Notes: Package number

2. **Items** (`order_packing_items.tsx`)
   - Designation: `item`
   - Location: Each item row in packing items table
   - Notes: Item designation and quantity

3. **Tasks** (`TaskLogsTable.tsx`)
   - Designation: `task`
   - Location: Each task row in task logs table
   - Notes: Task name
   - Available in overview tab

4. **Securing Sections** (`OrderSecuringSection.tsx`)
   - Designations: `big_side`, `small_side`, `lid`, `base`
   - Location: Header of securing section (changes based on active tab)
   - Notes: Side name

5. **Accessories** (`AccessoriesSection.tsx`)
   - Designation: `accessory`
   - Location: Each accessory row
   - Notes: Accessory name and quantity

6. **Vacuum Packing** (`VacuumPackingSection.tsx` + `FilteredMaterialsSection.tsx`)
   - Designation: `vacuum_packing`
   - Location: Each material row (laminate, desiccant, accessories)
   - Notes: Section and material name
   - **TODO**: Service section camera icon (pending service functionality)

7. **Gas Packing** (`GasPackingSection.tsx` + `GasMaterialsSection.tsx`)
   - Designation: `gas_packing`
   - Location: Each material row (laminate, desiccant, gas, accessories)
   - Notes: Section and material/gas details

## User Flow

1. User taps camera icon
2. Alert dialog appears with options: Gallery | Camera | Cancel
3. Permission check (camera or media library)
4. User captures/selects image
5. Upload process:
   - Query order_id and package_number
   - Build folder path
   - Upload to storage bucket
   - Generate signed URL
   - Insert media record
6. Success/error alert shown

## Security & Cost

### Signed URLs
- **Purpose**: Secure access to private bucket files
- **Validity**: 1 year (31,536,000 seconds)
- **Cost**: Free - Signed URLs are generated server-side and don't incur additional costs
- **Benefit**: Only authenticated users with valid URLs can access media

### RLS Policies
**Location**: `supabase/migrations/setup_media_bucket_policies.sql`

**Policies**:
- Authenticated users can INSERT (upload)
- Authenticated users can SELECT (read)
- Authenticated users can UPDATE
- Authenticated users can DELETE

## Helper Functions

### Available in `utils/api/supabase.ts`:

1. **`uploadMediaToStorage(orderPackageId, fileUri, designation, notes)`**
   - Main upload function
   - Returns: `{ mediaId, path, signedUrl }`

2. **`getMediaForPackage(orderPackageId)`**
   - Retrieves all media for a package
   - Returns media with signed URLs

3. **`deleteMedia(mediaId)`**
   - Deletes media record and file
   - Handles cleanup

## Migration Steps

1. Ensure the `media` table exists with proper schema
2. Run the migration: `supabase/migrations/setup_media_bucket_policies.sql`
3. This will:
   - Create the `media` bucket (if not exists)
   - Set up RLS policies for authenticated users
   - Enable secure file access

## Testing Checklist

- [ ] Package level camera uploads correctly
- [ ] Item level camera stores proper notes
- [ ] Task camera includes task name
- [ ] Securing section changes designation based on active tab
- [ ] Accessories include accessory details in notes
- [ ] Vacuum packing materials upload with correct designation
- [ ] Gas packing materials upload with correct designation
- [ ] Storage folder structure matches specification
- [ ] Signed URLs provide access to images
- [ ] Media table records match uploads
- [ ] Permission requests work properly
- [ ] Error handling shows appropriate alerts

## Future Enhancements

1. **Service Section Camera Icons**: Add camera icons for service entries in vacuum/gas packing sections once service functionality is fully implemented

2. **Media Gallery View**: Create a component to view all media for an order package

3. **Image Compression**: Implement more aggressive compression for storage optimization

4. **Batch Upload**: Allow multiple image selection and upload

5. **Image Annotations**: Add capability to annotate images before upload

6. **Video Recording**: Optimize video recording settings for smaller file sizes

## Notes

- All camera functionality uses `expo-image-picker` for cross-platform support
- Image quality is set to 0.7-0.8 to balance quality and file size
- The private bucket ensures only authorized users can access media
- Signed URLs eliminate the need for public bucket access
- The folder structure allows easy navigation and organization
