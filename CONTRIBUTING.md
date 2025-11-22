# Contributing to NytroAI

Thank you for your interest in contributing to NytroAI! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please be respectful and professional in all interactions.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue on GitHub with the following information:

- Clear description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Environment details (browser, OS, etc.)

### Suggesting Features

We welcome feature suggestions! Please create an issue with:

- Clear description of the feature
- Use case and benefits
- Proposed implementation (if applicable)

### Submitting Pull Requests

We follow a standard fork-and-pull-request workflow. Here's how to contribute code:

#### 1. Fork and Clone

Fork the repository on GitHub and clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/NytroAI.git
cd NytroAI
```

#### 2. Create a Branch

Create a feature branch for your changes:

```bash
git checkout -b feature/your-feature-name
```

Use descriptive branch names:
- `feature/` for new features
- `fix/` for bug fixes
- `docs/` for documentation updates
- `refactor/` for code refactoring

#### 3. Make Changes

Make your changes following our coding standards (see below). Ensure your code:

- Follows the existing code style
- Includes appropriate comments
- Has no linting errors
- Passes all tests

#### 4. Test Your Changes

Run the test suite to ensure everything works:

```bash
npm test
npm run test:integration
```

#### 5. Commit Your Changes

Write clear, descriptive commit messages following the Conventional Commits specification:

```bash
git commit -m "feat: add new validation type for learner guides"
git commit -m "fix: resolve column name mismatch in validation trigger"
git commit -m "docs: update installation guide with Supabase setup"
```

Commit types:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

#### 6. Push and Create Pull Request

Push your changes to your fork:

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub with:

- Clear title and description
- Reference to related issues
- Screenshots (if applicable)
- Testing notes

## Coding Standards

### TypeScript

We use TypeScript for type safety. All new code should be properly typed with no `any` types unless absolutely necessary.

**Good:**
```typescript
interface ValidationResult {
  status: 'pass' | 'fail' | 'partial';
  score: number;
  summary: string;
}

function validateAssessment(data: ValidationResult): boolean {
  return data.status === 'pass' && data.score >= 80;
}
```

**Avoid:**
```typescript
function validateAssessment(data: any): any {
  return data.status === 'pass';
}
```

### Code Style

We use ESLint and Prettier for code formatting. Run before committing:

```bash
npm run lint
npm run format
```

### Naming Conventions

**Database Columns:** Use snake_case
```typescript
// ✅ Correct
const { data } = await supabase
  .from('validation_detail')
  .select('doc_extracted, extract_status');

// ❌ Incorrect
const { data } = await supabase
  .from('validation_detail')
  .select('docExtracted, extractStatus');
```

**TypeScript/JavaScript:** Use camelCase for variables and functions, PascalCase for components and classes
```typescript
// ✅ Correct
const validationResult = getValidationStatus();
class ValidationService { }
function MyComponent() { }

// ❌ Incorrect
const validation_result = getValidationStatus();
class validation_service { }
function my_component() { }
```

### Comments

Write clear, helpful comments for complex logic:

```typescript
// ✅ Good comment
// Check if all documents are indexed before triggering validation
// This prevents validation from running on incomplete data
if (!validationDetail.doc_extracted || !validationDetail.file_search_store_id) {
  return createErrorResponse('Documents not yet indexed');
}

// ❌ Unnecessary comment
// Set x to 5
const x = 5;
```

## Project Structure

Understanding the project structure will help you navigate the codebase:

```
NytroAI/
├── src/
│   ├── components/       # React components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility libraries
│   ├── pages/           # Page components
│   ├── services/        # Business logic services
│   ├── store/           # State management
│   └── types/           # TypeScript type definitions
├── supabase/
│   ├── functions/       # Edge functions
│   └── migrations/      # Database migrations
├── docs/                # Documentation
└── public/             # Static assets
```

## Testing

We value well-tested code. When adding new features, please include:

### Unit Tests

Test individual functions and components:

```typescript
import { validateAssessment } from './validation';

describe('validateAssessment', () => {
  it('should return true for passing validation', () => {
    const result = { status: 'pass', score: 85, summary: 'Good' };
    expect(validateAssessment(result)).toBe(true);
  });
});
```

### Integration Tests

Test interactions between components and services:

```typescript
describe('Validation Workflow', () => {
  it('should trigger validation after document upload', async () => {
    // Test complete workflow
  });
});
```

## Documentation

Good documentation is essential. When contributing:

- Update relevant documentation files
- Add JSDoc comments to functions
- Update the README if adding features
- Create or update guides in `docs/guides/`

## Getting Help

If you need help with your contribution:

- Check existing documentation in `docs/`
- Review closed pull requests for examples
- Ask questions in GitHub Discussions
- Create a draft pull request for early feedback

## Review Process

All pull requests go through a review process:

1. **Automated Checks** - Linting, tests, build
2. **Code Review** - Maintainer reviews code quality
3. **Testing** - Manual testing of changes
4. **Approval** - Maintainer approves and merges

Please be patient during the review process and be open to feedback and suggestions.

## License

By contributing to NytroAI, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to NytroAI! 🎉
