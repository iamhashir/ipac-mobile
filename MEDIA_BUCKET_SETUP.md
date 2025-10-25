# Media Bucket Setup Guide

## Problem Summary
1. **SQL Migration Error**: Direct SQL execution failed due to permissions
2. **App Error (blob)**: React Native doesn't support `blob()` method - **FIXED** ✅

## Solution: Manual Setup via Supabase Dashboard

### Step 1: Create the Media Bucket

1. Go to your Supabase project dashboard
2. Click on **Storage** in the left sidebar
3. Click the **"New bucket"** button
4. Configure:
   - **Name**: `media`
   - **Public**: Toggle **OFF** (keep it private)
   - **File size limit**: Set to your preference (default 50MB is fine)
   - **Allowed MIME types**: Leave empty or add: `image/*, video/*`
5. Click **"Create bucket"**

### Step 2: Set Up Storage Policies

1. In the Storage section, click on the **`media`** bucket
2. Go to the **Policies** tab
3. Click **"New Policy"**

#### Policy 1: Upload (INSERT)
- **Policy name**: `Authenticated users can upload`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **Policy definition**: 
  ```sql
  bucket_id = 'media'
  ```
- Click **"Save"**

#### Policy 2: Read (SELECT)
- **Policy name**: `Authenticated users can read`
- **Allowed operation**: `SELECT`
- **Target roles**: `authenticated`
- **Policy definition**:
  ```sql
  bucket_id = 'media'
  ```
- Click **"Save"**

#### Policy 3: Update (UPDATE) - Optional
- **Policy name**: `Authenticated users can update`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **USING expression**:
  ```sql
  bucket_id = 'media'
  ```
- **WITH CHECK expression**:
  ```sql
  bucket_id = 'media'
  ```
- Click **"Save"**

#### Policy 4: Delete (DELETE) - Optional
- **Policy name**: `Authenticated users can delete`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **Policy definition**:
  ```sql
  bucket_id = 'media'
  ```
- Click **"Save"**

### Step 3: Verify Setup

1. Go back to Storage → media bucket
2. You should see 4 policies listed
3. Try uploading from the app - it should work now!

## Code Fix Applied ✅

The app error has been fixed in `utils/api/supabase.ts`:
- Changed from `blob()` to `arrayBuffer()` + `Uint8Array`
- This is the React Native compatible approach
- File type detection now uses URI extension instead of blob.type

## Testing

After setup, test by:
1. Opening the app in Expo Go
2. Navigate to any packing section
3. Click a camera icon
4. Take/select a photo
5. Verify it uploads successfully
6. Check Supabase Storage → media bucket to see the file

## Folder Structure

Files will be organized as:
```
media/
  └── orders/
      └── {order_uuid}/
          └── {package_number}/
              └── {designation}/
                  └── {timestamp}.jpg
```

Example: `orders/abc-123/1/package/1698765432.jpg`
