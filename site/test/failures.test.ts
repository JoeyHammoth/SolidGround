import { describe, expect, it } from "vitest";
import { groupControlFailures } from "../src/lib/failures.js";

describe("control failure grouping", () => {
  it("groups repeated control ids and preserves first-seen order", () => {
    expect(
      groupControlFailures([
        "control-subpath: import was false, expected true",
        "control-bad: import was true, expected false",
        "control-subpath: build was false, expected true",
      ]),
    ).toEqual([
      {
        subject: "control-subpath",
        details: ["import was false, expected true", "build was false, expected true"],
      },
      { subject: "control-bad", details: ["import was true, expected false"] },
    ]);
  });

  it("keeps a message without a control prefix under a generic subject", () => {
    expect(groupControlFailures(["the batch was empty"])).toEqual([
      { subject: "control", details: ["the batch was empty"] },
    ]);
  });

  it("returns no groups for no failures", () => {
    expect(groupControlFailures([])).toEqual([]);
  });
});
