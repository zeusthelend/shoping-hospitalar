import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createLovableAiGatewayRunIdFetch } from "./ai-run-id.server";

export async function recommendEmployeesWithAi(need: string, employees: Array<{ id: string; name: string; position: string; department: string; permissions: string[] }>) {
  const apiKey = process.env['LOVABLE_API_KEY'];
  if (!apiKey) throw new Error("A inteligência artificial não está configurada.");
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    system: "Você recomenda equipes corporativas. Use somente os dados fornecidos. Não invente competências. Responda em português com até 5 recomendações, cada uma contendo nome, cargo, departamento e justificativa objetiva. Finalize com lacunas da equipe, se houver.",
    prompt: `Necessidade descrita pelo gestor:\n${need}\n\nFuncionários elegíveis:\n${JSON.stringify(employees)}`,
    providerOptions: { openai: { forceReasoning: true, reasoningEffort: "medium", reasoningSummary: "auto", store: false, include: ["reasoning.encrypted_content"] } },
  });
  const text = await result.text;
  if (!text.trim()) throw new Error("A inteligência artificial não retornou uma recomendação.");
  return text;
}
