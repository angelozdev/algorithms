import { log } from "console";
import { ListNode } from "lc"; // delete this line when pasting into LeetCode

function gcd(n: number, m: number): number {
  while (m !== 0) {
    let temp = m;
    m = n % m;
    n = temp;
  }

  return n;
}

function insertGreatestCommonDivisors(
  head: ListNode | null,
): ListNode | null {
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
