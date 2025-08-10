# Claude Code Instructions

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md

## Testing Requirements

### Definition of Done for Tasks
Before marking any task as "done", ensure:

1. **Unit tests are implemented** - All components have corresponding unit tests with proper mocking
2. **Tests are passing** - Run `npm test` to verify all tests pass
3. **Coverage includes error handling** - Test both success and failure scenarios
4. **Integration tests where specified** - For services that interact with external APIs

### Test Structure
```
tests/
├── unit/           # Unit tests with mocks
├── integration/    # Integration tests with real services  
├── fixtures/       # Test data and mock responses
└── setup/          # Test configuration and helpers
```

### Testing Commands
- `npm test` - Run all tests
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:coverage` - Generate coverage report

### Test Implementation Priority
1. **Services** - Jenkins client, job tracker, webhook handler
2. **MCP Tools** - All four MCP tool implementations
3. **Utilities** - Logger, validation, error handling
4. **Integration** - End-to-end MCP communication flow

5. **Before you begin working, check in with me and I will verify the plan.**

6. **Give high-level explanations at each step** - detailed progress goes in TaskMaster subtasks

7. **Simplicity principle:** Every change should impact minimal code. Small functions with unit tests.

8. **Final review section** in the todo_${seq}.md file with summary of changes.

## Context7 MCP Integration
- Context7 MCP is configured in .mcp.json and provides access to the latest documentation
- Use it for checking current best practices, security recommendations, and implementation patterns
- Always consult latest documentation before implementing new features or making architectural decisions