// The fixed set of owning departments for projects, programs and products.
// Mirrors server/Departments.cs — keep the two lists in sync.
export const DEPARTMENTS = [
  "Infrastructure", "Development", "Security", "D365", "Architecture", "PMO", "PO",
] as const;

export type Department = (typeof DEPARTMENTS)[number];
