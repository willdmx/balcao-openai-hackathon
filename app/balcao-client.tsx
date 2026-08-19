"use client";

import { useState, type FormEvent } from "react";

import type { ExecutionResult } from "@/lib/execution/schemas";
import type { PlanApiResponse } from "@/lib/planning/schemas";

const demoRequest =
  "A Ana pediu 20 kits festa para amanhã às 14h. Cada kit custa R$35. Reserve o estoque e prepare o pedido.";

type RequestState = "idle" | "loading" | "success" | "error";
type ExecutionState = "idle" | "loading" | "success" | "error";

type ApiErrorPayload = {
  error?: {
    message?: string;
  };
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDelivery(value: string) {
  const delivery = new Date(value);

  if (Number.isNaN(delivery.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(delivery);
}

export default function BalcaoClient() {
  const [requestText, setRequestText] = useState(demoRequest);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [planResult, setPlanResult] = useState<PlanApiResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [executionState, setExecutionState] =
    useState<ExecutionState>("idle");
  const [executionResult, setExecutionResult] =
    useState<ExecutionResult | null>(null);
  const [executionErrorMessage, setExecutionErrorMessage] = useState<
    string | null
  >(null);

  async function handlePlanRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestState("loading");
    setErrorMessage(null);
    setPlanResult(null);
    setExecutionState("idle");
    setExecutionResult(null);
    setExecutionErrorMessage(null);

    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: requestText }),
      });
      const payload = (await response.json()) as PlanApiResponse & ApiErrorPayload;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
            "Não foi possível gerar o plano. Tente novamente.",
        );
      }

      setPlanResult(payload);
      setRequestState("success");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o plano. Tente novamente.",
      );
      setRequestState("error");
    }
  }

  async function handleExecution() {
    if (!planResult?.plan || !planResult.plan.inventoryAvailable) return;

    setExecutionState("loading");
    setExecutionErrorMessage(null);

    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planResult.plan }),
      });
      const payload = (await response.json()) as ExecutionResult &
        ApiErrorPayload;

      if (!response.ok) {
        throw new Error(
          payload.error?.message ??
            "Não foi possível concluir a execução. Tente novamente.",
        );
      }

      setExecutionResult(payload);
      setExecutionState("success");
    } catch (error) {
      setExecutionErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a execução. Tente novamente.",
      );
      setExecutionState("error");
    }
  }

  const plan = planResult?.plan;
  const inventoryCall = planResult?.toolCalls[0];
  const actions = plan
    ? [
        {
          tool: "check_inventory",
          label: `Consultou ${inventoryCall?.result.product ?? plan.product}`,
          tag: "Leitura concluída",
          read: true,
          completed: false,
        },
        ...plan.proposedActions.map((action) => ({
          tool: action.tool,
          label: action.description,
          tag:
            executionState === "success"
              ? "Concluída"
              : action.status === "blocked"
                ? "Bloqueada"
                : "Após aprovação",
          read: false,
          completed: executionState === "success",
        })),
      ]
    : [];

  const panelState =
    requestState === "loading"
      ? "Analisando"
      : requestState === "success"
        ? "Plano pronto"
        : requestState === "error"
          ? "Revisar"
          : "Entrada";

  const previewState =
    requestState === "loading"
      ? "Processando"
      : requestState === "success"
        ? "Plano real"
        : requestState === "error"
          ? "Erro"
          : "Aguardando";

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Balcão, início">
          <span className="brand-mark" aria-hidden="true">
            B
          </span>
          <span>BALCÃO</span>
        </a>
        <span className="environment-badge">
          <span className="status-dot" aria-hidden="true" />
          Planejamento real
        </span>
      </header>

      <section className="intro" id="inicio">
        <div>
          <p className="eyebrow">Operação assistida por IA</p>
          <h1>
            Um pedido em texto. Um plano claro.
            <span> Você no controle.</span>
          </h1>
        </div>
        <p className="intro-copy">
          O BALCÃO organiza estoque, pedido e cobrança antes de qualquer ação.
          Você revisa o plano e decide quando executar.
        </p>
      </section>

      <section className="workspace" aria-label="Área de operação do Balcão">
        <article className="request-panel panel">
          <form onSubmit={handlePlanRequest} aria-busy={requestState === "loading"}>
            <div className="panel-heading">
              <div>
                <p className="step-label">01 · Solicitação</p>
                <h2>O que precisa ser feito?</h2>
              </div>
              <span className="panel-state">{panelState}</span>
            </div>

            <label className="request-label" htmlFor="request">
              Pedido em linguagem natural
            </label>
            <textarea
              id="request"
              name="request"
              value={requestText}
              onChange={(event) => setRequestText(event.target.value)}
              aria-describedby="request-help"
              minLength={10}
              maxLength={2000}
              required
            />
            <p className="field-help" id="request-help">
              Informe cliente, produto, quantidade, preço e prazo em uma frase.
            </p>

            <button
              className="primary-button"
              type="submit"
              disabled={requestState === "loading" || requestText.trim().length < 10}
            >
              {requestState === "loading" ? "Gerando plano..." : "Gerar plano"}
              <span aria-hidden="true">→</span>
            </button>

            {errorMessage ? (
              <div className="form-error" role="alert">
                <strong>Não foi possível gerar o plano</strong>
                <p>{errorMessage}</p>
              </div>
            ) : null}

            <div className="safety-note">
              <span className="safety-icon" aria-hidden="true">
                ✓
              </span>
              <div>
                <strong>Aprovação humana obrigatória</strong>
                <p>Nenhuma ação altera estado antes da sua confirmação.</p>
              </div>
            </div>
          </form>
        </article>

        <article
          className="plan-panel panel"
          aria-labelledby="plan-title"
          aria-live="polite"
        >
          <div className="panel-heading">
            <div>
              <p className="step-label">02 · Plano proposto</p>
              <h2 id="plan-title">Revise antes de executar</h2>
            </div>
            <span className="preview-badge">{previewState}</span>
          </div>

          <dl className="summary-grid">
            <div>
              <dt>Cliente</dt>
              <dd>{plan?.customer ?? "—"}</dd>
            </div>
            <div>
              <dt>Produto</dt>
              <dd>{plan?.product ?? "—"}</dd>
            </div>
            <div>
              <dt>Quantidade</dt>
              <dd>{plan ? `${plan.quantity} unidades` : "—"}</dd>
            </div>
            <div>
              <dt>Prazo</dt>
              <dd>{plan ? formatDelivery(plan.requestedDelivery) : "—"}</dd>
            </div>
          </dl>

          <div
            className={`inventory-check${
              plan && !plan.inventoryAvailable ? " unavailable" : ""
            }`}
          >
            <div>
              <span className="inventory-icon" aria-hidden="true">
                {plan ? (plan.inventoryAvailable ? "✓" : "!") : "·"}
              </span>
              <span>
                <strong>
                  {plan
                    ? plan.inventoryAvailable
                      ? "Estoque suficiente"
                      : "Estoque insuficiente"
                    : "Aguardando consulta de estoque"}
                </strong>
                <small>
                  {plan
                    ? `${plan.availableQuantity} disponíveis para ${plan.quantity} solicitadas`
                    : "check_inventory será chamada ao gerar o plano"}
                </small>
              </span>
            </div>
            <span className="read-only-tag">Somente leitura</span>
          </div>

          <ol className={`action-list${actions.length === 0 ? " empty" : ""}`}>
            {actions.length > 0 ? (
              actions.map((action, index) => (
                <li key={action.tool}>
                  <span className="action-number">{index + 1}</span>
                  <span className="action-copy">
                    <strong>{action.label}</strong>
                    <code>{action.tool}</code>
                  </span>
                  <span
                    className={
                      action.read
                        ? "action-kind read"
                        : action.completed
                          ? "action-kind complete"
                          : "action-kind"
                    }
                  >
                    {action.tag}
                  </span>
                </li>
              ))
            ) : (
              <li className="action-placeholder">
                O plano e as tools aparecerão aqui após a análise.
              </li>
            )}
          </ol>

          <div className="plan-total">
            <span>
              {plan
                ? `${plan.quantity} × ${formatCurrency(plan.unitPrice)}`
                : "Total do pedido"}
            </span>
            <strong>{plan ? formatCurrency(plan.total) : "—"}</strong>
          </div>

          <button
            className="approval-button"
            type="button"
            onClick={handleExecution}
            disabled={
              !plan?.inventoryAvailable ||
              requestState !== "success" ||
              executionState === "loading" ||
              executionState === "success"
            }
            title={
              plan && !plan.inventoryAvailable
                ? "Execução bloqueada por estoque insuficiente"
                : executionState === "success"
                  ? "Esta operação já foi concluída"
                  : "Executar o plano aprovado"
            }
          >
            {executionState === "loading"
              ? "Executando..."
              : executionState === "success"
                ? "Operação concluída"
                : "Aprovar execução"}
          </button>
          {plan && !plan.inventoryAvailable ? (
            <p className="execution-blocked">
              Execução bloqueada — estoque insuficiente
            </p>
          ) : null}
          {planResult && executionState !== "success" ? (
            <p className="planning-attribution">
              Planejado com Codex <span aria-hidden="true">•</span> nenhuma ação
              executada ainda
            </p>
          ) : null}
        </article>
      </section>

      <section
        className="execution-strip"
        aria-labelledby="execution-title"
        aria-live="polite"
      >
        <div>
          <p className="step-label">03 · Execução</p>
          <h2 id="execution-title">
            {executionState === "success"
              ? "Operação concluída"
              : executionState === "loading"
                ? "Executando operação aprovada"
                : plan && !plan.inventoryAvailable
                  ? "Execução bloqueada — estoque insuficiente"
                  : planResult
                    ? "Plano aguardando sua aprovação"
                    : requestState === "error"
                      ? "Planejamento não concluído"
                      : "Nenhuma tool chamada ainda"}
          </h2>
        </div>
        <p className="execution-description">
          {executionResult ? (
            <>
              Pedido, reserva de estoque e cobrança local foram registrados de
              forma atômica.
            </>
          ) : executionState === "loading" ? (
            <>Validando novamente o estoque antes de aplicar as alterações.</>
          ) : planResult ? (
            <>
              <code>check_inventory</code> consultou o estado local. Nenhuma
              mutação ocorrerá sem sua aprovação.
            </>
          ) : (
            <>
              Somente <code>check_inventory</code> pode ser usada nesta etapa.
              Nenhuma ação de escrita será executada.
            </>
          )}
        </p>
        <span className="empty-state">
          {executionResult
            ? "Concluída"
            : executionState === "loading"
              ? "Em execução"
              : plan && !plan.inventoryAvailable
                ? "Bloqueada"
                : planResult
                  ? "Aguardando aprovação"
                  : "Aguardando plano"}
        </span>

        {executionErrorMessage ? (
          <div className="execution-error" role="alert">
            <strong>Execução não concluída</strong>
            <p>{executionErrorMessage}</p>
          </div>
        ) : null}

        {executionResult ? (
          <>
            <ol className="execution-timeline" aria-label="Ações executadas">
              {executionResult.events.map((event) => (
                <li key={event.tool}>
                  <span aria-hidden="true">✓</span>
                  <strong>{event.message}</strong>
                  <code>{event.tool}</code>
                </li>
              ))}
            </ol>

            <dl className="execution-summary">
              <div>
                <dt>Pedido</dt>
                <dd>#{executionResult.orderId}</dd>
              </div>
              <div>
                <dt>Cobrança</dt>
                <dd>#{executionResult.paymentId}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{formatCurrency(executionResult.total)}</dd>
              </div>
              <div>
                <dt>Estoque anterior</dt>
                <dd>{executionResult.previousStock}</dd>
              </div>
              <div>
                <dt>Estoque atual</dt>
                <dd>{executionResult.currentStock}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>Operação concluída</dd>
              </div>
            </dl>

            <p className="execution-attribution">
              Execução determinística <span aria-hidden="true">•</span> aprovada
              por você
            </p>
          </>
        ) : null}
      </section>
    </main>
  );
}
