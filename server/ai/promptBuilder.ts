import { storage, KnowledgeItem, MediaCatalogItem } from '../storage/store.js';

export function buildSystemInstruction(): string {
  const settings = storage.getSettings();
  const baseInstruction = settings.systemPrompt || 'Eres un asistente virtual profesional para WhatsApp.';

  const kbItems = storage.getKnowledgeBase().filter(item => item.isActive);
  const mediaItems = storage.getMediaCatalog();

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

  const finalPrompt = `${baseInstruction}

${kbSection}

${mediaSection}

INSTRUCCIONES CLAVE DE FORMATO Y COMPORTAMIENTO:
1. Responde de forma concisa, clara y amigable en español. WhatsApp es un medio de mensajería rápida.
2. Utiliza negritas con asteriscos (*texto*) y emojis cuando sea pertinente.
3. Basa tus respuestas únicamente en los datos de la Base de Conocimientos.
4. Si se te solicita una imagen del catálogo, incluye la etiqueta [SEND_MEDIA:ID] correspondiente al final o en el contexto adecuado.
5. Si no sabes la respuesta o no está en la base de conocimientos, ofrece derivar la consulta a un asesor humano.`;

  return finalPrompt;
}
