public class ListNode {
    public var val: Int
    public var next: ListNode?
    public init() { val = 0; next = nil }
    public init(_ val: Int) { self.val = val; next = nil }
    public init(_ val: Int, _ next: ListNode?) { self.val = val; self.next = next }
}

class Solution {
    func insertGreatestCommonDivisors(_ head: ListNode?) -> ListNode? {
        var currentNode = head

        while let current = currentNode, let next = current.next {
            let newLinkedList = ListNode(gcd(current.val, next.val))

            newLinkedList.next = next
            current.next = newLinkedList
            currentNode = newLinkedList.next
        }

        return head
    }

    func gcd(_ a: Int, _ b: Int) -> Int {
        return b == 0 ? a : gcd(b, a % b)
    }
}

let h = ListNode(18, ListNode(6, ListNode(10, ListNode(3))))
let newLinkedList = Solution().insertGreatestCommonDivisors(h)
if let newLinkedList = newLinkedList {
    print("\(newLinkedList)")
} else {
    print("newLinkedList is nil")
}
