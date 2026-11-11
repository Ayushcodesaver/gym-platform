import { describe, it, expect } from "vitest";
import {
  createMemberSchema, createPlanSchema, qrCheckinSchema, paymentWebhookSchema,
  createRefundSchema, inviteStaffSchema, updateGymSchema,
} from "../src/index";

describe("createMemberSchema", () => {
  it("accepts a valid Indian mobile number", () => {
    const parsed = createMemberSchema.parse({ first_name: "Rahul", phone: "9810011001" });
    expect(parsed.phone).toBe("9810011001");
    expect(parsed.communication_consent).toBe(true);
  });

  it("rejects invalid phone numbers", () => {
    for (const bad of ["1234567890", "98100110", "99810011001", "abcdefghij"]) {
      expect(() => createMemberSchema.parse({ first_name: "X", phone: bad })).toThrow();
    }
  });

  it("requires first_name", () => {
    expect(() => createMemberSchema.parse({ phone: "9810011001" })).toThrow();
  });
});

describe("createPlanSchema", () => {
  it("rejects non-positive duration and negative price", () => {
    expect(() => createPlanSchema.parse({ name: "P", duration_days: 0, price: 100 })).toThrow();
    expect(() => createPlanSchema.parse({ name: "P", duration_days: 30, price: -1 })).toThrow();
  });

  it("defaults discount to 0", () => {
    const parsed = createPlanSchema.parse({ name: "Basic", duration_days: 30, price: 999 });
    expect(parsed.discount).toBe(0);
  });
});

describe("qrCheckinSchema", () => {
  it("bounds token length", () => {
    expect(() => qrCheckinSchema.parse({ token: "short" })).toThrow();
    expect(() => qrCheckinSchema.parse({ token: "a".repeat(600) })).toThrow();
    expect(qrCheckinSchema.parse({ token: "a".repeat(64) }).token).toHaveLength(64);
  });
});

describe("paymentWebhookSchema", () => {
  it("accepts a provider-shaped payload", () => {
    const payload = {
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 149900, status: "captured" } } },
    };
    expect(paymentWebhookSchema.parse(payload).event).toBe("payment.captured");
  });

  it("rejects missing entity fields", () => {
    expect(() =>
      paymentWebhookSchema.parse({ event: "e", payload: { payment: { entity: { id: "pay_1" } } } }),
    ).toThrow();
  });
});

describe("createRefundSchema", () => {
  it("requires a positive refund amount when provided", () => {
    expect(() => createRefundSchema.parse({ payment_id: "3f2504e0-4f89-11d3-9a0c-0305e82c3301", amount: 0 })).toThrow();
    expect(() => createRefundSchema.parse({ payment_id: "not-a-uuid" })).toThrow();
  });
});

describe("inviteStaffSchema", () => {
  it("only allows manager/front_desk roles", () => {
    expect(() => inviteStaffSchema.parse({ first_name: "A", role: "owner" })).toThrow();
    expect(() => inviteStaffSchema.parse({ first_name: "A", role: "member" })).toThrow();
    expect(inviteStaffSchema.parse({ first_name: "A", role: "front_desk" }).role).toBe("front_desk");
  });
});

describe("updateGymSchema", () => {
  it("bounds the no-show threshold", () => {
    expect(() => updateGymSchema.parse({ no_show_threshold_days: 0 })).toThrow();
    expect(() => updateGymSchema.parse({ no_show_threshold_days: 400 })).toThrow();
    expect(updateGymSchema.parse({ no_show_threshold_days: 10 }).no_show_threshold_days).toBe(10);
  });
});
