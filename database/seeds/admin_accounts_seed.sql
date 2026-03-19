-- PMED admin accounts seed
-- Run after supabase/schema.sql.

BEGIN;

INSERT INTO admin_profiles (
  username, full_name, email, role, department, access_exemptions,
  is_super_admin, password_hash, status, phone
)
VALUES
  (
    'admin@pmed.local',
    'Default PMED Admin',
    'admin@pmed.local',
    'Admin',
    'PMED',
    ARRAY['pmed','reports'],
    1,
    'fb16971bc6e0fd2852916dd599ae11b1:062a7e6c2f54a264e99b3d08b81d9fc9078849139d0e3635a3c6d38561242c75609f6366ae8df520a0110e231b07d3b78e82c180461bc94596f75dbc99dc5a11',
    'active',
    ''
  ),
  (
    'planning.officer@pmed.local',
    'Planning Officer',
    'planning.officer@pmed.local',
    'Planning Officer',
    'PMED',
    ARRAY['pmed'],
    0,
    '4d316a4e9a94c929a12f7d654ea8a205:8b513777a58abff03f5e03cdf5fe2181f5ab66afacfa3a368b117902be0ebe317779e3a62026fc7c0441728563d5f96dfc37d633a1b6634b82c16df6f7419e09',
    'active',
    '+63 912 000 2001'
  )
ON CONFLICT (username) DO UPDATE
SET
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  department = EXCLUDED.department,
  access_exemptions = EXCLUDED.access_exemptions,
  is_super_admin = EXCLUDED.is_super_admin,
  password_hash = EXCLUDED.password_hash,
  status = EXCLUDED.status,
  phone = EXCLUDED.phone;

COMMIT;
