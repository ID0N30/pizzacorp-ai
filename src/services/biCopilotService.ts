import { FactVentaRow } from '../types';
import { getDualApiKeys } from './geminiLiveService';
import rawModelData from '../data/pizzaModelData.json';

export interface BICopilotContext {
  totalHistoricalRows: number;
  totalRevenue: number;
  totalQuantity: number;
  liveOrdersCount: number;
  liveRevenue: number;
  byCity: Record<string, { orders: number; qty: number; revenue: number }>;
  byChannel: Record<string, { orders: number; qty: number; revenue: number }>;
  byCategory: Record<string, { qty: number; revenue: number }>;
  bySize: Record<string, { qty: number; revenue: number }>;
  byYear: Record<string, { orders: number; qty: number; revenue: number }>;
  byMonth: Record<string, { orders: number; qty: number; revenue: number }>;
  byYearMonth: Record<string, { orders: number; qty: number; revenue: number }>;
  byDayOfWeek: Record<string, { orders: number; qty: number; revenue: number }>;
  topPizzas: Array<{ pizza_id: string; name: string; size: string; qty: number; revenue: number }>;
  bottomPizzas: Array<{ pizza_id: string; name: string; size: string; qty: number; revenue: number }>;
  recentLiveRows: FactVentaRow[];
}

export interface BICopilotResponse {
  userQuestion: string;
  answer: string;
  spokenSummary: string;
}

function buildContextSummaryText(ctx: BICopilotContext): string {
  const pizzaTypesText = (rawModelData.pizzaTypes || [])
    .map((pt: any) => `[${pt.pizza_type_id}] ${pt.name} (${pt.category}): ${pt.ingredients}`)
    .join(' | ');

  return `- Total filas en fact_ventas: ${(ctx.totalHistoricalRows + ctx.liveOrdersCount).toLocaleString()} (${ctx.totalHistoricalRows.toLocaleString()} históricas + ${ctx.liveOrdersCount} nuevas hoy)
- Rango de Fechas Históricas en dim_fecha: desde ${(rawModelData.summary as any).minDateIso || '2024-01-01'} hasta ${(rawModelData.summary as any).maxDateIso || '2025-12-31'} (+ órdenes en vivo en 2026)
- Ingresos Totales Acumulados: $${ctx.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD (Nuevas hoy: $${ctx.liveRevenue.toFixed(2)} USD)
- Total Unidades Vendidas: ${ctx.totalQuantity.toLocaleString()} pizzas
- Ticket Promedio por Transacción: $${(ctx.totalRevenue / Math.max(1, ctx.totalHistoricalRows + ctx.liveOrdersCount)).toFixed(2)} USD
- Ventas y Ganancias por AÑO (dim_fecha × fact_ventas): ${JSON.stringify(ctx.byYear)}
- Ventas por MES (dim_fecha): ${JSON.stringify(ctx.byMonth)}
- Ventas detalladas por AÑO-MES (dim_fecha): ${JSON.stringify(ctx.byYearMonth)}
- Ventas por DÍA DE LA SEMANA (dim_fecha): ${JSON.stringify(ctx.byDayOfWeek)}
- Ventas por Ciudad (dim_city): ${JSON.stringify(ctx.byCity)}
- Ventas por Canal (dim_saleChannel): ${JSON.stringify(ctx.byChannel)}
- Ventas por Categoría (dim_pizaTipeID): ${JSON.stringify(ctx.byCategory)}
- Ventas por Tamaño (dim_pizzas): ${JSON.stringify(ctx.bySize)}
- Top 5 Pizzas Más Vendidas: ${JSON.stringify(ctx.topPizzas.slice(0, 5))}
- Top 5 Pizzas Menos Vendidas: ${JSON.stringify(ctx.bottomPizzas.slice(0, 5))}
- Catálogo e Ingredientes de las 32 Variedades (dim_pizaTipeID): ${pizzaTypesText}`;
}

export function buildLocalFallbackAnswer(question: string, ctx: BICopilotContext): { answer: string; spokenSummary: string } {
  const q = question
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const citiesSorted = Object.entries(ctx.byCity).sort((a, b) => b[1].revenue - a[1].revenue);
  const channelsSorted = Object.entries(ctx.byChannel).sort((a, b) => b[1].revenue - a[1].revenue);
  const categoriesSorted = Object.entries(ctx.byCategory).sort((a, b) => b[1].revenue - a[1].revenue);
  const sizesSorted = Object.entries(ctx.bySize).sort((a, b) => b[1].revenue - a[1].revenue);
  const yearsSorted = Object.entries(ctx.byYear || {}).sort((a, b) => a[0].localeCompare(b[0]));
  const monthsSorted = Object.entries(ctx.byMonth || {}).sort((a, b) => b[1].revenue - a[1].revenue);
  const daysSorted = Object.entries(ctx.byDayOfWeek || {}).sort((a, b) => b[1].revenue - a[1].revenue);

  const topCity = citiesSorted[0];
  const lowCity = citiesSorted[citiesSorted.length - 1];
  const topChannel = channelsSorted[0];
  const topPizza = ctx.topPizzas[0];
  const worstPizza = ctx.bottomPizzas[0];

  if (
    q.includes('ano') ||
    q.includes('anio') ||
    q.includes('anual') ||
    q.includes('2024') ||
    q.includes('2025') ||
    q.includes('2026') ||
    q.includes('fecha') ||
    q.includes('mes') ||
    q.includes('semana') ||
    q.includes('tiempo')
  ) {
    const yearLines = yearsSorted
      .map(
        ([yr, v]) =>
          `• Año ${yr}: $${v.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD (${v.orders.toLocaleString()} filas / ${v.qty.toLocaleString()} pizzas — ${((v.revenue / ctx.totalRevenue) * 100).toFixed(1)}% del total)`
      )
      .join('\n');

    const topMonth = monthsSorted[0];
    const topDay = daysSorted[0];
    const growth =
      ctx.byYear['2024'] && ctx.byYear['2025']
        ? (((ctx.byYear['2025'].revenue - ctx.byYear['2024'].revenue) / ctx.byYear['2024'].revenue) * 100).toFixed(1)
        : null;

    return {
      answer: `Análisis Temporal de Ventas y Ganancias (dim_fecha × fact_ventas):\n${yearLines}\n\n• Mes con mayores ventas: ${topMonth ? `${topMonth[0]} ($${topMonth[1].revenue.toLocaleString('en-US')})` : 'N/A'}\n• Día de la semana más fuerte: ${topDay ? `${topDay[0]} ($${topDay[1].revenue.toLocaleString('en-US')})` : 'N/A'}${growth ? `\n• Crecimiento interanual (2024 → 2025): +${growth}%` : ''}`,
      spokenSummary: `En 2024 los ingresos fueron de ${Math.round(ctx.byYear['2024']?.revenue || 0).toLocaleString('es-CO')} dólares y en 2025 subieron a ${Math.round(ctx.byYear['2025']?.revenue || 0).toLocaleString('es-CO')} dólares.`
    };
  }

  if (q.includes('ingrediente') || q.includes('que lleva') || q.includes('que trae') || q.includes('receta')) {
    const types = rawModelData.pizzaTypes || [];
    const found = types.find(
      (pt: any) =>
        q.includes(pt.pizza_type_id.toLowerCase()) ||
        q.includes(pt.name.toLowerCase().replace('the ', '').replace(' pizza', ''))
    );
    if (found) {
      return {
        answer: `Ficha Técnica en dim_pizaTipeID:\n• Pizza: ${found.name} [${found.pizza_type_id}]\n• Categoría: ${found.category}\n• Ingredientes: ${found.ingredients}`,
        spokenSummary: `La pizza ${found.name} pertenece a la categoría ${found.category} y sus ingredientes son: ${found.ingredients}.`
      };
    }
    const sampleList = types
      .slice(0, 8)
      .map((pt: any) => `• ${pt.name} (${pt.category}): ${pt.ingredients}`)
      .join('\n');
    return {
      answer: `Catálogo de Ingredientes (dim_pizaTipeID — 32 variedades registradas):\n${sampleList}\n\nPuedes preguntarme por cualquier variedad específica del catálogo.`,
      spokenSummary: `Contamos con las recetas e ingredientes exactos de las 32 variedades en la tabla dim_pizaTipeID.`
    };
  }

  if (q.includes('ciudad') || q.includes('chicago') || q.includes('houston') || q.includes('angeles') || q.includes('york') || q.includes('sede') || q.includes('donde')) {
    const breakdown = citiesSorted
      .map(
        ([name, v], i) =>
          `${i + 1}. ${name}: $${v.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${v.orders.toLocaleString()} órdenes / ${v.qty.toLocaleString()} uds)`
      )
      .join('\n');
    return {
      answer: `Análisis por Ciudad (dim_city × fact_ventas):\n${breakdown}\n\nRecomendación: ${topCity[0]} lidera las ventas con $${topCity[1].revenue.toLocaleString('en-US')}, mientras que ${lowCity[0]} tiene oportunidad de crecimiento en canal Domicilio.`,
      spokenSummary: `La ciudad que más vende es ${topCity[0]} con ${Math.round(topCity[1].revenue).toLocaleString('es-CO')} dólares, seguida por ${citiesSorted[1][0]}.`
    };
  }

  if (q.includes('canal') || q.includes('domicilio') || q.includes('salon') || q.includes('recogida')) {
    const breakdown = channelsSorted
      .map(
        ([name, v], i) =>
          `${i + 1}. ${name}: $${v.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${v.orders.toLocaleString()} órdenes — ${((v.revenue / ctx.totalRevenue) * 100).toFixed(1)}%)`
      )
      .join('\n');
    return {
      answer: `Rendimiento por Canal de Venta (dim_saleChannel):\n${breakdown}\n\nRecomendación: El canal ${topChannel[0]} concentra la mayor facturación con el ${((topChannel[1].revenue / ctx.totalRevenue) * 100).toFixed(1)}% del total.`,
      spokenSummary: `El canal líder es ${topChannel[0]} con ${Math.round(topChannel[1].revenue).toLocaleString('es-CO')} dólares, representando el ${((topChannel[1].revenue / ctx.totalRevenue) * 100).toFixed(0)} por ciento de las ventas.`
    };
  }

  if (q.includes('peor') || q.includes('menos') || q.includes('baja') || q.includes('eliminar')) {
    const bottomList = ctx.bottomPizzas
      .slice(0, 5)
      .map((p, i) => `${i + 1}. ${p.name} [${p.pizza_id}] (${p.size}): $${p.revenue.toLocaleString('en-US')} (${p.qty} uds)`)
      .join('\n');
    return {
      answer: `Top 5 Pizzas con Menor Rotación:\n${bottomList}\n\nRecomendación: "${worstPizza.name}" (${worstPizza.pizza_id}) registra solo $${worstPizza.revenue.toLocaleString('en-US')} en ventas. Se recomienda incluirla en combos promocionales.`,
      spokenSummary: `La pizza con menor rotación es ${worstPizza.name} tamaño ${worstPizza.size}, con solo ${worstPizza.qty} unidades vendidas.`
    };
  }

  if (q.includes('mejor') || q.includes('mas vendida') || q.includes('top') || q.includes('estrella') || q.includes('pizza')) {
    const topList = ctx.topPizzas
      .slice(0, 5)
      .map((p, i) => `${i + 1}. ${p.name} [${p.pizza_id}] (Tamaño ${p.size}): $${p.revenue.toLocaleString('en-US')} (${p.qty} uds)`)
      .join('\n');
    return {
      answer: `Top 5 Pizzas Más Vendidas del Modelo:\n${topList}\n\nRecomendación: "${topPizza.name}" (${topPizza.pizza_id}) lidera con $${topPizza.revenue.toLocaleString('en-US')} y ${topPizza.qty} unidades.`,
      spokenSummary: `La pizza más rentable es ${topPizza.name} en tamaño ${topPizza.size}, generando ${Math.round(topPizza.revenue).toLocaleString('es-CO')} dólares.`
    };
  }

  if (q.includes('tamano') || q.includes('size') || q.includes('grande') || q.includes('mediana') || q.includes('categoria')) {
    const sizeText = sizesSorted
      .map(([s, v]) => `Tamaño ${s}: $${v.revenue.toLocaleString('en-US')} (${v.qty.toLocaleString()} uds)`)
      .join('\n• ');
    const catText = categoriesSorted
      .map(([c, v]) => `${c}: $${v.revenue.toLocaleString('en-US')} (${v.qty.toLocaleString()} uds)`)
      .join('\n• ');
    return {
      answer: `Distribución por Tamaño y Categoría:\n• ${sizeText}\n\nPor Categoría:\n• ${catText}`,
      spokenSummary: `La categoría líder es ${categoriesSorted[0][0]} y el tamaño más vendido es el ${sizesSorted[0][0]}.`
    };
  }

  if (q.includes('hoy') || q.includes('vivo') || q.includes('nuev') || q.includes('reciente')) {
    return {
      answer: `Operación en Vivo (Sesión Actual):\n• Nuevas filas agregadas a fact_ventas: ${ctx.liveOrdersCount}\n• Ingresos en vivo hoy: $${ctx.liveRevenue.toFixed(2)} USD\n• Total acumulado en el modelo: ${(ctx.totalHistoricalRows + ctx.liveOrdersCount).toLocaleString()} filas.`,
      spokenSummary: `En esta sesión se han registrado ${ctx.liveOrdersCount} nuevas filas en Excel por un total de ${ctx.liveRevenue.toFixed(0)} dólares.`
    };
  }

  return {
    answer: `Resumen Ejecutivo del Modelo de Datos (Excel):\n• Ingresos Totales: $${ctx.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD\n• Por Año: 2024 ($${(ctx.byYear['2024']?.revenue || 0).toLocaleString('en-US')}) | 2025 ($${(ctx.byYear['2025']?.revenue || 0).toLocaleString('en-US')})\n• Filas en fact_ventas: ${(ctx.totalHistoricalRows + ctx.liveOrdersCount).toLocaleString()} (${ctx.totalQuantity.toLocaleString()} pizzas)\n• Ciudad Líder: ${topCity[0]} ($${topCity[1].revenue.toLocaleString('en-US')})\n• Canal Principal: ${topChannel[0]} ($${topChannel[1].revenue.toLocaleString('en-US')})\n• Pizza #1: ${topPizza.name} (${topPizza.size}) — $${topPizza.revenue.toLocaleString('en-US')}`,
    spokenSummary: `El modelo registra ingresos totales por ${Math.round(ctx.totalRevenue).toLocaleString('es-CO')} dólares en ${(ctx.totalHistoricalRows + ctx.liveOrdersCount).toLocaleString('es-CO')} filas, liderado por la ciudad de ${topCity[0]}.`
  };
}

export async function askBICopilot(
  question: string,
  ctx: BICopilotContext,
  apiKey?: string
): Promise<BICopilotResponse> {
  const keys = getDualApiKeys(apiKey, true);

  if (keys.length > 0) {
    const prompt = `Eres el Analista Ejecutivo IA de PizzaCorp conectado directamente al modelo dimensional en Excel / Google Sheets (fact_ventas, dim_pizzas, dim_pizaTipeID, dim_city, dim_saleChannel, dim_fecha).
Tienes acceso COMPLETO a las fechas, años (2024, 2025 y 2026), meses y días de la semana a través de la tabla dim_fecha.
Datos exactos en tiempo real:
${buildContextSummaryText(ctx)}

Pregunta del administrador: "${question}"

Devuelve ÚNICAMENTE un JSON válido con esta estructura:
{
  "answer": "Respuesta ejecutiva bien formateada con cifras exactas (años, meses, ciudades, canales o ingredientes) y una recomendación breve.",
  "spokenSummary": "Resumen hablado natural de máximo 2 oraciones breves en español (sin símbolos ni listas) para leer en voz alta rápidamente."
}`;

    const attempts: Array<{ key: string; model: string }> = [];
    for (const k of keys) {
      attempts.push({ key: k, model: 'gemini-3.5-flash-lite' });
      attempts.push({ key: k, model: 'gemini-2.5-flash' });
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
          const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
          if (parsed.answer) {
            return {
              userQuestion: question,
              answer: String(parsed.answer),
              spokenSummary: String(parsed.spokenSummary || parsed.answer)
            };
          }
        }
      } catch {}
    }
  }

  const fallback = buildLocalFallbackAnswer(question, ctx);
  return {
    userQuestion: question,
    answer: fallback.answer,
    spokenSummary: fallback.spokenSummary
  };
}

/**
 * Escucha la pregunta en audio del administrador y responde en UN SOLO paso usando el pool de dos claves API
 */
export async function askBICopilotByAudio(
  base64Audio: string,
  mimeType: string,
  ctx: BICopilotContext,
  apiKey?: string
): Promise<BICopilotResponse | null> {
  const keys = getDualApiKeys(apiKey, false);
  if (keys.length === 0) return null;

  const prompt = `Escucha el audio del administrador preguntando sobre el negocio de pizzas, ventas por año/mes/día (dim_fecha), ciudades, canales o ingredientes del modelo en Excel.
Si el audio solo tiene silencio o ruido sin palabras, devuelve:
{"userQuestion": "", "answer": "", "spokenSummary": ""}

Datos exactos del modelo estrella (incluyendo años 2024, 2025, meses y días de dim_fecha):
${buildContextSummaryText(ctx)}

Devuelve ÚNICAMENTE un objeto JSON válido con:
{
  "userQuestion": "transcripción exacta en español de la pregunta que hizo el usuario",
  "answer": "respuesta ejecutiva clara con cifras o ingredientes exactos del modelo y recomendación",
  "spokenSummary": "resumen hablado directo en 1 o 2 frases cortas sin símbolos para decir por voz"
}`;

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
                  { text: prompt }
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
        const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());
        const q = String(parsed.userQuestion || '').trim();
        if (!q) return null;
        return {
          userQuestion: q,
          answer: String(parsed.answer || buildLocalFallbackAnswer(q, ctx).answer),
          spokenSummary: String(parsed.spokenSummary || parsed.answer || '')
        };
      }
    } catch {}
  }

  return null;
}
