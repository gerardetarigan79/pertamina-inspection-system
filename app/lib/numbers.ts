/** Round a finite numeric value to a fixed number of decimal places. */
export const round = (value: number, digits: number) =>
  Math.round(value * 10 ** digits) / 10 ** digits;
