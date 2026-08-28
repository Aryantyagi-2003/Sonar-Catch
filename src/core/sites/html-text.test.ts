import { describe, expect, it } from "vitest";

import { jsonLdDescriptionToText } from "@/core/sites/html-text";

describe("jsonLdDescriptionToText", () => {
  it("passes plain text through, collapsing whitespace (Workday shape)", () => {
    expect(jsonLdDescriptionToText("You’ll   love it here!\n\nJoin  us.")).toBe("You’ll love it here! Join us.");
  });

  it("untangles double-escaped HTML (Phenom shape)", () => {
    const raw = "&lt;div&gt;&lt;div&gt;&lt;p&gt;&lt;b&gt;WHAT IS THE OPPORTUNITY?&lt;/b&gt;&lt;/p&gt;&lt;p&gt;Design things.&lt;/p&gt;&lt;/div&gt;&lt;/div&gt;";
    expect(jsonLdDescriptionToText(raw)).toBe("WHAT IS THE OPPORTUNITY? Design things.");
  });

  it("strips ordinary HTML tags", () => {
    expect(jsonLdDescriptionToText("<p>Hello <b>world</b></p><ul><li>one</li><li>two</li></ul>")).toBe(
      "Hello world one two",
    );
  });

  it("decodes numeric and named entities", () => {
    expect(jsonLdDescriptionToText("Ben &amp; Jerry&#39;s &#x2014; tasty &nbsp;treats")).toBe(
      "Ben & Jerry's — tasty treats",
    );
  });

  it("drops script/style content entirely", () => {
    expect(jsonLdDescriptionToText("<style>.x{color:red}</style>Real text<script>evil()</script>")).toBe("Real text");
  });

  it("keeps words on either side of a tag separated", () => {
    expect(jsonLdDescriptionToText("first<br/>second<div>third</div>")).toBe("first second third");
  });
});
