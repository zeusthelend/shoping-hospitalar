import { createFileRoute } from "@tanstack/react-router";
import { ChatWorkspace } from "@/components/chat-workspace";

export const Route = createFileRoute("/_authenticated/chat/$conversationId")({
  head: () => ({
    meta: [
      { title: "Conversa — Shopping Hospitalar" },
      { name: "description", content: "Conversa corporativa em tempo real." },
      { property: "og:title", content: "Conversa — Shopping Hospitalar" },
      { property: "og:description", content: "Conversa corporativa em tempo real." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
function Page() {
  const { conversationId } = Route.useParams();
  return <ChatWorkspace conversationId={conversationId} />;
}
