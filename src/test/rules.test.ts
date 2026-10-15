import { describe, expect, it } from "vitest";
import { allowedNextStatuses, canCustomerCancel, computeShipping } from "@/lib/format";

describe("order rules", () => {
  it("customer cannot cancel once shipped", () => {
    expect(canCustomerCancel("packed")).toBe(true);
    expect(canCustomerCancel("shipped")).toBe(false);
    expect(canCustomerCancel("delivered")).toBe(false);
  });
  it("shipped orders can only become delivered", () => {
    expect(allowedNextStatuses("shipped")).toEqual(["delivered"]);
  });
  it("placed orders can be accepted or cancelled", () => {
    expect(allowedNextStatuses("placed")).toEqual(["accepted", "cancelled"]);
  });
  it("shipping is the sum of enabled product charges, ignoring off or zero", () => {
    expect(
      computeShipping([
        { shipping_enabled: true, shipping_charge: 49 },
        { shipping_enabled: false, shipping_charge: 100 },
        { shipping_enabled: true, shipping_charge: 0 },
        { shipping_enabled: true, shipping_charge: 40 },
      ]),
    ).toBe(89);
  });
});
