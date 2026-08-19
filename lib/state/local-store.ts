import type { InventoryItem } from "@/lib/domain/schemas";
import type { ExecutionResult } from "@/lib/execution/schemas";
import { normalizeProductName } from "@/lib/inventory/normalize-product-name";
import { inventorySeed } from "@/lib/inventory/seed";
import type {
  OrderRecord,
  PaymentRecord,
  ReservationRecord,
} from "@/lib/state/schemas";

type IdempotencyRecord = {
  fingerprint: string;
  result: unknown;
};

export type OperationExecutionRecord = {
  fingerprint: string;
  result: ExecutionResult;
};

export type LocalStore = {
  inventory: Map<string, InventoryItem>;
  orders: Map<string, OrderRecord>;
  reservations: Map<string, ReservationRecord>;
  payments: Map<string, PaymentRecord>;
  idempotency: Map<string, IdempotencyRecord>;
  executions: Map<string, OperationExecutionRecord>;
};

export function createLocalStore(): LocalStore {
  return {
    inventory: new Map(
      inventorySeed.map((item) => [item.id, { ...item }]),
    ),
    orders: new Map(),
    reservations: new Map(),
    payments: new Map(),
    idempotency: new Map(),
    executions: new Map(),
  };
}

function cloneRecordMap<T extends object>(source: Map<string, T>) {
  return new Map(
    Array.from(source, ([key, value]) => [key, { ...value }] as const),
  );
}

export function cloneLocalStore(store: LocalStore): LocalStore {
  return {
    inventory: cloneRecordMap(store.inventory),
    orders: cloneRecordMap(store.orders),
    reservations: cloneRecordMap(store.reservations),
    payments: cloneRecordMap(store.payments),
    idempotency: cloneRecordMap(store.idempotency),
    executions: cloneRecordMap(store.executions),
  };
}

function replaceMap<T>(target: Map<string, T>, source: Map<string, T>) {
  target.clear();
  for (const [key, value] of source) target.set(key, value);
}

export function commitLocalStore(target: LocalStore, source: LocalStore) {
  replaceMap(target.inventory, source.inventory);
  replaceMap(target.orders, source.orders);
  replaceMap(target.reservations, source.reservations);
  replaceMap(target.payments, source.payments);
  replaceMap(target.idempotency, source.idempotency);
  replaceMap(target.executions, source.executions);
}

export function findInventoryItem(
  store: LocalStore,
  productName: string,
): InventoryItem | undefined {
  const normalizedProduct = normalizeProductName(productName);

  return Array.from(store.inventory.values()).find(
    (item) => normalizeProductName(item.name) === normalizedProduct,
  );
}

const globalForBalcao = globalThis as typeof globalThis & {
  __balcaoLocalStore?: LocalStore;
};

export const localStore =
  globalForBalcao.__balcaoLocalStore ?? createLocalStore();

const runtimeStore = localStore as {
  executions?: LocalStore["executions"];
};

if (!runtimeStore.executions) {
  runtimeStore.executions = new Map();
}

if (process.env.NODE_ENV !== "production") {
  globalForBalcao.__balcaoLocalStore = localStore;
}
