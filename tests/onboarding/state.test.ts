import { describe, it, expect } from "vitest";
import {
  getNextOnboardingState,
  extractOnboardingMarker,
  ONBOARDING_STATES,
} from "../../src/onboarding/state.js";

describe("onboarding state machine", () => {
  describe("ONBOARDING_STATES", () => {
    it("does not include 'recipes'", () => {
      expect(ONBOARDING_STATES).not.toContain("recipes");
    });

    it("includes preferences, tour, tour_only, and complete", () => {
      expect(ONBOARDING_STATES).toContain("preferences");
      expect(ONBOARDING_STATES).toContain("tour");
      expect(ONBOARDING_STATES).toContain("tour_only");
      expect(ONBOARDING_STATES).toContain("complete");
    });
  });

  describe("getNextOnboardingState", () => {
    it('transitions preferences -> tour when completedPhase is "preferences"', () => {
      expect(getNextOnboardingState("preferences", "preferences")).toBe("tour");
    });

    it('transitions tour -> complete when completedPhase is "tour"', () => {
      expect(getNextOnboardingState("tour", "tour")).toBe("complete");
    });

    it('transitions tour_only -> complete when completedPhase is "tour"', () => {
      expect(getNextOnboardingState("tour_only", "tour")).toBe("complete");
    });

    it('transitions any state -> complete when completedPhase is "skip"', () => {
      expect(getNextOnboardingState("preferences", "skip")).toBe("complete");
      expect(getNextOnboardingState("tour", "skip")).toBe("complete");
      expect(getNextOnboardingState("tour_only", "skip")).toBe("complete");
    });

    it("returns current state for unknown completedPhase", () => {
      expect(getNextOnboardingState("tour", "unknown")).toBe("tour");
      expect(getNextOnboardingState("preferences", "unknown")).toBe(
        "preferences",
      );
    });

    it('returns current state for stale "recipes" completedPhase (dead code path)', () => {
      // If an old marker with "recipes" comes through, it hits the default
      // case and returns current state unchanged -- harmless no-op.
      expect(getNextOnboardingState("tour", "recipes")).toBe("tour");
    });
  });

  describe("extractOnboardingMarker", () => {
    it("extracts tour marker", () => {
      const result = extractOnboardingMarker(
        "hello __ONBOARDING_PHASE_COMPLETE:tour__",
      );
      expect(result.completedPhase).toBe("tour");
      expect(result.text).toBe("hello");
    });

    it("extracts preferences marker", () => {
      const result = extractOnboardingMarker(
        "welcome __ONBOARDING_PHASE_COMPLETE:preferences__",
      );
      expect(result.completedPhase).toBe("preferences");
      expect(result.text).toBe("welcome");
    });

    it("returns null when no marker present", () => {
      const result = extractOnboardingMarker("just a normal message");
      expect(result.completedPhase).toBeNull();
      expect(result.text).toBe("just a normal message");
    });

    it("extracts recipes marker (stale but still parseable)", () => {
      const result = extractOnboardingMarker(
        "hello __ONBOARDING_PHASE_COMPLETE:recipes__",
      );
      expect(result.completedPhase).toBe("recipes");
      expect(result.text).toBe("hello");
    });
  });
});
