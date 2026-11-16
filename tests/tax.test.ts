// Runtime validation coverage for restaurant tax rounding and splitting.
import { describe, expect, it } from "vitest";
import { calculateRestaurantTax } from "../src/lib/tax";

describe("restaurant tax calculation", () => {
  it("splits 5% tax into whole-paise CGST and SGST amounts", () => {
    expect(calculateRestaurantTax(1000)).toEqual({
      cgstPaise: 25,
      sgstPaise: 25,
      totalPaise: 50,
    });
  });

  it("assigns an odd tax paise to SGST so the split remains exact", () => {
    expect(calculateRestaurantTax(101)).toEqual({
      cgstPaise: 2,
      sgstPaise: 3,
      totalPaise: 5,
    });
  });
});
