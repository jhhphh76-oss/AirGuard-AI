/**
 * AirGuard AI - Context-Aware Problem-Solving AI Advisor Client Service
 * 
 * Capabilities:
 * 1. Open-ended conversational assistant (not limited to fixed FAQs)
 * 2. Problem-solving reasoning: combines current telemetry, forecast trend,
 *    recent location history, real comparison locations, and user health symptoms.
 * 3. Never invents missing readings.
 * 4. Challenges incorrect assumptions.
 * 5. Strict health safety (non-diagnostic).
 * 6. High-reliability fallback rules engine.
 */

import { AQIReading, AIAdvisorResponse, HourlyForecastPoint } from '../types/airguard';
import { historyService } from './historyService';
import { healthContextService } from './healthContextService';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export const PRESET_ADVISOR_QUESTIONS = [
  'Is it better to go outside right now?',
  'What should I do if I need to go outside?',
  'Where nearby has relatively lower pollution?',
  'Which pollutant is the main concern?',
  'Why did the AQI change?',
  'Explain PM2.5 to me',
];

export const aiAdvisorService = {
  async askAdvisor(
    question: string,
    reading: AQIReading,
    history: ChatTurn[] = [],
    forecast: HourlyForecastPoint[] = []
  ): Promise<AIAdvisorResponse> {
    // 1. Gather recent history for the selected location
    const allHistory = historyService.getHistory();
    const locationHistory = allHistory
      .filter((r) => r.location.name.toLowerCase() === reading.location.name.toLowerCase())
      .slice(0, 4)
      .map((r) => ({
        time: `${r.date} ${r.time}`,
        aqi: r.aqi,
        category: r.category,
      }));

    // 2. Identify other verified locations in this session for real comparisons
    const comparisonMap = new Map<string, { aqi: number; category: string; time: string }>();
    for (const rec of allHistory) {
      if (rec.location.name.toLowerCase() !== reading.location.name.toLowerCase()) {
        if (!comparisonMap.has(rec.location.name)) {
          comparisonMap.set(rec.location.name, {
            aqi: rec.aqi,
            category: rec.category,
            time: `${rec.date} ${rec.time}`,
          });
        }
      }
    }
    const availableComparisonLocations = Array.from(comparisonMap.entries()).map(([name, data]) => ({
      locationName: name,
      aqi: data.aqi,
      category: data.category,
      measuredAt: data.time,
    }));

    // 3. Summarize forecast trend
    let forecastSummary = '';
    if (forecast && forecast.length > 0) {
      const next6 = forecast.slice(0, 6);
      const minAqi = Math.min(...next6.map((f) => f.aqi));
      const maxAqi = Math.max(...next6.map((f) => f.aqi));
      const endAqi = next6[next6.length - 1].aqi;
      const trend = endAqi > reading.aqi + 5 ? 'worsening' : endAqi < reading.aqi - 5 ? 'improving' : 'stable';
      forecastSummary = `Next 6 hours forecast range: AQI ${minAqi} to ${maxAqi} (trend: ${trend}). Projected AQI in 1h: ${next6[0]?.aqi ?? reading.aqi}.`;
    }

    // 4. Gather active health symptoms & photo analysis
    const healthCtx = healthContextService.getHealthContext();

    const payload = {
      question,
      history,
      context: {
        locationName: reading.location.name,
        latitude: reading.location.latitude,
        longitude: reading.location.longitude,
        aqi: reading.aqi,
        category: reading.category,
        pollutants: reading.pollutants,
        indicators: reading.indicators,
        dominantPollutant: reading.dominantPollutant,
        timestamp: reading.timestamp,
        locationHistory,
        forecastSummary,
        availableComparisonLocations,
        selectedSymptom: healthCtx.selectedSymptom,
        customConcern: healthCtx.customConcern,
        photoObservation: healthCtx.photoObservation,
      },
    };

    // 5. Query server-side Gemini endpoint
    try {
      const response = await fetch('/api/gemini/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.answer) {
          return {
            answer: data.answer,
            source: data.source || 'AirGuard AI',
            warning: data.warning,
          };
        }
      }
    } catch (err) {
      console.warn('Network call to AI Advisor failed, using local engine:', err);
    }

    // 6. Resilient Problem-Solving Fallback Engine
    const scientificAnswer = generateProblemSolvingGuidance(question, payload.context);
    return {
      answer: scientificAnswer,
      source: 'AirGuard AI',
    };
  },
};

export function generateProblemSolvingGuidance(question: string, context: any): string {
  const {
    locationName,
    aqi,
    category,
    dominantPollutant,
    pollutants,
    forecastSummary,
    availableComparisonLocations,
    selectedSymptom,
  } = context || {};

  const q = (question || '').toLowerCase().trim();

  // 1. Identity & capabilities
  if (
    q.includes('who are you') ||
    q.includes('what are you') ||
    q.includes('what is your name') ||
    q.includes("what's your name") ||
    q.includes('are you an ai')
  ) {
    return "I'm AirGuard AI, your air-quality and environmental health assistant. I can help you understand pollution, AQI, environmental conditions, trends, and practical ways to respond.";
  }

  if (q.includes('what can you help') || q.includes('what can you do') || q.includes('help me with')) {
    return `I can help you with:\n\n• **Real-Time Analysis:** Breaking down measured pollutants (PM2.5, PM10, O₃, NO₂, CO) in ${locationName}.\n• **Outdoor Decision Support:** Reasoning through exercise, commute timing, and exposure precautions.\n• **Trend Interpretation:** Explaining why AQI changed and what upcoming forecast models show.\n• **Relative Comparisons:** Evaluating measured air quality across available locations without declaring anywhere "completely risk-free".\n• **Environmental Guidance:** Connecting reported symptoms to environmental irritants (non-diagnostic).`;
  }

  // 2. "I need to go outside but AQI is high. What should I do?"
  if (
    (q.includes('need to go outside') || q.includes('have to go outside')) &&
    (q.includes('high') || q.includes('poor') || q.includes('what should i do'))
  ) {
    let guidance = `If you need to go outside in **${locationName}** while the air quality is **${category}** (AQI ${aqi}, dominant: ${dominantPollutant}), here are practical, evidence-based options:\n\n`;
    guidance += `1. **Route Selection:** Stick to secondary residential corridors away from heavy truck and diesel arteries where ${dominantPollutant} concentrations peak.\n`;
    guidance += `2. **Personal Protection:** A well-fitted, certified particulate respirator (N95, KN95, or FFP2) significantly filters fine particles like PM2.5 and coarse dust.\n`;
    guidance += `3. **Exertion Management:** Keep your physical pace brisk but avoid high aerobic breathing (jogging, cycling) that pulls particles deep into pulmonary alveoli.\n`;
    if (forecastSummary) {
      guidance += `4. **Timing Window:** ${forecastSummary} If possible, align your outing with hours when dispersion improves.\n`;
    }
    guidance += `5. **Post-Exposure:** Wash your face and hands, rinse your eyes with clean saline if irritated, and change outer layers upon returning indoors.`;
    return guidance;
  }

  // 3. "Is it better to go outside right now?"
  if (q.includes('is it better to go outside') || q.includes('should i go outside') || q.includes('safe to go outside')) {
    if (aqi <= 50) {
      return `**Yes, right now is optimal.** Air quality in **${locationName}** is currently **Good** (US AQI ${aqi}). Atmospheric fine particles are minimal (${pollutants?.pm2_5 ?? 'low'} µg/m³), making it an excellent time for outdoor exercise, errands, and natural ventilation.`;
    }
    if (aqi <= 100) {
      return `**Right now is acceptable for most people.** Air quality in **${locationName}** is **Moderate** (US AQI ${aqi}, primary: ${dominantPollutant}). General activities are fine, though individuals with sensitive airways or asthma should avoid prolonged intense cardio. ${forecastSummary || ''}`;
    }
    return `**Outdoor conditions are currently suboptimal.** In **${locationName}**, air quality is **${category}** (US AQI ${aqi}, dominant: ${dominantPollutant}).\n\n• **Recommendation:** If your outdoor activity is discretionary, consider postponing or shifting indoors.\n• **If you must head out:** Shorten your time outdoors, avoid heavy traffic intersections, and consider wearing an N95/FFP2 mask. ${forecastSummary || ''}`;
  }

  // 4. "Where nearby has relatively lower measured pollution?" / "Where is better?"
  if (
    q.includes('where is better') ||
    q.includes('where nearby') ||
    q.includes('lower pollution') ||
    q.includes('cleaner air') ||
    q.includes('where should i go')
  ) {
    if (availableComparisonLocations && availableComparisonLocations.length > 0) {
      const sorted = [...availableComparisonLocations].sort((a: any, b: any) => a.aqi - b.aqi);
      const cleanest = sorted[0];
      let resp = `Comparing only locations for which AirGuard has actual measured telemetry in this session:\n\n`;
      resp += `• **${locationName} (Current):** AQI ${aqi} (${category})\n`;
      sorted.forEach((loc: any) => {
        resp += `• **${loc.locationName}:** AQI ${loc.aqi} (${loc.category}) — recorded ${loc.measuredAt}\n`;
      });
      resp += `\nAmong these measured locations, **${cleanest.locationName}** has **better measured air quality** (relatively lower-pollution). Note that no outdoor environment is completely free of particles; conditions depend on real-time atmospheric wind patterns.`;
      return resp;
    }
    return `Currently, AirGuard only has verified Open-Meteo measurements for **${locationName}** in this session.\n\nTo see where has relatively lower pollution, search other destinations or suburbs using the **Location Search** tool. Once loaded, AirGuard will compare their actual measured readings rather than guessing.`;
  }

  // 5. Challenge assumptions: "AQI went up so PM2.5 must have increased"
  if (
    (q.includes('aqi went up') || q.includes('aqi increased')) &&
    (q.includes('pm2.5') || q.includes('pm25')) &&
    (q.includes('must have') || q.includes('means') || q.includes('because'))
  ) {
    return `**Not necessarily.** AQI is calculated based on whichever single monitored pollutant poses the highest relative risk at that moment, not solely PM2.5.\n\n• **Current Dominant Pollutant in ${locationName}:** **${dominantPollutant}**\n• **PM2.5:** ${pollutants?.pm2_5 ?? 'Unavailable'} µg/m³\n• **PM10:** ${pollutants?.pm10 ?? 'Unavailable'} µg/m³\n• **Ozone (O₃):** ${pollutants?.o3 ?? 'Unavailable'} µg/m³\n• **NO₂:** ${pollutants?.no2 ?? 'Unavailable'} µg/m³\n\nFor example, on hot sunny afternoons, photochemical ozone (O₃) can surge and raise the AQI even if PM2.5 levels remain flat. Checking the specific pollutant breakdown reveals the true atmospheric driver.`;
  }

  // 6. "Which pollutant is the main concern?"
  if (q.includes('which pollutant') || q.includes('main concern') || q.includes('primary pollutant')) {
    return `In **${locationName}**, the primary measured pollutant of concern right now is **${dominantPollutant}**.\n\n• **Concentration:** ${dominantPollutant === 'PM2.5' ? `${pollutants?.pm2_5 ?? 'N/A'} µg/m³` : dominantPollutant === 'PM10' ? `${pollutants?.pm10 ?? 'N/A'} µg/m³` : `${pollutants?.o3 ?? 'N/A'} µg/m³`}\n• **Total US AQI:** ${aqi} (${category})\n• **Why it matters:** ${dominantPollutant} is currently at the highest proportional threshold relative to air quality standards, making it the primary factor driving today's category classification.`;
  }

  // 7. "Why did the AQI change?"
  if (q.includes('why did the aqi change') || q.includes('why did aqi change') || q.includes('why did it change')) {
    return `AQI shifts in **${locationName}** are typically driven by three interacting factors:\n\n1. **Boundary Layer Meteorology:** Calm winds or temperature inversions trap emissions close to ground level, causing AQI to rise. When wind speeds pick up, vertical dispersion dilutes airborne particles.\n2. **Diurnal Emission Cycles:** Morning and evening vehicular rush hours sharply elevate NO₂ and fine PM2.5, whereas daytime solar radiation drives secondary photochemical Ozone (O₃) creation.\n3. **Current Reading:** AQI is currently **${aqi}** (**${category}**), driven primarily by **${dominantPollutant}**.`;
  }

  // 8. Health questions & symptoms
  if (q.includes('headache') || q.includes('cough') || q.includes('breathe') || q.includes('throat') || q.includes('eye') || selectedSymptom) {
    const sym = selectedSymptom || 'respiratory/mucosal irritation';
    return `AirGuard is an environmental support tool, not a medical diagnostic system. Elevated **${dominantPollutant}** levels in **${locationName}** (AQI ${aqi}, ${category}) can act as environmental irritants that may contribute to or exacerbate symptoms like ${sym}.\n\n• **Environmental precaution:** Rest indoors in a space equipped with mechanical HEPA air filtration and avoid strenuous cardio outside.\n• **Health notice:** We cannot determine whether pollution is the sole cause of your symptoms. If you experience severe, worsening, or persistent discomfort (such as chest tightness or severe breathlessness), please tell a parent/guardian and seek prompt evaluation by a healthcare professional.`;
  }

  // 9. Standard definitions (PM2.5, PM10, Ozone, etc.)
  if (q.includes('pm2.5') || q.includes('pm25')) {
    return `PM2.5 refers to fine inhalable particles with diameters 2.5 micrometers and smaller (about 30 times finer than a strand of human hair). Because of their microscopic scale, they can bypass upper airway defenses, penetrate deep into alveolar lung tissue, and enter the bloodstream. In **${locationName}**, current PM2.5 is **${pollutants?.pm2_5 ?? 'unavailable'} µg/m³**.`;
  }

  if (q.includes('pm10')) {
    return `PM10 consists of inhalable particles with diameters of 10 micrometers and smaller, including airborne road dust, pollen, mold spores, and mechanical abrasion debris. They primarily settle in the upper respiratory tract. In **${locationName}**, current PM10 is **${pollutants?.pm10 ?? 'unavailable'} µg/m³**.`;
  }

  if (q.includes('ozone') || q.includes('o3')) {
    return `Ground-level ozone (O3) is a secondary pollutant created by photochemical reactions between nitrogen oxides (NOx) and volatile organic compounds (VOCs) under sunlight. Unlike stratospheric ozone that shields us from UV, ground-level ozone is a powerful lung irritant. In **${locationName}**, current O3 is **${pollutants?.o3 ?? 'unavailable'} µg/m³**.`;
  }

  return `### Air Quality Analysis for ${locationName}\n\n• **Current AQI:** ${aqi} (${category})\n• **Dominant Factor:** ${dominantPollutant}\n• **PM2.5:** ${pollutants?.pm2_5 ?? 'Unavailable'} µg/m³ · **PM10:** ${pollutants?.pm10 ?? 'Unavailable'} µg/m³\n\nI can help you reason through outdoor plans, explain specific pollutants, assess relative comparisons, or answer general environmental health questions!`;
}
