import { bookingService } from '../storage/bookingService.js';
import { baileysManager } from '../whatsapp/baileysClient.js';
import { eventBus } from '../utils/logger.js';

class ReminderService {
  private intervalTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  public start(intervalMs: number = 5 * 60 * 1000): void {
    if (this.intervalTimer) return;

    eventBus.log('info', 'system', 'Servicio de recordatorios automáticos de citas por WhatsApp iniciado.');

    // Run first check after 10 seconds, then periodically
    setTimeout(() => {
      this.checkAndSendReminders().catch(err => {
        console.warn('Error en ejecución inicial de recordatorios:', err);
      });
    }, 10000);

    this.intervalTimer = setInterval(() => {
      this.checkAndSendReminders().catch(err => {
        console.warn('Error en ciclo de recordatorios:', err);
      });
    }, intervalMs);
  }

  public stop(): void {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public async checkAndSendReminders(): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    try {
      const waStatus = baileysManager.getStatus();
      if (waStatus.state !== 'connected') {
        // WhatsApp not connected, wait for next cycle
        return 0;
      }

      const pendingList = await bookingService.getPendingReminders();
      if (pendingList.length === 0) {
        return 0;
      }

      eventBus.log('info', 'system', `Verificando ${pendingList.length} recordatorios de citas pendientes por enviar...`);

      let sentCount = 0;
      for (const item of pendingList) {
        try {
          const cleanPhone = item.phone.replace(/[^0-9]/g, '');
          if (!cleanPhone) continue;

          const remoteJid = `${cleanPhone}@s.whatsapp.net`;
          const messageText = `⏰ *RECORDATORIO DE CITA PROGRAMADA*

Hola *${item.client_name}*, te recordamos que tienes una cita confirmada en nuestra agenda:

💼 *Servicio:* ${item.service_name}
📅 *Fecha:* ${item.appointment_date}
⏰ *Hora:* ${item.start_time.slice(0, 5)}
🔖 *Código de cita:* ${item.booking_code}

📍 Te esperamos puntualmente. Si necesitas cancelar o reprogramar tu cita, simplemente responde a este mensaje.`;

          await baileysManager.sendMessage(remoteJid, { text: messageText });
          await bookingService.markReminderSent(item.id);

          eventBus.log(
            'success',
            'whatsapp',
            `Recordatorio de cita enviado exitosamente a ${item.client_name} (${cleanPhone}) para el ${item.appointment_date} a las ${item.start_time.slice(0, 5)}`
          );

          sentCount++;
          // Small delay between reminders to avoid WhatsApp spam triggers
          await new Promise(r => setTimeout(r, 2000));
        } catch (sendErr: any) {
          eventBus.log('error', 'whatsapp', `Fallo al enviar recordatorio a ${item.phone}: ${sendErr?.message || sendErr}`);
        }
      }

      return sentCount;
    } catch (err: any) {
      console.warn('Error verificando recordatorios pendientes:', err?.message || err);
      return 0;
    } finally {
      this.isProcessing = false;
    }
  }

  public async sendManualReminder(appointmentId: number): Promise<{ success: boolean; message: string }> {
    const list = await bookingService.getAppointmentsList({ limit: 1000 });
    const appointment = list.find(a => a.id === appointmentId);
    if (!appointment) {
      throw new Error('Cita no encontrada.');
    }

    const cleanPhone = appointment.phone.replace(/[^0-9]/g, '');
    const remoteJid = `${cleanPhone}@s.whatsapp.net`;

    const messageText = `⏰ *RECORDATORIO DE CITA*

Hola *${appointment.client_name}*, te escribimos para recordarte tu cita programada:

💼 *Servicio:* ${appointment.service_name}
📅 *Fecha:* ${appointment.appointment_date}
⏰ *Hora:* ${appointment.start_time.slice(0, 5)}
🔖 *Código:* ${appointment.booking_code}

¡Te esperamos! Si tienes alguna duda o consulta, responde a este chat.`;

    await baileysManager.sendMessage(remoteJid, { text: messageText });
    await bookingService.markReminderSent(appointment.id);

    eventBus.log('success', 'whatsapp', `Recordatorio manual enviado a ${appointment.client_name} (${cleanPhone})`);
    return {
      success: true,
      message: `Recordatorio enviado a ${appointment.client_name} (${cleanPhone}).`,
    };
  }
}

export const reminderService = new ReminderService();
