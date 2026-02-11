/**
 * Onboarding state machine.
 *
 * Defines the persisted onboarding states, transitions between them,
 * and the hidden-marker extraction logic that lets the pipeline
 * detect when Claude signals phase completion.
 */

/** Persisted onboarding states (stored in users.onboarding_state). */
export type OnboardingState =
  | "preferences"
  | "tour"
  | "recipes"
  | "tour_only"
  | "complete";

/** All valid onboarding states, for runtime validation. */
export const ONBOARDING_STATES: readonly OnboardingState[] = [
  "preferences",
  "tour",
  "recipes",
  "tour_only",
  "complete",
] as const;

/**
 * Advance the onboarding state machine.
 *
 * @param current       The user's current onboarding state.
 * @param completedPhase  The phase name extracted from Claude's marker
 *                        (e.g. "preferences", "tour", "recipes", "skip").
 * @returns The next state, or `current` if the phase is unknown.
 */
export function getNextOnboardingState(
  current: OnboardingState,
  completedPhase: string,
): OnboardingState {
  // Skip from ANY state jumps straight to complete.
  if (completedPhase === "skip") return "complete";

  switch (completedPhase) {
    case "preferences":
      return "tour";
    case "tour":
      // Works for both the "tour" state (full flow) and "tour_only" state
      // (abbreviated flow) because Claude uses the same marker.
      return current === "tour_only" ? "complete" : "recipes";
    case "recipes":
      return "complete";
    default:
      // Unknown phase -- no-op, return current state unchanged.
      return current;
  }
}

/** Regex matching the hidden onboarding completion marker. */
const MARKER_RE = /__ONBOARDING_PHASE_COMPLETE:(\w+)__/;

/**
 * Extract and strip the hidden onboarding marker from Claude's response.
 *
 * The marker looks like `__ONBOARDING_PHASE_COMPLETE:preferences__` and
 * may appear on its own line at the end of the response. This function
 * removes the marker (and any surrounding blank lines it leaves behind)
 * so the user never sees it.
 *
 * @returns `text` with marker removed and `completedPhase` if a marker
 *          was found, otherwise the original text and `null`.
 */
export function extractOnboardingMarker(text: string): {
  text: string;
  completedPhase: string | null;
} {
  const match = text.match(MARKER_RE);

  if (!match) {
    return { text, completedPhase: null };
  }

  const completedPhase = match[1];

  // Remove the marker itself, then collapse any resulting blank-line runs
  // at the edges of the text.
  const cleaned = text
    .replace(MARKER_RE, "")
    .replace(/\n{2,}$/g, "\n")
    .trim();

  return { text: cleaned, completedPhase };
}
