import { log } from "console";

export class ListNode {
  val: number;
  next: ListNode | null;
  constructor(val?: number, next?: ListNode | null) {
    this.val = val === undefined ? 0 : val;
    this.next = next === undefined ? null : next;
  }
}

function mergeNodes(head: ListNode | null): ListNode | null {
  if (!head) return null;

  let prev = head;
  let current = head.next;
  let sum = 0;

  while (current !== null) {
    if (current.val !== 0) {
      sum += current.val;
    } else {
      current.val = sum;
      prev.next = current;
      prev = current;
    }

    current = current.next;
  }

  return head.next;
}

export default mergeNodes;
