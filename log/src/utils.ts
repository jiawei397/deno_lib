export function mkdir(dir: string) {
  try {
    Deno.mkdirSync(dir, { recursive: true });
  } catch (e) {
  }
}

export function expireDate(day: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - day);
  return date;
}
