import { CartItem, CityItem, PizzaItem, SaleChannelItem } from '../types';

export interface VoiceActionCallbacks {
  getCurrentCart?: () => CartItem[];
  onAddPizza: (pizzaId: string, quantity: number) => void;
  onRemovePizza?: (pizzaId: string, quantity?: number) => void;
  onSetCart?: (items: Array<{ pizzaId: string; quantity: number }>) => void;
  onSetCity: (cityId: number) => void;
  onSetChannel: (channelId: number) => void;
  onConfirmOrder: () => void;
  onClearCart: () => void;
  onTranscriptUser: (text: string, isFinal: boolean) => void;
  onTranscriptAI: (text: string) => void;
  onStatusChange: (status: 'idle' | 'connecting' | 'listening' | 'speaking' | 'error', detail?: string) => void;
  onAudioLevel: (level: number) => void;
}

const SPANISH_NUMBERS: Record<string, number> = {
  un: 1, una: 1, uno: 1,
  dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10
};

const PIZZA_ALIASES: Array<{ keywords: string[]; typeId: string; label: string }> = [
  { keywords: ['hawaiana', 'hawaianas', 'hawayana', 'hawayanas', 'hawaiian', 'piña', 'jamon y piña'], typeId: 'hawaiian', label: 'The Hawaiian Pizza' },
  { keywords: ['pepperoni salami', 'peperoni salami', 'salami'], typeId: 'peppr_salami', label: 'The Pepperoni, Mushroom, and Peppers Pizza' },
  { keywords: ['pepperoni', 'peperoni'], typeId: 'pepperoni', label: 'The Pepperoni Pizza' },
  { keywords: ['california', 'pollo california'], typeId: 'cali_ckn', label: 'The California Chicken Pizza' },
  { keywords: ['alfredo', 'pollo alfredo'], typeId: 'ckn_alfredo', label: 'The Chicken Alfredo Pizza' },
  { keywords: ['pesto', 'pollo pesto'], typeId: 'ckn_pesto', label: 'The Chicken Pesto Pizza' },
  { keywords: ['southwest', 'suroeste', 'chipotle', 'pollo chipotle'], typeId: 'southw_ckn', label: 'The Southwest Chicken Pizza' },
  { keywords: ['thai', 'tailandesa', 'pollo thai'], typeId: 'thai_ckn', label: 'The Thai Chicken Pizza' },
  { keywords: ['barbecue', 'bbq', 'barbacoa', 'pollo bbq', 'pollo barbacoa', 'de pollo', 'pollo'], typeId: 'bbq_ckn', label: 'The Barbecue Chicken Pizza' },
  { keywords: ['big meat', 'mucha carne', 'carnivora', 'carnes'], typeId: 'big_meat', label: 'The Big Meat Pizza' },
  { keywords: ['classic deluxe', 'clasica deluxe', 'clasica', 'deluxe'], typeId: 'classic_dlx', label: 'The Classic Deluxe Pizza' },
  { keywords: ['italiana capocollo', 'capocollo'], typeId: 'ital_cpcllo', label: 'The Italian Capocollo Pizza' },
  { keywords: ['napolitana', 'napolitano'], typeId: 'napolitana', label: 'The Napolitana Pizza' },
  { keywords: ['griega', 'greek'], typeId: 'the_greek', label: 'The Greek Pizza' },
  { keywords: ['cinco quesos', '5 quesos', 'five cheese'], typeId: 'five_cheese', label: 'The Five Cheese Pizza' },
  { keywords: ['cuatro quesos', '4 quesos', 'four cheese'], typeId: 'four_cheese', label: 'The Four Cheese Pizza' },
  { keywords: ['green garden', 'jardin verde', 'jardin'], typeId: 'green_garden', label: 'The Green Garden Pizza' },
  { keywords: ['italiana vegetales', 'italiana vegetariana', 'italian vegetables'], typeId: 'ital_veggie', label: 'The Italian Vegetables Pizza' },
  { keywords: ['mediterranea', 'mediterraneo'], typeId: 'mediterraneo', label: 'The Mediterranean Pizza' },
  { keywords: ['mexicana', 'mexicano', 'jalapeño'], typeId: 'mexicana', label: 'The Mexicana Pizza' },
  { keywords: ['espinaca pesto', 'spinach pesto'], typeId: 'spin_pesto', label: 'The Spinach Pesto Pizza' },
  { keywords: ['espinaca y feta', 'spinach and feta', 'feta', 'espinaca', 'spinach'], typeId: 'spinach_fet', label: 'The Spinach and Feta Pizza' },
  { keywords: ['vegetariana', 'vegetables', 'veggie', 'vegetales'], typeId: 'veggie_veg', label: 'The Vegetables + Vegetables Pizza' },
  { keywords: ['brie', 'carre', 'brie carre'], typeId: 'brie_carre', label: 'The Brie Carre Pizza' },
  { keywords: ['calabrese', 'calabresa'], typeId: 'calabrese', label: 'The Calabrese Pizza' },
  { keywords: ['italiana suprema', 'italian supreme'], typeId: 'ital_supr', label: 'The Italian Supreme Pizza' },
  { keywords: ['peppry', 'champiñones', 'mushroom'], typeId: 'pep_msh_pep', label: 'The Pepperoni, Mushroom, and Peppers Pizza' },
  { keywords: ['prosciutto', 'arugula', 'jamon serrano'], typeId: 'prsc_argla', label: 'The Prosciutto and Arugula Pizza' },
  { keywords: ['siciliana', 'sicilian'], typeId: 'sicilian', label: 'The Sicilian Pizza' },
  { keywords: ['soppressata'], typeId: 'soppressata', label: 'The Soppressata Pizza' },
  { keywords: ['spicy italian', 'italiana picante', 'picante'], typeId: 'spicy_ital', label: 'The Spicy Italian Pizza' },
  { keywords: ['suprema', 'supreme'], typeId: 'spinach_supr', label: 'The Spinach Supreme Pizza' }
];

/**
 * Construye el catálogo completo de las 32 variedades de dim_pizaTipeID con sus ingredientes exactos,
 * categoría y todos los tamaños/precios disponibles en dim_pizzas.
 */
export function buildFullCatalogWithIngredients(pizzas: PizzaItem[]): string {
  const byType = new Map<
    string,
    {
      name: string;
      category: string;
      ingredients: string;
      sizes: string[];
    }
  >();

  for (const p of pizzas) {
    if (!byType.has(p.pizza_type_id)) {
      byType.set(p.pizza_type_id, {
        name: p.name,
        category: p.category,
        ingredients: p.ingredients,
        sizes: []
      });
    }
    byType.get(p.pizza_type_id)!.sizes.push(`${p.size}=${p.pizza_id}($${p.price})`);
  }

  const lines: string[] = [];
  for (const [typeId, info] of byType.entries()) {
    lines.push(
      `• [${typeId}] ${info.name} (Categoría: ${info.category}) | Ingredientes: ${info.ingredients} | Tamaños: ${info.sizes.join(', ')}`
    );
  }
  return lines.join('\n');
}

export function parseNaturalVoiceOrder(
  rawText: string,
  pizzas: PizzaItem[],
  cities: CityItem[],
  channels: SaleChannelItem[],
  callbacks: VoiceActionCallbacks
): { handled: boolean; reply: string } {
  const text = rawText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const currentCart = callbacks.getCurrentCart ? callbacks.getCurrentCart() : [];
  const actionsTaken: string[] = [];

  // 1. Vaciar todo el carrito explícitamente
  if (
    text.includes('vaciar') ||
    text.includes('limpiar') ||
    text.includes('cancelar todo') ||
    text.includes('borrar todo') ||
    text.includes('ya no quiero nada')
  ) {
    callbacks.onClearCart();
    return {
      handled: true,
      reply: 'He vaciado el pedido actual por completo. ¿Qué pizzas te gustaría ordenar?'
    };
  }

  // 2. Consulta de ingredientes ("qué ingredientes tiene...", "qué lleva...", "qué trae...")
  if (
    text.includes('ingrediente') ||
    text.includes('que lleva') ||
    text.includes('que trae') ||
    text.includes('que contiene') ||
    text.includes('de que es')
  ) {
    for (const alias of PIZZA_ALIASES) {
      if (alias.keywords.some((kw) => text.includes(kw))) {
        const sample = pizzas.find((p) => p.pizza_type_id === alias.typeId);
        if (sample) {
          const sizesInfo = pizzas
            .filter((p) => p.pizza_type_id === alias.typeId)
            .map((p) => `${p.size} ($${p.price})`)
            .join(', ');
          return {
            handled: true,
            reply: `La pizza ${sample.name} (categoría ${sample.category}) lleva: ${sample.ingredients}. Está disponible en tamaños ${sizesInfo}. ¿Te gustaría agregarla al pedido?`
          };
        }
      }
    }
    return {
      handled: true,
      reply: 'Conozco los ingredientes de nuestras 32 variedades de pizza (Hawaiana, Barbecue Chicken, Pepperoni, California Chicken, 5 Quesos, Mexicana, Napolitana y más). ¿De cuál pizza te gustaría saber los ingredientes?'
    };
  }

  // 3. Detectar intención de arrepentimiento / reemplazo / cambio de tamaño o precio
  const isReplacementIntent =
    text.includes('mejor que sea') ||
    text.includes('mejor dame') ||
    text.includes('mejor pon') ||
    text.includes('sabes que') ||
    text.includes('en vez de') ||
    text.includes('en lugar de') ||
    text.includes('cambia') ||
    text.includes('cambiala') ||
    text.includes('cambialas') ||
    text.includes('muy caro') ||
    text.includes('mas barata') ||
    text.includes('mas pequena') ||
    text.includes('me arrepenti') ||
    text.includes('no, mejor');

  const isRemoveOnlyIntent =
    !isReplacementIntent &&
    (text.includes('quita') ||
      text.includes('quitar') ||
      text.includes('saca') ||
      text.includes('sacar') ||
      text.includes('elimina') ||
      text.includes('eliminar') ||
      text.includes('ya no quiero'));

  if (text.includes('chicago')) {
    callbacks.onSetCity(1);
    actionsTaken.push('ciudad Chicago');
  } else if (text.includes('houston')) {
    callbacks.onSetCity(2);
    actionsTaken.push('ciudad Houston');
  } else if (text.includes('los angeles') || text.includes('angeles')) {
    callbacks.onSetCity(3);
    actionsTaken.push('ciudad Los Angeles');
  } else if (text.includes('new york') || text.includes('nueva york') || text.includes('york')) {
    callbacks.onSetCity(4);
    actionsTaken.push('ciudad New York');
  }

  if (text.includes('domicilio') || text.includes('casa') || text.includes('delivery')) {
    callbacks.onSetChannel(1);
    actionsTaken.push('canal Domicilio');
  } else if (text.includes('recogida') || text.includes('recoger') || text.includes('llevar') || text.includes('pickup')) {
    callbacks.onSetChannel(2);
    actionsTaken.push('canal Recogida');
  } else if (text.includes('salon') || text.includes('mesa') || text.includes('restaurante')) {
    callbacks.onSetChannel(3);
    actionsTaken.push('canal Salón');
  }

  const segments = text.split(/\s+y\s+|,|;/);
  const newItemsToApply: Array<{ pizza: PizzaItem; qty: number }> = [];

  for (const seg of segments) {
    let matchedType: { typeId: string; label: string } | null = null;
    for (const alias of PIZZA_ALIASES) {
      if (alias.keywords.some((kw) => seg.includes(kw))) {
        matchedType = alias;
        break;
      }
    }

    if (!matchedType) {
      const direct = pizzas.find(
        (p) =>
          seg.includes(p.pizza_id.toLowerCase()) ||
          seg.includes(p.pizza_type_id.toLowerCase()) ||
          seg.includes(p.name.toLowerCase().replace('the ', '').replace(' pizza', ''))
      );
      if (direct) {
        matchedType = { typeId: direct.pizza_type_id, label: direct.name };
      }
    }

    // Si dijo "muy caro, mejor pequeñas" sin repetir el nombre de la pizza, usar la última pizza del carrito
    if (!matchedType && isReplacementIntent && currentCart.length > 0) {
      const lastItem = currentCart[currentCart.length - 1];
      if (
        seg.includes('pequena') ||
        seg.includes('pequenas') ||
        seg.includes('mediana') ||
        seg.includes('medianas') ||
        seg.includes('grande') ||
        seg.includes('grandes')
      ) {
        matchedType = {
          typeId: lastItem.pizza.pizza_type_id,
          label: lastItem.pizza.name
        };
      }
    }

    if (matchedType) {
      let size = 'M';
      if (seg.includes('extra grande') || seg.includes('xl')) size = 'XL';
      else if (seg.includes('grande') || seg.includes('familiar') || /\bl\b/.test(seg)) size = 'L';
      else if (seg.includes('pequena') || seg.includes('personal') || seg.includes('chica') || /\bs\b/.test(seg)) size = 'S';
      else if (seg.includes('mediana') || /\bm\b/.test(seg)) size = 'M';

      let qty = 1;
      const numMatch = seg.match(/\b(\d+)\b/);
      if (numMatch) {
        qty = Math.min(25, Math.max(1, parseInt(numMatch[1], 10)));
      } else {
        let foundWordNum = false;
        for (const [word, val] of Object.entries(SPANISH_NUMBERS)) {
          if (new RegExp(`\\b${word}\\b`).test(seg)) {
            qty = val;
            foundWordNum = true;
            break;
          }
        }
        if (!foundWordNum && isReplacementIntent && currentCart.length > 0) {
          qty = currentCart[currentCart.length - 1].quantity;
        }
      }

      const targetPizza =
        pizzas.find((p) => p.pizza_type_id === matchedType!.typeId && p.size.toUpperCase() === size) ||
        pizzas.find((p) => p.pizza_type_id === matchedType!.typeId && p.size.toUpperCase() === 'M') ||
        pizzas.find((p) => p.pizza_type_id === matchedType!.typeId);

      if (targetPizza) {
        if (isRemoveOnlyIntent && callbacks.onRemovePizza) {
          callbacks.onRemovePizza(targetPizza.pizza_id, qty);
          actionsTaken.push(`quité ${targetPizza.name}`);
        } else {
          newItemsToApply.push({ pizza: targetPizza, qty });
        }
      }
    }
  }

  if (newItemsToApply.length > 0) {
    if (isReplacementIntent) {
      // Si el cliente se arrepintió ("mejor que sean...", "muy caro, dame..."), reemplazamos el pedido anterior
      if (callbacks.onSetCart) {
        callbacks.onSetCart(newItemsToApply.map((item) => ({ pizzaId: item.pizza.pizza_id, quantity: item.qty })));
      } else {
        callbacks.onClearCart();
        for (const item of newItemsToApply) {
          callbacks.onAddPizza(item.pizza.pizza_id, item.qty);
        }
      }
      const desc = newItemsToApply
        .map((i) => `${i.qty} ${i.pizza.name} (${i.pizza.size}, $${(i.pizza.price * i.qty).toFixed(2)})`)
        .join(', ');
      return {
        handled: true,
        reply: `Perfecto, retiré el pedido anterior y lo cambié por ${desc}. ¿Deseas confirmar o hacer otro cambio?`
      };
    } else {
      for (const item of newItemsToApply) {
        callbacks.onAddPizza(item.pizza.pizza_id, item.qty);
        actionsTaken.push(`${item.qty} ${item.pizza.name} (${item.pizza.size})`);
      }
    }
  }

  if (
    text.includes('confirmar') ||
    text.includes('confirmo') ||
    text.includes('guardar') ||
    text.includes('registrar') ||
    text.includes('enviar') ||
    text.includes('eso es todo') ||
    text.includes('listo')
  ) {
    setTimeout(() => callbacks.onConfirmOrder(), 250);
    return {
      handled: true,
      reply:
        actionsTaken.length > 0
          ? `Perfecto, actualicé ${actionsTaken.join(', ')} y envié el pedido a Google Sheets.`
          : '¡Pedido confirmado y guardado en Google Sheets!'
    };
  }

  if (actionsTaken.length > 0) {
    return {
      handled: true,
      reply: `Listo: ${actionsTaken.join(', ')}. ¿Deseas algo más o confirmamos el pedido?`
    };
  }

  return {
    handled: false,
    reply: ''
  };
}

/**
 * Devuelve la lista ordenada de claves API activas desde las variables de entorno (.env.local / Vercel):
 * 1) VITE_GEMINI_API_KEY_1 (Principal — soporta gemini-2.5-flash 1.3s + TTS Aoede 200 OK + gemini-3.5-flash-lite)
 * 2) VITE_GEMINI_API_KEY (Secundaria — respaldo y balanceo de carga en gemini-3.5-flash-lite 1.2s)
 */
export function getDualApiKeys(preferredOverride?: string, preferSecondaryFirst = false): string[] {
  const env = (import.meta as any).env || {};
  const k1 = (env.VITE_GEMINI_API_KEY_1 || '').trim();
  const k2 = (env.VITE_GEMINI_API_KEY || '').trim();
  const custom = (preferredOverride || '').trim();

  const ordered = preferSecondaryFirst ? [k2, k1] : [k1, k2];
  if (custom && custom.length > 15 && custom !== k2) {
    ordered.unshift(custom);
  }
  return Array.from(new Set(ordered.filter((k) => k && k.length > 15)));
}

let sharedTtsAudioCtx: AudioContext | null = null;
// Caché en memoria para respuestas de audio repetidas -> 0ms latencia y ahorra cuota en ambas cuentas
const ttsPcmCache = new Map<string, string>();
// Circuit breaker independiente por cada API Key cuando alcanza límite de cuota (HTTP 429)
const ttsQuotaExhaustedByKey = new Map<string, number>();

// Precargar voces del navegador apenas carga el módulo para evitar que getVoices() devuelva []
let cachedBrowserVoices: SpeechSynthesisVoice[] = [];
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const loadVoices = () => {
    const v = window.speechSynthesis.getVoices();
    if (v && v.length > 0) cachedBrowserVoices = v;
  };
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  if (sharedTtsAudioCtx && sharedTtsAudioCtx.state === 'running') {
    try {
      sharedTtsAudioCtx.close();
      sharedTtsAudioCtx = null;
    } catch {}
  }
}

function playBase64Pcm24k(
  base64Data: string,
  audioCtx: AudioContext,
  onStart?: () => void,
  onEnd?: () => void
) {
  let finished = false;
  const finishOnce = () => {
    if (!finished) {
      finished = true;
      onEnd?.();
    }
  };

  try {
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const pcm16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768;

    const buffer = audioCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);

    onStart?.();
    source.onended = finishOnce;
    source.start();

    setTimeout(finishOnce, Math.ceil(buffer.duration * 1000) + 250);
  } catch {
    finishOnce();
  }
}

function selectBestNaturalSpanishVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined;
  const voices = cachedBrowserVoices.length > 0 ? cachedBrowserVoices : window.speechSynthesis.getVoices();
  const esVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('es'));
  if (esVoices.length === 0) return undefined;

  // Descartar explícitamente las voces SAPI5 locales antiguas de Windows ("Desktop") que suenan robóticas
  const nonDesktop = esVoices.filter((v) => !v.name.toLowerCase().includes('desktop'));
  const pool = nonDesktop.length > 0 ? nonDesktop : esVoices;

  return (
    // 1. Voces neuronales Online de Microsoft Edge (Salomé, Dalia, Jorge, Álvaro Natural)
    pool.find((v) => v.name.includes('Natural') && (v.lang.includes('CO') || v.lang.includes('MX') || v.lang.includes('US'))) ||
    pool.find((v) => v.name.includes('Natural')) ||
    pool.find((v) => v.name.includes('Online')) ||
    // 2. Voces en la nube de Google Chrome ("Google español de Estados Unidos" / "Google español")
    pool.find((v) => v.name.includes('Google') && v.lang.includes('US')) ||
    pool.find((v) => v.name.includes('Google')) ||
    // 3. Voces mejoradas macOS/iOS (Paulina, Mónica)
    pool.find((v) => v.name.includes('Paulina') || v.name.includes('Monica') || v.name.includes('Mónica')) ||
    pool[0]
  );
}

export async function speakSpanish(
  text: string,
  apiKey?: string,
  onStart?: () => void,
  onEnd?: () => void
) {
  // Limpiar símbolos markdown y abreviaturas para que la lectura sea natural y rápida
  const cleanText = text
    .replace(/[*#_`~•]/g, '')
    .replace(/\$(\d+(?:,\d{3})*(?:\.\d+)?)\s*USD/gi, '$1 dólares')
    .replace(/\$(\d+(?:,\d{3})*(?:\.\d+)?)/g, '$1 dólares')
    .replace(/\buds\b/gi, 'unidades')
    .trim();

  const keys = getDualApiKeys(apiKey, false);
  if (keys.length > 0) {
    const playedByRestTts = await speakViaGeminiRestTTS(cleanText, keys, onStart, onEnd);
    if (playedByRestTts) return;
  }

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }

  let ended = false;
  const safeEnd = () => {
    if (!ended) {
      ended = true;
      onEnd?.();
    }
  };

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  const bestVoice = selectBestNaturalSpanishVoice();

  if (bestVoice) {
    utterance.voice = bestVoice;
    // CRÍTICO en Chromium: utterance.lang DEBE coincidir exactamente con bestVoice.lang,
    // de lo contrario Chrome ignora utterance.voice y usa la voz robótica Desktop de Windows.
    utterance.lang = bestVoice.lang;
  } else {
    utterance.lang = 'es-US';
  }

  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  utterance.onstart = () => onStart?.();
  utterance.onend = safeEnd;
  utterance.onerror = safeEnd;
  window.speechSynthesis.speak(utterance);

  setTimeout(safeEnd, Math.max(3000, cleanText.length * 80));
}

async function speakViaGeminiRestTTS(
  textToRead: string,
  apiKeys: string[],
  onStart?: () => void,
  onEnd?: () => void
): Promise<boolean> {
  try {
    // 1. Si ya está en caché en memoria, reproducir instantáneamente (0ms latencia, 0 gasto de cuota)
    const cachedAudio = ttsPcmCache.get(textToRead);
    if (cachedAudio) {
      if (!sharedTtsAudioCtx || sharedTtsAudioCtx.state === 'closed') {
        sharedTtsAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      if (sharedTtsAudioCtx.state === 'suspended') {
        await sharedTtsAudioCtx.resume();
      }
      playBase64Pcm24k(cachedAudio, sharedTtsAudioCtx, onStart, onEnd);
      return true;
    }

    // 2. Probar primero con VITE_GEMINI_API_KEY_1 (Principal) y luego con la Secundaria si aplica
    for (const key of apiKeys) {
      const exhaustedUntil = ttsQuotaExhaustedByKey.get(key) || 0;
      if (Date.now() < exhaustedUntil) {
        continue;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3800);

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: textToRead }] }],
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: 'Aoede'
                    }
                  }
                }
              }
            })
          }
        );
        clearTimeout(timeoutId);

        if (res.status === 429) {
          // Marcar solo esta API Key en enfriamiento por 10 minutos y pasar de inmediato a la siguiente clave
          ttsQuotaExhaustedByKey.set(key, Date.now() + 10 * 60 * 1000);
          continue;
        }

        if (!res.ok) continue;
        const data = await res.json();
        const base64Audio = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) continue;

        ttsPcmCache.set(textToRead, base64Audio);

        if (!sharedTtsAudioCtx || sharedTtsAudioCtx.state === 'closed') {
          sharedTtsAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        if (sharedTtsAudioCtx.state === 'suspended') {
          await sharedTtsAudioCtx.resume();
        }

        playBase64Pcm24k(base64Audio, sharedTtsAudioCtx, onStart, onEnd);
        return true;
      } catch {
        clearTimeout(timeoutId);
      }
    }

    return false;
  } catch {
    return false;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatCurrentCartForPrompt(callbacks: VoiceActionCallbacks): string {
  const cart = callbacks.getCurrentCart ? callbacks.getCurrentCart() : [];
  if (!cart || cart.length === 0) {
    return 'Vacío ($0.00 USD)';
  }
  const total = cart.reduce((acc, item) => acc + item.pizza.price * item.quantity, 0);
  const itemsStr = cart
    .map(
      (item) =>
        `${item.quantity}x ${item.pizza.name} (Tamaño ${item.pizza.size}, pizza_id="${item.pizza.pizza_id}", $${item.pizza.price.toFixed(2)} c/u = $${(item.pizza.price * item.quantity).toFixed(2)})`
    )
    .join(' | ');
  return `${itemsStr} — TOTAL ACTUAL: $${total.toFixed(2)} USD`;
}

function applyParsedGeminiCartActions(
  parsed: any,
  transcript: string,
  pizzas: PizzaItem[],
  callbacks: VoiceActionCallbacks
) {
  let cartModifiedByGemini = false;

  if (parsed.clearCart === true) {
    callbacks.onClearCart();
    cartModifiedByGemini = true;
  }

  // Si Gemini devuelve setCart (el estado exacto final deseado tras un reemplazo/arrepentimiento)
  if (Array.isArray(parsed.setCart) && callbacks.onSetCart) {
    const validSet = parsed.setCart
      .filter((item: any) => item && item.pizza_id && Number(item.quantity) > 0)
      .map((item: any) => ({
        pizzaId: String(item.pizza_id),
        quantity: Number(item.quantity)
      }));
    callbacks.onSetCart(validSet);
    cartModifiedByGemini = true;
  } else {
    // O bien si devuelve removePizzas + addPizzas individuales
    if (Array.isArray(parsed.removePizzas) && parsed.removePizzas.length > 0 && callbacks.onRemovePizza) {
      for (const rem of parsed.removePizzas) {
        if (rem && rem.pizza_id) {
          callbacks.onRemovePizza(
            String(rem.pizza_id),
            rem.quantity !== undefined && rem.quantity !== null ? Number(rem.quantity) : undefined
          );
          cartModifiedByGemini = true;
        }
      }
    }

    if (Array.isArray(parsed.addPizzas) && parsed.addPizzas.length > 0) {
      for (const item of parsed.addPizzas) {
        if (item && item.pizza_id) {
          callbacks.onAddPizza(String(item.pizza_id), Number(item.quantity || 1));
          cartModifiedByGemini = true;
        }
      }
    }
  }

  if (parsed.city_id) callbacks.onSetCity(Number(parsed.city_id));
  if (parsed.salechannel_id) callbacks.onSetChannel(Number(parsed.salechannel_id));
  if (parsed.confirm === true) {
    setTimeout(() => callbacks.onConfirmOrder(), 250);
  }

  // Respaldo adicional sobre la transcripción si Gemini no modificó el carrito pero el usuario dio una orden
  const isIngredientQuestion =
    transcript.toLowerCase().includes('ingrediente') ||
    transcript.toLowerCase().includes('que lleva') ||
    transcript.toLowerCase().includes('que trae') ||
    transcript.toLowerCase().includes('que tiene');

  if (!cartModifiedByGemini && !isIngredientQuestion && transcript) {
    parseNaturalVoiceOrder(transcript, pizzas, [], [], callbacks);
  }
}

function buildOrderAssistantSystemPrompt(
  pizzas: PizzaItem[],
  history: Array<{ role: string; text: string }>,
  callbacks: VoiceActionCallbacks
): string {
  const fullCatalog = buildFullCatalogWithIngredients(pizzas);
  const currentCartText = formatCurrentCartForPrompt(callbacks);
  const historyText = history
    .slice(-6)
    .map((h) => `${h.role === 'user' ? 'Cliente' : 'Asistente'}: ${h.text}`)
    .join('\n');

  return `Eres el asistente inteligente de atención y pedidos de PizzaCorp.
Conoces a la perfección las 32 variedades de pizza de nuestra tabla dim_pizaTipeID, incluyendo sus INGREDIENTES exactos, categorías, tamaños y precios.

CATÁLOGO COMPLETO DE PIZZAS E INGREDIENTES (dim_pizaTipeID + dim_pizzas):
${fullCatalog}

Ciudades (city_id): 1=Chicago, 2=Houston, 3=Los Angeles, 4=New York.
Canales (salechannel_id): 1=Domicilio, 2=Recogida, 3=Salon.

ESTADO DEL PEDIDO ACTUAL EN EL CARRITO:
${currentCartText}

HISTORIAL RECIENTE DE LA CONVERSACIÓN:
${historyText}

REGLAS CRÍTICAS DE NEGOCIO Y ARREPENTIMIENTO / MODIFICACIÓN DEL PEDIDO:
1. PREGUNTAS SOBRE INGREDIENTES O RECOMENDACIONES:
   - Si el cliente pregunta qué ingredientes lleva una pizza o pide recomendaciones según ingredientes (ej. "¿qué lleva la hawaiana?", "¿qué pizzas tienen pollo o champiñones?", "¿cuál es vegetariana?"), respóndele con los ingredientes exactos en español usando la lista de arriba y deja "setCart": null, "addPizzas": [], "removePizzas": [].
2. ARREPENTIMIENTO, CAMBIO DE OPINIÓN, REEMPLAZO O CAMBIO DE TAMAÑO/PRECIO:
   - Si el cliente se arrepiente de lo que pidió antes o quiere cambiarlo (ejemplos:
     * Pide "2 pizzas hawaianas", y luego dice "sabes qué, mejor que sean 2 de pollo medianas" -> Debes SACAR las 2 hawaianas y dejar SOLO las 2 de pollo medianas ("bbq_ckn_m").
     * Luego dice "muy caro, dame 2 pizzas de pollo pequeñas" -> Debes SACAR las 2 de pollo medianas ("bbq_ckn_m") y dejar SOLO 2 de pollo pequeñas ("bbq_ckn_s").
     * O si dice "quita la hawaiana", "saca una de pepperoni", "cámbiala por tamaño pequeña").
   - Cuando ocurra cualquier reemplazo, cambio o arrepentimiento, usa el campo "setCart" indicando exactamente la lista final de pizzas que debe quedar en el carrito (ej: "setCart": [{"pizza_id": "bbq_ckn_s", "quantity": 2}]), o bien usa "removePizzas" para quitar la anterior y "addPizzas" para poner la nueva. ¡NUNCA dejes en el carrito una pizza que el cliente decidió cambiar por otra!
   - Nota: Cuando el cliente diga simplemente "pizza de pollo" sin especificar cuál de las de pollo, usa por defecto Barbecue Chicken ("bbq_ckn_s", "bbq_ckn_m" o "bbq_ckn_l"). Si no especifica tamaño al pedir por primera vez, usa tamaño "M".
3. AGREGAR PIZZAS ADICIONALES:
   - Si el cliente solo quiere agregar más pizzas sin cancelar las anteriores (ej. "agrega también una napolitana grande"), usa "addPizzas": [{"pizza_id": "napolitana_l", "quantity": 1}] y deja "setCart": null.

Devuelve ÚNICAMENTE un objeto JSON válido con esta estructura exacta:
{
  "userTranscript": "transcripción en español de lo que dijo el cliente",
  "reply": "tu respuesta hablada breve (1 o 2 oraciones), cálida y natural en español mencionando los ingredientes o confirmando el cambio/precio",
  "setCart": null,
  "addPizzas": [],
  "removePizzas": [],
  "clearCart": false,
  "city_id": null,
  "salechannel_id": null,
  "confirm": false
}
(Nota: Si usas "setCart", pon un arreglo como [{"pizza_id": "id_exacto", "quantity": 2}] con el contenido completo que debe quedar en el carrito; si no estás reemplazando todo el carrito, deja "setCart": null y usa "addPizzas" y/o "removePizzas").`;
}

/**
 * Envía el audio grabado aprovechando las DOS claves API:
 * - Clave 1 (Principal VITE_GEMINI_API_KEY_1): gemini-2.5-flash (2.2s) y gemini-3.5-flash-lite
 * - Clave 2 (Secundaria VITE_GEMINI_API_KEY): gemini-3.5-flash-lite (1.2s) y gemini-3.6-flash
 */
async function processAudioTurnWithVerifiedGemini(
  base64Audio: string,
  mimeType: string,
  history: Array<{ role: string; text: string }>,
  pizzas: PizzaItem[],
  apiKey: string,
  callbacks: VoiceActionCallbacks
): Promise<{ userTranscript: string; reply: string }> {
  const systemPrompt = `Escucha atentamente el audio del cliente hablando en español.
Si en el audio solo hay silencio, ruido de fondo o respiración sin palabras claras, devuelve exactamente:
{"userTranscript": "", "reply": "", "setCart": null, "addPizzas": [], "removePizzas": [], "clearCart": false, "city_id": null, "salechannel_id": null, "confirm": false}

${buildOrderAssistantSystemPrompt(pizzas, history, callbacks)}`;

  const keys = getDualApiKeys(apiKey, false);
  const attempts: Array<{ key: string; model: string }> = [];
  if (keys[0]) {
    attempts.push({ key: keys[0], model: 'gemini-2.5-flash' });
    attempts.push({ key: keys[0], model: 'gemini-3.5-flash-lite' });
  }
  if (keys[1]) {
    attempts.push({ key: keys[1], model: 'gemini-3.5-flash-lite' });
    attempts.push({ key: keys[1], model: 'gemini-3.6-flash' });
  }

  for (const { key, model } of attempts) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: mimeType || 'audio/webm',
                      data: base64Audio
                    }
                  },
                  { text: systemPrompt }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json'
            }
          })
        }
      );

      if (res.ok) {
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const cleaned = rawText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        const transcript = String(parsed.userTranscript || '').trim();
        if (!transcript) {
          return { userTranscript: '', reply: '' };
        }

        applyParsedGeminiCartActions(parsed, transcript, pizzas, callbacks);

        return {
          userTranscript: transcript,
          reply: String(parsed.reply || 'Listo, he actualizado tu pedido. ¿Deseas algo más o confirmar?')
        };
      }
    } catch {}
  }

  return { userTranscript: '', reply: '' };
}

/**
 * Procesa también comandos escritos por texto con la misma inteligencia de ingredientes,
 * arrepentimiento, reemplazo de ítems y estado en tiempo real del carrito.
 */
export async function processTextTurnWithVerifiedGemini(
  userText: string,
  history: Array<{ role: string; text: string }>,
  pizzas: PizzaItem[],
  apiKey: string,
  callbacks: VoiceActionCallbacks
): Promise<string> {
  const prompt = `${buildOrderAssistantSystemPrompt(pizzas, history, callbacks)}

MENSAJE ESCRITO POR EL CLIENTE:
"${userText}"`;

  const keys = getDualApiKeys(apiKey, false);
  const attempts: Array<{ key: string; model: string }> = [];
  if (keys[0]) {
    attempts.push({ key: keys[0], model: 'gemini-2.5-flash' });
    attempts.push({ key: keys[0], model: 'gemini-3.5-flash-lite' });
  }
  if (keys[1]) {
    attempts.push({ key: keys[1], model: 'gemini-3.5-flash-lite' });
    attempts.push({ key: keys[1], model: 'gemini-3.6-flash' });
  }

  for (const { key, model } of attempts) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json'
            }
          })
        }
      );

      if (res.ok) {
        const data = await res.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const cleaned = rawText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        applyParsedGeminiCartActions(parsed, userText, pizzas, callbacks);
        if (parsed.reply) {
          return String(parsed.reply);
        }
      }
    } catch {}
  }

  const fallback = parseNaturalVoiceOrder(userText, pizzas, [], [], callbacks);
  return fallback.reply || 'Dime qué pizza deseas agregar, cambiar o consultar sus ingredientes.';
}

/**
 * Sesión de Voz con Grabación Nativa (getUserMedia + MediaRecorder + Onda en Vivo)
 * Conectada a gemini-3.5-flash-lite (verificado 200 OK en 2.7s) + gemini-2.5-flash-preview-tts (Voz Aoede).
 */
export class GeminiLiveVoiceSession {
  private mediaStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private vadInterval: any = null;
  private isRunning = false;
  private isSpeaking = false;
  private isProcessing = false;
  private history: Array<{ role: string; text: string }> = [];
  private callbacks: VoiceActionCallbacks;
  private pizzas: PizzaItem[];
  private cities: CityItem[];
  private channels: SaleChannelItem[];
  private apiKey: string;

  constructor(
    apiKey: string,
    pizzas: PizzaItem[],
    cities: CityItem[],
    channels: SaleChannelItem[],
    callbacks: VoiceActionCallbacks
  ) {
    this.apiKey = apiKey?.trim() || (import.meta as any).env?.VITE_GEMINI_API_KEY?.trim() || '';
    this.pizzas = pizzas;
    this.cities = cities;
    this.channels = channels;
    this.callbacks = callbacks;
  }

  public async start() {
    this.isRunning = true;
    this.isSpeaking = true;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);
    } catch {
      this.callbacks.onStatusChange('error', 'No se pudo acceder al micrófono. Verifica los permisos del navegador.');
      this.isRunning = false;
      return;
    }

    const greeting = 'Hola, bienvenido a PizzaCorp. ¿Qué pizzas deseas pedir hoy?';
    this.history.push({ role: 'ai', text: greeting });
    this.callbacks.onTranscriptAI(greeting);
    this.callbacks.onStatusChange('speaking', '🔊 Gemini hablando...');

    await speakSpanish(
      greeting,
      this.apiKey,
      () => {
        this.isSpeaking = true;
        this.callbacks.onStatusChange('speaking', '🔊 Gemini hablando...');
      },
      () => {
        this.isSpeaking = false;
        if (this.isRunning) {
          this.startListeningTurn();
        }
      }
    );
  }

  private startListeningTurn() {
    if (!this.isRunning || !this.mediaStream || this.isSpeaking || this.isProcessing) return;

    const chunks: BlobPart[] = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4';

    try {
      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });
    } catch {
      this.mediaRecorder = new MediaRecorder(this.mediaStream);
    }

    let hasSpoken = false;
    let consecutiveVoiceFrames = 0;
    let silenceStart = 0;
    let noiseFloor = 15;
    const calibrationSamples: number[] = [];

    this.callbacks.onStatusChange('listening', '🎙️ Escuchándote... Habla ahora');

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = async () => {
      if (this.vadInterval) clearInterval(this.vadInterval);
      this.callbacks.onAudioLevel(0);

      if (!this.isRunning) return;

      if (!hasSpoken || chunks.length === 0) {
        if (this.isRunning && !this.isSpeaking) {
          this.startListeningTurn();
        }
        return;
      }

      this.isProcessing = true;
      this.callbacks.onStatusChange('connecting', '⏳ Analizando tu voz con Gemini 3.5...');

      try {
        const blob = new Blob(chunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
        const cleanMime = blob.type.split(';')[0] || 'audio/webm';
        const base64Audio = await blobToBase64(blob);

        const result = await processAudioTurnWithVerifiedGemini(
          base64Audio,
          cleanMime,
          this.history,
          this.pizzas,
          this.apiKey,
          this.callbacks
        );

        if (!this.isRunning) return;

        // Si solo fue ruido ambiental sin palabras, volver a escuchar en silencio (SIN bucle)
        if (!result.userTranscript || !result.reply) {
          this.isProcessing = false;
          if (this.isRunning) {
            this.startListeningTurn();
          }
          return;
        }

        this.callbacks.onTranscriptUser(result.userTranscript, true);
        this.history.push({ role: 'user', text: result.userTranscript });
        this.history.push({ role: 'ai', text: result.reply });
        this.callbacks.onTranscriptAI(result.reply);
        this.isSpeaking = true;

        await speakSpanish(
          result.reply,
          this.apiKey,
          () => {
            this.callbacks.onStatusChange('speaking', '🔊 Gemini respondiendo...');
          },
          () => {
            this.isSpeaking = false;
            this.isProcessing = false;
            if (this.isRunning) {
              this.startListeningTurn();
            }
          }
        );
      } catch {
        this.isProcessing = false;
        if (this.isRunning) {
          this.startListeningTurn();
        }
      }
    };

    this.mediaRecorder.start(200);

    const dataArray = new Uint8Array(this.analyser ? this.analyser.frequencyBinCount : 128);
    if (this.vadInterval) clearInterval(this.vadInterval);

    this.vadInterval = setInterval(() => {
      if (!this.isRunning || !this.analyser || !this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      const limit = Math.min(60, dataArray.length);
      for (let i = 2; i < limit; i++) {
        sum += dataArray[i];
      }
      const avg = sum / (limit - 2);
      const level = Math.min(100, Math.round(avg * 1.35));
      this.callbacks.onAudioLevel(level);

      // Calibrar el ruido base de la habitación durante los primeros 5 frames (400ms)
      if (calibrationSamples.length < 5) {
        calibrationSamples.push(level);
        if (calibrationSamples.length === 5) {
          const avgNoise = calibrationSamples.reduce((a, b) => a + b, 0) / calibrationSamples.length;
          noiseFloor = Math.max(18, Math.min(38, Math.round(avgNoise + 12)));
        }
        return;
      }

      const now = Date.now();

      if (level > noiseFloor) {
        consecutiveVoiceFrames += 1;
        silenceStart = 0;
        // Requiere al menos ~320ms continuos de voz por encima del ruido base para confirmar que estás hablando
        if (consecutiveVoiceFrames >= 4 && !hasSpoken) {
          hasSpoken = true;
          this.callbacks.onStatusChange('listening', '🟢 Escuchando tu voz... (haz una pausa al terminar)');
        }
      } else {
        consecutiveVoiceFrames = 0;
        if (hasSpoken) {
          if (silenceStart === 0) {
            silenceStart = now;
          } else if (now - silenceStart > 1300) {
            // 1.3 segundos de pausa después de hablar -> enviar audio a Gemini 3.5 Flash Lite
            try {
              this.mediaRecorder.stop();
            } catch {}
          }
        }
      }
    }, 80);
  }

  public finishCurrentTurnNow() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    }
  }

  public stop() {
    this.isRunning = false;
    this.isSpeaking = false;
    this.isProcessing = false;
    if (this.vadInterval) clearInterval(this.vadInterval);
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.onstop = null;
        this.mediaRecorder.stop();
      } catch {}
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {}
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.callbacks.onAudioLevel(0);
    this.callbacks.onStatusChange('idle', 'Toca el micrófono para iniciar la conversación');
  }
}

/**
 * Grabador de voz con detección de silencio y onda en tiempo real para el Copiloto BI del Admin
 */
export class AdminVoiceRecorder {
  private mediaStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private vadInterval: any = null;
  private isRecording = false;

  public async start(
    onAudioLevel: (lvl: number) => void,
    onFinishedAudio: (base64Audio: string, mimeType: string) => void,
    onError: (msg: string) => void
  ) {
    stopSpeaking();
    this.isRecording = true;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);
    } catch {
      this.isRecording = false;
      onError('No se pudo acceder al micrófono.');
      return;
    }

    const chunks: BlobPart[] = [];
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4';

    try {
      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });
    } catch {
      this.mediaRecorder = new MediaRecorder(this.mediaStream);
    }

    let hasSpoken = false;
    let consecutiveVoiceFrames = 0;
    let silenceStart = 0;
    let noiseFloor = 16;
    const calibrationSamples: number[] = [];

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    this.mediaRecorder.onstop = async () => {
      this.cleanup();
      onAudioLevel(0);
      if (chunks.length === 0) return;

      const blob = new Blob(chunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });
      const cleanMime = blob.type.split(';')[0] || 'audio/webm';
      const base64Audio = await blobToBase64(blob);
      onFinishedAudio(base64Audio, cleanMime);
    };

    this.mediaRecorder.start(200);

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.vadInterval = setInterval(() => {
      if (!this.isRecording || !this.analyser || !this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
        return;
      }
      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      const limit = Math.min(60, dataArray.length);
      for (let i = 2; i < limit; i++) sum += dataArray[i];
      const avg = sum / (limit - 2);
      const level = Math.min(100, Math.round(avg * 1.35));
      onAudioLevel(level);

      if (calibrationSamples.length < 4) {
        calibrationSamples.push(level);
        if (calibrationSamples.length === 4) {
          const avgNoise = calibrationSamples.reduce((a, b) => a + b, 0) / calibrationSamples.length;
          noiseFloor = Math.max(16, Math.min(36, Math.round(avgNoise + 10)));
        }
        return;
      }

      const now = Date.now();
      if (level > noiseFloor) {
        consecutiveVoiceFrames += 1;
        silenceStart = 0;
        if (consecutiveVoiceFrames >= 3) {
          hasSpoken = true;
        }
      } else {
        consecutiveVoiceFrames = 0;
        if (hasSpoken) {
          if (silenceStart === 0) {
            silenceStart = now;
          } else if (now - silenceStart > 1200) {
            this.stop();
          }
        }
      }
    }, 80);
  }

  public stop() {
    this.isRecording = false;
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      try {
        this.mediaRecorder.stop();
      } catch {}
    } else {
      this.cleanup();
    }
  }

  private cleanup() {
    this.isRecording = false;
    if (this.vadInterval) clearInterval(this.vadInterval);
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
  }
}

