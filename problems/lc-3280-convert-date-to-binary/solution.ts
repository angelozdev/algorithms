import { log } from "console";

function convertDateToBinary(date: string): string {
  const [year, month, day] = date
    .split("-")
    .map((d) => parseInt(d, 10).toString(2));

  return `${year}-${month}-${day}`;
}

export default convertDateToBinary;
