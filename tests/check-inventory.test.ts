import assert from "node:assert/strict";
import test from "node:test";

import { checkInventory } from "@/lib/inventory/check-inventory";
import { inventorySeed } from "@/lib/inventory/seed";
import { createLocalStore } from "@/lib/state/local-store";

test("20 kits festa estão disponíveis sem alterar o estoque", () => {
  const initialQuantity = inventorySeed[0].availableQuantity;
  const store = createLocalStore();
  const result = checkInventory(
    { product: "Kit Festa", quantity: 20 },
    store,
  );

  assert.deepEqual(result, {
    product: "Kit Festa",
    requestedQuantity: 20,
    availableQuantity: 50,
    available: true,
  });
  assert.equal(inventorySeed[0].availableQuantity, initialQuantity);
});

test("200 kits festa retornam estoque insuficiente sem alterar o estoque", () => {
  const initialQuantity = inventorySeed[0].availableQuantity;
  const store = createLocalStore();
  const result = checkInventory(
    { product: "kits festa", quantity: 200 },
    store,
  );

  assert.deepEqual(result, {
    product: "Kit Festa",
    requestedQuantity: 200,
    availableQuantity: 50,
    available: false,
  });
  assert.equal(inventorySeed[0].availableQuantity, initialQuantity);
});
