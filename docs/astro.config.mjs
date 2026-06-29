import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://willisback.github.io",
  base: "/ai_corrector",
  integrations: [
    starlight({
      title: "AI Corrector",
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/WillIsback/ai_corrector" }],
      sidebar: [
        { label: "Getting Started", items: [
          { label: "Overview", link: "getting-started/" },
          { label: "Installation", link: "getting-started/installation" },
          { label: "Configuration", link: "getting-started/configuration" },
        ]},
        { label: "Core Components", items: [
          { label: "Correction Modes", link: "core/correction-modes" },
          { label: "Engine Selector", link: "core/engine-selector" },
          { label: "Diff View", link: "core/diff-view" },
        ]},
        { label: "Advanced Features", items: [
          { label: "Custom Words", link: "advanced/custom-words" },
          { label: "Telemetry", link: "advanced/telemetry" },
          { label: "Docker Deploy", link: "advanced/docker-deploy" },
        ]},
        { label: "References", items: [
          { label: "API Reference", link: "references/api" },
          { label: "Architecture", link: "references/architecture" },
          { label: "FAQ", link: "references/faq" },
        ]},
      ],
    }),
  ],
});
