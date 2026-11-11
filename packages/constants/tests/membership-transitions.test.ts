import { describe, it, expect } from "vitest";
import { canTransition, MEMBERSHIP_TRANSITIONS, deriveRenewalStage } from "../src/membership-transitions";

describe("membership state machine", () => {
  it("allows every legal transition", () => {
    expect(canTransition("pending", "active")).toBe(true);
    expect(canTransition("pending", "cancelled")).toBe(true);
    expect(canTransition("active", "frozen")).toBe(true);
    expect(canTransition("active", "cancelled")).toBe(true);
    expect(canTransition("frozen", "active")).toBe(true);
    expect(canTransition("expired", "active")).toBe(true); // renewal path
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("cancelled", "active")).toBe(false);
    expect(canTransition("cancelled", "pending")).toBe(false);
    expect(canTransition("pending", "frozen")).toBe(false);
    expect(canTransition("frozen", "expired")).toBe(false);
    expect(canTransition("active", "pending")).toBe(false);
  });

  it("every state has an entry in the transition map", () => {
    for (const state of ["pending", "active", "frozen", "expired", "cancelled"] as const) {
      expect(MEMBERSHIP_TRANSITIONS[state]).toBeDefined();
    }
  });
});

describe("renewal pipeline stage derivation", () => {
  const base = {
    expiry_date: "2026-11-20",
    today: "2026-10-31",
    has_follow_up: false,
    follow_up_outcome: null,
    has_pending_renewal_order: false,
    has_paid_renewal_order: false,
  };

  it("upcoming when nothing has happened", () => {
    expect(deriveRenewalStage(base)).toBe("upcoming");
  });

  it("contacted / interested from follow-up state", () => {
    expect(deriveRenewalStage({ ...base, has_follow_up: true, follow_up_outcome: "no_response" })).toBe("contacted");
    expect(deriveRenewalStage({ ...base, has_follow_up: true, follow_up_outcome: "will_return" })).toBe("interested");
  });

  it("payment_pending before renewed", () => {
    expect(deriveRenewalStage({ ...base, has_pending_renewal_order: true, has_paid_renewal_order: true })).toBe("renewed");
    expect(deriveRenewalStage({ ...base, has_pending_renewal_order: true })).toBe("payment_pending");
  });

  it("expired only when past expiry with no order", () => {
    expect(deriveRenewalStage({ ...base, expiry_date: "2026-10-01" })).toBe("expired");
    expect(deriveRenewalStage({ ...base, expiry_date: "2026-10-01", has_paid_renewal_order: true })).toBe("renewed");
  });
});
