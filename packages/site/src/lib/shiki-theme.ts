export const graphiteTheme = {
  name: "relatinator-graphite",
  type: "dark" as const,
  colors: {
    "editor.background": "#161b22",
    "editor.foreground": "#dadee3",
  },
  settings: [
    { scope: ["comment", "punctuation", "keyword", "storage"], settings: { foreground: "#999fa7" } },
    { scope: ["string", "constant", "number"], settings: { foreground: "#dadee3" } },
    { scope: ["entity.name.function", "support.function", "variable.other.property", "meta.property-name"], settings: { foreground: "#5ea9f9" } },
    { scope: ["entity.name.type", "support.type", "entity.name.class"], settings: { foreground: "#dadee3" } },
  ],
};
