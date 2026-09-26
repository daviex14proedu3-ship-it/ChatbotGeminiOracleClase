-- ==============================================================================
-- MIGRATION: Creación de tablas para Memoria Conversacional de WhatsApp
-- Proyecto: OmniBot WhatsApp SaaS (Supabase Fallback)
-- ==============================================================================

-- 1. Tabla de conversaciones
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
    phone VARCHAR(64) PRIMARY KEY,
    contact_name VARCHAR(255) DEFAULT '',
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabla de mensajes de historial
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id BIGSERIAL PRIMARY KEY,
    phone VARCHAR(64) NOT NULL,
    role VARCHAR(16) NOT NULL,
    content TEXT NOT NULL,
    media_id VARCHAR(128) DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_wa_messages_phone_created ON public.whatsapp_messages (phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_last_msg ON public.whatsapp_conversations (last_message_at DESC);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de seguridad (Service Role y Anon Key)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_conversations' AND policyname = 'service_role_conversations_all'
    ) THEN
        CREATE POLICY service_role_conversations_all ON public.whatsapp_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_messages' AND policyname = 'service_role_messages_all'
    ) THEN
        CREATE POLICY service_role_messages_all ON public.whatsapp_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_conversations' AND policyname = 'anon_conversations_all'
    ) THEN
        CREATE POLICY anon_conversations_all ON public.whatsapp_conversations FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_messages' AND policyname = 'anon_messages_all'
    ) THEN
        CREATE POLICY anon_messages_all ON public.whatsapp_messages FOR ALL TO anon USING (true) WITH CHECK (true);
    END IF;
END $$;
