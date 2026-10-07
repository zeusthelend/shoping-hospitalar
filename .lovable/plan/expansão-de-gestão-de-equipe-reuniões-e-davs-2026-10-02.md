# Expansão de gestão de equipe, reuniões e DAVs

## Objetivo
Entregar uma área operacional completa para gestores e vendedores, mantendo todos os dados protegidos pelas permissões corporativas já existentes.

## O que será criado

### 1. Recomendação de equipe com IA
- Nova ferramenta para gestores descreverem uma necessidade de equipe.
- A recomendação considera somente funcionários ativos e os dados autorizados: cargo, departamento e permissões.
- Resultado com funcionários sugeridos, justificativa objetiva e pontos de compatibilidade.
- A análise será executada com Lovable AI no servidor; a chave e as instruções nunca irão para o navegador.
- A permissão de gestor será validada no servidor antes da consulta e da chamada de IA.

### 2. Exportação de funcionários
- Botão na tela de Funcionários para baixar CSV.
- Colunas: nome, e-mail, telefone, unidade, ramal, status, cargo e departamento.
- Arquivo em UTF-8 compatível com Excel, respeitando os funcionários visíveis ao usuário.

### 3. Cadastro de reuniões
- Formulário para gestores criarem reuniões com título, descrição, data, horário, local e link.
- Agenda ordenada por data, com validação dos campos e atualização imediata da lista.
- Funcionários continuam visualizando as reuniões; somente gestores podem cadastrá-las ou alterá-las.

### 4. Área de DAVs e documentos
- Nova aba “DAVs” dentro de Documentos.
- Cadastro com número no formato `DAV:00000`, cliente/empresa, vendedor responsável, descrição, vencimento individual e status.
- Upload de PDF e fotos vinculado a cada DAV, com limite e validação de tipo/tamanho.
- Busca por número, cliente/empresa e vendedor.
- Vendedores visualizam e alteram os próprios DAVs; gestores visualizam e administram todos.
- A listagem destacará DAVs próximos do vencimento e vencidos.

### 5. Alertas no celular e sons
- Notificação no celular para DAV vencido, após autorização do usuário.
- Cada vencimento será notificado uma vez por usuário, evitando alertas duplicados.
- Alertas de presença tocarão apenas quando outro funcionário mudar de offline para online, nunca no carregamento inicial.
- Controles individuais para ativar/desativar som de presença e notificações de DAV.
- O aplicativo continuará exibindo alertas e contadores mesmo quando a permissão do celular não for concedida.

## Segurança e acesso
- Novas tabelas para DAVs, anexos, preferências, inscrições de notificação e histórico de alertas.
- Políticas no banco garantirão: vendedor somente nos próprios DAVs; gestores em todos; anexos seguindo o mesmo acesso do DAV.
- Arquivos permanecerão privados e serão acessados por links temporários.
- Entradas serão validadas no navegador e no servidor.

## Detalhes técnicos
- Lovable AI Gateway com `openai/gpt-6-astra` via Responses API e resposta consumida no servidor.
- Realtime para mudanças de presença e atualização de DAVs enquanto o app estiver aberto.
- Web Push para notificações com o app fechado; isso exige aplicativo publicado/instalado e permissão do navegador.
- Verificação periódica de DAVs vencidos para disparar notificações. A cadência será configurada para equilibrar atraso do alerta e custo de execução.
- Manifesto e ícones atuais serão preservados; será adicionado apenas o worker específico de notificações, sem cache offline.

## Validação final
- Testar perfis de gestor e vendedor, restrições de acesso, recomendação por IA, CSV, reunião, DAV com anexo e busca.
- Conferir em computador e tela de celular.
- Validar estados sem permissão de notificação, sem resultados e erros da IA.
