import { inventorySeed } from "@/lib/inventory/seed";

const demoRequest =
  "A Ana pediu 20 kits festa para amanhã às 14h. Cada kit custa R$35. Reserve o estoque e prepare o pedido.";

const demoPlan = [
  {
    tool: "check_inventory",
    label: "Verificar disponibilidade de 20 kits",
    kind: "Leitura",
  },
  {
    tool: "create_order",
    label: "Criar pedido para Ana",
    kind: "Após aprovação",
  },
  {
    tool: "reserve_inventory",
    label: "Reservar 20 unidades no estoque",
    kind: "Após aprovação",
  },
  {
    tool: "create_payment",
    label: "Registrar cobrança de R$ 700,00",
    kind: "Após aprovação",
  },
] as const;

export default function Home() {
  const demoProduct = inventorySeed[0];

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
          MVP em preparação
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
          <div className="panel-heading">
            <div>
              <p className="step-label">01 · Solicitação</p>
              <h2>O que precisa ser feito?</h2>
            </div>
            <span className="panel-state">Entrada</span>
          </div>

          <label className="request-label" htmlFor="request">
            Pedido em linguagem natural
          </label>
          <textarea
            id="request"
            name="request"
            defaultValue={demoRequest}
            aria-describedby="request-help"
          />
          <p className="field-help" id="request-help">
            Informe cliente, produto, quantidade, preço e prazo em uma frase.
          </p>

          <button
            className="primary-button"
            type="button"
            disabled
            title="A análise pela OpenAI será conectada na próxima etapa"
          >
            Gerar plano
            <span aria-hidden="true">→</span>
          </button>

          <div className="safety-note">
            <span className="safety-icon" aria-hidden="true">
              ✓
            </span>
            <div>
              <strong>Aprovação humana obrigatória</strong>
              <p>Nenhuma ação altera estado antes da sua confirmação.</p>
            </div>
          </div>
        </article>

        <article className="plan-panel panel" aria-labelledby="plan-title">
          <div className="panel-heading">
            <div>
              <p className="step-label">02 · Plano proposto</p>
              <h2 id="plan-title">Revise antes de executar</h2>
            </div>
            <span className="preview-badge">Prévia</span>
          </div>

          <dl className="summary-grid">
            <div>
              <dt>Cliente</dt>
              <dd>Ana</dd>
            </div>
            <div>
              <dt>Produto</dt>
              <dd>{demoProduct.name}</dd>
            </div>
            <div>
              <dt>Quantidade</dt>
              <dd>20 unidades</dd>
            </div>
            <div>
              <dt>Prazo</dt>
              <dd>Amanhã, 14h</dd>
            </div>
          </dl>

          <div className="inventory-check">
            <div>
              <span className="inventory-icon" aria-hidden="true">
                ✓
              </span>
              <span>
                <strong>Estoque inicial suficiente</strong>
                <small>{demoProduct.availableQuantity} unidades disponíveis</small>
              </span>
            </div>
            <span className="read-only-tag">Somente leitura</span>
          </div>

          <ol className="action-list">
            {demoPlan.map((action, index) => (
              <li key={action.tool}>
                <span className="action-number">{index + 1}</span>
                <span className="action-copy">
                  <strong>{action.label}</strong>
                  <code>{action.tool}</code>
                </span>
                <span
                  className={
                    action.kind === "Leitura" ? "action-kind read" : "action-kind"
                  }
                >
                  {action.kind}
                </span>
              </li>
            ))}
          </ol>

          <div className="plan-total">
            <span>Total do pedido</span>
            <strong>R$ 700,00</strong>
          </div>

          <button
            className="approval-button"
            type="button"
            disabled
            title="A execução será conectada após o planejamento"
          >
            Aprovar execução
          </button>
        </article>
      </section>

      <section className="execution-strip" aria-labelledby="execution-title">
        <div>
          <p className="step-label">03 · Execução</p>
          <h2 id="execution-title">Nenhuma tool chamada ainda</h2>
        </div>
        <p>
          O histórico de <code>create_order</code>, <code>reserve_inventory</code> e{" "}
          <code>create_payment</code> aparecerá aqui depois da aprovação.
        </p>
        <span className="empty-state">Aguardando plano</span>
      </section>
    </main>
  );
}
