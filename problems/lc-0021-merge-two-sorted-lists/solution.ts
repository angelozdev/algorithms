/**
 * Definition for singly-linked list.
 * class ListNode {
 *     val: number
 *     next: ListNode | null
 *     constructor(val?: number, next?: ListNode | null) {
 *         this.val = (val===undefined ? 0 : val)
 *         this.next = (next===undefined ? null : next)
 *     }
 * }
 **/

type TNode = ListNode | null;

class ListNode {
  val: number;
  next: TNode;
  constructor(val?: number, next?: TNode) {
    this.val = val === undefined ? 0 : val;
    this.next = next === undefined ? null : next;
  }

  toArray() {
    const list = [];
    let current: TNode = this;

    while (current !== null) {
      list.push(current.val);
      current = current.next;
    }

    return list;
  }

  toString() {
    return `${this.toArray().join("-> ")}`;
  }
}

function mergeTwoLists(list1: TNode, list2: TNode): TNode {
  let a: TNode = list1;
  let b: TNode = list2;
  const result = new ListNode();
  let current = result;

  while (a?.val !== undefined && b?.val !== undefined) {
    if (a?.val > b?.val) {
      current.next = b;
      b = b?.next || null;
    } else {
      current.next = a;
      a = a?.next || null;
    }

    current = current.next;
  }

  if (a) current.next = a;
  if (b) current.next = b;

  return result.next;
}

const a = new ListNode(1, new ListNode(2));
const b = new ListNode(3, new ListNode(4, new ListNode(5)));

const list = mergeTwoLists(a, b);

console.log(list?.toString());
