import { Pool } from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { storage } from './store.js';
import { eventBus } from '../utils/logger.js';

export interface AdminContactRecord {
  id: number;
  phone: string;
  secondary_phones?: string;
  name: string;
  role: 'superadmin' | 'admin' | 'operator';
  is_active: boolean;
  can_view_finances: boolean;
  can_view_metrics: boolean;
  can_manage_bookings: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAdminContactDto {
  phone: string;
  secondary_phones?: string;
  name: string;
  role?: 'superadmin' | 'admin' | 'operator';
  is_active?: boolean;
  can_view_finances?: boolean;
  can_view_metrics?: boolean;
  can_manage_bookings?: boolean;
  notes?: string;
}

export interface UpdateAdminContactDto {
  name?: string;
  secondary_phones?: string;
  role?: 'superadmin' | 'admin' | 'operator';
  is_active?: boolean;
  can_view_finances?: boolean;
  can_view_metrics?: boolean;
  can_manage_bookings?: boolean;
  notes?: string;
}

class AdminContactService {
  private pgPool: Pool | null = null;
  private supabasePool: Pool | null = null;
  private supabaseClient: SupabaseClient | null = null;

  constructor() {
    this.refreshConnections();
  }

  public refreshConnections() {
    const settings = storage.getSettings();
    const primaryUrl = settings.postgresUrl || process.env.DATABASE_URL || '';
    if (primaryUrl && (!this.pgPool || (this.pgPool as any)._connectionString !== primaryUrl)) {
      try {
        this.pgPool = new Pool({
          connectionString: primaryUrl,
          connectionTimeoutMillis: 5000,
          ssl: primaryUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
        });
      } catch (e) {
        console.warn('[AdminContactService] Failed to init primary PG pool:', e);
      }
    }

    const sbDbUrl = settings.supabaseDbUrl || process.env.SUPABASE_DB_URL || '';
    if (sbDbUrl && (!this.supabasePool || (this.supabasePool as any)._connectionString !== sbDbUrl)) {
      try {
        this.supabasePool = new Pool({
          connectionString: sbDbUrl,
          connectionTimeoutMillis: 5000,
          ssl: { rejectUnauthorized: false },
        });
      } catch (e) {
        console.warn('[AdminContactService] Failed to init fallback Supabase pool:', e);
      }
    }

    const sbUrl = settings.supabaseUrl || process.env.SUPABASE_URL || '';
    const sbKey = settings.supabaseKey || process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (sbUrl && sbKey && !this.supabaseClient) {
      try {
        this.supabaseClient = createClient(sbUrl, sbKey);
      } catch (e) {
        console.warn('[AdminContactService] Failed to init Supabase REST client:', e);
      }
    }
  }

  private cleanPhone(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }

  /**
   * Executes query on primary (PostgreSQL Oracle) with transparent fallback to Supabase
   */
  private async queryWithFallback<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    this.refreshConnections();

    // 1. Try Primary (Oracle PostgreSQL)
    if (this.pgPool) {
      try {
        const res = await this.pgPool.query(sql, params);
        return res.rows;
      } catch (err: any) {
        console.warn('[AdminContactService] Primary PG error, falling back to Supabase:', err?.message || err);
      }
    }

    // 2. Try Supabase Pool
    if (this.supabasePool) {
      try {
        const res = await this.supabasePool.query(sql, params);
        return res.rows;
      } catch (err: any) {
        console.warn('[AdminContactService] Supabase Pool error:', err?.message || err);
      }
    }

    throw new Error('No hay bases de datos disponibles para AdminContactService.');
  }

  /**
   * List all admin contacts
   */
  public async getAdminContacts(): Promise<AdminContactRecord[]> {
    const sql = `
      SELECT id, phone, secondary_phones, name, role, is_active, can_view_finances, can_view_metrics, can_manage_bookings, notes, created_at, updated_at
      FROM admin_contacts
      ORDER BY id ASC;
    `;
    return await this.queryWithFallback<AdminContactRecord>(sql);
  }

  /**
   * Check if a phone number belongs to an active administrator
   * Supports administrators with multiple phone numbers (primary or in secondary_phones)
   */
  public async getAdminContactByPhone(phone: string): Promise<AdminContactRecord | null> {
    const cleaned = this.cleanPhone(phone);
    if (!cleaned && phone !== 'admin-dashboard') return null;

    const sql = `
      SELECT id, phone, secondary_phones, name, role, is_active, can_view_finances, can_view_metrics, can_manage_bookings, notes, created_at, updated_at
      FROM admin_contacts
      WHERE (
        phone = $1 OR phone = $2
        OR (secondary_phones IS NOT NULL AND (secondary_phones ILIKE '%' || $1 || '%' OR secondary_phones ILIKE '%' || $2 || '%'))
      ) AND is_active = true
      LIMIT 1;
    `;
    const rows = await this.queryWithFallback<AdminContactRecord>(sql, [cleaned, phone]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Helper that returns boolean indicating if contact is an active admin
   */
  public async isAdmin(phone: string): Promise<boolean> {
    const admin = await this.getAdminContactByPhone(phone);
    return Boolean(admin && admin.is_active);
  }

  /**
   * Add a new administrator contact
   */
  public async createAdminContact(data: CreateAdminContactDto): Promise<AdminContactRecord> {
    const cleaned = this.cleanPhone(data.phone) || data.phone.trim();
    if (!cleaned) throw new Error('El número de teléfono es obligatorio.');
    if (!data.name?.trim()) throw new Error('El nombre del contacto administrativo es obligatorio.');

    const sql = `
      INSERT INTO admin_contacts (
        phone, secondary_phones, name, role, is_active, can_view_finances, can_view_metrics, can_manage_bookings, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (phone) DO UPDATE SET
        secondary_phones = COALESCE(EXCLUDED.secondary_phones, admin_contacts.secondary_phones),
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        is_active = EXCLUDED.is_active,
        can_view_finances = EXCLUDED.can_view_finances,
        can_view_metrics = EXCLUDED.can_view_metrics,
        can_manage_bookings = EXCLUDED.can_manage_bookings,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *;
    `;

    const params = [
      cleaned,
      data.secondary_phones || '',
      data.name.trim(),
      data.role || 'admin',
      data.is_active !== false,
      data.can_view_finances !== false,
      data.can_view_metrics !== false,
      data.can_manage_bookings !== false,
      data.notes || null,
    ];

    const rows = await this.queryWithFallback<AdminContactRecord>(sql, params);
    eventBus.log('info', 'system', `Nuevo contacto administrativo registrado/actualizado: ${data.name} (${cleaned})`);
    return rows[0];
  }

  /**
   * Update an existing admin contact
   */
  public async updateAdminContact(id: number | string, data: UpdateAdminContactDto): Promise<AdminContactRecord> {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      params.push(data.name.trim());
    }
    if (data.secondary_phones !== undefined) {
      fields.push(`secondary_phones = $${idx++}`);
      params.push(data.secondary_phones);
    }
    if (data.role !== undefined) {
      fields.push(`role = $${idx++}`);
      params.push(data.role);
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${idx++}`);
      params.push(data.is_active);
    }
    if (data.can_view_finances !== undefined) {
      fields.push(`can_view_finances = $${idx++}`);
      params.push(data.can_view_finances);
    }
    if (data.can_view_metrics !== undefined) {
      fields.push(`can_view_metrics = $${idx++}`);
      params.push(data.can_view_metrics);
    }
    if (data.can_manage_bookings !== undefined) {
      fields.push(`can_manage_bookings = $${idx++}`);
      params.push(data.can_manage_bookings);
    }
    if (data.notes !== undefined) {
      fields.push(`notes = $${idx++}`);
      params.push(data.notes);
    }

    fields.push(`updated_at = NOW()`);
    params.push(id);

    const sql = `
      UPDATE admin_contacts
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `;

    const rows = await this.queryWithFallback<AdminContactRecord>(sql, params);
    if (rows.length === 0) throw new Error(`Contacto administrativo #${id} no encontrado.`);
    return rows[0];
  }

  /**
   * Delete an admin contact
   */
  public async deleteAdminContact(id: number | string): Promise<boolean> {
    const sql = `DELETE FROM admin_contacts WHERE id = $1 RETURNING id;`;
    const rows = await this.queryWithFallback(sql, [id]);
    return rows.length > 0;
  }
}

export const adminContactService = new AdminContactService();
