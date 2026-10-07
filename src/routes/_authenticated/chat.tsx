import { createFileRoute } from "@tanstack/react-router";
import { ChatWorkspace } from "@/components/chat-workspace";
export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Shopping Hospitalar" },
      { name: "description", content: "Conversas corporativas individuais e em grupo." },
      { property: "og:title", content: "Chat — Shopping Hospitalar" },
      { property: "og:description", content: "Conversas corporativas individuais e em grupo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <ChatWorkspace />,
});
