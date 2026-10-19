import type { LiveDataEntry } from "astro";
import { describe, expect, expectTypeOf, it } from "vitest";
import { getLiveRelated } from "../../src/index.js";
import { setLiveCollection } from "../astro-content.js";

setLiveCollection("products", [
  { id: "telescope", data: { title: "Telescope stars", price: 300 } },
  { id: "star-map", data: { title: "Star map stars", price: 20 } },
]);
setLiveCollection("reviews", [
  { id: "r1", data: { text: "Clear stars", stars: 5 } },
  { id: "r2", data: { text: "Stars, clear sky", stars: 4 } },
]);

describe("getLiveRelated types", () => {
  it("types the results as entries of the live loader data", async () => {
    const related = await getLiveRelated("products", "telescope", {
      filter: (entry) => entry.data.price < 100,
    });

    expectTypeOf(related).toEqualTypeOf<
      LiveDataEntry<{ title: string; price: number }>[]
    >();
    expect(related.map((entry) => entry.data.title)).toEqual([
      "Star map stars",
    ]);
  });

  it("types the results as entries of the schema output when the collection has a schema", async () => {
    const related = await getLiveRelated("reviews", "r1");

    expectTypeOf(related).toEqualTypeOf<
      LiveDataEntry<{ text: string; stars: number }>[]
    >();
    expect(related.map((entry) => entry.data.stars)).toEqual([4]);
  });

  it("accepts only the names of live collections", () => {
    // @ts-expect-error "posts" is not in live.config.ts.
    void getLiveRelated("posts", "a").catch(() => {});
  });
});
