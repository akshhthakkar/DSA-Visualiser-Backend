# @dsa-visualizer/shared

Shared TypeScript types, constants, and utilities used across frontend and backend packages.

## Structure

```
shared/
├── src/
│   ├── types/           # TypeScript type definitions
│   ├── constants/       # Shared constants
│   ├── utils/          # Shared utility functions
│   └── index.ts        # Main export file
```

## Usage

### In Frontend
```typescript
import { Algorithm, Step } from '@shared/types'
```

### In Backend
```typescript
import { LeetCodeProblem } from '@shared/types'
```

## Development

```bash
# Build
npm run build

# Type check
npm run type-check
```
