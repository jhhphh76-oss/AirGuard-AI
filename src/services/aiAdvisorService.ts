/**
 * AirGuard AI - AI Advisor Client Service
 * Grounded 100% in real Open-Meteo measurements.
 * Conversational multi-turn support.
 * Resilient fallback to scientific rules engine if backend is offline.
 */

import { AQIReading, AIAdvisorResponse } from '../types/airguard';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export const PRESET_ADVISOR_QUESTIONS = [
  'What is PM2.5?',
  'Why is the AQI high today?',
  'What can I do when the AQI is poor?',
  'Tell me something interesting',
  'Is outdoor exercise reasonable?',
];

export const aiAdvisorService = {
  async askAdvisor(
    question: string,
    reading: AQIReading,
    history: ChatTurn[] = []
  ): Promise<AIAdvisorResponse> {
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
      },
    };

    // 1. Try server-side Gemini AI Advisor
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

    // 2. Scientific rules engine fallback
    // Ensures application never fails or crashes even without network
    const scientificAnswer = generateScientificGuidance(question, reading);
    return {
      answer: scientificAnswer,
      source: 'AirGuard AI',
    };
  },
};

function generateScientificGuidance(question: string, reading: AQIReading): string {
  const { aqi, category, pollutants, dominantPollutant, location } = reading;
  const q = (question || '').toLowerCase().trim();

  // Identity questions
  if (
    q.includes('who are you') ||
    q.includes('what are you') ||
    q.includes('what is your name') ||
    q.includes("what's your name") ||
    q.includes('are you an ai')
  ) {
    return "I’m AirGuard AI, your air-quality and environmental health assistant. I can help you understand pollution, AQI readings, pollutants, forecasts, and general questions.";
  }

  // Pollutant definitions
  if (q.includes('pm2.5') || q.includes('pm25')) {
    return `PM2.5 refers to fine particulate matter with diameters 2.5 micrometers and smaller. Because of their tiny size, they can bypass upper airway filters, penetrate deep into alveolar lung tissue, and enter the bloodstream. In **${location.name}**, current PM2.5 is **${pollutants.pm2_5 ?? 'unavailable'} µg/m³**.`;
  }

  if (q.includes('pm10')) {
    return `PM10 consists of inhalable particles with diameters 10 micrometers and smaller, including airborne road dust, pollen, mold spores, and mechanical abrasion debris. In **${location.name}**, current PM10 is **${pollutants.pm10 ?? 'unavailable'} µg/m³**.`;
  }

  if (q.includes('ozone') || q.includes('o3')) {
    return `Ground-level ozone (O3) is a secondary pollutant created by photochemical reactions between nitrogen oxides (NOx) and volatile organic compounds (VOCs) under sunlight. Unlike stratospheric ozone that shields us from UV, ground-level ozone is a powerful lung irritant. In **${location.name}**, current O3 is **${pollutants.o3 ?? 'unavailable'} µg/m³**.`;
  }

  // Child explanation
  if (q.includes('like i\'m 10') || q.includes('like im 10') || q.includes('for a kid') || q.includes('simple')) {
    return `Imagine the air around us is like a big glass of clear water. Air pollution is like tiny invisible specks of dust and smoke floating inside that water. When the air has too many specks, it can make our throats tickle or make it harder to run fast. In **${location.name}**, the air is currently **${category}** (AQI ${aqi}), so it's a good idea to check before big outdoor games!`;
  }

  // Why is AQI high / current status
  if (q.includes('why is') && (q.includes('high') || q.includes('poor') || q.includes('aqi'))) {
    return `In **${location.name}**, the current US AQI is **${aqi}** (**${category}**), with **${dominantPollutant}** as the primary driver. Elevated levels may be influenced by localized vehicular emissions, heating or industrial outputs, and atmospheric temperature inversions that suppress vertical pollutant dispersion.`;
  }

  // Precautions / What can I do
  if (q.includes('what can i do') || q.includes('precaution') || q.includes('protect') || q.includes('advice')) {
    return `When ambient air quality is ${category} (AQI ${aqi}) in **${location.name}**, recommended practical precautions include:\n\n• **Indoor air protection:** Keep windows closed along congested roads during peak rush hours, and run mechanical HEPA air purifiers.\n• **Activity scheduling:** Shift intense cardiovascular training to early morning or filtered indoor facilities.\n• **Personal protection:** Active seniors, children, and individuals with asthma should carry prescribed rescue inhalers and consider certified N95/FFP2 masks for prolonged outdoor exposure.`;
  }

  // Interesting facts
  if (q.includes('interesting') || q.includes('fun fact') || q.includes('fact')) {
    return `Here is a fascinating atmospheric fact: Microscopic fine particles (PM2.5) are so lightweight that they can remain suspended in the atmosphere for weeks, traveling thousands of miles across oceans on continental jet streams! For example, Saharan dust plumes regularly travel across the Atlantic to the Americas.`;
  }

  // General conversational questions
  if (q.includes('why is the sky blue') || q.includes('sky blue')) {
    return `The sky is blue due to a physical phenomenon called **Rayleigh scattering**. Earth's atmospheric gases scatter shorter wavelengths of sunlight (blue and violet) in all directions much more strongly than longer wavelengths (red and yellow). Because human eyes are more sensitive to blue light, we perceive the daytime sky as blue!`;
  }

  if (q.includes('joke')) {
    return `Why did the atmospheric sensor break up with the air filter? Because it felt too much pressure! 😄`;
  }

  // Exercise queries
  if (q.includes('exercise') || q.includes('outdoor') || q.includes('run') || q.includes('sport')) {
    if (aqi <= 50) {
      return `### Outdoor Exercise: Recommended ✅\n\nConditions in **${location.name}** are optimal (US AQI ${aqi}, ${category}).\n\n• **Aerobic activity:** Suitable for all outdoor sports, running, cycling, and leisure.\n• **Exposure risk:** Negligible fine-particle penetration.\n• **Ventilation:** Windows and fresh air circulation are encouraged.`;
    }
    if (aqi <= 100) {
      return `### Outdoor Exercise: Acceptable with Mild Discretion ⚠️\n\nConditions in **${location.name}** are Moderate (US AQI ${aqi}).\n\n• **General Population:** Routine outdoor workouts and jogging are reasonable.\n• **Sensitive Individuals:** If you experience unusual respiratory sensitivity, take more rest breaks.\n• **Peak Timing:** Early afternoons often offer better air mixing than rush hour.`;
    }
    return `### Outdoor Exercise: Reduced Exertion Advised 🛑\n\nAir quality is **${category}** (US AQI ${aqi}).\n\n• **Guidance:** Strenuous outdoor physical exertion should be limited or shifted indoors.\n• **Mechanism:** Heavy breathing during exercise significantly accelerates particulate deposition deep into pulmonary alveoli.\n• **Recommendation:** Exercise in an indoor environment equipped with mechanical HEPA filtration. Keep windows sealed.`;
  }

  return `### Air Quality Analysis for ${location.name}\n\n• **Current AQI:** ${aqi} (${category})\n• **Dominant Factor:** ${dominantPollutant}\n• **PM2.5:** ${pollutants.pm2_5 ?? 'Unavailable'} µg/m³ · **PM10:** ${pollutants.pm10 ?? 'Unavailable'} µg/m³\n\nI’m AirGuard AI, your open-ended environmental assistant. You can ask me anything about the air here, specific pollutants, health guidance, or general questions!`;
}
