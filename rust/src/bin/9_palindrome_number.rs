struct Solution;

impl Solution {
    pub fn is_palindrome(x: i32) -> bool {
        if x < 0 {
            return false;
        }

        let mut num = x;
        let mut reversed: i32 = 0;

        while num > 0 {
            let last_number = num % 10;
            reversed = (reversed * 10) + last_number;
            num /= 10;
        }

        x == reversed
    }
}

fn main() {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn palindromes() {
        assert!(Solution::is_palindrome(0));
        assert!(Solution::is_palindrome(1));
        assert!(Solution::is_palindrome(11));
        assert!(Solution::is_palindrome(121));
        assert!(Solution::is_palindrome(1221));
    }

    #[test]
    fn non_palindromes() {
        assert!(!Solution::is_palindrome(-121));
        assert!(!Solution::is_palindrome(10));
        assert!(!Solution::is_palindrome(100));
        assert!(!Solution::is_palindrome(123));
    }
}
