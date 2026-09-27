import { log } from "console";

export class ListNode<T> {
  val: T | null;
  next: ListNode<T> | null;
  constructor(val?: T, next?: ListNode<T> | null) {
    this.val = val === undefined ? null : val;
    this.next = next === undefined ? null : next;
  }

  forEach(callback: (node: T | null) => void) {
    let currentNode: ListNode<T> | null = this;

    while (currentNode) {
      callback(currentNode?.val);
      currentNode = currentNode.next;
    }
  }
}

function gcd(n: number, m: number): number {
  while (m !== 0) {
    let temp = m;
    m = n % m;
    n = temp;
  }

  return n;
}

function insertGreatestCommonDivisors(
  head: ListNode<number> | null,
): ListNode<number> | null {
  let currentNode = head;

  while (
    currentNode?.val !== null &&
    currentNode?.next &&
    currentNode.next?.val !== null
  ) {
    const newNode = new ListNode(gcd(currentNode.val, currentNode.next.val));
    log(newNode);
    newNode.next = currentNode.next;
    currentNode.next = newNode;
    currentNode = newNode.next;
  }

  return head;
}

export default insertGreatestCommonDivisors;
