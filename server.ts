import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateScientificRulesFallback(question: string, context: any): string {
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
    return `PM2.5 refers to fine inhalable particles with diameters 2.5 micrometers and smaller (roughly 30 times finer than a strand of human hair). Because of their microscopic scale, they can bypass upper airway defenses, penetrate deep into alveolar lung tissue, and enter the bloodstream. In ${locationName}, current PM2.5 is **${pollutants?.pm2_5 ?? 'unavailable'} µg/m³**.`;
  }

  if (q.includes('pm10')) {
    return `PM10 consists of inhalable particles with diameters of 10 micrometers and smaller, including airborne road dust, pollen, mold spores, and mechanical abrasion debris. They primarily settle in the upper respiratory tract. In ${locationName}, current PM10 is **${pollutants?.pm10 ?? 'unavailable'} µg/m³**.`;
  }

  if (q.includes('ozone') || q.includes('o3')) {
    return `Ground-level ozone (O3) is a secondary pollutant created by photochemical reactions between nitrogen oxides (NOx) and volatile organic compounds (VOCs) under sunlight. Unlike stratospheric ozone that protects us from UV, ground-level ozone is a powerful lung irritant. In ${locationName}, current O3 is **${pollutants?.o3 ?? 'unavailable'} µg/m³**.`;
  }

  if (q.includes('seven pollutants') || q.includes('7 pollutants')) {
    return `AirGuard monitors the primary environmental pollutants affecting respiratory and cardiovascular wellness:\n\n1. **PM2.5** — Fine particulate matter\n2. **PM10** — Inhalable coarse particles\n3. **NO2** — Nitrogen dioxide from combustion\n4. **O3** — Ground-level ozone\n5. **CO** — Carbon monoxide\n6. **SO2** — Sulphur dioxide\n7. **CO2** — Atmospheric carbon dioxide`;
  }

  if (q.includes('difference between aqi and pm2.5') || q.includes('aqi and pm2.5')) {
    return `**PM2.5** is a physical measurement of mass concentration (in micrograms per cubic meter, µg/m³) of fine particles in the air.\n\n**AQI (Air Quality Index)** is a standardized index (0 to 500) designed by environmental agencies to translate raw pollutant concentrations into a simple, color-coded health risk scale (Good, Moderate, Unhealthy, etc.).`;
  }

  if (q.includes('like i\'m 10') || q.includes('like im 10') || q.includes('for a kid') || q.includes('simple')) {
    return `Imagine the air around us is like a big glass of clear water. Air pollution is like tiny invisible specks of dust and smoke floating inside that water. When the air has too many specks, it can make our throats tickle or make it harder to run fast. In ${locationName}, the air is currently **${category}** (AQI ${aqi}), so it's a good idea to check before big outdoor games!`;
  }

  if (q.includes('why is the sky blue') || q.includes('sky blue')) {
    return `The sky is blue due to a physical phenomenon called **Rayleigh scattering**. Earth's atmospheric gases scatter shorter wavelengths of sunlight (blue and violet) in all directions much more strongly than longer wavelengths (red and yellow). Because human eyes are more sensitive to blue light, we perceive the daytime sky as blue!`;
  }

  if (q.includes('joke')) {
    return `Why did the atmospheric sensor break up with the air filter? Because it felt too much pressure! 😄`;
  }

  if (q.includes('interesting') || q.includes('fun fact') || q.includes('fact')) {
    return `Here is a fascinating atmospheric fact: Microscopic fine particles (PM2.5) are so lightweight that they can remain suspended in the atmosphere for weeks, traveling thousands of miles across oceans on continental jet streams! For example, Saharan dust plumes regularly travel across the Atlantic to the Americas.`;
  }

  return `### Air Quality Analysis for ${locationName}\n\n• **Current AQI:** ${aqi} (${category})\n• **Dominant Factor:** ${dominantPollutant}\n• **PM2.5:** ${pollutants?.pm2_5 ?? 'Unavailable'} µg/m³ · **PM10:** ${pollutants?.pm10 ?? 'Unavailable'} µg/m³\n\nI can help you reason through outdoor plans, explain specific pollutants, assess relative comparisons, or answer general environmental health questions!`;
}

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Increase payload limit to support captured photos and image attachments
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Initialize server-side Gemini client
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey
    ? new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    : null;

  // Server-side AI Advisor endpoint
  app.post('/api/gemini/advisor', async (req, res) => {
    try {
      const { question, context, history } = req.body;
      if (!question || !context) {
        return res.status(400).json({ error: 'Missing question or context payload' });
      }

      if (!ai) {
        return res.json({
          answer: generateScientificRulesFallback(question, context),
          source: 'AirGuard AI',
        });
      }

      const systemInstruction = `You are AirGuard AI, a context-aware environmental problem-solving assistant inside the AirGuard application.

IDENTITY:
- Your name is AirGuard AI, personal air-quality and environmental health assistant.
- If asked "Who are you?", "What are you?", "What's your name?", or "What can you help with?", introduce yourself naturally:
  "I'm AirGuard AI, your air-quality and environmental health assistant. I can help you understand pollution, AQI, environmental conditions, trends, and practical ways to respond."
- Never claim to be OpenAI, ChatGPT, or external models.

CRITICAL PROBLEM-SOLVING PRINCIPLES:
Reason through problems instead of simply repeating the AQI.
1. Understand the user's actual goal (e.g. going outside, commuting, exercising, planning daily activities, understanding why numbers changed, comparing locations, or managing symptoms).
2. Reason from the real available evidence:
   - Location: ${context.locationName} (${context.latitude}, ${context.longitude})
   - Current US AQI: ${context.aqi} (${context.category})
   - Dominant Pollutant: ${context.dominantPollutant}
   - Measured Pollutants (Open-Meteo):
     * PM2.5: ${context.pollutants?.pm2_5 != null ? `${context.pollutants.pm2_5} µg/m³` : 'Unavailable'}
     * PM10: ${context.pollutants?.pm10 != null ? `${context.pollutants.pm10} µg/m³` : 'Unavailable'}
     * NO2: ${context.pollutants?.no2 != null ? `${context.pollutants.no2} µg/m³` : 'Unavailable'}
     * O3 (Ozone): ${context.pollutants?.o3 != null ? `${context.pollutants.o3} µg/m³` : 'Unavailable'}
     * CO: ${context.pollutants?.co != null ? `${context.pollutants.co} µg/m³` : 'Unavailable'}
     * SO2: ${context.pollutants?.so2 != null ? `${context.pollutants.so2} µg/m³` : 'Unavailable'}
     * CO2: ${context.pollutants?.co2 != null ? `${context.pollutants.co2} ppm` : 'Unavailable'}
   - Environmental Indicators:
     * AOD: ${context.indicators?.aod ?? 'Unavailable'}
     * Dust: ${context.indicators?.dust != null ? `${context.indicators.dust} µg/m³` : 'Unavailable'}
     * UV Index: ${context.indicators?.uv_index ?? 'Unavailable'}
   - Forecast / Trend: ${context.forecastSummary || 'Available in Forecast tab'}
   - Recent History for ${context.locationName}: ${JSON.stringify(context.locationHistory || [])}
   - Other Verified Locations in Session: ${JSON.stringify(context.availableComparisonLocations || [])}
   - User Health Symptom (if reported): ${context.selectedSymptom ? `${context.selectedSymptom} ${context.customConcern ? `(${context.customConcern})` : ''}` : 'None reported'}
   - Photo Analysis Observation (if analyzed): ${context.photoObservation || 'None'}

PROBLEM-SOLVING RULES:
1. PRACTICAL OPTIONS:
   Never simply tell the user "AQI is high. Stay indoors."
   If the user needs or wants to go outside, reason from specific pollutant levels, the forecast trend, wind/time of day, personal protection (certified N95/FFP2 masks for fine particles/dust), and route choices (avoiding heavy diesel traffic arteries).
2. "WHERE IS BETTER?" / COMPARISONS:
   Compare ONLY locations for which AirGuard has actual measured data (listed under "Other Verified Locations in Session").
   Use phrasing such as "relatively lower-pollution" or "better measured air quality among the available locations".
   NEVER declare any location to be "absolutely safe" or risk-free.
   If NO other location has verified measurements in the session, explicitly state:
   "AirGuard currently only has verified measurements for ${context.locationName} in this session. To check other areas, use the Location Search to load verified Open-Meteo readings for those locations."
   NEVER fabricate or invent AQI numbers for locations not measured.
3. CHALLENGE ASSUMPTIONS:
   If the user assumes an incorrect cause (e.g. "The AQI went up so PM2.5 must have increased"), gently correct the misconception:
   AQI can be driven by different pollutants (e.g., ground-level ozone on hot sunny afternoons, coarse PM10 dust during windy conditions, or NO2 from rush-hour traffic). Examine which pollutant is actually dominant in the current data.
   Clearly distinguish between:
   - Measured fact (what the sensors recorded)
   - Scientific interpretation (likely sources or atmospheric behavior)
   - Uncertainty (what AirGuard does not measure).
4. HEALTH SAFETY:
   You are an environmental health assistant, NOT a doctor or diagnostic system.
   NEVER diagnose medical conditions (never say "You have asthma" or "You have an allergy" or "Pollution caused your headache").
   Explain environmental context cautiously: "may contribute to", "can be associated with", "can irritate airways".
   For serious, acute, or worsening symptoms (e.g., severe breathlessness, chest tightness, extreme dizziness), urge the user to tell a parent/guardian and seek prompt medical care.
5. OPEN-ENDED & EDUCATIONAL:
   You can answer any educational question about air quality, atmospheric science, pollutants, or the AirGuard app. Do NOT reject questions or force every question into a generic AQI regurgitation.
6. MONITORED POLLUTANTS:
   - AirGuard monitors PM2.5, PM10, NO2, O3, CO, SO2, and CO2.
   - Do NOT reference NH3 (ammonia) as a measured pollutant; AirGuard does not track, measure, or report NH3.`;

      // Build contents array for multi-turn conversation
      const contents: any[] = [];
      if (Array.isArray(history) && history.length > 0) {
        for (const turn of history.slice(-10)) {
          if (turn.text && turn.text.trim()) {
            const role = turn.role === 'assistant' || turn.role === 'model' ? 'model' : 'user';
            if (contents.length === 0 && role !== 'user') {
              continue;
            }
            if (contents.length > 0 && contents[contents.length - 1].role === role) {
              contents[contents.length - 1].parts[0].text += `\n${turn.text}`;
            } else {
              contents.push({
                role,
                parts: [{ text: turn.text }],
              });
            }
          }
        }
      }

      // Append current user question
      if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
        contents[contents.length - 1].parts[0].text += `\n${question}`;
      } else {
        contents.push({
          role: 'user',
          parts: [{ text: question }],
        });
      }

      // Attempt generation with primary fast model gemini-flash-latest
      let text = '';
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents,
          config: {
            systemInstruction,
            temperature: 0.6,
          },
        });
        text = response.text || '';
      } catch (primaryErr: any) {
        // If primary model hit rate limits or 429, try secondary lightweight model
        console.warn('Primary Gemini model busy, attempting secondary flash-lite:', primaryErr?.message || primaryErr);
        try {
          const fallbackResp = await ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents,
            config: {
              systemInstruction,
              temperature: 0.5,
            },
          });
          text = fallbackResp.text || '';
        } catch (secondaryErr: any) {
          console.warn('Gemini quota limit reached, activating AirGuard AI engine fallback');
          text = generateScientificRulesFallback(question, context);
        }
      }

      if (!text) {
        text = generateScientificRulesFallback(question, context);
      }

      res.json({ answer: text, source: 'AirGuard AI' });
    } catch (err: any) {
      console.warn('Gemini advisor request handled via fallback:', err?.message || err);
      // Friendly fallback adhering strictly to rule 11
      const fallback = generateScientificRulesFallback(req.body?.question || '', req.body?.context);
      res.json({
        answer: fallback || "I'm having trouble connecting right now. Please try again in a moment.",
        source: 'AirGuard AI',
      });
    }
  });

  // Helper for generating non-diagnostic exposure and symptom analysis fallback
  function generateExposureAnalysisFallback(context: any, hasPhoto: boolean): any {
    const {
      locationName = 'Current Location',
      aqi = 50,
      category = 'Moderate',
      dominantPollutant = 'PM2.5',
      pollutants = {},
      symptoms = [],
      customConcern = '',
      isNoSymptomMode = false,
    } = context || {};

    const pm25 = pollutants?.pm2_5;
    const pm10 = pollutants?.pm10;
    const o3 = pollutants?.o3;
    const no2 = pollutants?.no2;

    const isElevated = (val: number | null | undefined, threshold: number) =>
      typeof val === 'number' && val > threshold;

    const pm25High = isElevated(pm25, 15);
    const o3High = isElevated(o3, 60);

    const visibleContent = hasPhoto
      ? 'Optical observations from the image indicate ambient surface features under available lighting. Insufficient visual information for meaningful clinical assessment; visual data provides general reference only.'
      : 'Photo not provided';

    const environmentalObservations = `Current environmental conditions in ${locationName}: US AQI ${aqi} (${category}), with ${dominantPollutant} as dominant pollutant. Real-time telemetry: PM2.5: ${pm25 !== null && pm25 !== undefined ? pm25 : 'N/A'} µg/m³, PM10: ${pm10 !== null && pm10 !== undefined ? pm10 : 'N/A'} µg/m³, O₃: ${o3 !== null && o3 !== undefined ? o3 : 'N/A'} µg/m³, NO₂: ${no2 !== null && no2 !== undefined ? no2 : 'N/A'} µg/m³.`;

    let potentialFactors = '';
    const precautions: string[] = [];

    const whatMayBeIrritating = hasPhoto
      ? 'Optical observations indicate exposed surface appearance under ambient lighting. In an environmental context, particulate deposition or atmospheric dryness may contribute to surface dryness or minor irritation, though photographs cannot diagnose clinical causes.'
      : `Based on current ambient conditions (${category}, AQI ${aqi}), elevated ${dominantPollutant} or airborne particulates may be contributing to environmental irritation.`;

    let whyThisMatters = `Air quality conditions (AQI ${aqi}, ${dominantPollutant}) in ${locationName} can interact with mucosal and respiratory barriers. Current levels may contribute to sensory irritation in exposed individuals.`;
    const doList: string[] = [
      'Stay well hydrated to maintain healthy mucous membrane barriers.',
      'Operate indoor mechanical HEPA air filtration if available.',
    ];
    const dontList: string[] = [
      'Avoid strenuous outdoor cardio workouts during peak traffic or high pollution hours.',
      'Avoid rubbing irritated eyes or scrubbing facial skin aggressively.',
    ];
    let whenToGetHelp = 'Seek medical evaluation if symptoms worsen, do not improve with clean indoor rest, or if you experience severe discomfort, fever, or difficulty breathing.';

    const researchAnalysis = `Research-Style Optical & Environmental Evaluation:
1. Visual Observations: Image demonstrates facial surface under ambient illumination. No definitive clinical biomarkers or pathological lesions can be determined from 2D photographic capture.
2. Environmental Exposure Relevance: Current ambient air registers AQI ${aqi} (${category}) with ${dominantPollutant} as primary pollutant. Ambient particulate matter can settle on external dermal barriers.
3. Scientific Context: Fine particulates (PM2.5) and ambient oxidants interact with the stratum corneum lipid matrix, potentially influencing transepidermal water loss and superficial barrier stress.
4. Distinguishing Observations vs Possibilities: Surface appearance may be influenced by hydration, ambient humidity, temperature, or individual baseline characteristics; environmental air quality is a potential external contributor rather than an established sole cause.
5. Limitations: Standard photographic images cannot quantify microscopic particulate load, tissue penetration, or replace in-person clinical dermatological evaluation.`;

    const isExplicitNoSymptom =
      isNoSymptomMode || (symptoms.length === 1 && symptoms[0] === 'No symptoms / just checking air');

    if (isExplicitNoSymptom) {
      whyThisMatters = `Checking ambient air (AQI ${aqi}, ${category}) provides proactive baseline awareness before irritants accumulate.`;
      potentialFactors = `Current environmental conditions in ${locationName} serve as an ambient baseline check. At an AQI of ${aqi} (${category}), environmental factors are currently ${
        aqi <= 50 ? 'minimal' : aqi <= 100 ? 'moderate' : 'elevated'
      }. No individual discomfort or irritation symptoms were reported.`;
      if (aqi <= 50) {
        precautions.push('Air quality is satisfactory — optimal for regular outdoor workouts and natural window ventilation.');
        precautions.push('Continue normal daily activities with minimal particulate exposure concern.');
      } else if (aqi <= 100) {
        precautions.push('Acceptable for general outdoor activities for most individuals.');
        precautions.push('If unusually sensitive to ozone or airborne particles, consider taking more rest breaks during high exertion.');
      } else {
        precautions.push('Consider limiting prolonged outdoor cardiovascular exertion during peak pollution hours.');
        precautions.push('Keep windows closed along high-traffic corridors and run mechanical HEPA filtration indoors.');
      }
    } else if (symptoms.length > 0) {
      const symptomList = symptoms.join(', ') + (customConcern ? ` (${customConcern})` : '');
      whyThisMatters = `Reported concerns (${symptomList}) can be irritated by current environmental pollutants (${dominantPollutant}, AQI ${aqi}). Environmental air is a recognized mucosal irritant, though non-environmental factors can also cause similar symptoms.`;
      potentialFactors = `Current environmental conditions may contribute to irritation or discomfort. Some pollutants can be associated with respiratory or irritation-related symptoms like ${symptomList}. Observed atmospheric factors (${dominantPollutant}${
        pm25High ? ', elevated PM2.5' : ''
      }${o3High ? ', elevated Ozone' : ''}) represent possible contributors rather than proven causes.`;

      if (symptoms.some((s: string) => s.includes('Eye'))) {
        doList.push('Rinse eyes with clean sterile saline or artificial tears if airborne dust or ozone irritation occurs.');
        dontList.push('Avoid vigorously rubbing your eyes, as abrasive particles can scratch delicate corneal surfaces.');
        whenToGetHelp = 'Seek medical care if you experience severe eye pain, vision changes, extreme light sensitivity, or thick discharge.';
        precautions.push('Rinse eyes with clean sterile saline or artificial tears if airborne dust or ozone irritation occurs.');
      }
      if (symptoms.some((s: string) => s.includes('Skin') || s.includes('face') || s.includes('Face'))) {
        doList.push('Wash exposed skin with a gentle non-soap cleanser and apply a barrier moisturizer after outdoor exposure.');
        dontList.push('Avoid harsh abrasive exfoliants while your skin feels sensitized.');
        whenToGetHelp = 'Seek medical evaluation if redness spreads, hives appear, or facial swelling occurs.';
        precautions.push('Wash exposed skin with a gentle non-soap cleanser and apply a barrier moisturizer after outdoor exposure.');
      }
      if (symptoms.some((s: string) => s.includes('Throat') || s.includes('Cough') || s.includes('Sneezing'))) {
        doList.push('Stay well hydrated and consider wearing a certified N95/FFP2 respirator when outdoor particulate levels are elevated.');
        dontList.push('Avoid exposure to secondary irritants like cigarette smoke, vaping, or chemical cleaning aerosols.');
        precautions.push('Stay well hydrated and consider wearing a certified N95/FFP2 respirator when outdoor particulate levels are elevated.');
      }
      if (symptoms.some((s: string) => s.includes('Breathing'))) {
        doList.unshift('Stop outdoor exertion immediately and rest in clean, filtered indoor air.');
        dontList.unshift('Do not ignore shortness of breath or attempt strenuous exercise.');
        whenToGetHelp = 'EMERGENCY: Seek immediate emergency medical assistance (e.g. dial 911) if you experience severe shortness of breath, chest tightness, or blue lips/fingertips.';
        precautions.push('Reduce strenuous physical exertion outdoors and stay in clean, filtered indoor air.');
        precautions.push('Seek immediate medical evaluation if acute shortness of breath or chest tightness occurs.');
      }
      if (precautions.length < 3) {
        precautions.push('Consider running indoor HEPA air filtration to reduce ambient airborne particle concentration.');
        precautions.push('Consult a qualified healthcare professional if symptoms persist or worsen.');
      }
    } else {
      potentialFactors = `Current ambient readings in ${locationName} reflect an AQI of ${aqi} (${category}) with ${dominantPollutant} as dominant pollutant. Current environmental conditions may contribute to irritation or discomfort in sensitive individuals.`;
      precautions.push('Monitor real-time AQI and forecast trends before planning extended outdoor exercise.');
      precautions.push('Maintain indoor air quality with proper filtration and ventilation management.');
    }

    return {
      photoProvided: hasPhoto,
      visibleContent,
      whatMayBeIrritating,
      whyThisMatters,
      doList: doList.slice(0, 4),
      dontList: dontList.slice(0, 4),
      whenToGetHelp,
      researchAnalysis,
      environmentalObservations,
      potentialFactors,
      precautions: precautions.slice(0, 4),
    };
  }

  // Server-side Gemini Exposure & Photo Analysis Endpoint
  app.post('/api/gemini/analyze-photo', async (req, res) => {
    try {
      const { imageBase64, context } = req.body || {};
      const hasPhoto = Boolean(imageBase64 && typeof imageBase64 === 'string' && imageBase64.trim().length > 0);

      if (!ai) {
        const fallback = generateExposureAnalysisFallback(context, hasPhoto);
        return res.json({ result: fallback, source: 'AirGuard Environmental Intelligence' });
      }

      const systemInstruction = `You are the AirGuard AI Environmental Health & Exposure Specialist.
Analyze the user's reported concerns and environmental conditions${hasPhoto ? ' and submitted photograph' : ''}.

CRITICAL MEDICAL & NON-DIAGNOSTIC CONSTRAINTS:
1. AirGuardian is NOT a diagnostic system. Never diagnose any disease, clinical disorder, illness, or medical condition.
2. Never claim that pollution definitely caused a symptom or condition.
   - Distinguish possible contributor from proven cause.
   - Use language such as:
     * "Current environmental conditions may contribute to irritation or discomfort."
     * "Some pollutants can be associated with respiratory or irritation-related symptoms."
     * "May irritate", "could be associated with", "possible contributing factor".
   - Do NOT say "PM2.5 caused your coughing" or declare definitive causation.
3. ${
  hasPhoto
    ? `PHOTO ANALYSIS:
   - For normal photo analysis, provide the same useful Health-style analysis structure as normal Health analysis:
     * whatMayBeIrritating: Explain what the image may indicate or show in an environmental/health context using cautious language ("may", "could", "possible"). Never diagnose a medical condition from a photograph and never claim pollution definitely caused what is visible.
     * whyThisMatters: Briefly explain why the selected symptom/concern matters in the context of the current air-quality conditions.
     * doList: Practical, reasonable precautions based on actual air-quality situation.
     * dontList: Practical things the user should avoid when appropriate.
     * whenToGetHelp: Clear, responsible guidance about when the user should seek professional medical help.
     * researchAnalysis: Detailed research-style analysis explaining what can reasonably be observed from the image, possible environmental/exposure relevance, scientific context, distinguishing observations from possibilities, and stating limitations of what can be determined from a photograph.`
    : `NO-PHOTO MODE:
   - Photo was not provided. Set visibleContent exactly to "Photo not provided". Provide whatMayBeIrritating, whyThisMatters, doList, dontList, whenToGetHelp based on reported concerns and live air telemetry.`
}
4. NO-SYMPTOM MODE:
   - If user selected "No symptoms / just checking air", do NOT force or invent a symptom. Provide an environmental exposure overview based on actual current AirGuardian readings.`;

      const promptText = `Ambient Air Quality Context:
Location: ${context?.locationName || 'Current Location'}
Current AQI: ${context?.aqi || 'N/A'} (${context?.category || 'N/A'}, US AQI)
Dominant Pollutant: ${context?.dominantPollutant || 'N/A'}
PM2.5: ${context?.pollutants?.pm2_5 ?? 'N/A'} µg/m³
PM10: ${context?.pollutants?.pm10 ?? 'N/A'} µg/m³
Ozone (O3): ${context?.pollutants?.o3 ?? 'N/A'} µg/m³
Nitrogen Dioxide (NO2): ${context?.pollutants?.no2 ?? 'N/A'} µg/m³
Reported Symptoms / Concerns: ${Array.isArray(context?.symptoms) && context.symptoms.length > 0 ? context.symptoms.join(', ') : context?.userConcern || 'None reported'}
${context?.customConcern ? `User Additional Description: "${context.customConcern}"` : ''}
Photo Provided: ${hasPhoto ? 'Yes' : 'No (Photo not provided)'}
Special Mode: ${context?.isFaceExposureMode ? 'Check general exposure on face' : 'Standard'}

Provide the non-diagnostic exposure assessment adhering strictly to the Big 3 structure and guidelines.`;

      const analysisSchema = {
        type: Type.OBJECT,
        properties: {
          photoProvided: { type: Type.BOOLEAN },
          visibleContent: { type: Type.STRING },
          whatMayBeIrritating: { type: Type.STRING },
          whyThisMatters: { type: Type.STRING },
          doList: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          dontList: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          whenToGetHelp: { type: Type.STRING },
          researchAnalysis: { type: Type.STRING },
          environmentalObservations: { type: Type.STRING },
          potentialFactors: { type: Type.STRING },
          precautions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: [
          'visibleContent',
          'whatMayBeIrritating',
          'whyThisMatters',
          'doList',
          'dontList',
          'whenToGetHelp',
          'environmentalObservations',
          'potentialFactors',
          'precautions',
        ],
      };

      let response;
      if (hasPhoto) {
        let mimeType = 'image/jpeg';
        let rawData = imageBase64;
        if (imageBase64.includes(';base64,')) {
          const parts = imageBase64.split(';base64,');
          const match = parts[0].match(/data:(.*?)$/);
          if (match) {
            mimeType = match[1];
          }
          rawData = parts[1];
        }

        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: rawData,
                },
              },
              { text: promptText },
            ],
          },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: analysisSchema,
          },
        });
      } else {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: promptText,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: analysisSchema,
          },
        });
      }

      const jsonText = response.text;
      if (!jsonText) {
        throw new Error('Empty response from model');
      }

      const parsed = JSON.parse(jsonText);
      parsed.photoProvided = hasPhoto;
      if (!hasPhoto) {
        parsed.visibleContent = 'Photo not provided';
      }

      res.json({
        result: parsed,
        source: 'gemini-3.8-flash',
      });
    } catch (err: any) {
      console.warn('Gemini analysis error, serving scientific fallback:', err?.message || err);
      const fallback = generateExposureAnalysisFallback(req.body?.context, Boolean(req.body?.imageBase64));
      res.json({
        result: fallback,
        source: 'AirGuard Environmental Intelligence',
      });
    }
  });

  // Server-side Real Healthcare Facilities Search Proxy
  const healthcareCache = new Map<string, { facilities: any[]; timestamp: number }>();
  app.get('/api/healthcare', async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lon = parseFloat(req.query.lon as string);
      const radiusKm = parseFloat(req.query.radius as string) || 10;

      if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ error: 'Valid lat and lon query parameters required' });
      }

      const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}_${radiusKm}`;
      const cached = healthcareCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < 3600000) {
        return res.json({ facilities: cached.facilities, source: 'cached' });
      }

      // Delta bounds in degrees
      const latDelta = radiusKm / 111;
      const lonDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180) || 1);
      const left = lon - lonDelta;
      const bottom = lat - latDelta;
      const right = lon + lonDelta;
      const top = lat + latDelta;

      const url = `https://nominatim.openstreetmap.org/search?q=hospital&format=json&viewbox=${left.toFixed(4)},${top.toFixed(4)},${right.toFixed(4)},${bottom.toFixed(4)}&bounded=1&limit=25&addressdetails=1&extratags=1`;

      const osmRes = await fetch(url, {
        headers: {
          'User-Agent': 'AirGuard-AI/1.0 (contact@airguard.app; Environmental Intelligence)',
          'Accept': 'application/json',
        },
      });

      if (!osmRes.ok) {
        return res.status(502).json({ error: 'External healthcare registry unavailable' });
      }

      const items: any[] = await osmRes.json();
      if (!Array.isArray(items)) {
        return res.json({ facilities: [] });
      }

      const facilities = items
        .map((item) => {
          const itemLat = parseFloat(item.lat);
          const itemLon = parseFloat(item.lon);
          if (isNaN(itemLat) || isNaN(itemLon)) return null;

          // Ignore transit stops or unrelated objects named 'hospital'
          if (item.class === 'highway' || item.type === 'bus_stop') return null;

          const name = item.name || item.display_name?.split(',')[0]?.trim();
          if (!name || name.length < 2 || name.toLowerCase() === 'hospital') return null;

          // Haversine distance
          const R = 6371;
          const dLat = ((itemLat - lat) * Math.PI) / 180;
          const dLon = ((itemLon - lon) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat * Math.PI) / 180) *
              Math.cos((itemLat * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distanceKm = Math.round(R * c * 10) / 10;

          const typeLower = (item.type || item.class || '').toLowerCase();
          const nameLower = name.toLowerCase();

          let facilityType = 'hospital';
          if (nameLower.includes('urgent') || typeLower.includes('urgent')) {
            facilityType = 'urgent_care';
          } else if (nameLower.includes('pulmon') || nameLower.includes('respirat') || nameLower.includes('chest')) {
            facilityType = 'respiratory_clinic';
          } else if (typeLower.includes('clinic') || nameLower.includes('clinic')) {
            facilityType = 'respiratory_clinic';
          } else if (nameLower.includes('health') || nameLower.includes('medical center')) {
            facilityType = 'medical_center';
          }

          const isEmergency =
            facilityType === 'hospital' ||
            item.extratags?.emergency === 'yes' ||
            nameLower.includes('emergency') ||
            nameLower.includes('trauma');

          const realPhone = item.extratags?.phone || item.extratags?.['contact:phone'] || undefined;
          const realWebsite = item.extratags?.website || item.extratags?.['contact:website'] || undefined;

          const addrObj = item.address || {};
          const road = addrObj.road || addrObj.suburb || addrObj.neighbourhood || '';
          const city = addrObj.city || addrObj.town || addrObj.county || addrObj.state || '';
          const address = [road, city].filter(Boolean).join(', ') || item.display_name;

          return {
            id: `osm_${item.place_id || item.osm_id}`,
            name,
            type: facilityType,
            distanceKm,
            address,
            latitude: itemLat,
            longitude: itemLon,
            emergencyAvailable: isEmergency,
            contactNumber: realPhone,
            website: realWebsite,
            specialty: isEmergency
              ? 'Emergency Services & Acute Inpatient Care'
              : 'Outpatient Care & Consultation',
          };
        })
        .filter(Boolean);

      facilities.sort((a: any, b: any) => a.distanceKm - b.distanceKm);

      healthcareCache.set(cacheKey, { facilities, timestamp: Date.now() });
      res.json({ facilities, source: 'OpenStreetMap Nominatim Verified' });
    } catch (err: any) {
      console.error('Healthcare search error:', err);
      res.status(500).json({ error: 'Failed to search healthcare facilities' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`AirGuard AI server running on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
