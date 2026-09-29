-- Migration: Create Admin Contacts Table (Roles y Permisos de Contactos de WhatsApp)
CREATE TABLE IF NOT EXISTS admin_contacts (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin', -- 'superadmin', 'admin', 'operator'
    is_active BOOLEAN NOT NULL DEFAULT true,
    can_view_finances BOOLEAN NOT NULL DEFAULT true,
    can_view_metrics BOOLEAN NOT NULL DEFAULT true,
    can_manage_bookings BOOLEAN NOT NULL DEFAULT true,
    secondary_phones TEXT DEFAULT '',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_contacts_phone ON admin_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_admin_contacts_active ON admin_contacts(is_active);

-- Seed initial admin contacts:
-- 1. DxS (+21122699509833 / 21122699509833)
-- 2. WhatsApp bot owner (+51942629785 / 51942629785)
-- 3. Web Dashboard Admin (admin-dashboard)
INSERT INTO admin_contacts (phone, name, role, is_active, can_view_finances, can_view_metrics, can_manage_bookings, notes)
VALUES 
    ('21122699509833', 'DxS (Ing. David Salcedo)', 'superadmin', true, true, true, true, 'Administrador principal del sistema'),
    ('51942629785', 'Número Bot / Admin', 'superadmin', true, true, true, true, 'Línea de WhatsApp oficial'),
    ('admin-dashboard', 'Administrador Web', 'superadmin', true, true, true, true, 'Consultas desde el panel web')
ON CONFLICT (phone) DO UPDATE 
SET is_active = true, can_view_finances = true, can_view_metrics = true, can_manage_bookings = true;
