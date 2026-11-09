import { createFileRoute } from "@tanstack/react-router";
import { CodeHerProvider } from "@/components/codeher/store";
import { CodeHerApp } from "@/components/codeher/CodeHerApp";

const TITLE = "Code:HER. Offline voice SOS";
const DESCRIPTION =
  "Voice activated emergency SOS that works without internet. Say your SOS phrase and trusted contacts get your location.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CodeHerProvider>
      <CodeHerApp />
    </CodeHerProvider>
  ),
});
