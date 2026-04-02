// backend/prisma/seed-codehire-problems.ts
// Seeds the 15 built-in CodeHire problems into the Problem table.
// Run:  npx ts-node --esm prisma/seed-codehire-problems.ts
// Safe to re-run — upserts by slug.

import { prisma } from '../src/config/database.js';

const BUILT_IN_PROBLEMS = [
    {
        slug: 'two-sum',
        title: 'Two Sum',
        difficulty: 'EASY' as const,
        topic: 'Array',
        category: 'Array • Hash Table',
        description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
        constraints: '2 ≤ nums.length ≤ 10⁴\n-10⁹ ≤ nums[i] ≤ 10⁹\nOnly one valid answer exists',
        examples: [
            { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].' },
            { input: 'nums = [3,2,4], target = 6', output: '[1,2]' },
        ],
        isPublished: true,
        starterCode: {
            javascript: `function twoSum(nums, target) {\n  // Write your solution here\n  \n}\n\nconsole.log(JSON.stringify(twoSum([2, 7, 11, 15], 9))); // [0,1]\nconsole.log(JSON.stringify(twoSum([3, 2, 4], 6)));       // [1,2]`,
            python: `import json\ndef twoSum(nums, target):\n    # Write your solution here\n    pass\n\nprint(json.dumps(twoSum([2, 7, 11, 15], 9), separators=(',', ':')))  # [0,1]\nprint(json.dumps(twoSum([3, 2, 4], 6), separators=(',', ':')))        # [1,2]`,
            java: `import java.util.*;\nclass Solution {\n    public static int[] twoSum(int[] nums, int target) {\n        return new int[0];\n    }\n    public static void main(String[] args) {\n        System.out.println(Arrays.toString(twoSum(new int[]{2, 7, 11, 15}, 9)));\n        System.out.println(Arrays.toString(twoSum(new int[]{3, 2, 4}, 6)));\n    }\n}`,
        },
        expectedOutput: { javascript: '[0,1]\n[1,2]', python: '[0,1]\n[1,2]', java: '[0, 1]\n[1, 2]' },
    },
    {
        slug: 'reverse-string',
        title: 'Reverse String',
        difficulty: 'EASY' as const,
        topic: 'String',
        category: 'String • Two Pointers',
        description: 'Write a function that reverses a string. The input string is given as an array of characters s. You must do this by modifying the input array in-place with O(1) extra memory.',
        constraints: '1 ≤ s.length ≤ 10⁵\ns[i] is a printable ascii character',
        examples: [
            { input: 's = ["h","e","l","l","o"]', output: '["o","l","l","e","h"]' },
        ],
        isPublished: true,
        starterCode: {
            javascript: `function reverseString(s) {\n  // Modify in-place\n}\nlet t = ["h","e","l","l","o"];\nreverseString(t);\nconsole.log(JSON.stringify(t));`,
            python: `import json\ndef reverseString(s):\n    pass\nt = ["h","e","l","l","o"]\nreverseString(t)\nprint(json.dumps(t, separators=(',', ':')))`,
            java: `import java.util.*;\nclass Solution {\n    public static void reverseString(char[] s) {}\n    public static void main(String[] args) {\n        char[] t = {'h','e','l','l','o'};\n        reverseString(t);\n        System.out.println(Arrays.toString(t));\n    }\n}`,
        },
        expectedOutput: { javascript: '["o","l","l","e","h"]', python: '["o","l","l","e","h"]', java: '[o, l, l, e, h]' },
    },
    {
        slug: 'valid-palindrome',
        title: 'Valid Palindrome',
        difficulty: 'EASY' as const,
        topic: 'String',
        category: 'String • Two Pointers',
        description: 'A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward.',
        constraints: '1 ≤ s.length ≤ 2 * 10⁵',
        examples: [{ input: 's = "A man, a plan, a canal: Panama"', output: 'true' }],
        isPublished: true,
        starterCode: {
            javascript: `function isPalindrome(s) {\n  // Your solution\n}\nconsole.log(isPalindrome("A man, a plan, a canal: Panama")); // true`,
            python: `def isPalindrome(s):\n    pass\nprint(isPalindrome("A man, a plan, a canal: Panama"))  # True`,
            java: `class Solution {\n    public static boolean isPalindrome(String s) { return false; }\n    public static void main(String[] args) {\n        System.out.println(isPalindrome("A man, a plan, a canal: Panama"));\n    }\n}`,
        },
        expectedOutput: { javascript: 'true', python: 'True', java: 'true' },
    },
    {
        slug: 'maximum-subarray',
        title: 'Maximum Subarray',
        difficulty: 'MEDIUM' as const,
        topic: 'Array',
        category: 'Array • Dynamic Programming',
        description: 'Given an integer array nums, find the subarray with the largest sum, and return its sum.',
        constraints: '1 ≤ nums.length ≤ 10⁵\n-10⁴ ≤ nums[i] ≤ 10⁴',
        examples: [{ input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6', explanation: 'The subarray [4,-1,2,1] has the largest sum 6.' }],
        isPublished: true,
        starterCode: {
            javascript: `function maxSubArray(nums) {\n  // Kadane's algorithm\n}\nconsole.log(maxSubArray([-2,1,-3,4,-1,2,1,-5,4])); // 6`,
            python: `def maxSubArray(nums):\n    pass\nprint(maxSubArray([-2,1,-3,4,-1,2,1,-5,4]))  # 6`,
            java: `class Solution {\n    public static int maxSubArray(int[] nums) { return 0; }\n    public static void main(String[] args) {\n        System.out.println(maxSubArray(new int[]{-2,1,-3,4,-1,2,1,-5,4}));\n    }\n}`,
        },
        expectedOutput: { javascript: '6', python: '6', java: '6' },
    },
    {
        slug: 'valid-anagram',
        title: 'Valid Anagram',
        difficulty: 'EASY' as const,
        topic: 'String',
        category: 'String • Hash Table',
        description: 'Given two strings s and t, return true if t is an anagram of s, and false otherwise.',
        constraints: '1 ≤ s.length, t.length ≤ 5 * 10⁴',
        examples: [{ input: 's = "anagram", t = "nagaram"', output: 'true' }],
        isPublished: true,
        starterCode: {
            javascript: `function isAnagram(s, t) {\n  // Your solution\n}\nconsole.log(isAnagram("anagram", "nagaram")); // true`,
            python: `def isAnagram(s, t):\n    pass\nprint(isAnagram("anagram", "nagaram"))  # True`,
            java: `class Solution {\n    public static boolean isAnagram(String s, String t) { return false; }\n    public static void main(String[] args) {\n        System.out.println(isAnagram("anagram", "nagaram"));\n    }\n}`,
        },
        expectedOutput: { javascript: 'true', python: 'True', java: 'true' },
    },
    {
        slug: 'best-time-to-buy-and-sell-stock',
        title: 'Best Time to Buy and Sell Stock',
        difficulty: 'EASY' as const,
        topic: 'Array',
        category: 'Array • Dynamic Programming',
        description: 'You are given an array prices where prices[i] is the price of a given stock on the ith day. Return the maximum profit you can achieve from this transaction.',
        constraints: '1 ≤ prices.length ≤ 10⁵\n0 ≤ prices[i] ≤ 10⁴',
        examples: [{ input: 'prices = [7,1,5,3,6,4]', output: '5', explanation: 'Buy on day 2 (price=1), sell on day 5 (price=6). Profit = 6-1 = 5.' }],
        isPublished: true,
        starterCode: {
            javascript: `function maxProfit(prices) {\n  // Your solution\n}\nconsole.log(maxProfit([7,1,5,3,6,4])); // 5`,
            python: `def maxProfit(prices):\n    pass\nprint(maxProfit([7,1,5,3,6,4]))  # 5`,
            java: `class Solution {\n    public static int maxProfit(int[] prices) { return 0; }\n    public static void main(String[] args) {\n        System.out.println(maxProfit(new int[]{7,1,5,3,6,4}));\n    }\n}`,
        },
        expectedOutput: { javascript: '5', python: '5', java: '5' },
    },
    {
        slug: 'container-with-most-water',
        title: 'Container With Most Water',
        difficulty: 'MEDIUM' as const,
        topic: 'Array',
        category: 'Array • Two Pointers',
        description: 'Given an integer array height of length n, find two lines that together with the x-axis form a container, such that the container contains the most water.',
        constraints: 'n == height.length\n2 ≤ n ≤ 10⁵\n0 ≤ height[i] ≤ 10⁴',
        examples: [{ input: 'height = [1,8,6,2,5,4,8,3,7]', output: '49' }],
        isPublished: true,
        starterCode: {
            javascript: `function maxArea(height) {\n  // Two-pointer approach\n}\nconsole.log(maxArea([1,8,6,2,5,4,8,3,7])); // 49`,
            python: `def maxArea(height):\n    pass\nprint(maxArea([1,8,6,2,5,4,8,3,7]))  # 49`,
            java: `class Solution {\n    public static int maxArea(int[] height) { return 0; }\n    public static void main(String[] args) {\n        System.out.println(maxArea(new int[]{1,8,6,2,5,4,8,3,7}));\n    }\n}`,
        },
        expectedOutput: { javascript: '49', python: '49', java: '49' },
    },
    {
        slug: 'search-in-rotated-sorted-array',
        title: 'Search in Rotated Sorted Array',
        difficulty: 'MEDIUM' as const,
        topic: 'Array',
        category: 'Array • Binary Search',
        description: 'Given the array nums after the possible rotation and an integer target, return the index of target if it is in nums, or -1 if it is not in nums.',
        constraints: '1 ≤ nums.length ≤ 5000\n-10⁴ ≤ nums[i] ≤ 10⁴',
        examples: [{ input: 'nums = [4,5,6,7,0,1,2], target = 0', output: '4' }],
        isPublished: true,
        starterCode: {
            javascript: `function search(nums, target) {\n  // Binary search on rotated array\n}\nconsole.log(search([4,5,6,7,0,1,2], 0)); // 4`,
            python: `def search(nums, target):\n    pass\nprint(search([4,5,6,7,0,1,2], 0))  # 4`,
            java: `class Solution {\n    public static int search(int[] nums, int target) { return -1; }\n    public static void main(String[] args) {\n        System.out.println(search(new int[]{4,5,6,7,0,1,2}, 0));\n    }\n}`,
        },
        expectedOutput: { javascript: '4', python: '4', java: '4' },
    },
    {
        slug: 'three-sum',
        title: '3Sum',
        difficulty: 'MEDIUM' as const,
        topic: 'Array',
        category: 'Array • Two Pointers',
        description: 'Given an integer array nums, return all the triplets [nums[i], nums[j], nums[k]] such that i != j, i != k, and j != k, and nums[i] + nums[j] + nums[k] == 0.',
        constraints: '3 ≤ nums.length ≤ 3000\n-10⁵ ≤ nums[i] ≤ 10⁵',
        examples: [{ input: 'nums = [-1,0,1,2,-1,-4]', output: '[[-1,-1,2],[-1,0,1]]' }],
        isPublished: true,
        starterCode: {
            javascript: `function threeSum(nums) {\n  // Sort + two pointers\n  return [];\n}\nconsole.log(JSON.stringify(threeSum([-1,0,1,2,-1,-4]))); // [[-1,-1,2],[-1,0,1]]`,
            python: `import json\ndef threeSum(nums):\n    return []\nprint(json.dumps(threeSum([-1,0,1,2,-1,-4])))`,
            java: `import java.util.*;\nclass Solution {\n    public static List<List<Integer>> threeSum(int[] nums) { return new ArrayList<>(); }\n    public static void main(String[] args) {\n        System.out.println(threeSum(new int[]{-1,0,1,2,-1,-4}));\n    }\n}`,
        },
        expectedOutput: { javascript: '[[-1,-1,2],[-1,0,1]]', python: '[[-1, -1, 2], [-1, 0, 1]]', java: '[[-1, -1, 2], [-1, 0, 1]]' },
    },
    {
        slug: 'longest-substring-without-repeating',
        title: 'Longest Substring Without Repeating Characters',
        difficulty: 'MEDIUM' as const,
        topic: 'String',
        category: 'String • Sliding Window',
        description: 'Given a string s, find the length of the longest substring without repeating characters.',
        constraints: '0 ≤ s.length ≤ 5 * 10⁴',
        examples: [{ input: 's = "abcabcbb"', output: '3', explanation: 'The answer is "abc", with the length of 3.' }],
        isPublished: true,
        starterCode: {
            javascript: `function lengthOfLongestSubstring(s) {\n  // Sliding window\n}\nconsole.log(lengthOfLongestSubstring("abcabcbb")); // 3`,
            python: `def lengthOfLongestSubstring(s):\n    pass\nprint(lengthOfLongestSubstring("abcabcbb"))  # 3`,
            java: `class Solution {\n    public static int lengthOfLongestSubstring(String s) { return 0; }\n    public static void main(String[] args) {\n        System.out.println(lengthOfLongestSubstring("abcabcbb"));\n    }\n}`,
        },
        expectedOutput: { javascript: '3', python: '3', java: '3' },
    },
    {
        slug: 'merge-intervals',
        title: 'Merge Intervals',
        difficulty: 'MEDIUM' as const,
        topic: 'Array',
        category: 'Array • Sorting',
        description: 'Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.',
        constraints: '1 ≤ intervals.length ≤ 10⁴\nintervals[i].length == 2\n0 ≤ starti ≤ endi ≤ 10⁴',
        examples: [{ input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]', output: '[[1,6],[8,10],[15,18]]' }],
        isPublished: true,
        starterCode: {
            javascript: `function merge(intervals) {\n  // Sort then merge\n  return [];\n}\nconsole.log(JSON.stringify(merge([[1,3],[2,6],[8,10],[15,18]]))); // [[1,6],[8,10],[15,18]]`,
            python: `import json\ndef merge(intervals):\n    return []\nprint(json.dumps(merge([[1,3],[2,6],[8,10],[15,18]])))`,
            java: `import java.util.*;\nclass Solution {\n    public static int[][] merge(int[][] intervals) { return new int[0][0]; }\n    public static void main(String[] args) {\n        System.out.println(Arrays.deepToString(merge(new int[][]{{1,3},{2,6},{8,10},{15,18}})));\n    }\n}`,
        },
        expectedOutput: { javascript: '[[1,6],[8,10],[15,18]]', python: '[[1, 6], [8, 10], [15, 18]]', java: '[[1, 6], [8, 10], [15, 18]]' },
    },
    {
        slug: 'climbing-stairs',
        title: 'Climbing Stairs',
        difficulty: 'EASY' as const,
        topic: 'Dynamic Programming',
        category: 'Dynamic Programming • Math',
        description: 'You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?',
        constraints: '1 ≤ n ≤ 45',
        examples: [{ input: 'n = 5', output: '8' }],
        isPublished: true,
        starterCode: {
            javascript: `function climbStairs(n) {\n  // DP or fibonacci\n}\nconsole.log(climbStairs(5)); // 8`,
            python: `def climbStairs(n):\n    pass\nprint(climbStairs(5))  # 8`,
            java: `class Solution {\n    public static int climbStairs(int n) { return 0; }\n    public static void main(String[] args) {\n        System.out.println(climbStairs(5));\n    }\n}`,
        },
        expectedOutput: { javascript: '8', python: '8', java: '8' },
    },
    {
        slug: 'binary-search',
        title: 'Binary Search',
        difficulty: 'EASY' as const,
        topic: 'Array',
        category: 'Array • Binary Search',
        description: 'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1.',
        constraints: '1 ≤ nums.length ≤ 10⁴\n-10⁴ < nums[i], target < 10⁴\nAll the integers in nums are unique.',
        examples: [{ input: 'nums = [-1,0,3,5,9,12], target = 9', output: '4' }],
        isPublished: true,
        starterCode: {
            javascript: `function search(nums, target) {\n  // Binary search\n}\nconsole.log(search([-1,0,3,5,9,12], 9)); // 4`,
            python: `def search(nums, target):\n    pass\nprint(search([-1,0,3,5,9,12], 9))  # 4`,
            java: `class Solution {\n    public static int search(int[] nums, int target) { return -1; }\n    public static void main(String[] args) {\n        System.out.println(search(new int[]{-1,0,3,5,9,12}, 9));\n    }\n}`,
        },
        expectedOutput: { javascript: '4', python: '4', java: '4' },
    },
    {
        slug: 'linked-list-cycle',
        title: 'Linked List Cycle',
        difficulty: 'EASY' as const,
        topic: 'Linked List',
        category: 'Linked List • Two Pointers',
        description: 'Given head, the head of a linked list, determine if the linked list has a cycle in it. Return true if there is a cycle, otherwise return false.',
        constraints: 'The number of the nodes in the list is in the range [0, 10⁴].\n-10⁵ ≤ Node.val ≤ 10⁵',
        examples: [{ input: 'head = [3,2,0,-4], pos = 1', output: 'true', explanation: 'There is a cycle in the linked list, where the tail connects to the 1st node (0-indexed).' }],
        isPublished: true,
        starterCode: {
            javascript: `// Fast and slow pointer approach\nfunction hasCycle(head) {\n  let slow = head, fast = head;\n  while (fast && fast.next) {\n    slow = slow.next;\n    fast = fast.next.next;\n    if (slow === fast) return true;\n  }\n  return false;\n}\n// Simulation (no real linked list in console env):\nconsole.log(true); // expected: true`,
            python: `# Fast and slow pointer approach\ndef hasCycle(head):\n    slow = fast = head\n    while fast and fast.next:\n        slow = slow.next\n        fast = fast.next.next\n        if slow is fast:\n            return True\n    return False\n# Simulation:\nprint(True)  # expected: True`,
            java: `public class Solution {\n    public static boolean hasCycle(ListNode head) {\n        ListNode slow = head, fast = head;\n        while (fast != null && fast.next != null) {\n            slow = slow.next;\n            fast = fast.next.next;\n            if (slow == fast) return true;\n        }\n        return false;\n    }\n    public static void main(String[] args) {\n        System.out.println(true); // expected: true\n    }\n}`,
        },
        expectedOutput: { javascript: 'true', python: 'True', java: 'true' },
    },
    {
        slug: 'valid-brackets',
        title: 'Valid Parentheses',
        difficulty: 'EASY' as const,
        topic: 'Stack',
        category: 'Stack • String',
        description: 'Given a string s containing just the characters \'(\', \')\', \'{\', \'}\', \'[\' and \']\', determine if the input string is valid.',
        constraints: '1 ≤ s.length ≤ 10⁴\ns consists of parentheses only \'()[]{}\'..',
        examples: [{ input: 's = "()[]{}"', output: 'true' }, { input: 's = "(]"', output: 'false' }],
        isPublished: true,
        starterCode: {
            javascript: `function isValid(s) {\n  // Use a stack\n}\nconsole.log(isValid("()[]{}")); // true\nconsole.log(isValid("(]"));     // false`,
            python: `def isValid(s):\n    pass\nprint(isValid("()[]{}"))  # True\nprint(isValid("(]"))       # False`,
            java: `import java.util.*;\nclass Solution {\n    public static boolean isValid(String s) { return false; }\n    public static void main(String[] args) {\n        System.out.println(isValid("()[]{}"));\n        System.out.println(isValid("(]"));\n    }\n}`,
        },
        expectedOutput: { javascript: 'true\nfalse', python: 'True\nFalse', java: 'true\nfalse' },
    },
];

async function main() {
    let created = 0;
    let updated = 0;

    for (const p of BUILT_IN_PROBLEMS) {
        const existing = await prisma.problem.findUnique({ where: { slug: p.slug } });
        if (existing) {
            await prisma.problem.update({
                where: { slug: p.slug },
                data: {
                    category: p.category,
                    starterCode: p.starterCode,
                    expectedOutput: p.expectedOutput,
                    isPublished: true,
                },
            });
            updated++;
        } else {
            await prisma.problem.create({
                data: {
                    ...p,
                    difficulty: p.difficulty,
                    createdByUserId: null,
                },
            });
            created++;
        }
    }

    console.log(`✅ ${created} problems created, ${updated} updated`);
    await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
