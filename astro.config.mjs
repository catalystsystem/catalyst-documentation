import starlight from "@astrojs/starlight";
import d2 from "astro-d2";
import { defineConfig } from "astro/config";
import rehypeMathjax from "rehype-mathjax";
import remarkMath from "remark-math";
import starlightLinksValidator from "starlight-links-validator";

import svelte from "@astrojs/svelte";

// https://astro.build/config
export default defineConfig({
  redirects: {
    "/cross-cats/": "/",
    "/cross-cats/solver/": "/solver/intro",
    "/solver/auction/": "/solver/auctions/",
    "/knowledge/glossary/": "/glossary/",
    "/architecture/erc7683": "/architecture/open"
  },
  site: `${process.env["CF_PAGES_URL"] ?? "https://docs.catalyst.exchange"}`,
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeMathjax],
  },
  integrations: [
    starlight({
      plugins: [starlightLinksValidator()],
      title: "Catalyst Documentation",
      editLink: {
        baseUrl: `https://github.com/catalystsystem/catalyst-documentation/edit/${process.env["CF_PAGES_BRANCH"]}`,
      },
      logo: {
        light: "/src/assets/logo_dark.svg",
        dark: "/src/assets/logo_light.svg",
        replacesTitle: true,
      },
      social: [
        {icon: 'github', label: 'Github', href: "https://github.com/catalystsystem"}
      ],
      customCss: ["./src/assets/landing.css", "./src/assets/math-fix.css"],
      favicon: "/favicon.ico",
      sidebar: [
        {
          label: "Catalyst Intent System",
          link: "/",
        },
        {
          label: "System Architecture",
          autogenerate: {
            directory: "1-system-architecture",
          },
        },
        {
          label: "For Developers",
          autogenerate: {
            directory: "2-devs",
          },
        },
        {
          label: "For Solvers",
          autogenerate: {
            directory: "3-solver",
          },
        },
        {
          label: "Knowledge Database",
          collapsed: true,
          autogenerate: {
            directory: "7-knowledge",
          },
        },
        {
          label: "CatalystAMM",
          collapsed: true,
          badge: { text: "Deprecated", variant: "caution"},
          autogenerate: {
            directory: "9-amm",
          },
        },
      ],
    }),
    d2({
      skipGeneration: !!process.env["CF_PAGES"] || !process.env["D2"],
      layout: "elk",
    }),
    svelte(),
  ],
});
