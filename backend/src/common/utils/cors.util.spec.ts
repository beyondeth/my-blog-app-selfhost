import { expandLoopbackOrigins } from "./cors.util";

describe("expandLoopbackOrigins", () => {
  it("adds the localhost alias without allowing arbitrary origins", () => {
    expect(expandLoopbackOrigins(["http://localhost:13001"])).toEqual([
      "http://localhost:13001",
      "http://127.0.0.1:13001",
    ]);
  });

  it("preserves explicit remote origins", () => {
    expect(expandLoopbackOrigins(["https://blog.example.com"])).toEqual([
      "https://blog.example.com",
    ]);
  });

  it("deduplicates configured aliases", () => {
    expect(
      expandLoopbackOrigins([
        "http://localhost:13001",
        "http://127.0.0.1:13001",
      ]),
    ).toEqual(["http://localhost:13001", "http://127.0.0.1:13001"]);
  });
});
