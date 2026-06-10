import { describe, it, expect } from "vitest";
import { docIdFromUrl } from "../ids";

describe("docIdFromUrl", () => {
  it("extracts the file id from a standard Google Docs edit URL", () => {
    expect(docIdFromUrl("https://docs.google.com/document/d/ABC123/edit")).toBe("ABC123");
  });

  it("extracts an alphanumeric id with underscores/dashes", () => {
    expect(docIdFromUrl("https://docs.google.com/document/d/1aBc-XYZ_789/edit?usp=sharing")).toBe("1aBc-XYZ_789");
  });

  it("returns null for a URL with no /d/ segment", () => {
    expect(docIdFromUrl("https://drive.google.com/file/nonsense")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(docIdFromUrl("")).toBeNull();
  });
});
