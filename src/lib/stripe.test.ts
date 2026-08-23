import { describe, expect, it } from "vitest";
import { resolvePaymentsClientConfiguration } from "@/lib/stripe";

describe("resolvePaymentsClientConfiguration", () => {
  it("does not silently classify a missing client key as live", () => {
    expect(resolvePaymentsClientConfiguration(undefined)).toEqual({
      status: "unconfigured",
      environment: null,
    });
  });

  it("rejects an unrecognised browser key", () => {
    expect(resolvePaymentsClientConfiguration("not-a-stripe-key")).toEqual({
      status: "invalid",
      environment: null,
    });
  });

  it("identifies the environment from valid Stripe publishable-key prefixes", () => {
    expect(resolvePaymentsClientConfiguration("pk_test_example")).toEqual({
      status: "configured",
      environment: "sandbox",
    });
    expect(resolvePaymentsClientConfiguration("pk_live_example")).toEqual({
      status: "configured",
      environment: "live",
    });
  });
});
