-- Function to lookup user email by username securely
-- This function runs with elevated privileges to bypass RLS policies
-- and is used specifically for username-based authentication

CREATE OR REPLACE FUNCTION get_user_email_by_username(lookup_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- Look up the email for the given username by joining profiles and auth.users
    -- Note: email is stored in auth.users table, not profiles table
    SELECT au.email INTO user_email
    FROM profiles p
    JOIN auth.users au ON p.id = au.id
    WHERE p.username = lookup_username
    LIMIT 1;
    
    -- Return the email if found, NULL otherwise
    RETURN user_email;
END;
$$;

-- Grant execute permission to authenticated and anonymous users
GRANT EXECUTE ON FUNCTION get_user_email_by_username(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_email_by_username(TEXT) TO anon;

-- Add comment explaining the function
COMMENT ON FUNCTION get_user_email_by_username(TEXT) IS 
'Securely lookup user email by username for authentication purposes. 
Runs with elevated privileges to bypass RLS policies. 
Joins profiles table with auth.users to get email from correct table.';
