/**
 * Strict AI response contract for campaign content generation.
 * Every AI response MUST include a top-level `type` field.
 */

export const BRIEF_TYPES = ["GATE_BLOCKED", "PRE_BRIEF", "FULL_BRIEF", "ERROR_FALLBACK"] as const;
export type BriefType = (typeof BRIEF_TYPES)[number];

export interface EffortGuide {
  minimum: string;
  impressive: string;
}

export interface FullBrief {
  type: "FULL_BRIEF";
  project: string;
  why_this_works: string;
  build_steps: string[];
  final_output: string;
  effort_guide: EffortGuide;
  key_insight: string;
  outreach_hook: string;
}

export interface PreBrief {
  type: "PRE_BRIEF";
  optionA: string;
  optionB: string;
  checklist: string[];
}

export interface GateBlocked {
  type: "GATE_BLOCKED";
  reason: string;
  guidance: string;
}

export interface ErrorFallback {
  type: "ERROR_FALLBACK";
  message: string;
  debugId: string;
}

export type BriefResponse = FullBrief | PreBrief | GateBlocked | ErrorFallback;

/**
 * Validate and normalize any AI response into a typed BriefResponse.
 * If the response is missing `type` or has unexpected shape, returns ERROR_FALLBACK.
 */
export function validateBriefResponse(raw: unknown): BriefResponse {
  if (!raw || typeof raw !== "object") {
    return makeErrorFallback("Response was empty or not an object");
  }

  const obj = raw as Record<string, unknown>;

  // If it already has a valid type, validate minimally per type
  if (typeof obj.type === "string" && BRIEF_TYPES.includes(obj.type as BriefType)) {
    switch (obj.type) {
      case "FULL_BRIEF":
        if (typeof obj.project === "string" && Array.isArray(obj.build_steps) && typeof obj.outreach_hook === "string") {
          return {
            type: "FULL_BRIEF",
            project: obj.project as string,
            why_this_works: (obj.why_this_works as string) || "",
            build_steps: (obj.build_steps as string[]).filter((s) => typeof s === "string"),
            final_output: (obj.final_output as string) || "",
            effort_guide: validateEffortGuide(obj.effort_guide),
            key_insight: (obj.key_insight as string) || "",
            outreach_hook: obj.outreach_hook as string,
          };
        }
        return makeErrorFallback("FULL_BRIEF missing required fields");

      case "PRE_BRIEF":
        return obj as unknown as PreBrief;

      case "GATE_BLOCKED":
        return obj as unknown as GateBlocked;

      case "ERROR_FALLBACK":
        return obj as unknown as ErrorFallback;
    }
  }

  // Legacy format: no `type` but has `project` or `title` → treat as FULL_BRIEF
  if (typeof obj.project === "string" || typeof obj.title === "string") {
    const project = (obj.project as string) || (obj.title as string) || "";
    const buildSteps = Array.isArray(obj.build_steps) ? (obj.build_steps as string[]).filter((s) => typeof s === "string") : [];
    const outreachHook = typeof obj.outreach_hook === "string" ? obj.outreach_hook : "";

    if (!project || buildSteps.length === 0 || !outreachHook) {
      return makeErrorFallback("Response missing critical fields (project, build_steps, or outreach_hook)");
    }

    return {
      type: "FULL_BRIEF",
      project,
      why_this_works: (obj.why_this_works as string) || "",
      build_steps: buildSteps,
      final_output: (obj.final_output as string) || "",
      effort_guide: validateEffortGuide(obj.effort_guide),
      key_insight: (obj.key_insight as string) || "",
      outreach_hook: outreachHook,
    };
  }

  return makeErrorFallback("Unknown response format");
}

function validateEffortGuide(raw: unknown): EffortGuide {
  if (raw && typeof raw === "object") {
    const eg = raw as Record<string, unknown>;
    return {
      minimum: typeof eg.minimum === "string" ? eg.minimum : "",
      impressive: typeof eg.impressive === "string" ? eg.impressive : "",
    };
  }
  return { minimum: "", impressive: "" };
}

function makeErrorFallback(debugDetail: string): ErrorFallback {
  return {
    type: "ERROR_FALLBACK",
    message: "We hit an issue generating your brief. Please try again.",
    debugId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}
