import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useSession } from "@/lib/auth";
import { Logo } from "@/components/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shopping Hospitalar — Portal Corporativo" },
      { name: "description", content: "Acesse o portal interno do Shopping Hospitalar." },
      { property: "og:title", content: "Shopping Hospitalar — Portal Corporativo" },
      { property: "og:description", content: "Acesse o portal interno do Shopping Hospitalar." },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useSession();
  if (loading)
    return (
      <div className="grid min-h-screen place-items-center bg-brand">
        <Logo light />
      </div>
    );
  return <Navigate to={session ? "/dashboard" : "/auth"} replace />;
}
