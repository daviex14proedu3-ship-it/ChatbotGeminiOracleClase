import { FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { bookingService } from '../storage/bookingService.js';
import { financeService } from '../storage/financeService.js';
import { storage } from '../storage/store.js';
import { adminContactService } from '../storage/adminContactService.js';
import { eventBus } from '../utils/logger.js';

export const bookingFunctionDeclarations: FunctionDeclaration[] = [
  // ============================================================================
  // CITAS, HORARIOS Y CALENDARIOS
  // ============================================================================
  {
    name: 'consultar_horarios_disponibles',
    description: 'Consulta los horarios y turnos disponibles para agendar citas en una fecha determinada (formato YYYY-MM-DD). Úsala cuando el usuario pregunte "¿Qué horarios tienes mañana?", "¿Tienes espacio el viernes?", "¿A qué hora puedo ir?", etc.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        fecha: {
          type: SchemaType.STRING,
          description: 'Fecha en formato YYYY-MM-DD (ej: 2026-09-26). Si el usuario dice "hoy", "mañana" o un día de la semana, calcula la fecha exacta en base a la fecha actual.',
        },
        nombre_servicio: {
          type: SchemaType.STRING,
          description: 'Nombre opcional del servicio o tipo de cita.',
        },
      },
      required: ['fecha'],
    },
  },
  {
    name: 'reservar_cita',
    description: 'Reserva y agenda una cita en el sistema para el cliente, validando disponibilidad. Devuelve el código de reserva.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        fecha: {
          type: SchemaType.STRING,
          description: 'Fecha de la cita en formato YYYY-MM-DD.',
        },
        hora: {
          type: SchemaType.STRING,
          description: 'Hora de la cita en formato HH:MM (24 horas, ej: 16:00, 10:00).',
        },
        nombre_cliente: {
          type: SchemaType.STRING,
          description: 'Nombre de la persona para la cita.',
        },
        nombre_servicio: {
          type: SchemaType.STRING,
          description: 'Servicio solicitado (ej: Asesoría Especializada, Consulta General, Clase Personalizada 1 a 1).',
        },
        notas: {
          type: SchemaType.STRING,
          description: 'Detalles o requerimientos adicionales de la cita.',
        },
      },
      required: ['fecha', 'hora'],
    },
  },
  {
    name: 'consultar_mis_citas',
    description: 'Consulta las citas y reservas agendadas que tiene el cliente que escribe.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'cancelar_cita',
    description: 'Cancela una cita agendada por el cliente mediante el código de cita o la fecha.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        codigo_o_fecha: {
          type: SchemaType.STRING,
          description: 'Código de la cita (ej: CITA-1234) o fecha de la cita (YYYY-MM-DD).',
        },
      },
    },
  },

  // ============================================================================
  // CLASES Y CURSOS
  // ============================================================================
  {
    name: 'consultar_mis_clases_y_cursos',
    description: 'Consulta el horario de clases, materias, docentes y aulas/enlaces asignados al alumno que escribe según su número de teléfono.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'consultar_cursos_disponibles',
    description: 'Consulta la oferta de cursos y clases grupales activas, días de cursado, horarios y cupos disponibles.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },

  // ============================================================================
  // PAGOS, MENSUALIDADES Y ESTADOS DE CUENTA
  // ============================================================================
  {
    name: 'consultar_estado_cuenta',
    description: 'Consulta el estado de cuenta financiero del alumno o cliente: mensualidades pendientes, saldo por pagar, fecha de vencimiento y cuotas al día. Úsala cuando pregunte "¿Cuánto debo?", "¿Tengo pagos pendientes?", "¿Cuándo vence mi cuota?", "¿Cuál es mi saldo actual?".',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'consultar_planes_y_tarifas',
    description: 'Consulta los planes mensuales, cuotas, membresías y costos de los cursos disponibles para brindar información de precios a clientes.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },

  // ============================================================================
  // ANALÍTICA EJECUTIVA & MÉTRICAS DEL NEGOCIO
  // ============================================================================
  {
    name: 'consultar_metricas_negocio',
    description: 'Consulta métricas y estadísticas consolidadas del negocio en tiempo real: recaudación del mes, saldo pendiente por cobrar, número de alumnos activos, cuotas vencidas y comprobantes validados hoy.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'consultar_deudores',
    description: 'Consulta la lista y resumen de alumnos con cuotas o mensualidades vencidas o pendientes de pago, con montos y conceptos.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'consultar_resumen_ejecutivo',
    description: 'Genera un informe integral del negocio combinando citas para hoy/mañana, cursos activos, alumnos inscritos y métricas de recaudación financiera.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },

  // ============================================================================
  // GESTIÓN ADMINISTRATIVA: CURSOS Y CLASES (SOLO ADMINISTRADORES)
  // ============================================================================
  {
    name: 'crear_curso',
    description: 'Crea y publica un nuevo curso o clase regular en la plataforma con horarios, docente y cupo. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        titulo: {
          type: SchemaType.STRING,
          description: 'Nombre o título del curso (ej: "Programación Web con React").',
        },
        dias: {
          type: SchemaType.STRING,
          description: 'Días de clase (ej: "Lunes, Miércoles y Viernes", "Sábados").',
        },
        hora_inicio: {
          type: SchemaType.STRING,
          description: 'Hora de inicio en formato HH:MM (24 horas, ej: "18:00").',
        },
        hora_fin: {
          type: SchemaType.STRING,
          description: 'Hora de fin en formato HH:MM (24 horas, ej: "20:00").',
        },
        codigo: {
          type: SchemaType.STRING,
          description: 'Código identificador opcional (ej: "REACT-01").',
        },
        descripcion: {
          type: SchemaType.STRING,
          description: 'Descripción breve de contenidos o temario.',
        },
        profesor: {
          type: SchemaType.STRING,
          description: 'Nombre del docente o profesor responsable.',
        },
        ubicacion_o_enlace: {
          type: SchemaType.STRING,
          description: 'Enlace virtual (Zoom/Meet) o dirección presencial de aula.',
        },
        cupo_maximo: {
          type: SchemaType.NUMBER,
          description: 'Capacidad máxima de estudiantes (por defecto 30).',
        },
      },
      required: ['titulo', 'dias', 'hora_inicio', 'hora_fin'],
    },
  },
  {
    name: 'modificar_curso',
    description: 'Modifica o actualiza horarios, profesor, título, cupo o estado de un curso existente. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        codigo_o_id: {
          type: SchemaType.STRING,
          description: 'Código, ID o nombre del curso a editar.',
        },
        titulo: {
          type: SchemaType.STRING,
          description: 'Nuevo título del curso.',
        },
        profesor: {
          type: SchemaType.STRING,
          description: 'Nuevo docente o profesor.',
        },
        dias: {
          type: SchemaType.STRING,
          description: 'Nuevos días de cursado.',
        },
        hora_inicio: {
          type: SchemaType.STRING,
          description: 'Nueva hora de inicio HH:MM.',
        },
        hora_fin: {
          type: SchemaType.STRING,
          description: 'Nueva hora de finalización HH:MM.',
        },
        ubicacion_o_enlace: {
          type: SchemaType.STRING,
          description: 'Nueva ubicación física o enlace virtual.',
        },
        cupo_maximo: {
          type: SchemaType.NUMBER,
          description: 'Nuevo límite de cupos.',
        },
        activo: {
          type: SchemaType.BOOLEAN,
          description: 'true para curso activo, false para suspender o pausar.',
        },
      },
      required: ['codigo_o_id'],
    },
  },
  {
    name: 'eliminar_curso',
    description: 'Elimina permanentemente un curso de la base de datos y catálogo. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        codigo_o_id: {
          type: SchemaType.STRING,
          description: 'Código o ID del curso a eliminar.',
        },
      },
      required: ['codigo_o_id'],
    },
  },
  {
    name: 'matricular_alumno',
    description: 'Inscribe formalmente a un alumno en un curso mediante su número de WhatsApp. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        telefono_alumno: {
          type: SchemaType.STRING,
          description: 'Número de teléfono o WhatsApp del alumno.',
        },
        codigo_o_id_curso: {
          type: SchemaType.STRING,
          description: 'Código, ID o nombre del curso a inscribir.',
        },
        nombre_alumno: {
          type: SchemaType.STRING,
          description: 'Nombre completo del alumno.',
        },
      },
      required: ['telefono_alumno', 'codigo_o_id_curso'],
    },
  },
  {
    name: 'desmatricular_alumno',
    description: 'Retira la inscripción de un alumno de un curso. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        telefono_alumno: {
          type: SchemaType.STRING,
          description: 'Número de WhatsApp del alumno.',
        },
        codigo_o_id_curso: {
          type: SchemaType.STRING,
          description: 'Código o ID del curso.',
        },
      },
      required: ['telefono_alumno', 'codigo_o_id_curso'],
    },
  },

  // ============================================================================
  // GESTIÓN ADMINISTRATIVA: PLANES Y TARIFAS (SOLO ADMINISTRADORES)
  // ============================================================================
  {
    name: 'crear_plan',
    description: 'Crea una nueva tarifa, membresía o plan de cobro para alumnos y clientes. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        nombre: {
          type: SchemaType.STRING,
          description: 'Nombre del plan (ej: "Plan Mensual Intensivo").',
        },
        precio: {
          type: SchemaType.NUMBER,
          description: 'Precio o tarifa numérica (ej: 50.00).',
        },
        codigo: {
          type: SchemaType.STRING,
          description: 'Código identificador opcional (ej: "PLAN-INT").',
        },
        descripcion: {
          type: SchemaType.STRING,
          description: 'Detalle de los beneficios o clases que cubre.',
        },
        ciclo: {
          type: SchemaType.STRING,
          description: 'Ciclo de facturación: "monthly", "biweekly", "annual" o "one_time".',
        },
      },
      required: ['nombre', 'precio'],
    },
  },
  {
    name: 'modificar_plan',
    description: 'Modifica el precio, nombre, descripción o ciclo de un plan/tarifa existente. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        codigo_o_id: {
          type: SchemaType.STRING,
          description: 'Código, ID o nombre del plan a modificar.',
        },
        nombre: {
          type: SchemaType.STRING,
          description: 'Nuevo nombre del plan.',
        },
        precio: {
          type: SchemaType.NUMBER,
          description: 'Nuevo valor o costo numérico.',
        },
        descripcion: {
          type: SchemaType.STRING,
          description: 'Nueva descripción de beneficios.',
        },
        ciclo: {
          type: SchemaType.STRING,
          description: 'Nuevo ciclo de facturación.',
        },
        activo: {
          type: SchemaType.BOOLEAN,
          description: 'true para mantener activo, false para pausar.',
        },
      },
      required: ['codigo_o_id'],
    },
  },
  {
    name: 'eliminar_plan',
    description: 'Elimina definitivamente un plan o tarifa del catálogo de cobros. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        codigo_o_id: {
          type: SchemaType.STRING,
          description: 'Código o ID del plan a eliminar.',
        },
      },
      required: ['codigo_o_id'],
    },
  },

  // ============================================================================
  // GESTIÓN ADMINISTRATIVA: CUOTAS, COBRANZAS Y PAGOS (SOLO ADMINISTRADORES)
  // ============================================================================
  {
    name: 'generar_cuota_alumno',
    description: 'Genera una nueva cuota, mensualidad o cobro pendiente para un alumno. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        telefono_alumno: {
          type: SchemaType.STRING,
          description: 'Número de WhatsApp del alumno.',
        },
        monto: {
          type: SchemaType.NUMBER,
          description: 'Monto de la cuota en dólares u otra moneda (ej: 40.00).',
        },
        concepto: {
          type: SchemaType.STRING,
          description: 'Concepto del cobro (ej: "Mensualidad Octubre 2026", "Matrícula").',
        },
        fecha_vencimiento: {
          type: SchemaType.STRING,
          description: 'Fecha límite de pago en formato YYYY-MM-DD.',
        },
        nombre_alumno: {
          type: SchemaType.STRING,
          description: 'Nombre completo opcional del alumno.',
        },
        moneda: {
          type: SchemaType.STRING,
          description: 'Moneda del cobro (ej: "USD").',
        },
        notas: {
          type: SchemaType.STRING,
          description: 'Observaciones o notas adicionales.',
        },
      },
      required: ['telefono_alumno', 'monto', 'concepto', 'fecha_vencimiento'],
    },
  },
  {
    name: 'registrar_pago_manual',
    description: 'Marca manualmente una cuota como pagada o cancelada en el sistema. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        codigo_cuota_o_id: {
          type: SchemaType.STRING,
          description: 'Código de cuota (ej: "CUOTA-123456") o ID numérico.',
        },
        estado: {
          type: SchemaType.STRING,
          description: 'Estado: "paid" (pagado), "pending", "overdue" o "cancelled".',
        },
      },
      required: ['codigo_cuota_o_id'],
    },
  },
  {
    name: 'anular_cuota_alumno',
    description: 'Anula o descarta una cuota registrada a un alumno. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        codigo_cuota_o_id: {
          type: SchemaType.STRING,
          description: 'Código de cuota (ej: "CUOTA-123456") o ID a anular.',
        },
      },
      required: ['codigo_cuota_o_id'],
    },
  },

  // ============================================================================
  // GESTIÓN ADMINISTRATIVA: MEDIOS MULTIMEDIA (SOLO ADMINISTRADORES)
  // ============================================================================
  {
    name: 'consultar_catalogo_medios',
    description: 'Consulta los archivos multimedia, imágenes de catálogo y brochures guardados en el servidor con sus IDs, nombres y tags. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'eliminar_medio_catalogo',
    description: 'Elimina un archivo multimedia o imagen del catálogo y del disco del servidor. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id_o_nombre: {
          type: SchemaType.STRING,
          description: 'ID del medio (ej: "media-123") o nombre del archivo/título.',
        },
      },
      required: ['id_o_nombre'],
    },
  },
  {
    name: 'modificar_medio_catalogo',
    description: 'Modifica el nombre descriptivo, pie de foto o etiquetas de una imagen del catálogo. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: {
          type: SchemaType.STRING,
          description: 'ID del archivo en el catálogo (ej: "media-123").',
        },
        nombre: {
          type: SchemaType.STRING,
          description: 'Nuevo título o nombre descriptivo.',
        },
        caption: {
          type: SchemaType.STRING,
          description: 'Nuevo pie de foto o descripción.',
        },
        tags: {
          type: SchemaType.STRING,
          description: 'Nuevas etiquetas separadas por coma.',
        },
      },
      required: ['id'],
    },
  },

  // ============================================================================
  // GESTIÓN ADMINISTRATIVA: CONTACTOS Y NÚMEROS ADMINISTRADORES (SOLO ADMINISTRADORES)
  // ============================================================================
  {
    name: 'listar_administradores',
    description: 'Muestra todos los contactos autorizados con rol administrativo y sus números telefónicos principales y secundarios. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {},
    },
  },
  {
    name: 'agregar_administrador',
    description: 'Registra un nuevo contacto con permisos de administrador en el sistema, con soporte para números principales y secundarios. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        telefono: {
          type: SchemaType.STRING,
          description: 'Número principal de WhatsApp del administrador (con código de país, ej: "593999999999").',
        },
        nombre: {
          type: SchemaType.STRING,
          description: 'Nombre del administrador.',
        },
        telefonos_secundarios: {
          type: SchemaType.STRING,
          description: 'Números secundarios adicionales separados por comas (ej: "593988888888, 593977777777").',
        },
        rol: {
          type: SchemaType.STRING,
          description: 'Rol: "admin", "superadmin" o "operator". Por defecto "admin".',
        },
        notas: {
          type: SchemaType.STRING,
          description: 'Notas o descripción del contacto administrativo.',
        },
      },
      required: ['telefono', 'nombre'],
    },
  },
  {
    name: 'remover_administrador',
    description: 'Revoca o elimina un contacto administrativo por su número de teléfono o ID. Exclusivo para administradores.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        telefono_o_id: {
          type: SchemaType.STRING,
          description: 'Número de WhatsApp o ID del administrador a remover.',
        },
      },
      required: ['telefono_o_id'],
    },
  },
];

export async function executeBookingTool(
  name: string,
  args: any,
  context: { phone: string; contactName?: string; isAdmin?: boolean }
): Promise<any> {
  eventBus.log('info', 'ai', `Ejecutando Tool de Gemini: "${name}" con parámetros: ${JSON.stringify(args)}`);

  const denyAdmin = () => ({
    resultado: 'ACCESO_DENEGADO',
    mensaje: 'Esta operación requiere permisos de Administrador.',
    instruccion: 'Explica respetuosamente al usuario que no tiene permisos de administrador para realizar esta acción.',
  });

  try {
    switch (name) {
      // 1. Horarios
      case 'consultar_horarios_disponibles': {
        const slots = await bookingService.getAvailableSlots(args.fecha);
        return {
          resultado: 'OK',
          fecha_consultada: slots.date,
          dia_semana: slots.dayName,
          abierto: slots.isOpen,
          duracion_turno_minutos: slots.slotDurationMinutes,
          horarios_disponibles: slots.availableSlots,
          mensaje_estado: slots.isOpen
            ? (slots.availableSlots.length > 0 
                ? `Hay ${slots.availableSlots.length} horarios libres para esta fecha.` 
                : 'No quedan horarios libres disponibles para la fecha indicada.')
            : slots.reason,
        };
      }

      // 2. Reserva de citas
      case 'reservar_cita': {
        const clientName = args.nombre_cliente || context.contactName || `Cliente ${context.phone.slice(-4)}`;
        const appointment = await bookingService.bookAppointment({
          phone: context.phone,
          clientName: clientName,
          date: args.fecha,
          time: args.hora,
          serviceName: args.nombre_servicio,
          notes: args.notas,
        });

        return {
          resultado: 'EXITO',
          codigo_reserva: appointment.booking_code,
          cliente: appointment.client_name,
          servicio: appointment.service_name,
          fecha: appointment.appointment_date,
          hora_inicio: appointment.start_time.slice(0, 5),
          hora_fin: appointment.end_time.slice(0, 5),
          estado: 'CONFIRMADA',
          instruccion: 'Indícale al usuario con entusiasmo que su cita está confirmada y entrégale los datos con el código de reserva.',
        };
      }

      // 3. Mis citas
      case 'consultar_mis_citas': {
        const appointments = await bookingService.getAppointmentsByPhone(context.phone);
        const active = appointments.filter(a => a.status === 'confirmed' || a.status === 'pending');
        return {
          resultado: 'OK',
          total_citas_activas: active.length,
          citas: active.map(a => ({
            codigo: a.booking_code,
            servicio: a.service_name,
            fecha: a.appointment_date,
            hora: `${a.start_time.slice(0, 5)} - ${a.end_time.slice(0, 5)}`,
            estado: a.status,
          })),
        };
      }

      // 4. Cancelar cita
      case 'cancelar_cita': {
        const cancelResult = await bookingService.cancelAppointment(context.phone, args.codigo_o_fecha);
        return {
          resultado: cancelResult.success ? 'CANCELADA' : 'NO_ENCONTRADA',
          codigo_cancelado: cancelResult.cancelledCode,
          mensaje: cancelResult.message,
        };
      }

      // 5. Mis clases
      case 'consultar_mis_clases_y_cursos': {
        const studentClasses = await bookingService.getStudentClasses(context.phone);
        if (!studentClasses.isEnrolled) {
          return {
            resultado: 'NO_MATRICULADO',
            mensaje: 'No encontramos cursos activos asociados a tu número de WhatsApp.',
            sugerencia: 'Ofrecerle los cursos disponibles consultando la lista de cursos.',
          };
        }
        return {
          resultado: 'ALUMNO_MATRICULADO',
          nombre_alumno: studentClasses.studentName,
          total_cursos: studentClasses.classes.length,
          clases: studentClasses.classes.map(c => ({
            curso: c.courseTitle,
            dias: c.scheduleDays,
            horario: `${c.startTime.slice(0, 5)} a ${c.endTime.slice(0, 5)}`,
            profesor: c.instructor,
            ubicacion_o_enlace: c.location,
          })),
        };
      }

      // 6. Cursos disponibles
      case 'consultar_cursos_disponibles': {
        const courses = await bookingService.getCourses();
        const active = courses.filter(c => c.is_active);
        return {
          resultado: 'OK',
          cursos_disponibles: active.map(c => ({
            codigo: c.code,
            titulo: c.title,
            descripcion: c.description,
            dias: c.schedule_days,
            horario: `${c.start_time.slice(0, 5)} - ${c.end_time.slice(0, 5)}`,
            profesor: c.instructor,
            cupo_maximo: c.max_capacity,
            cupos_disponibles: Math.max(0, c.max_capacity - (c.enrolled_count || 0)),
          })),
        };
      }

      // 7. Estado de cuenta y mensualidades del cliente
      case 'consultar_estado_cuenta': {
        const bills = await financeService.getBillsByPhone(context.phone);
        const pendingBills = bills.filter(b => b.status === 'pending' || b.status === 'partial' || b.status === 'overdue');
        const paidBills = bills.filter(b => b.status === 'paid');
        const totalPending = pendingBills.reduce((acc, b) => acc + (b.balance_pending || 0), 0);

        return {
          resultado: 'OK',
          alumno: context.contactName || `Cliente ${context.phone.slice(-4)}`,
          tiene_deuda: pendingBills.length > 0,
          saldo_pendiente_total: totalPending,
          total_cuotas_pendientes: pendingBills.length,
          cuotas_pendientes: pendingBills.map(b => ({
            codigo: b.bill_code,
            concepto: b.concept,
            monto_total: b.amount,
            abonado: b.amount_paid,
            saldo_a_pagar: b.balance_pending,
            fecha_vencimiento: b.due_date,
            estado: b.status,
          })),
          total_cuotas_pagadas: paidBills.length,
          mensaje_instruccion: pendingBills.length > 0
            ? 'Informa al usuario amablemente sobre su saldo pendiente y explícale que puede enviar su comprobante de pago por este mismo chat para validarlo al instante.'
            : 'Felicita al usuario porque se encuentra 100% al día con sus mensualidades y pagos.',
        };
      }

      // 8. Planes y tarifas
      case 'consultar_planes_y_tarifas': {
        const plans = await financeService.getPlans();
        const active = plans.filter(p => p.is_active);
        return {
          resultado: 'OK',
          planes_disponibles: active.map(p => ({
            codigo: p.code,
            nombre: p.name,
            precio: p.price,
            ciclo: p.billing_cycle === 'monthly' ? 'Mensual' : p.billing_cycle,
            descripcion: p.description,
          })),
        };
      }

      // 9. Métricas del negocio (Analítica en vivo - Solo Administradores)
      case 'consultar_metricas_negocio': {
        if (!context.isAdmin) {
          return {
            resultado: 'ACCESO_DENEGADO',
            mensaje: 'Esta información es confidencial y solo está autorizada para números de contacto administrativo del negocio.',
            instruccion: 'Explica respetuosamente al usuario que no tiene permisos de administrador para consultar métricas financieras globales, y pregúntale amablemente en qué otra cosa referente a sus propias citas o clases puedes ayudarle.',
          };
        }
        const stats = await financeService.getFinancialStats();
        const bookingStats = await bookingService.getDashboardStats();
        return {
          resultado: 'OK',
          recaudacion_mes_actual: stats.totalCollectedMonth,
          saldo_pendiente_por_cobrar: stats.totalPendingAmount,
          tasa_cobranza_porcentaje: stats.collectionRatePct,
          cuotas_vencidas: stats.overdueBillsCount,
          vouchers_validados_hoy: stats.vouchersValidatedToday,
          alumnos_activos: stats.activeStudents,
          citas_hoy: bookingStats.todayAppointments,
          proximas_citas: bookingStats.upcomingAppointments,
          cursos_activos: bookingStats.activeCourses,
        };
      }

      // 10. Reporte de deudores (Solo Administradores)
      case 'consultar_deudores': {
        if (!context.isAdmin) {
          return {
            resultado: 'ACCESO_DENEGADO',
            mensaje: 'Esta información es confidencial y solo está autorizada para números de contacto administrativo del negocio.',
            instruccion: 'Explica respetuosamente al usuario que no tiene permisos de administrador para consultar listas de alumnos con deudas, y pregúntale amablemente en qué otra cosa referente a sus propias citas o clases puedes ayudarle.',
          };
        }
        const debtors = await financeService.getDebtors();
        const totalDebt = debtors.reduce((acc, d) => acc + (d.total_debt || 0), 0);
        return {
          resultado: 'OK',
          total_alumnos_con_deuda: debtors.length,
          deuda_total_acumulada: totalDebt,
          deudores: debtors.map(d => ({
            alumno: d.student_name,
            telefono: d.student_phone,
            deuda: d.total_debt,
            cuotas_pendientes: d.bills_count,
            vencimiento_mas_antiguo: d.oldest_due_date,
            conceptos: d.concepts,
          })),
        };
      }

      // 11. Resumen ejecutivo integral (Solo Administradores)
      case 'consultar_resumen_ejecutivo': {
        if (!context.isAdmin) {
          return {
            resultado: 'ACCESO_DENEGADO',
            mensaje: 'Esta información es confidencial y solo está autorizada para números de contacto administrativo del negocio.',
            instruccion: 'Explica respetuosamente al usuario que no tiene permisos de administrador para consultar el resumen ejecutivo de la empresa.',
          };
        }
        const finStats = await financeService.getFinancialStats();
        const debtors = await financeService.getDebtors();
        const bookingStats = await bookingService.getDashboardStats();
        const appointmentsToday = await bookingService.getAppointmentsList({
          date: new Date().toISOString().split('T')[0],
        });

        return {
          resultado: 'OK',
          finanzas: {
            recaudacion_mes: finStats.totalCollectedMonth,
            saldo_por_cobrar: finStats.totalPendingAmount,
            tasa_cobranza: `${finStats.collectionRatePct}%`,
            alumnos_con_deuda: debtors.length,
            vouchers_validados_hoy: finStats.vouchersValidatedToday,
          },
          operaciones: {
            alumnos_activos: finStats.activeStudents,
            citas_hoy: bookingStats.todayAppointments,
            citas_programadas_hoy: appointmentsToday.map(a => ({
              codigo: a.booking_code,
              cliente: a.client_name,
              servicio: a.service_name,
              horario: `${a.start_time.slice(0, 5)} - ${a.end_time.slice(0, 5)}`,
              estado: a.status,
            })),
            cursos_activos: bookingStats.activeCourses,
          },
          recomendacion_ejecutiva: debtors.length > 0
            ? `Se recomienda enviar recordatorios preventivos a los ${debtors.length} alumnos con pagos pendientes para maximizar el flujo de caja.`
            : 'El negocio opera con 100% de cumplimiento en cobranzas y agenda al día.',
        };
      }

      // ============================================================================
      // GESTIÓN ADMINISTRATIVA: CURSOS Y CLASES (SOLO ADMINISTRADORES)
      // ============================================================================
      case 'crear_curso': {
        if (!context.isAdmin) return denyAdmin();
        const code = args.codigo || `CURSO-${Date.now().toString().slice(-4)}`;
        const course = await bookingService.createCourse({
          code: code.toUpperCase(),
          title: args.titulo,
          description: args.descripcion || '',
          instructor: args.profesor || 'Docente Asignado',
          schedule_days: args.dias,
          start_time: args.hora_inicio.length === 5 ? `${args.hora_inicio}:00` : args.hora_inicio,
          end_time: args.hora_fin.length === 5 ? `${args.hora_fin}:00` : args.hora_fin,
          location_or_link: args.ubicacion_o_enlace || 'Aula Virtual',
          max_capacity: Number(args.cupo_maximo) || 30,
          is_active: true,
        });
        return {
          resultado: 'EXITO',
          mensaje: `Curso "${course.title}" (${course.code}) creado exitosamente.`,
          curso: {
            id: course.id,
            codigo: course.code,
            titulo: course.title,
            dias: course.schedule_days,
            horario: `${course.start_time.slice(0, 5)} - ${course.end_time.slice(0, 5)}`,
            profesor: course.instructor,
            cupos: course.max_capacity,
          },
        };
      }

      case 'modificar_curso': {
        if (!context.isAdmin) return denyAdmin();
        const allCourses = await bookingService.getCourses();
        const target = allCourses.find(c =>
          String(c.id) === String(args.codigo_o_id).trim() ||
          c.code.toLowerCase() === String(args.codigo_o_id).trim().toLowerCase() ||
          c.title.toLowerCase().includes(String(args.codigo_o_id).trim().toLowerCase())
        );
        if (!target) {
          return {
            resultado: 'ERROR',
            mensaje: `No se encontró ningún curso con código, ID o título "${args.codigo_o_id}".`,
          };
        }
        const updated = await bookingService.updateCourse(target.id, {
          title: args.titulo,
          description: args.descripcion,
          instructor: args.profesor,
          schedule_days: args.dias,
          start_time: args.hora_inicio ? (args.hora_inicio.length === 5 ? `${args.hora_inicio}:00` : args.hora_inicio) : undefined,
          end_time: args.hora_fin ? (args.hora_fin.length === 5 ? `${args.hora_fin}:00` : args.hora_fin) : undefined,
          location_or_link: args.ubicacion_o_enlace,
          max_capacity: args.cupo_maximo !== undefined ? Number(args.cupo_maximo) : undefined,
          is_active: args.activo !== undefined ? Boolean(args.activo) : undefined,
        });
        return {
          resultado: 'EXITO',
          mensaje: `Curso "${updated.title}" actualizado con éxito.`,
          curso: updated,
        };
      }

      case 'eliminar_curso': {
        if (!context.isAdmin) return denyAdmin();
        const allCourses = await bookingService.getCourses();
        const target = allCourses.find(c =>
          String(c.id) === String(args.codigo_o_id).trim() ||
          c.code.toLowerCase() === String(args.codigo_o_id).trim().toLowerCase()
        );
        if (!target) {
          return {
            resultado: 'ERROR',
            mensaje: `No se encontró el curso "${args.codigo_o_id}" para eliminar.`,
          };
        }
        await bookingService.deleteCourse(target.id);
        return {
          resultado: 'EXITO',
          mensaje: `Curso "${target.title}" (${target.code}) eliminado correctamente de la base de datos.`,
        };
      }

      case 'matricular_alumno': {
        if (!context.isAdmin) return denyAdmin();
        const allCourses = await bookingService.getCourses();
        const target = allCourses.find(c =>
          String(c.id) === String(args.codigo_o_id_curso).trim() ||
          c.code.toLowerCase() === String(args.codigo_o_id_curso).trim().toLowerCase() ||
          c.title.toLowerCase().includes(String(args.codigo_o_id_curso).trim().toLowerCase())
        );
        if (!target) {
          return {
            resultado: 'ERROR',
            mensaje: `No se encontró el curso "${args.codigo_o_id_curso}".`,
          };
        }
        await bookingService.enrollStudent(args.telefono_alumno, target.id, args.nombre_alumno);
        return {
          resultado: 'EXITO',
          mensaje: `Alumno ${args.nombre_alumno || args.telefono_alumno} matriculado exitosamente en el curso "${target.title}".`,
        };
      }

      case 'desmatricular_alumno': {
        if (!context.isAdmin) return denyAdmin();
        const allCourses = await bookingService.getCourses();
        const target = allCourses.find(c =>
          String(c.id) === String(args.codigo_o_id_curso).trim() ||
          c.code.toLowerCase() === String(args.codigo_o_id_curso).trim().toLowerCase()
        );
        if (!target) {
          return {
            resultado: 'ERROR',
            mensaje: `No se encontró el curso "${args.codigo_o_id_curso}".`,
          };
        }
        await bookingService.unenrollStudent(args.telefono_alumno, target.id);
        return {
          resultado: 'EXITO',
          mensaje: `Alumno con teléfono ${args.telefono_alumno} retirado del curso "${target.title}".`,
        };
      }

      // ============================================================================
      // GESTIÓN ADMINISTRATIVA: PLANES Y TARIFAS (SOLO ADMINISTRADORES)
      // ============================================================================
      case 'crear_plan': {
        if (!context.isAdmin) return denyAdmin();
        const plan = await financeService.createPlan({
          code: args.codigo || `PLAN-${Date.now().toString().slice(-4)}`,
          name: args.nombre,
          description: args.descripcion || '',
          price: Number(args.precio) || 0,
          billing_cycle: args.ciclo || 'monthly',
          is_active: true,
        });
        return {
          resultado: 'EXITO',
          mensaje: `Plan "${plan.name}" creado con éxito. Tarifa: $${plan.price} (${plan.billing_cycle}).`,
          plan,
        };
      }

      case 'modificar_plan': {
        if (!context.isAdmin) return denyAdmin();
        const allPlans = await financeService.getPlans();
        const target = allPlans.find(p =>
          String(p.id) === String(args.codigo_o_id).trim() ||
          p.code.toLowerCase() === String(args.codigo_o_id).trim().toLowerCase() ||
          p.name.toLowerCase().includes(String(args.codigo_o_id).trim().toLowerCase())
        );
        if (!target) {
          return {
            resultado: 'ERROR',
            mensaje: `No se encontró el plan o tarifa "${args.codigo_o_id}".`,
          };
        }
        const updated = await financeService.updatePlan(target.id, {
          name: args.nombre,
          description: args.descripcion,
          price: args.precio !== undefined ? Number(args.precio) : undefined,
          billing_cycle: args.ciclo,
          is_active: args.activo !== undefined ? Boolean(args.activo) : undefined,
        });
        return {
          resultado: 'EXITO',
          mensaje: `Plan "${updated.name}" actualizado exitosamente.`,
          plan: updated,
        };
      }

      case 'eliminar_plan': {
        if (!context.isAdmin) return denyAdmin();
        const allPlans = await financeService.getPlans();
        const target = allPlans.find(p =>
          String(p.id) === String(args.codigo_o_id).trim() ||
          p.code.toLowerCase() === String(args.codigo_o_id).trim().toLowerCase()
        );
        if (!target) {
          return {
            resultado: 'ERROR',
            mensaje: `No se encontró el plan "${args.codigo_o_id}".`,
          };
        }
        await financeService.deletePlan(target.id);
        return {
          resultado: 'EXITO',
          mensaje: `Plan "${target.name}" (${target.code}) eliminado del sistema.`,
        };
      }

      // ============================================================================
      // GESTIÓN ADMINISTRATIVA: CUOTAS, COBRANZAS Y PAGOS (SOLO ADMINISTRADORES)
      // ============================================================================
      case 'generar_cuota_alumno': {
        if (!context.isAdmin) return denyAdmin();
        const newBill = await financeService.createBill({
          studentPhone: args.telefono_alumno,
          studentName: args.nombre_alumno || `Alumno ${args.telefono_alumno.slice(-4)}`,
          concept: args.concepto || 'Mensualidad',
          amount: Number(args.monto) || 0,
          currency: args.moneda || 'USD',
          dueDate: args.fecha_vencimiento,
          notes: args.notas || '',
        });
        return {
          resultado: 'EXITO',
          mensaje: `Cuota ${newBill.bill_code} por $${newBill.amount} emitida para ${newBill.student_name}.`,
          cuota: {
            codigo: newBill.bill_code,
            alumno: newBill.student_name,
            telefono: newBill.student_phone,
            monto: newBill.amount,
            concepto: newBill.concept,
            vencimiento: newBill.due_date,
          },
        };
      }

      case 'registrar_pago_manual': {
        if (!context.isAdmin) return denyAdmin();
        const allBills = await financeService.getBills({ search: args.codigo_cuota_o_id });
        const target = allBills.find(b =>
          String(b.id) === String(args.codigo_cuota_o_id).trim() ||
          b.bill_code.toLowerCase() === String(args.codigo_cuota_o_id).trim().toLowerCase()
        ) || allBills[0];
        if (!target) {
          return {
            resultado: 'ERROR',
            mensaje: `No se encontró ninguna cuota con código o búsqueda "${args.codigo_cuota_o_id}".`,
          };
        }
        const status = args.estado || 'paid';
        const updated = await financeService.updateBillStatus(target.id, status);
        return {
          resultado: 'EXITO',
          mensaje: `Cuota ${updated.bill_code} de ${updated.student_name} actualizada a estado: ${updated.status}.`,
          cuota: updated,
        };
      }

      case 'anular_cuota_alumno': {
        if (!context.isAdmin) return denyAdmin();
        const allBills = await financeService.getBills({ search: args.codigo_cuota_o_id });
        const target = allBills.find(b =>
          String(b.id) === String(args.codigo_cuota_o_id).trim() ||
          b.bill_code.toLowerCase() === String(args.codigo_cuota_o_id).trim().toLowerCase()
        ) || allBills[0];
        if (!target) {
          return {
            resultado: 'ERROR',
            mensaje: `No se encontró la cuota "${args.codigo_cuota_o_id}".`,
          };
        }
        const cancelled = await financeService.updateBillStatus(target.id, 'cancelled');
        return {
          resultado: 'EXITO',
          mensaje: `Cuota ${cancelled.bill_code} de ${cancelled.student_name} anulada correctamente.`,
        };
      }

      // ============================================================================
      // GESTIÓN ADMINISTRATIVA: MEDIOS MULTIMEDIA (SOLO ADMINISTRADORES)
      // ============================================================================
      case 'consultar_catalogo_medios': {
        if (!context.isAdmin) return denyAdmin();
        const mediaItems = storage.getMediaCatalog();
        return {
          resultado: 'OK',
          total_medios: mediaItems.length,
          medios: mediaItems.map(m => ({
            id: m.id,
            nombre: m.name,
            archivo: m.filename,
            descripcion: m.description,
            etiquetas: m.tags,
            tipo: m.mimeType,
          })),
        };
      }

      case 'eliminar_medio_catalogo': {
        if (!context.isAdmin) return denyAdmin();
        const mediaItems = storage.getMediaCatalog();
        const target = mediaItems.find(m =>
          m.id.toLowerCase() === String(args.id_o_nombre).trim().toLowerCase() ||
          m.name.toLowerCase() === String(args.id_o_nombre).trim().toLowerCase() ||
          m.filename.toLowerCase() === String(args.id_o_nombre).trim().toLowerCase()
        );
        if (!target) {
          return {
            resultado: 'ERROR',
            mensaje: `No se encontró ningún medio con ID o nombre "${args.id_o_nombre}".`,
          };
        }
        const deleted = storage.deleteMediaItem(target.id);
        return {
          resultado: deleted ? 'EXITO' : 'ERROR',
          mensaje: deleted ? `Medio "${target.name}" (${target.id}) eliminado correctamente del catálogo.` : 'No se pudo eliminar el medio.',
        };
      }

      case 'modificar_medio_catalogo': {
        if (!context.isAdmin) return denyAdmin();
        const tags = args.tags ? (typeof args.tags === 'string' ? args.tags.split(',').map((t: string) => t.trim()) : args.tags) : undefined;
        const updated = storage.updateMediaItem(args.id, {
          name: args.nombre,
          description: args.caption || args.descripcion,
          tags: tags,
        });
        if (!updated) {
          return {
            resultado: 'ERROR',
            mensaje: `No se encontró el medio con ID "${args.id}".`,
          };
        }
        return {
          resultado: 'EXITO',
          mensaje: `Medio "${updated.name}" actualizado correctamente.`,
          medio: updated,
        };
      }

      // ============================================================================
      // GESTIÓN ADMINISTRATIVA: CONTACTOS Y NÚMEROS ADMINISTRADORES (SOLO ADMINISTRADORES)
      // ============================================================================
      case 'listar_administradores': {
        if (!context.isAdmin) return denyAdmin();
        const admins = await adminContactService.getAdminContacts();
        return {
          resultado: 'OK',
          total_administradores: admins.length,
          administradores: admins.map(a => ({
            id: a.id,
            nombre: a.name,
            telefono_principal: a.phone,
            telefonos_secundarios: a.secondary_phones || 'Ninguno',
            rol: a.role,
            activo: a.is_active,
          })),
        };
      }

      case 'agregar_administrador': {
        if (!context.isAdmin) return denyAdmin();
        const newAdmin = await adminContactService.createAdminContact({
          phone: args.telefono,
          name: args.nombre,
          secondary_phones: args.telefonos_secundarios || '',
          role: args.rol || 'admin',
          notes: args.notas || 'Creado vía chatbot WhatsApp por admin',
        });
        return {
          resultado: 'EXITO',
          mensaje: `Administrador "${newAdmin.name}" (${newAdmin.phone}) registrado exitosamente con rol ${newAdmin.role}.`,
          administrador: newAdmin,
        };
      }

      case 'remover_administrador': {
        if (!context.isAdmin) return denyAdmin();
        const admins = await adminContactService.getAdminContacts();
        const target = admins.find(a =>
          String(a.id) === String(args.telefono_o_id).trim() ||
          a.phone.replace(/[^0-9]/g, '') === String(args.telefono_o_id).replace(/[^0-9]/g, '')
        );
        if (!target) {
          return {
            resultado: 'ERROR',
            mensaje: `No se encontró el contacto administrativo "${args.telefono_o_id}".`,
          };
        }
        const deleted = await adminContactService.deleteAdminContact(target.id);
        return {
          resultado: deleted ? 'EXITO' : 'ERROR',
          mensaje: deleted ? `Contacto administrativo "${target.name}" (${target.phone}) eliminado correctamente.` : 'No se pudo eliminar el contacto.',
        };
      }

      default:
        throw new Error(`Función desconocida: ${name}`);
    }
  } catch (err: any) {
    eventBus.log('warn', 'ai', `Error ejecutando tool ${name}: ${err?.message || err}`);
    return {
      resultado: 'ERROR',
      error: err?.message || 'Error al procesar la solicitud.',
    };
  }
}
