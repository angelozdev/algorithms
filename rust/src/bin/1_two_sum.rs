use std::collections::HashMap;

fn two_sum(nums: &[i32], target: i32) -> Option<(usize, usize)> {
    let mut seen: HashMap<i32, usize> = HashMap::new();

    for (i, &num) in nums.iter().enumerate() {
        let complement = target - num;
        if let Some(&j) = seen.get(&complement) {
            return Some((j, i));
        }
        seen.insert(num, i);
    }

    None
}

fn main() {
    println!("{:?}", two_sum(&[2, 7, 11, 15], 9));  // Some((0, 1))
    println!("{:?}", two_sum(&[3, 2, 4], 6));       // Some((1, 2))
    println!("{:?}", two_sum(&[3, 3], 6));          // Some((0, 1))
}
