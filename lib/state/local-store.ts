import type { InventoryItem } from "@/lib/domain/schemas";
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

export type LocalStore = {
  inventory: Map<string, InventoryItem>;
  orders: Map<string, OrderRecord>;
  reservations: Map<string, ReservationRecord>;
  payments: Map<string, PaymentRecord>;
  idempotency: Map<string, IdempotencyRecord>;
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
  };
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

if (process.env.NODE_ENV !== "production") {
  globalForBalcao.__balcaoLocalStore = localStore;
}
