import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const requestSchema = z.object({
  need: z.string().trim().min(10, "Descreva a necessidade com mais detalhes.").max(1500),
});

export const recommendTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => requestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isManager, error: roleError } = await context.supabase.rpc("is_manager", {
      _user_id: context.userId,
    });
    if (roleError || !isManager) throw new Error("Apenas gestores podem solicitar recomendações.");

    const { data: employees, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, positions(name, permissions), departments(name)")
      .eq("active", true)
      .order("full_name");
    if (error) throw new Error("Não foi possível consultar a equipe.");

    const candidates = (employees ?? []).map((employee) => ({
      id: employee.id,
      name: employee.full_name,
      position: employee.positions?.name ?? "Cargo não definido",
      department: employee.departments?.name ?? "Departamento não definido",
      permissions: employee.positions?.permissions ?? [],
    }));

    const { recommendEmployeesWithAi } = await import("./team-recommendation.server");
    return { recommendation: await recommendEmployeesWithAi(data.need, candidates) };
  });