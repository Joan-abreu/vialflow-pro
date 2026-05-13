-- 1. OTORGAR PERMISOS A TODAS LAS TABLAS EXISTENTES EN EL ESQUEMA PUBLIC
-- Esto asegura la compatibilidad si corremos el historial completo de migraciones en un nuevo proyecto.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;

-- 2. OTORGAR PERMISOS A TODAS LAS SECUENCIAS EXISTENTES
-- Necesario para que las consultas cliente puedan leer y operar con columnas de tipo SERIAL / autoincrementales.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 3. CONFIGURAR SEGURIDAD POR DEFECTO PARA NUEVAS TABLAS (SAFETY NET)
-- Esto le indica a Postgres que cualquier tabla creada en el futuro por el rol 'postgres' (el rol de migración)
-- obtendrá automáticamente los permisos para la API, evitando errores si olvidamos añadir GRANTs individuales.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;

-- 4. CONFIGURAR SEGURIDAD POR DEFECTO PARA NUEVAS SECUENCIAS
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO service_role;
