import { Router, Request, Response } from 'express';
import { adminContactService } from '../storage/adminContactService.js';

export const adminContactRouter = Router();

adminContactRouter.get('/', async (req: Request, res: Response) => {
  try {
    const contacts = await adminContactService.getAdminContacts();
    res.json(contacts);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al listar contactos administrativos' });
  }
});

adminContactRouter.get('/check/:phone', async (req: Request, res: Response) => {
  try {
    const phone = req.params.phone;
    const admin = await adminContactService.getAdminContactByPhone(phone);
    res.json({
      isAdmin: Boolean(admin && admin.is_active),
      admin,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al verificar contacto' });
  }
});

adminContactRouter.post('/', async (req: Request, res: Response) => {
  try {
    const created = await adminContactService.createAdminContact(req.body);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Error al crear contacto administrativo' });
  }
});

adminContactRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const updated = await adminContactService.updateAdminContact(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'Error al actualizar contacto administrativo' });
  }
});

adminContactRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const ok = await adminContactService.deleteAdminContact(req.params.id);
    res.json({ success: ok });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error al eliminar contacto administrativo' });
  }
});
