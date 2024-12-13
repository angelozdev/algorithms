import { log } from "console";
import mergeNodes, {
  ListNode,
} from "./leetcode/2181_merge_nodes_in_between_zeros";

const list = new ListNode(
  0,
  new ListNode(
    3,
    new ListNode(
      1,
      new ListNode(
        0,
        new ListNode(4, new ListNode(5, new ListNode(2, new ListNode(0))))
      )
    )
  )
);

let current: ListNode | null = mergeNodes(list);
while (current !== null) {
  console.log(current.val);
  current = current.next;
}
