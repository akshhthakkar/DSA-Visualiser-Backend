export type StepType =
    | 'POINTER'
    | 'COMPARE'
    | 'FOUND'
    | 'RETURN'
    | 'READ'
    | 'COMPUTE'
    | 'CREATE_NODE'
    | 'LINK'
    | 'MOVE_POINTER'
    | 'MUTATE_GRID' // NEW
    | 'DFS_CALL'    // NEW
    | 'ISLAND_DISCOVERED' // NEW: For persistent count updates
    | 'SWAP' // NEW
    | 'CHECK_SORTED' // NEW for #33
    | 'DISCARD_HALF' // NEW for #33
    | 'UPDATE' // NEW for #53
    | 'RESET' // NEW for #53
    // LeetCode 128 - Longest Consecutive Sequence
    | 'INIT_SET'
    | 'ADD_TO_SET'
    | 'CHECK_START'
    | 'START_SEQUENCE'
    | 'EXPAND'
    | 'SEQUENCE_END'
    | 'UPDATE_MAX'
    | 'MARK_DONE'
    | 'SKIP'
    | 'INITIALIZE' // NEW for #5
    // LeetCode 152 - Maximum Product Subarray
    | 'INIT'
    | 'SELECT'
    | 'CANDIDATES' // NEW: For showing computation candidates
    | 'SWAP'
    // LeetCode 560 - Subarray Sum
    | 'PROCESS'
    | 'LOOKUP'
    | 'UPDATE_MAP'
    // LeetCode 387 - First Unique Character
    | 'START'
    | 'COUNT_CHAR'
    | 'CHECK_FREQ'
    | 'NO_UNIQUE'
    // LeetCode 125 - Valid Palindrome
    // 'INIT' is already defined
    | 'SKIP_LEFT'
    | 'SKIP_RIGHT'
    // 'COMPARE' is already defined
    | 'MATCH'
    | 'MISMATCH'
    | 'SUCCESS'
    | 'MATCH'
    | 'MISMATCH'
    | 'SUCCESS'
    | 'MOVE'
    // LeetCode 443 - String Compression
    | 'START_GROUP'
    | 'COUNT'
    | 'WRITE_CHAR'
    | 'WRITE_COUNT'
    | 'PUSH'
    | 'POP'
    // LeetCode 28 - strStr
    | 'START_WINDOW'
    | 'MOVE_WINDOW'
    | 'FAIL'
    | 'LPS_COMPUTE'
    // LeetCode 49 - Group Anagrams
    | 'READ_STRING'
    | 'GENERATE_KEY'
    | 'MAP_LOOKUP'
    | 'CREATE_GROUP'
    | 'ADD_TO_GROUP'
    // LeetCode 151 - Reverse Words in a String
    | 'SCAN'
    | 'START_WORD'
    | 'END_WORD'
    | 'PUSH_WORD'
    | 'SKIP_SPACE'
    | 'REVERSE_ORDER'
    // LeetCode 1143 - Longest Common Subsequence
    | 'TAKE_TOP'
    | 'TAKE_LEFT'
    | 'UPDATE_CELL'
    // LeetCode 97 - Interleaving String
    | 'COMPARE_S1'
    | 'COMPARE_S2'
    | 'MATCH_S1'
    | 'MATCH_S2'
    | 'SET_TRUE'
    | 'SET_FALSE'
    | 'TAKE_DIAGONAL'
    // LeetCode 430 - Flatten Multilevel Doubly Linked List
    | 'VISIT_NODE'
    | 'FOUND_CHILD'  // Changed from DETECT_CHILD to match usage
    | 'DESCEND_CHILD'
    | 'REWIRE_NEXT'
    | 'REWIRE_PREV' // Not used in engine but good to have
    | 'NULLIFY_CHILD' // Changed from REMOVE_CHILD to match usage
    | 'RETURN_PARENT' // Changed from RETURN_TO_PARENT to match usage
    | 'MOVE_FORWARD' // Changed from CONTINUE to match usage
    | 'COMPLETE' // Added for Problem 430 completion step
    // LeetCode 206 - Reverse Linked List
    | 'SET_NEXT'
    | 'REVERSE_LINK'
    | 'MOVE_PREV'
    | 'MOVE_CURR'
    | 'UPDATE_HEAD'
    // Recursive Linked List
    | 'CALL_RECURSION'
    | 'BASE_CASE'
    | 'RETURN_FROM_CALL'
    | 'BREAK_LINK'
    | 'RETURN_HEAD'
    // LeetCode 215 - Kth Largest Element (Quickselect)
    | 'SELECT_PIVOT'
    | 'PARTITION_DONE'
    | 'MOVE_LEFT'
    | 'MOVE_RIGHT'
    | 'NARROW_RANGE'
    // LeetCode 876 - Middle of Linked List
    | 'CHECK_CONDITION'
    | 'MOVE_SLOW'
    | 'MOVE_FAST'
    | 'FOUND_MIDDLE'
    // LeetCode 21 - Merge Two Sorted Lists
    | 'ATTACH_NODE'
    | 'MOVE_L1'
    | 'MOVE_L2'
    | 'MOVE_MERGED'
    | 'ATTACH_REMAINING'
    // LeetCode 19 - Remove Nth Node From End
    | 'ADVANCE_FAST'
    | 'CHECK_GAP'
    | 'MOVE_BOTH'
    | 'IDENTIFY_TARGET'
    | 'REMOVE_NODE'
    // LeetCode 234 - Palindrome Linked List
    | 'SEGMENTATION'
    | 'START_REVERSAL'
    | 'REVERSE_LINK'
    | 'MOVE_REVERSE_PTR'
    | 'SETUP_COMPARISON'
    | 'RESTORE_LINK'
    | 'SUCCESS_CONFIRMATION'
    // LeetCode 61 - Rotate List
    | 'COUNT_LENGTH'
    | 'MODULO_K'
    | 'MAKE_CYCLE'
    | 'FIND_NEW_TAIL'
    | 'IDENTIFY_NEW_HEAD'
    | 'BREAK_CYCLE'
    | 'HOLD_FINAL_STATE'
    // LeetCode 160 - Intersection of Two Linked Lists
    | 'NO_INTERSECTION'
    | 'INTERSECTION_FOUND'
    // LeetCode 138 - Copy List with Random Pointer
    | 'INTERLEAVE_START'
    | 'CREATE_COPY'
    | 'INSERT_COPY_AFTER_ORIGINAL'
    | 'LINK_COPY_INLINE'
    | 'ASSIGN_RANDOM_START'
    | 'ASSIGN_RANDOM_HIGHLIGHT_SRC'
    | 'ASSIGN_RANDOM_HIGHLIGHT_TARGET'
    | 'ASSIGN_RANDOM_SHOW_ARROW'
    | 'SEPARATE_START'
    | 'RESTORE_ORIGINAL_NEXT'
    | 'EXTRACT_COPY_LIST'
    | 'DEEP_COPY_COMPLETE'
    // LeetCode 24 - Swap Nodes in Pairs
    | 'IDENTIFY_PAIR'
    | 'DETACH_LINKS'
    | 'SWAP_PAIR'
    | 'RECONNECT'
    | 'SKIP_LAST'
    // BFS Traversal (Graph problems)
    | 'ENQUEUE'
    | 'DEQUEUE'
    | 'EDGE_CLASSIFY'
    | 'DONE'
    // DFS Traversal
    | 'DISCOVER'
    | 'FINISH'
    // Cycle Detection (Union-Find & DFS)
    | 'PROCESSING_EDGE'
    | 'UNION'
    | 'CYCLE_DETECTED'
    | 'CHECK_NEIGHBOR'
    | 'TREE_EDGE'
    | 'CROSS_EDGE'
    | 'BACKTRACK'
    | 'START_DFS'
    // Dijkstra's Algorithm
    | 'SETTLE'
    | 'RELAX'
    | 'SKIP'
    | 'heap_step';


export interface Step {
    title?: string // Step title for clear phase structure
    type: StepType
    // Array specific
    indices?: number[] // Can also hold [row, col] for grid
    targetIndex?: number

    // Linked List specific
    pointers?: {
        l1?: number | null // Index/ID of node l1 is pointing to
        l2?: number | null
        tail?: number | null
        curr?: number | null
        left?: number // Sliding window left
        right?: number // Sliding window right

        // Binary Search / Median Pointers
        low?: number
        high?: number
        partitionX?: number
        partitionY?: number
        maxLeftX?: number
        minRightX?: number
        maxLeftY?: number
        minRightY?: number
        mid?: number // Added for Sort Colors
        current?: number // Added for Problem 560 - Subarray Sum
    }
    // For Multi-Array steps
    rowHighlights?: { [rowIndex: number]: number[] }
    values?: {
        digit1?: number
        digit2?: number
        sum?: number
        digit?: number
        carry?: number
    }
    index?: number // Index in result list
    source?: number // Source index for LINK
    target?: number // Target index for LINK
    newNodeVal?: number // For CREATE_NODE

    // Common
    value?: number | string | boolean
    message?: string  // Made optional - can use description instead
    highlight?: boolean
    line?: number

    // Generic extensions
    customValues?: Record<string, any> // Flexible storage for things like islandCount
    codeLineMap?: Partial<Record<SupportedLanguage, readonly [number, number]>> // Multi-language line mapping
    description?: string | string[] // For Classroom Mode step-by-step explanations (supports arrays for clean line breaks)
    metadata?: Record<string, any> // For problem-specific metadata (e.g., character frequencies)

    // Two Pointer Specific (Problem 125)
    leftIndex?: number
    rightIndex?: number
    leftChar?: string
    rightChar?: string
    char?: string // For single char actions like SKIP_LEFT

    // Palindrome Specific (Problem 5)
    range?: [number, number] // [start, end] for longest palindrome found
}

export type SupportedLanguage = 'java' | 'cpp' | 'c' | 'python';

export type AlgorithmVariant = {
    id: string
    label: string
    code: Partial<Record<SupportedLanguage, string>> // Changed from string to Record
    // Generalized run function: accepts any input, returns Steps
    run: (input: any, ...args: any[]) => Step[]
}

// Helper for Linked List algorithms
export class ListNode {
    val: number
    next: ListNode | null
    id: string // Visual ID

    constructor(val?: number, next?: ListNode | null) {
        this.val = (val === undefined ? 0 : val)
        this.next = (next === undefined ? null : next)
        this.id = Math.random().toString(36).substr(2, 9)
    }
}
