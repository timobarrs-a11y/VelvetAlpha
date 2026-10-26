// The first session, in order (docs/onboarding/questionnaire-plan.md,
// "The whole arrival"): quick questions, your look, your home, a look around
// town, then Atlas.
export const ARRIVAL_ROUTES = {
  questions: '/user-questionnaire',
  look: '/arrival/look',
  home: '/arrival/home',
  town: '/arrival/town',
  atlas: '/atlas-onboarding',
} as const;
