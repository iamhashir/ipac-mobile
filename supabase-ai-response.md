ERROR:  42883: function get_user_role() does not exist
HINT:  No function matches the given name and argument types. You might need to add explicit type casts.

SUPABASE AI response:

I'll help you debug the SQL snippet. The error "function get_user_role() does not exist" indicates that you're using a function get_user_role() in several RLS policies, but this function has not been defined in the provided SQL.

Let me help you create the missing get_user_role() function. I'll use display_query to generate the function:

-- Create a function to get the user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Fetch the role name for the current authenticated user
    SELECT r.name INTO user_role
    FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = auth.uid();
    
    RETURN COALESCE(user_role, 'unknown');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_role() TO authenticated;


I've created a get_user_role() function that:

Joins the profiles and roles tables
Finds the role name for the current authenticated user
Returns the role name, or 'unknown' if no role is found
Uses SECURITY DEFINER to ensure it can access the tables
Grants execute permissions to authenticated users
A few additional observations and recommendations:

The function assumes you have:

A public.profiles table with a role_id column
A public.roles table with a name column
A relationship between these tables
I noticed you're using several custom functions in your RLS policies:

user_assigned_to_order_today()
user_needs_attendance_today()
There's a discrepancy in the GRANT statements at the end. You have a line:

GRANT EXECUTE ON FUNCTION packer_needs_daily_attendance(UUID, UUID, DATE) TO authenticated;

But this function is not defined in the provided SQL. You might want to remove this line or create the corresponding function.

Would you like me to help you review and potentially refactor these RLS policies and functions? The current implementation looks complex and might benefit from some simplification.
