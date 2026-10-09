/** Normalizes a PH mobile number to +639XXXXXXXXX, or returns null if invalid. */
export function normalizePH(input: string): string | null {
  const d = input.replace(/[\s-()]/g, "");
  let m = d.match(/^\+?63(9\d{9})$/) || d.match(/^0(9\d{9})$/) || d.match(/^(9\d{9})$/);
  return m ? `+63${m[1]}` : null;
}
export function formatPH(p: string) {
  const m = p.match(/^\+63(\d{3})(\d{3})(\d{4})$/);
  return m ? `+63 ${m[1]} ${m[2]} ${m[3]}` : p;
}
