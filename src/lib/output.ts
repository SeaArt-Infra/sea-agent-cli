export function printJSON(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printTable(items: any[]): void {
  if (!Array.isArray(items)) {
    printJSON(items);
    return;
  }
  console.table(items);
}
