import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']! });
const prisma = new PrismaClient({ adapter });

// ─── 1. SEED PROBLEMS ────────────────────────────────────────────────────────
const PROBLEMS = [
    {
        slug: 'two-sum', title: 'Two Sum', difficulty: 'EASY' as const, topic: 'Array', isPublished: true,
        description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
        constraints: '2 ≤ nums.length ≤ 10⁴\n-10⁹ ≤ nums[i] ≤ 10⁹\nOnly one valid answer exists',
        examples: [{ input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] == 9 → [0, 1]' }],
        starterCode: { javascript: 'function twoSum(nums, target) {\n  // Write your solution here\n}\nconsole.log(JSON.stringify(twoSum([2,7,11,15],9)));\nconsole.log(JSON.stringify(twoSum([3,2,4],6)));', python: 'def twoSum(nums, target):\n    pass\nimport json\nprint(json.dumps(twoSum([2,7,11,15],9),separators=(\',\',\':\')))\nprint(json.dumps(twoSum([3,2,4],6),separators=(\',\',\':\')))' },
        expectedOutput: { javascript: '[0,1]\n[1,2]', python: '[0,1]\n[1,2]' },
        hints: ['Use a hash map to store seen numbers.', 'For each number, check if (target - num) is already in the map.'],
    },
    {
        slug: 'reverse-string', title: 'Reverse String', difficulty: 'EASY' as const, topic: 'String', isPublished: true,
        description: 'Write a function that reverses a string. The input string is given as an array of characters. Modify in-place with O(1) extra memory.',
        constraints: '1 ≤ s.length ≤ 10⁵',
        examples: [{ input: 's = ["h","e","l","l","o"]', output: '["o","l","l","e","h"]' }],
        starterCode: { javascript: 'function reverseString(s) {\n  // Write your solution here\n}\nlet t=["h","e","l","l","o"]; reverseString(t); console.log(JSON.stringify(t));', python: 'def reverseString(s):\n    pass\nimport json\nt=["h","e","l","l","o"]\nreverseString(t)\nprint(json.dumps(t,separators=(\',\',\':\')))' },
        expectedOutput: { javascript: '["o","l","l","e","h"]', python: '["o","l","l","e","h"]' },
        hints: ['Use two pointers, one at start and one at end.', 'Swap elements and move pointers toward each other.'],
    },
    {
        slug: 'valid-palindrome', title: 'Valid Palindrome', difficulty: 'EASY' as const, topic: 'String', isPublished: true,
        description: 'Given a string s, return true if it is a palindrome after removing non-alphanumeric characters and converting to lowercase.',
        constraints: '1 ≤ s.length ≤ 2 * 10⁵',
        examples: [{ input: 's = "A man, a plan, a canal: Panama"', output: 'true', explanation: '"amanaplanacanalpanama" is a palindrome.' }],
        starterCode: { javascript: 'function isPalindrome(s) {\n  // Write your solution here\n}\nconsole.log(isPalindrome("A man, a plan, a canal: Panama"));\nconsole.log(isPalindrome("race a car"));', python: 'def isPalindrome(s):\n    pass\nprint(isPalindrome("A man, a plan, a canal: Panama"))\nprint(isPalindrome("race a car"))' },
        expectedOutput: { javascript: 'true\nfalse', python: 'True\nFalse' },
        hints: ['Filter out non-alphanumeric characters first.', 'Then compare the cleaned string with its reverse.'],
    },
    {
        slug: 'maximum-subarray', title: 'Maximum Subarray', difficulty: 'MEDIUM' as const, topic: 'Array', isPublished: true,
        description: "Given an integer array nums, find the subarray with the largest sum, and return its sum. (Kadane's Algorithm)",
        constraints: '1 ≤ nums.length ≤ 10⁵\n-10⁴ ≤ nums[i] ≤ 10⁴',
        examples: [{ input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]', output: '6', explanation: 'The subarray [4,-1,2,1] has sum 6.' }],
        starterCode: { javascript: 'function maxSubArray(nums) {\n  // Write your solution here\n}\nconsole.log(maxSubArray([-2,1,-3,4,-1,2,1,-5,4]));', python: 'def maxSubArray(nums):\n    pass\nprint(maxSubArray([-2,1,-3,4,-1,2,1,-5,4]))' },
        expectedOutput: { javascript: '6', python: '6' },
        hints: ["Track current sum and reset when it goes negative (Kadane's).", 'Keep a running max alongside the current sum.'],
    },
    {
        slug: 'container-with-most-water', title: 'Container With Most Water', difficulty: 'MEDIUM' as const, topic: 'Array', isPublished: true,
        description: 'Given integer array height, find two lines that form a container with maximum water and return the maximum amount of water.',
        constraints: '2 ≤ n ≤ 10⁵\n0 ≤ height[i] ≤ 10⁴',
        examples: [{ input: 'height = [1,8,6,2,5,4,8,3,7]', output: '49' }],
        starterCode: { javascript: 'function maxArea(height) {\n  // Write your solution here\n}\nconsole.log(maxArea([1,8,6,2,5,4,8,3,7]));', python: 'def maxArea(height):\n    pass\nprint(maxArea([1,8,6,2,5,4,8,3,7]))' },
        expectedOutput: { javascript: '49', python: '49' },
        hints: ['Use two pointers from both ends.', 'Move the pointer with the smaller height inward.'],
    },
    {
        slug: '3sum', title: '3Sum', difficulty: 'MEDIUM' as const, topic: 'Array', isPublished: true,
        description: 'Given an integer array nums, return all triplets that sum to 0. The solution set must not contain duplicate triplets.',
        constraints: '3 ≤ nums.length ≤ 3000',
        examples: [{ input: 'nums = [-1,0,1,2,-1,-4]', output: '[[-1,-1,2],[-1,0,1]]' }],
        starterCode: { javascript: 'function threeSum(nums) {\n  // Write your solution here\n}\nconsole.log(JSON.stringify(threeSum([-1,0,1,2,-1,-4])));', python: 'def threeSum(nums):\n    pass\nprint(threeSum([-1,0,1,2,-1,-4]))' },
        expectedOutput: { javascript: '[[-1,-1,2],[-1,0,1]]', python: '[[-1, -1, 2], [-1, 0, 1]]' },
        hints: ['Sort the array first.', 'For each element use two pointers for the remaining pair.', 'Skip duplicates to avoid duplicate triplets.'],
    },
    {
        slug: 'trapping-rain-water', title: 'Trapping Rain Water', difficulty: 'HARD' as const, topic: 'Array', isPublished: true,
        description: 'Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap.',
        constraints: '1 ≤ n ≤ 2 * 10⁴\n0 ≤ height[i] ≤ 10⁵',
        examples: [{ input: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]', output: '6' }],
        starterCode: { javascript: 'function trap(height) {\n  // Write your solution here\n}\nconsole.log(trap([0,1,0,2,1,0,1,3,2,1,2,1]));', python: 'def trap(height):\n    pass\nprint(trap([0,1,0,2,1,0,1,3,2,1,2,1]))' },
        expectedOutput: { javascript: '6', python: '6' },
        hints: ['Water trapped at i = min(maxLeft, maxRight) - height[i].', 'Use two pointers for O(n) solution.'],
    },
    {
        slug: 'merge-intervals', title: 'Merge Intervals', difficulty: 'MEDIUM' as const, topic: 'Array', isPublished: true,
        description: 'Given an array of intervals, merge all overlapping intervals and return the non-overlapping intervals.',
        constraints: '1 ≤ intervals.length ≤ 10⁴',
        examples: [{ input: 'intervals = [[1,3],[2,6],[8,10],[15,18]]', output: '[[1,6],[8,10],[15,18]]' }],
        starterCode: { javascript: 'function merge(intervals) {\n  // Write your solution here\n}\nconsole.log(JSON.stringify(merge([[1,3],[2,6],[8,10],[15,18]])));', python: 'def merge(intervals):\n    pass\nprint(merge([[1,3],[2,6],[8,10],[15,18]]))' },
        expectedOutput: { javascript: '[[1,6],[8,10],[15,18]]', python: '[[1, 6], [8, 10], [15, 18]]' },
        hints: ['Sort intervals by start time.', 'Merge if current start ≤ previous end.'],
    },
    {
        slug: 'median-of-two-sorted-arrays', title: 'Median of Two Sorted Arrays', difficulty: 'HARD' as const, topic: 'Binary Search', isPublished: true,
        description: 'Given two sorted arrays nums1 and nums2, return the median of the two sorted arrays in O(log (m+n)) time.',
        constraints: '0 ≤ m, n ≤ 1000\n1 ≤ m + n ≤ 2000',
        examples: [{ input: 'nums1 = [1,3], nums2 = [2]', output: '2.00000', explanation: 'Merged = [1,2,3], median is 2.' }],
        starterCode: { javascript: 'function findMedianSortedArrays(nums1, nums2) {\n  // Write your solution here\n}\nconsole.log(findMedianSortedArrays([1,3],[2]));\nconsole.log(findMedianSortedArrays([1,2],[3,4]));', python: 'def findMedianSortedArrays(nums1, nums2):\n    pass\nprint(findMedianSortedArrays([1,3],[2]))\nprint(findMedianSortedArrays([1,2],[3,4]))' },
        expectedOutput: { javascript: '2\n2.5', python: '2\n2.5' },
        hints: ['Binary search on the smaller array.', 'Partition both arrays so left half ≤ right half.'],
    },
    {
        slug: 'longest-substring-without-repeating-characters', title: 'Longest Substring Without Repeating Characters', difficulty: 'MEDIUM' as const, topic: 'String', isPublished: true,
        description: 'Given a string s, find the length of the longest substring without repeating characters.',
        constraints: '0 ≤ s.length ≤ 5 * 10⁴',
        examples: [{ input: 's = "abcabcbb"', output: '3', explanation: 'The answer is "abc".' }],
        starterCode: { javascript: 'function lengthOfLongestSubstring(s) {\n  // Write your solution here\n}\nconsole.log(lengthOfLongestSubstring("abcabcbb"));', python: 'def lengthOfLongestSubstring(s):\n    pass\nprint(lengthOfLongestSubstring("abcabcbb"))' },
        expectedOutput: { javascript: '3', python: '3' },
        hints: ['Use a sliding window with a set to track characters.', 'Expand right, shrink left when a repeat is found.'],
    },
    {
        slug: 'first-missing-positive', title: 'First Missing Positive', difficulty: 'HARD' as const, topic: 'Array', isPublished: true,
        description: 'Given an unsorted integer array nums, return the smallest missing positive integer. Must be O(n) time and constant extra space.',
        constraints: '1 ≤ nums.length ≤ 10⁵',
        examples: [{ input: 'nums = [1,2,0]', output: '3' }, { input: 'nums = [3,4,-1,1]', output: '2' }],
        starterCode: { javascript: 'function firstMissingPositive(nums) {\n  // Write your solution here\n}\nconsole.log(firstMissingPositive([1,2,0]));\nconsole.log(firstMissingPositive([3,4,-1,1]));', python: 'def firstMissingPositive(nums):\n    pass\nprint(firstMissingPositive([1,2,0]))\nprint(firstMissingPositive([3,4,-1,1]))' },
        expectedOutput: { javascript: '3\n2', python: '3\n2' },
        hints: ['Place each number at its correct index position.', 'The first index with a wrong number is your answer.'],
    },
    {
        slug: 'search-in-rotated-sorted-array', title: 'Search in Rotated Sorted Array', difficulty: 'MEDIUM' as const, topic: 'Binary Search', isPublished: true,
        description: 'Given a possibly rotated sorted array and a target, return the index of target or -1. Must use O(log n) time.',
        constraints: '1 ≤ nums.length ≤ 5000\nAll values unique',
        examples: [{ input: 'nums = [4,5,6,7,0,1,2], target = 0', output: '4' }],
        starterCode: { javascript: 'function search(nums, target) {\n  // Write your solution here\n}\nconsole.log(search([4,5,6,7,0,1,2], 0));', python: 'def search(nums, target):\n    pass\nprint(search([4,5,6,7,0,1,2], 0))' },
        expectedOutput: { javascript: '4', python: '4' },
        hints: ['One half is always sorted — determine which half, then decide where to search.'],
    },
    {
        slug: 'valid-anagram', title: 'Valid Anagram', difficulty: 'EASY' as const, topic: 'String', isPublished: true,
        description: 'Given two strings s and t, return true if t is an anagram of s.',
        constraints: '1 ≤ s.length, t.length ≤ 5 * 10⁴',
        examples: [{ input: 's = "anagram", t = "nagaram"', output: 'true' }, { input: 's = "rat", t = "car"', output: 'false' }],
        starterCode: { javascript: 'function isAnagram(s, t) {\n  // Write your solution here\n}\nconsole.log(isAnagram("anagram","nagaram"));', python: 'def isAnagram(s,t):\n    pass\nprint(isAnagram("anagram","nagaram"))' },
        expectedOutput: { javascript: 'true', python: 'True' },
        hints: ['Count character frequencies and compare.', 'Or sort both strings and compare.'],
    },
    {
        slug: 'best-time-to-buy-and-sell-stock', title: 'Best Time to Buy and Sell Stock', difficulty: 'EASY' as const, topic: 'Array', isPublished: true,
        description: 'Given an array prices where prices[i] is stock price on day i, return the maximum profit. If no profit possible, return 0.',
        constraints: '1 ≤ prices.length ≤ 10⁵\n0 ≤ prices[i] ≤ 10⁴',
        examples: [{ input: 'prices = [7,1,5,3,6,4]', output: '5', explanation: 'Buy on day 2 (price=1), sell on day 5 (price=6).' }],
        starterCode: { javascript: 'function maxProfit(prices) {\n  // Write your solution here\n}\nconsole.log(maxProfit([7,1,5,3,6,4]));', python: 'def maxProfit(prices):\n    pass\nprint(maxProfit([7,1,5,3,6,4]))' },
        expectedOutput: { javascript: '5', python: '5' },
        hints: ['Track the minimum price seen so far.', 'At each step, profit = current price - min price.'],
    },
    {
        slug: 'word-search', title: 'Word Search', difficulty: 'MEDIUM' as const, topic: 'Array', isPublished: true,
        description: 'Given an m x n grid of characters and a word, return true if the word exists in the grid using sequentially adjacent cells.',
        constraints: '1 ≤ word.length ≤ 15',
        examples: [{ input: 'board=[["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]], word="ABCCED"', output: 'true' }],
        starterCode: { javascript: 'function exist(board, word) {\n  // Write your solution here\n}\nconsole.log(exist([["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]],"ABCCED"));', python: 'def exist(board, word):\n    pass\nprint(exist([["A","B","C","E"],["S","F","C","S"],["A","D","E","E"]],"ABCCED"))' },
        expectedOutput: { javascript: 'true', python: 'True' },
        hints: ['Use DFS from each cell where word[0] matches.', 'Mark cells as visited and unmark on backtrack.'],
    },
    {
        slug: 'check-odd-even',
        title: 'Check Odd or Even',
        difficulty: 'EASY' as const,
        topic: 'Basics',
        isPublished: true,
        description: 'Given an integer `n`, return `"Odd"` if the number is odd, and `"Even"` if the number is even.',
        constraints: '-10⁹ ≤ n ≤ 10⁹',
        examples: [
            { input: 'n = 5', output: '"Odd"', explanation: '5 is not divisible by 2.' },
            { input: 'n = -4', output: '"Even"', explanation: '-4 is divisible by 2.' }
        ],
        starterCode: {
            javascript: 'function checkOddEven(n) {\n  // Write your solution here\n  \n}\nconsole.log(checkOddEven(5));\nconsole.log(checkOddEven(-4));',
            python: 'def check_odd_even(n):\n    # Write your solution here\n    pass\n\nprint(check_odd_even(5))\nprint(check_odd_even(-4))'
        },
        expectedOutput: { javascript: 'Odd\nEven', python: 'Odd\nEven' },
        hints: [
            'Use the modulo operator `%` to find the remainder.',
            'If `n % 2 === 0`, the number is even.'
        ],
    },
    {
        slug: 'sum-of-first-n',
        title: 'Sum of First N Natural Numbers',
        difficulty: 'EASY' as const,
        topic: 'Basics',
        isPublished: true,
        description: 'Given an integer `n`, calculate the sum of the first `n` natural numbers. For example, if `n` is 5, the sum is 1 + 2 + 3 + 4 + 5 = 15.',
        constraints: '1 ≤ n ≤ 10⁵',
        examples: [
            { input: 'n = 5', output: '15' },
            { input: 'n = 10', output: '55' }
        ],
        starterCode: {
            javascript: 'function sumOfN(n) {\n  // Write your solution here\n  \n}\nconsole.log(sumOfN(5));\nconsole.log(sumOfN(10));',
            python: 'def sum_of_n(n):\n    # Write your solution here\n    pass\n\nprint(sum_of_n(5))\nprint(sum_of_n(10))'
        },
        expectedOutput: { javascript: '15\n55', python: '15\n55' },
        hints: [
            'You can use a simple `for` loop from 1 to `n` and accumulate the sum.',
            'Optimization: Mathematically, the sum of first N natural numbers is `(n * (n + 1)) / 2`.'
        ],
    },
    {
        slug: 'factorial-of-n',
        title: 'Factorial of a Number',
        difficulty: 'EASY' as const,
        topic: 'Basics',
        isPublished: true,
        description: 'Write a function to compute the factorial of a given integer `n`, denoted as `n!`. By definition, `0! = 1`.',
        constraints: '0 ≤ n ≤ 20',
        examples: [
            { input: 'n = 5', output: '120', explanation: '5! = 5 * 4 * 3 * 2 * 1 = 120.' },
            { input: 'n = 0', output: '1', explanation: 'By mathematical definition, 0! is 1.' }
        ],
        starterCode: {
            javascript: 'function factorial(n) {\n  // Write your solution here\n  \n}\nconsole.log(factorial(5));\nconsole.log(factorial(0));',
            python: 'def factorial(n):\n    # Write your solution here\n    pass\n\nprint(factorial(5))\nprint(factorial(0))'
        },
        expectedOutput: { javascript: '120\n1', python: '120\n1' },
        hints: [
            'Start with a base result of 1.',
            'Multiply the result by every number from 1 up to `n`.',
            'Alternatively, try calculating this using recursion!'
        ],
    },
    {
        slug: 'check-prime',
        title: 'Check Prime Number',
        difficulty: 'EASY' as const,
        topic: 'Basics',
        isPublished: true,
        description: 'Determine if a given number `n` is a prime number. A prime number is a natural number greater than 1 that has no positive divisors other than 1 and itself.',
        constraints: '1 ≤ n ≤ 10⁹',
        examples: [
            { input: 'n = 7', output: 'true', explanation: '7 is only divisible by 1 and 7.' },
            { input: 'n = 10', output: 'false', explanation: '10 is divisible by 1, 2, 5, and 10.' },
            { input: 'n = 1', output: 'false', explanation: '1 is not considered a prime number.' }
        ],
        starterCode: {
            javascript: 'function isPrime(n) {\n  // Write your solution here\n  \n}\nconsole.log(isPrime(7));\nconsole.log(isPrime(10));\nconsole.log(isPrime(1));',
            python: 'def is_prime(n):\n    # Write your solution here\n    pass\n\nprint(is_prime(7))\nprint(is_prime(10))\nprint(is_prime(1))'
        },
        expectedOutput: { javascript: 'true\nfalse\nfalse', python: 'True\nFalse\nFalse' },
        hints: [
            'Check if `n` is less than or equal to 1. If so, return `false`.',
            'Iterate from 2 up to the square root of `n`. If `n` is divisible by any of these numbers, it is not prime.'
        ],
    }
];

async function seedProblems() {
    let count = 0;
    for (const p of PROBLEMS) {
        try {
            await prisma.problem.upsert({
                where: { slug: p.slug },
                update: {
                    isPublished: p.isPublished,
                    starterCode: p.starterCode,
                    expectedOutput: p.expectedOutput,
                    hints: p.hints,
                },
                create: {
                    slug: p.slug,
                    title: p.title,
                    difficulty: p.difficulty,
                    topic: p.topic,
                    description: p.description,
                    constraints: p.constraints,
                    examples: p.examples,
                    starterCode: p.starterCode,
                    expectedOutput: p.expectedOutput,
                    hints: p.hints,
                    isPublished: p.isPublished,
                },
            });
            count++;
        } catch (e) {
            console.error(`Error seeding ${p.slug}:`, (e as Error).message.split('\n')[0]);
        }
    }
    console.log(`✅ ${count}/${PROBLEMS.length} problems seeded`);
}

// ─── 2. SEED ROADMAP ─────────────────────────────────────────────────────────
const CHAPTERS = [
    {
        order: 1, title: 'Learn the Basics', total: 10, problems: [
            { order: 1, title: 'User Input / Output', diff: 'EASY', topic: 'Basics' },
            { order: 2, title: 'Data Types', diff: 'EASY', topic: 'Basics' },
            { order: 3, title: 'If-Else / Switch Statements', diff: 'EASY', topic: 'Basics' },
            { order: 4, title: 'Loops (for/while/do-while)', diff: 'EASY', topic: 'Basics' },
            { order: 5, title: 'Functions & Pass by Value/Ref', diff: 'EASY', topic: 'Basics' },
            { order: 6, title: 'Time & Space Complexity Basics', diff: 'EASY', topic: 'Basics' },
            { order: 7, title: 'Linear Search', diff: 'EASY', topic: 'Basics' },
            { order: 8, title: 'Binary Search Intro', diff: 'EASY', topic: 'Basics', lc: 'https://leetcode.com/problems/binary-search/' },
            { order: 9, title: 'Pattern Printing (1-9)', diff: 'EASY', topic: 'Patterns' },
            { order: 10, title: 'Recursion Basics', diff: 'EASY', topic: 'Recursion' },
        ]
    },
    {
        order: 2, title: 'Sorting Techniques', total: 7, problems: [
            { order: 1, title: 'Selection Sort', diff: 'EASY', topic: 'Sorting' },
            { order: 2, title: 'Bubble Sort', diff: 'EASY', topic: 'Sorting' },
            { order: 3, title: 'Insertion Sort', diff: 'EASY', topic: 'Sorting' },
            { order: 4, title: 'Merge Sort', diff: 'MEDIUM', topic: 'Sorting' },
            { order: 5, title: 'Quick Sort', diff: 'MEDIUM', topic: 'Sorting' },
            { order: 6, title: 'Recursive Bubble Sort', diff: 'EASY', topic: 'Sorting' },
            { order: 7, title: 'Recursive Insertion Sort', diff: 'EASY', topic: 'Sorting' },
        ]
    },
    {
        order: 3, title: 'Arrays — Easy to Hard', total: 15, problems: [
            { order: 1, title: 'Largest Element in Array', diff: 'EASY', topic: 'Array' },
            { order: 2, title: 'Second Largest Element', diff: 'EASY', topic: 'Array' },
            { order: 3, title: 'Check if Array is Sorted', diff: 'EASY', topic: 'Array' },
            { order: 4, title: 'Remove Duplicates from Sorted Array', diff: 'EASY', topic: 'Array', lc: 'https://leetcode.com/problems/remove-duplicates-from-sorted-array/' },
            { order: 5, title: 'Move Zeros to End', diff: 'EASY', topic: 'Array', lc: 'https://leetcode.com/problems/move-zeroes/' },
            { order: 6, title: 'Left Rotate Array by K', diff: 'MEDIUM', topic: 'Array', lc: 'https://leetcode.com/problems/rotate-array/' },
            { order: 7, title: 'Find Missing Number', diff: 'EASY', topic: 'Array', lc: 'https://leetcode.com/problems/missing-number/' },
            { order: 8, title: 'Max Consecutive Ones', diff: 'EASY', topic: 'Array', lc: 'https://leetcode.com/problems/max-consecutive-ones/' },
            { order: 9, title: 'Single Number', diff: 'EASY', topic: 'Array', lc: 'https://leetcode.com/problems/single-number/' },
            { order: 10, title: 'Two Sum', diff: 'EASY', topic: 'Array', lc: 'https://leetcode.com/problems/two-sum/' },
            { order: 11, title: 'Sort Array of 0s 1s 2s', diff: 'MEDIUM', topic: 'Array', lc: 'https://leetcode.com/problems/sort-colors/' },
            { order: 12, title: 'Majority Element', diff: 'MEDIUM', topic: 'Array', lc: 'https://leetcode.com/problems/majority-element/' },
            { order: 13, title: "Maximum Subarray (Kadane's)", diff: 'MEDIUM', topic: 'Array', lc: 'https://leetcode.com/problems/maximum-subarray/' },
            { order: 14, title: 'Best Time to Buy and Sell Stock', diff: 'EASY', topic: 'Array', lc: 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/' },
            { order: 15, title: 'Next Permutation', diff: 'MEDIUM', topic: 'Array', lc: 'https://leetcode.com/problems/next-permutation/' },
        ]
    },
    {
        order: 4, title: 'Binary Search', total: 8, problems: [
            { order: 1, title: 'Binary Search', diff: 'EASY', topic: 'Binary Search', lc: 'https://leetcode.com/problems/binary-search/' },
            { order: 2, title: 'Search Insert Position', diff: 'EASY', topic: 'Binary Search', lc: 'https://leetcode.com/problems/search-insert-position/' },
            { order: 3, title: 'First and Last Position of Element', diff: 'MEDIUM', topic: 'Binary Search', lc: 'https://leetcode.com/problems/find-first-and-last-position-of-element-in-sorted-array/' },
            { order: 4, title: 'Search in Rotated Sorted Array', diff: 'MEDIUM', topic: 'Binary Search', lc: 'https://leetcode.com/problems/search-in-rotated-sorted-array/' },
            { order: 5, title: 'Minimum in Rotated Sorted Array', diff: 'MEDIUM', topic: 'Binary Search', lc: 'https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/' },
            { order: 6, title: 'Single Element in Sorted Array', diff: 'MEDIUM', topic: 'Binary Search', lc: 'https://leetcode.com/problems/single-element-in-a-sorted-array/' },
            { order: 7, title: 'Koko Eating Bananas', diff: 'MEDIUM', topic: 'Binary Search', lc: 'https://leetcode.com/problems/koko-eating-bananas/' },
            { order: 8, title: 'Median of Two Sorted Arrays', diff: 'HARD', topic: 'Binary Search', lc: 'https://leetcode.com/problems/median-of-two-sorted-arrays/' },
        ]
    },
    {
        order: 5, title: 'Strings — Basic to Medium', total: 7, problems: [
            { order: 1, title: 'Reverse Words in String', diff: 'MEDIUM', topic: 'String', lc: 'https://leetcode.com/problems/reverse-words-in-a-string/' },
            { order: 2, title: 'Longest Common Prefix', diff: 'EASY', topic: 'String', lc: 'https://leetcode.com/problems/longest-common-prefix/' },
            { order: 3, title: 'Valid Anagram', diff: 'EASY', topic: 'String', lc: 'https://leetcode.com/problems/valid-anagram/' },
            { order: 4, title: 'Valid Palindrome', diff: 'EASY', topic: 'String', lc: 'https://leetcode.com/problems/valid-palindrome/' },
            { order: 5, title: 'Longest Substring Without Repeating', diff: 'MEDIUM', topic: 'String', lc: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/' },
            { order: 6, title: 'String to Integer (atoi)', diff: 'MEDIUM', topic: 'String', lc: 'https://leetcode.com/problems/string-to-integer-atoi/' },
            { order: 7, title: 'Count and Say', diff: 'MEDIUM', topic: 'String', lc: 'https://leetcode.com/problems/count-and-say/' },
        ]
    },
    {
        order: 6, title: 'Linked List', total: 10, problems: [
            { order: 1, title: 'Introduction to LinkedList', diff: 'EASY', topic: 'Linked List' },
            { order: 2, title: 'Delete Node in LinkedList', diff: 'EASY', topic: 'Linked List', lc: 'https://leetcode.com/problems/delete-node-in-a-linked-list/' },
            { order: 3, title: 'Reverse LinkedList', diff: 'EASY', topic: 'Linked List', lc: 'https://leetcode.com/problems/reverse-linked-list/' },
            { order: 4, title: 'Middle of LinkedList', diff: 'EASY', topic: 'Linked List', lc: 'https://leetcode.com/problems/middle-of-the-linked-list/' },
            { order: 5, title: 'Detect Cycle in LinkedList', diff: 'MEDIUM', topic: 'Linked List', lc: 'https://leetcode.com/problems/linked-list-cycle/' },
            { order: 6, title: 'Merge Two Sorted Lists', diff: 'EASY', topic: 'Linked List', lc: 'https://leetcode.com/problems/merge-two-sorted-lists/' },
            { order: 7, title: 'Remove Nth Node From End', diff: 'MEDIUM', topic: 'Linked List', lc: 'https://leetcode.com/problems/remove-nth-node-from-end-of-list/' },
            { order: 8, title: 'Add Two Numbers', diff: 'MEDIUM', topic: 'Linked List', lc: 'https://leetcode.com/problems/add-two-numbers/' },
            { order: 9, title: 'Intersection of Two LinkedLists', diff: 'EASY', topic: 'Linked List', lc: 'https://leetcode.com/problems/intersection-of-two-linked-lists/' },
            { order: 10, title: 'LRU Cache', diff: 'MEDIUM', topic: 'Linked List', lc: 'https://leetcode.com/problems/lru-cache/' },
        ]
    },
    {
        order: 7, title: 'Recursion', total: 10, problems: [
            { order: 1, title: 'Fibonacci Number', diff: 'EASY', topic: 'Recursion', lc: 'https://leetcode.com/problems/fibonacci-number/' },
            { order: 2, title: 'Factorial of N', diff: 'EASY', topic: 'Recursion' },
            { order: 3, title: 'Reverse an Array', diff: 'EASY', topic: 'Recursion' },
            { order: 4, title: 'Check Palindrome String', diff: 'EASY', topic: 'Recursion' },
            { order: 5, title: 'Subset Sums', diff: 'MEDIUM', topic: 'Recursion' },
            { order: 6, title: 'Subsets II (duplicates)', diff: 'MEDIUM', topic: 'Recursion', lc: 'https://leetcode.com/problems/subsets-ii/' },
            { order: 7, title: 'Combination Sum I', diff: 'MEDIUM', topic: 'Recursion', lc: 'https://leetcode.com/problems/combination-sum/' },
            { order: 8, title: 'Combination Sum II', diff: 'MEDIUM', topic: 'Recursion', lc: 'https://leetcode.com/problems/combination-sum-ii/' },
            { order: 9, title: 'Permutations', diff: 'MEDIUM', topic: 'Recursion', lc: 'https://leetcode.com/problems/permutations/' },
            { order: 10, title: 'N-Queens', diff: 'HARD', topic: 'Recursion', lc: 'https://leetcode.com/problems/n-queens/' },
        ]
    },
    {
        order: 8, title: 'Bit Manipulation', total: 8, problems: [
            { order: 1, title: 'Check ODD or EVEN', diff: 'EASY', topic: 'Bit Manipulation' },
            { order: 2, title: 'Check if i-th bit is set', diff: 'EASY', topic: 'Bit Manipulation' },
            { order: 3, title: 'Count Set Bits', diff: 'EASY', topic: 'Bit Manipulation', lc: 'https://leetcode.com/problems/number-of-1-bits/' },
            { order: 4, title: 'Power of Two', diff: 'EASY', topic: 'Bit Manipulation', lc: 'https://leetcode.com/problems/power-of-two/' },
            { order: 5, title: 'Single Number', diff: 'EASY', topic: 'Bit Manipulation', lc: 'https://leetcode.com/problems/single-number/' },
            { order: 6, title: 'Single Number II', diff: 'MEDIUM', topic: 'Bit Manipulation', lc: 'https://leetcode.com/problems/single-number-ii/' },
            { order: 7, title: 'XOR of Numbers in Range', diff: 'MEDIUM', topic: 'Bit Manipulation' },
            { order: 8, title: 'Divide Two Integers', diff: 'MEDIUM', topic: 'Bit Manipulation', lc: 'https://leetcode.com/problems/divide-two-integers/' },
        ]
    },
    {
        order: 9, title: 'Stacks and Queues', total: 10, problems: [
            { order: 1, title: 'Implement Stack using Array', diff: 'EASY', topic: 'Stack' },
            { order: 2, title: 'Implement Queue using Array', diff: 'EASY', topic: 'Queue' },
            { order: 3, title: 'Stack using Queues', diff: 'MEDIUM', topic: 'Stack', lc: 'https://leetcode.com/problems/implement-stack-using-queues/' },
            { order: 4, title: 'Queue using Stacks', diff: 'EASY', topic: 'Queue', lc: 'https://leetcode.com/problems/implement-queue-using-stacks/' },
            { order: 5, title: 'Valid Parentheses', diff: 'EASY', topic: 'Stack', lc: 'https://leetcode.com/problems/valid-parentheses/' },
            { order: 6, title: 'Next Greater Element I', diff: 'EASY', topic: 'Stack', lc: 'https://leetcode.com/problems/next-greater-element-i/' },
            { order: 7, title: 'Min Stack', diff: 'MEDIUM', topic: 'Stack', lc: 'https://leetcode.com/problems/min-stack/' },
            { order: 8, title: 'Trapping Rain Water', diff: 'HARD', topic: 'Stack', lc: 'https://leetcode.com/problems/trapping-rain-water/' },
            { order: 9, title: 'Largest Rectangle in Histogram', diff: 'HARD', topic: 'Stack', lc: 'https://leetcode.com/problems/largest-rectangle-in-histogram/' },
            { order: 10, title: 'Design Circular Queue', diff: 'MEDIUM', topic: 'Queue', lc: 'https://leetcode.com/problems/design-circular-queue/' },
        ]
    },
    {
        order: 10, title: 'Sliding Window & Two Pointer', total: 7, problems: [
            { order: 1, title: 'Longest Substring Without Repeating', diff: 'MEDIUM', topic: 'Sliding Window', lc: 'https://leetcode.com/problems/longest-substring-without-repeating-characters/' },
            { order: 2, title: 'Fruits Into Baskets', diff: 'MEDIUM', topic: 'Sliding Window', lc: 'https://leetcode.com/problems/fruit-into-baskets/' },
            { order: 3, title: 'Longest Repeating Char Replacement', diff: 'MEDIUM', topic: 'Sliding Window', lc: 'https://leetcode.com/problems/longest-repeating-character-replacement/' },
            { order: 4, title: 'Binary Subarrays with Sum', diff: 'MEDIUM', topic: 'Sliding Window', lc: 'https://leetcode.com/problems/binary-subarrays-with-sum/' },
            { order: 5, title: 'Count Nice Subarrays', diff: 'MEDIUM', topic: 'Sliding Window', lc: 'https://leetcode.com/problems/count-number-of-nice-subarrays/' },
            { order: 6, title: 'Minimum Window Substring', diff: 'HARD', topic: 'Sliding Window', lc: 'https://leetcode.com/problems/minimum-window-substring/' },
            { order: 7, title: 'Sliding Window Maximum', diff: 'HARD', topic: 'Sliding Window', lc: 'https://leetcode.com/problems/sliding-window-maximum/' },
        ]
    },
    {
        order: 11, title: 'Heaps', total: 7, problems: [
            { order: 1, title: 'Introduction to Heaps', diff: 'EASY', topic: 'Heap' },
            { order: 2, title: 'Kth Largest Element', diff: 'MEDIUM', topic: 'Heap', lc: 'https://leetcode.com/problems/kth-largest-element-in-an-array/' },
            { order: 3, title: 'Top K Frequent Elements', diff: 'MEDIUM', topic: 'Heap', lc: 'https://leetcode.com/problems/top-k-frequent-elements/' },
            { order: 4, title: 'K Closest Points to Origin', diff: 'MEDIUM', topic: 'Heap', lc: 'https://leetcode.com/problems/k-closest-points-to-origin/' },
            { order: 5, title: 'Merge K Sorted Lists', diff: 'HARD', topic: 'Heap', lc: 'https://leetcode.com/problems/merge-k-sorted-lists/' },
            { order: 6, title: 'Find Median from Data Stream', diff: 'HARD', topic: 'Heap', lc: 'https://leetcode.com/problems/find-median-from-data-stream/' },
            { order: 7, title: 'Task Scheduler', diff: 'MEDIUM', topic: 'Heap', lc: 'https://leetcode.com/problems/task-scheduler/' },
        ]
    },
    {
        order: 12, title: 'Greedy Algorithms', total: 7, problems: [
            { order: 1, title: 'Assign Cookies', diff: 'EASY', topic: 'Greedy', lc: 'https://leetcode.com/problems/assign-cookies/' },
            { order: 2, title: 'Jump Game I', diff: 'MEDIUM', topic: 'Greedy', lc: 'https://leetcode.com/problems/jump-game/' },
            { order: 3, title: 'Jump Game II', diff: 'MEDIUM', topic: 'Greedy', lc: 'https://leetcode.com/problems/jump-game-ii/' },
            { order: 4, title: 'N Meetings in One Room', diff: 'MEDIUM', topic: 'Greedy' },
            { order: 5, title: 'Job Sequencing Problem', diff: 'MEDIUM', topic: 'Greedy' },
            { order: 6, title: 'Fractional Knapsack', diff: 'MEDIUM', topic: 'Greedy' },
            { order: 7, title: 'Minimum Platforms', diff: 'MEDIUM', topic: 'Greedy' },
        ]
    },
    {
        order: 13, title: 'Binary Trees', total: 10, problems: [
            { order: 1, title: 'Inorder Traversal', diff: 'EASY', topic: 'Binary Tree', lc: 'https://leetcode.com/problems/binary-tree-inorder-traversal/' },
            { order: 2, title: 'Preorder Traversal', diff: 'EASY', topic: 'Binary Tree', lc: 'https://leetcode.com/problems/binary-tree-preorder-traversal/' },
            { order: 3, title: 'Postorder Traversal', diff: 'EASY', topic: 'Binary Tree', lc: 'https://leetcode.com/problems/binary-tree-postorder-traversal/' },
            { order: 4, title: 'Level Order Traversal', diff: 'MEDIUM', topic: 'Binary Tree', lc: 'https://leetcode.com/problems/binary-tree-level-order-traversal/' },
            { order: 5, title: 'Maximum Depth of Binary Tree', diff: 'EASY', topic: 'Binary Tree', lc: 'https://leetcode.com/problems/maximum-depth-of-binary-tree/' },
            { order: 6, title: 'Balanced Binary Tree', diff: 'EASY', topic: 'Binary Tree', lc: 'https://leetcode.com/problems/balanced-binary-tree/' },
            { order: 7, title: 'Diameter of Binary Tree', diff: 'EASY', topic: 'Binary Tree', lc: 'https://leetcode.com/problems/diameter-of-binary-tree/' },
            { order: 8, title: 'Lowest Common Ancestor', diff: 'MEDIUM', topic: 'Binary Tree', lc: 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-tree/' },
            { order: 9, title: 'Binary Tree Maximum Path Sum', diff: 'HARD', topic: 'Binary Tree', lc: 'https://leetcode.com/problems/binary-tree-maximum-path-sum/' },
            { order: 10, title: 'Serialize and Deserialize Binary Tree', diff: 'HARD', topic: 'Binary Tree', lc: 'https://leetcode.com/problems/serialize-and-deserialize-binary-tree/' },
        ]
    },
    {
        order: 14, title: 'Binary Search Trees', total: 7, problems: [
            { order: 1, title: 'Search in BST', diff: 'EASY', topic: 'BST', lc: 'https://leetcode.com/problems/search-in-a-binary-search-tree/' },
            { order: 2, title: 'Insert into BST', diff: 'MEDIUM', topic: 'BST', lc: 'https://leetcode.com/problems/insert-into-a-binary-search-tree/' },
            { order: 3, title: 'Delete Node in BST', diff: 'MEDIUM', topic: 'BST', lc: 'https://leetcode.com/problems/delete-node-in-a-bst/' },
            { order: 4, title: 'Validate Binary Search Tree', diff: 'MEDIUM', topic: 'BST', lc: 'https://leetcode.com/problems/validate-binary-search-tree/' },
            { order: 5, title: 'Kth Smallest in BST', diff: 'MEDIUM', topic: 'BST', lc: 'https://leetcode.com/problems/kth-smallest-element-in-a-bst/' },
            { order: 6, title: 'Lowest Common Ancestor of BST', diff: 'MEDIUM', topic: 'BST', lc: 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/' },
            { order: 7, title: 'Two Sum IV — Input is BST', diff: 'EASY', topic: 'BST', lc: 'https://leetcode.com/problems/two-sum-iv-input-is-a-bst/' },
        ]
    },
    {
        order: 15, title: 'Graphs', total: 12, problems: [
            { order: 1, title: 'BFS of Graph', diff: 'EASY', topic: 'Graph' },
            { order: 2, title: 'DFS of Graph', diff: 'EASY', topic: 'Graph' },
            { order: 3, title: 'Number of Provinces', diff: 'MEDIUM', topic: 'Graph', lc: 'https://leetcode.com/problems/number-of-provinces/' },
            { order: 4, title: 'Number of Islands', diff: 'MEDIUM', topic: 'Graph', lc: 'https://leetcode.com/problems/number-of-islands/' },
            { order: 5, title: 'Flood Fill', diff: 'EASY', topic: 'Graph', lc: 'https://leetcode.com/problems/flood-fill/' },
            { order: 6, title: 'Rotten Oranges', diff: 'MEDIUM', topic: 'Graph', lc: 'https://leetcode.com/problems/rotting-oranges/' },
            { order: 7, title: 'Detect Cycle Undirected Graph', diff: 'MEDIUM', topic: 'Graph' },
            { order: 8, title: 'Detect Cycle Directed Graph', diff: 'MEDIUM', topic: 'Graph' },
            { order: 9, title: 'Topological Sort (DFS)', diff: 'MEDIUM', topic: 'Graph' },
            { order: 10, title: "Topological Sort (Kahn's BFS)", diff: 'MEDIUM', topic: 'Graph' },
            { order: 11, title: "Dijkstra's Algorithm", diff: 'MEDIUM', topic: 'Graph', lc: 'https://leetcode.com/problems/network-delay-time/' },
            { order: 12, title: 'Bellman Ford Algorithm', diff: 'MEDIUM', topic: 'Graph' },
        ]
    },
    {
        order: 16, title: 'Dynamic Programming', total: 12, problems: [
            { order: 1, title: 'Climbing Stairs', diff: 'EASY', topic: 'DP', lc: 'https://leetcode.com/problems/climbing-stairs/' },
            { order: 2, title: 'House Robber', diff: 'MEDIUM', topic: 'DP', lc: 'https://leetcode.com/problems/house-robber/' },
            { order: 3, title: 'House Robber II', diff: 'MEDIUM', topic: 'DP', lc: 'https://leetcode.com/problems/house-robber-ii/' },
            { order: 4, title: 'Longest Common Subsequence', diff: 'MEDIUM', topic: 'DP', lc: 'https://leetcode.com/problems/longest-common-subsequence/' },
            { order: 5, title: 'Longest Increasing Subsequence', diff: 'MEDIUM', topic: 'DP', lc: 'https://leetcode.com/problems/longest-increasing-subsequence/' },
            { order: 6, title: '0/1 Knapsack', diff: 'MEDIUM', topic: 'DP' },
            { order: 7, title: 'Coin Change', diff: 'MEDIUM', topic: 'DP', lc: 'https://leetcode.com/problems/coin-change/' },
            { order: 8, title: 'Coin Change II', diff: 'MEDIUM', topic: 'DP', lc: 'https://leetcode.com/problems/coin-change-ii/' },
            { order: 9, title: 'Unique Paths', diff: 'MEDIUM', topic: 'DP', lc: 'https://leetcode.com/problems/unique-paths/' },
            { order: 10, title: 'Minimum Path Sum', diff: 'MEDIUM', topic: 'DP', lc: 'https://leetcode.com/problems/minimum-path-sum/' },
            { order: 11, title: 'Edit Distance', diff: 'HARD', topic: 'DP', lc: 'https://leetcode.com/problems/edit-distance/' },
            { order: 12, title: 'Partition Equal Subset Sum', diff: 'MEDIUM', topic: 'DP', lc: 'https://leetcode.com/problems/partition-equal-subset-sum/' },
        ]
    },
    {
        order: 17, title: 'Tries', total: 5, problems: [
            { order: 1, title: 'Implement Trie', diff: 'MEDIUM', topic: 'Trie', lc: 'https://leetcode.com/problems/implement-trie-prefix-tree/' },
            { order: 2, title: 'Word Search II', diff: 'HARD', topic: 'Trie', lc: 'https://leetcode.com/problems/word-search-ii/' },
            { order: 3, title: 'Maximum XOR of Two Numbers', diff: 'MEDIUM', topic: 'Trie', lc: 'https://leetcode.com/problems/maximum-xor-of-two-numbers-in-an-array/' },
            { order: 4, title: 'Longest Word with All Prefixes', diff: 'MEDIUM', topic: 'Trie' },
            { order: 5, title: 'Number of Distinct Substrings', diff: 'HARD', topic: 'Trie' },
        ]
    },
    {
        order: 18, title: 'Advanced Strings', total: 5, problems: [
            { order: 1, title: 'Z-Function', diff: 'MEDIUM', topic: 'String' },
            { order: 2, title: 'KMP / LPS Array', diff: 'HARD', topic: 'String' },
            { order: 3, title: 'Shortest Palindrome', diff: 'HARD', topic: 'String', lc: 'https://leetcode.com/problems/shortest-palindrome/' },
            { order: 4, title: 'Longest Happy Prefix', diff: 'HARD', topic: 'String', lc: 'https://leetcode.com/problems/longest-happy-prefix/' },
            { order: 5, title: 'Minimum Characters to Make Palindrome', diff: 'HARD', topic: 'String' },
        ]
    },
];

async function seedRoadmap() {
    let chapterCount = 0;
    let problemCount = 0;

    // Fetch all practice problems to try and link them
    const practiceProblems = await prisma.problem.findMany();

    for (const ch of CHAPTERS) {
        try {
            // Find or create chapter by order field (avoids UUID string issue)
            let chapter = await prisma.roadmapChapter.findFirst({ where: { order: ch.order } });
            if (!chapter) {
                chapter = await prisma.roadmapChapter.create({
                    data: { order: ch.order, title: ch.title, totalProblems: ch.total },
                });
            } else {
                await prisma.roadmapChapter.update({
                    where: { id: chapter.id },
                    data: { title: ch.title, totalProblems: ch.total },
                });
            }
            chapterCount++;

            for (const p of ch.problems) {
                // Try to find a matching interactive problem
                const match = practiceProblems.find(pp =>
                    pp.title.toLowerCase() === p.title.toLowerCase() ||
                    pp.title.toLowerCase().includes(p.title.toLowerCase()) ||
                    p.title.toLowerCase().includes(pp.title.toLowerCase())
                );

                const existing = await prisma.roadmapProblem.findFirst({
                    where: { chapterId: chapter.id, order: p.order },
                });

                if (!existing) {
                    await prisma.roadmapProblem.create({
                        data: {
                            chapterId: chapter.id,
                            order: p.order,
                            title: p.title,
                            difficulty: p.diff as any,
                            topic: p.topic,
                            leetcodeUrl: (p as any).lc ?? null,
                            problemId: match?.id ?? null
                        },
                    });
                } else if (match && !existing.problemId) {
                    // Update existing to link it
                    await prisma.roadmapProblem.update({
                        where: { id: existing.id },
                        data: { problemId: match.id }
                    });
                }
                problemCount++;
            }
        } catch (e) {
            console.error(`Error seeding chapter "${ch.title}":`, e);
        }
    }
    console.log(`✅ ${chapterCount} chapters, ${problemCount} roadmap problems seeded`);
}

async function main() {
    console.log('🌱 Starting seed...');
    await seedProblems();
    await seedRoadmap();
    await prisma.$disconnect();
    console.log('🎉 Seed complete!');
}

main().catch(e => { console.error(e); process.exit(1); });
