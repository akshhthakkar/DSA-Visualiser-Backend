import type { AlgorithmVariant } from './Algorithm'

export type Difficulty = 'Easy' | 'Medium' | 'Hard'
export type Tag = 'Array' | 'Hash Table' | 'Stack' | 'Queue' | 'Linked List' | 'Tree' | 'Graph' | 'Heap' | 'String' | 'Dynamic Programming' | 'Two Pointers' | 'Math' | 'Recursion' | 'Sliding Window' | 'Binary Search' | 'Divide and Conquer' | 'BFS' | 'DFS' | 'Sorting' | 'Prefix Sum' | 'Backtracking'

export interface LeetCodeProblem {
    id: string
    leetcodeId: number // OFFICIAL ID
    title: string
    difficulty: Difficulty
    tags: Tag[]
    description: string
    inputDescription?: string
    outputDescription?: string
    examples?: {
        input: string
        output: string
        explanation?: string
    }[]
    constraints?: string[]
    variants?: Record<string, AlgorithmVariant> // Optional for lazy loading lists
    defaultInput: string
    defaultTarget?: number
    requiresTarget?: boolean
    visualizerType?: 'array-default' | 'array-isolated' | 'linked-list' | 'island-grid'
    leetcodeUrl?: string
}
