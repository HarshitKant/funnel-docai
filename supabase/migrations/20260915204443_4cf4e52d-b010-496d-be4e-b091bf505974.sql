REVOKE EXECUTE ON FUNCTION public.has_unlock(uuid, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_unlock(uuid, text) TO service_role;