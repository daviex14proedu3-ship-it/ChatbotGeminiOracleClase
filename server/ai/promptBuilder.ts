import { storage, KnowledgeItem, MediaCatalogItem } from '../storage/store.js';

export function buildSystemInstruction(): string {
  const settings = storage.getSettings();
  const baseInstruction = settings.systemPrompt || 'Eres un asistente virtual profesional para WhatsApp.';

  const kbItems = storage.getKnowledgeBase().filter(item => item.isActive);
  const mediaItems = storage.getMediaCatalog();

  const now = new Date();
  const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dayName = daysOfWeek[now.getDay()];
  const dateFormatted = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timeFormatted = now.toTimeString().split(' ')[0].slice(0, 5); // HH:MM

  let kbSection = '=== BASE DE CONOCIMIENTOS DE LA EMPRESA ===\n';
  if (kbItems.length === 0) {
    kbSection += 'No hay artículos específicos cargados. Responde cordialmente y con sentido común.\n';
  } else {
    kbItems.forEach((item, index) => {
      kbSection += `[ARTÍCULO ${index + 1}]: ${item.title} (Categoría: ${item.category})\n`;
      kbSection += `Contenido: ${item.content}\n`;
      if (item.tags && item.tags.length > 0) {
        kbSection += `Etiquetas clave: ${item.tags.join(', ')}\n`;
      }
      kbSection += '\n';
    });
  }

  let mediaSection = '=== CATÁLOGO DE MEDIOS / IMÁGENES DISPONIBLES ===\n';
  if (mediaItems.length === 0) {
    mediaSection += 'Actualmente no hay imágenes registradas en el catálogo del servidor.\n';
  } else {
    mediaSection += 'Si el cliente solicita explícitamente ver fotos, comprobantes, catálogos o imágenes que coincidan con estos elementos, debes incluir EXACTAMENTE la etiqueta [SEND_MEDIA:ID] en tu mensaje (por ejemplo: "Aquí te comparto nuestro catálogo [SEND_MEDIA:media-123]").\nMedios registrados:\n';
    mediaItems.forEach(media => {
      mediaSection += `- ID: "${media.id}" | Nombre: "${media.name}" | Descripción: "${media.description}" | Etiquetas: ${media.tags.join(', ')}\n`;
    });
  }

  const schedulingSection = `=== GESTIÓN DE CITAS, HORARIOS, CLASES Y ALUMNOS (TOOLS ACTIVAS) ===
FECHA Y HORA ACTUAL: Hoy es ${dayName}, ${dateFormatted}, hora: ${timeFormatted}.
Cuando el cliente se refiera a fechas relativas:
- "hoy" corresponde a: ${dateFormatted}
- "mañana" corresponde a: ${new Date(now.getTime() + 86400000).toISOString().split('T')[0]}

REGLAS DE ATENCIÓN DE CITAS Y CLASES:
1. Disponibilidad de Horarios: Si el usuario pregunta "¿Qué horarios tienes?", "¿Tienes cita mañana?", "¿A qué hora atienden?", USA INMEDIATAMENTE la herramienta "consultar_horarios_disponibles" con la fecha calculada. NUNCA inventes horarios libres, consulta la herramienta.
2. Agendar Citas: Si el usuario dice "Reserva mi cita a las 4", "Quiero agendar para mañana", ejecuta la herramienta "reservar_cita". Si falta la fecha o la hora, pídeselas amablemente antes de reservar.
3. Consultas de Alumnos y Clases: Si el usuario pregunta "¿A qué hora tengo clase?", "¿En qué curso estoy?", "¿Tengo clase hoy?", ejecuta la herramienta "consultar_mis_clases_y_cursos". Si está inscrito, infórmale con precisión sus horarios, profesor y aula/enlace.
4. Cursos Disponibles: Si el usuario pregunta qué cursos o talleres se dictan, ejecuta "consultar_cursos_disponibles".`;

  const finalPrompt = `${baseInstruction}

${schedulingSection}

${kbSection}

${mediaSection}

INSTRUCCIONES CLAVE DE FORMATO Y COMPORTAMIENTO:
1. Responde de forma concisa, clara y amigable en español. WhatsApp es un medio de mensajería rápida.
2. Utiliza negritas con asteriscos (*texto*) y emojis cuando sea pertinente para una lectura agradable.
3. Siempre que reserves una cita, menciona claramente la fecha, la hora, el servicio y el *código de reserva*.
4. Si se te solicita una imagen del catálogo, incluye la etiqueta [SEND_MEDIA:ID] correspondiente al final.
5. Sé siempre servicial, profesional y empático.`;

  return finalPrompt;
}
