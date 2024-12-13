class Solution {
    func scoreOfString(_ s: String) -> Int {
        var score = 0
        for (charA, charB) in zip(s, s.dropFirst()) {
            let difference = Int(charA.asciiValue!) - Int(charB.asciiValue!)
            score += abs(difference)
        }

        return score
    }
}
