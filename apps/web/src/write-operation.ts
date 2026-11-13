export type WriteOperation = {
  busy: boolean;
  start: () => boolean;
  finish: (changed: "categories" | "transactions" | null) => void;
  isActive: () => boolean;
};
