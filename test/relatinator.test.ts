import { describe, expect, it } from "vitest";
import { tfIdf, train, findRelated } from "../src";
import { TfIdfDocument } from "natural";

const documents = [
  { id: "node", content: "this document is about node." },
  { id: "ruby", content: "this document is about ruby." },
  { id: "ruby-node", content: "this document is about ruby and node." },
  {
    id: "node-examples",
    content: "this document is about node. it has node examples",
  },
];

describe("relatinator", () => {
  it("should be trainable", () => {
    train(documents);
    const docLength = (tfIdf.documents as unknown as TfIdfDocument[]).length;
    expect(docLength).toBe(4);
  });

  it("should find related documents", () => {
    const related = findRelated(documents[0].content, documents[0].id, 1);
    expect(related).toEqual(["node-examples"]);
  });

  it("should be able to match documents properly", () => {
    const related = findRelated(documents[0].content, documents[0].id, 3);
    expect(related).toEqual(["node-examples", "ruby-node", "ruby"]);
  });
});
