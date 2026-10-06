/**
 * AirGuard AI - Health Context Service
 * Connects Health View selections (reported symptoms & photo analysis observations)
 * with the AI Advisor for unified, context-aware reasoning.
 */

export interface ActiveHealthContext {
  selectedSymptom: string | null;
  selectedSymptoms: string[];
  customConcern: string | null;
  photoObservation: string | null;
  updatedAt: number;
}

let activeContext: ActiveHealthContext = {
  selectedSymptom: null,
  selectedSymptoms: [],
  customConcern: null,
  photoObservation: null,
  updatedAt: Date.now(),
};

export const healthContextService = {
  setSymptoms(symptoms: string[], customConcern?: string | null) {
    const filtered = symptoms.filter(
      (s) => s !== 'No symptoms / just checking air' && s !== 'No symptoms — check air'
    );
    activeContext = {
      ...activeContext,
      selectedSymptom: filtered.length > 0 ? filtered.join(', ') : null,
      selectedSymptoms: filtered,
      customConcern: customConcern || null,
      updatedAt: Date.now(),
    };
  },

  setSymptom(symptom: string | null, customConcern?: string | null) {
    const isNoSymptom =
      !symptom ||
      symptom === 'No symptoms / just checking air' ||
      symptom === 'No symptoms — check air';
    activeContext = {
      ...activeContext,
      selectedSymptom: isNoSymptom ? null : symptom,
      selectedSymptoms: isNoSymptom || !symptom ? [] : [symptom],
      customConcern: customConcern || null,
      updatedAt: Date.now(),
    };
  },

  setPhotoObservation(observation: string | null) {
    activeContext = {
      ...activeContext,
      photoObservation: observation,
      updatedAt: Date.now(),
    };
  },

  getHealthContext(): ActiveHealthContext {
    return { ...activeContext };
  },

  clear() {
    activeContext = {
      selectedSymptom: null,
      selectedSymptoms: [],
      customConcern: null,
      photoObservation: null,
      updatedAt: Date.now(),
    };
  },
};
