import { inventoryItemSchema, type InventoryItem } from "@/lib/domain/schemas";

const initialInventory: InventoryItem[] = [
  {
    id: "prod_kit_festa",
    name: "Kit Festa",
    availableQuantity: 80,
    unitPriceCents: 3500,
  },
];

export const inventorySeed = initialInventory.map((item) =>
  inventoryItemSchema.parse(item),
);
