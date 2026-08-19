import {
  findInventoryItem,
  localStore,
  type LocalStore,
} from "@/lib/state/local-store";
import {
  checkInventoryArgumentsSchema,
  checkInventoryResultSchema,
  type CheckInventoryArguments,
  type CheckInventoryResult,
} from "@/lib/tools/contracts";

export function checkInventory(
  input: CheckInventoryArguments,
  store: LocalStore = localStore,
): CheckInventoryResult {
  const argumentsResult = checkInventoryArgumentsSchema.parse(input);
  const item = findInventoryItem(store, argumentsResult.product);

  return checkInventoryResultSchema.parse({
    product: item?.name ?? argumentsResult.product,
    requestedQuantity: argumentsResult.quantity,
    availableQuantity: item?.availableQuantity ?? 0,
    available: Boolean(
      item && item.availableQuantity >= argumentsResult.quantity,
    ),
  });
}
