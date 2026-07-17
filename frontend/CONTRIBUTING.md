# Contributing Guide

## Development Standards

### Code Style

This project uses ESLint for code quality. Before submitting:

```bash
# Check for linting issues
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### Component Guidelines

#### Functional Components

Always use functional components with hooks:

```jsx
import { useState } from 'react';
import logger from '@/utils/logger';

const MyComponent = ({ title, onAction }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async () => {
    try {
      setIsLoading(true);
      // Do something
      logger.info('Action completed');
    } catch (error) {
      logger.error('Action failed', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1>{title}</h1>
      <button onClick={handleAction} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Click me'}
      </button>
    </div>
  );
};

export default MyComponent;
```

#### Component Organization

```
src/components/
├── ComponentName/
│   ├── index.jsx          # Main component
│   ├── ComponentName.css   # Component styles (if needed)
│   └── hooks/              # Component-specific hooks
```

### State Management

#### Redux for Global State

Use Redux for:
- Authentication state
- User preferences
- App-wide notifications
- Settings

#### RTK Query for Server State

Use RTK Query for:
- API data fetching
- Caching
- Synchronization
- Mutations

Example:

```javascript
// src/store/api/features/itemApi.js
import { baseApi } from '../baseApi';

export const itemApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Query: GET request
    getItems: builder.query({
      query: ({ page = 1, limit = 10 } = {}) => ({
        url: '/items',
        params: { page, limit },
      }),
      providesTags: ['Items'],
    }),

    // Mutation: POST request
    createItem: builder.mutation({
      query: (itemData) => ({
        url: '/items',
        method: 'POST',
        body: itemData,
      }),
      invalidatesTags: ['Items'],
      // Transform response for UI
      transformResponse: (response) => ({
        ...response,
        createdAt: new Date(),
      }),
    }),

    // Mutation: PUT request
    updateItem: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/items/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Items'],
    }),

    // Mutation: DELETE request
    deleteItem: builder.mutation({
      query: (id) => ({
        url: `/items/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Items'],
    }),
  }),
});

export const {
  useGetItemsQuery,
  useCreateItemMutation,
  useUpdateItemMutation,
  useDeleteItemMutation,
} = itemApi;
```

### Error Handling

#### In Components

```jsx
import { useState } from 'react';
import logger from '@/utils/logger';

const MyComponent = () => {
  const [error, setError] = useState(null);

  const handleAction = async () => {
    try {
      // Do something
    } catch (error) {
      logger.error('Operation failed', error);
      setError(error.message);
    }
  };

  return (
    <div>
      {error && <div className="error">{error}</div>}
      {/* Component content */}
    </div>
  );
};
```

#### In API Calls

The `baseQuery` handles:
- Network errors with retry logic
- 401/403 authentication errors
- Error logging

No additional error handling needed in most cases.

### Logging

Use the logger utility for all logging:

```javascript
import logger from '@/utils/logger';

// Info - important user actions
logger.info('User logged in', { userId: 123 });

// Warn - potentially problematic situations
logger.warn('Cache miss for user data', { userId: 123 });

// Error - errors that need attention
logger.error('Failed to fetch user data', error);

// Debug - detailed debugging info (dev only)
logger.debug('Component mounted', { props });

// Log - general logging (dev only)
logger.log('Processing data', { count: 100 });
```

### Testing

Create tests for:
- Complex logic
- Critical features (auth, payments)
- Utility functions
- Custom hooks

```bash
# Run tests (when added)
npm run test

# Run tests in watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Commit Messages

Follow conventional commits:

```
feat: add new feature
fix: fix a bug
docs: update documentation
style: formatting changes
refactor: code refactoring
perf: performance improvements
test: add/update tests
chore: maintenance tasks
```

Examples:
```
feat: add user authentication
fix: resolve token refresh issue
docs: update API documentation
refactor: extract auth logic to custom hook
```

### Pull Request Process

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit with meaningful messages
3. Test your changes: `npm run lint && npm run test`
4. Push to repository: `git push origin feature/my-feature`
5. Create Pull Request with description
6. Address review comments
7. Merge when approved

### File Naming

- **Components**: PascalCase (e.g., `UserProfile.jsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth.js`)
- **Utilities**: camelCase (e.g., `formatDate.js`)
- **Styles**: matching component name (e.g., `UserProfile.css`)

### Performance

#### Code Splitting

Use lazy loading for routes:

```jsx
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./Dashboard'));

// In router
<Suspense fallback={<Loading />}>
  <Dashboard />
</Suspense>
```

#### Memoization

Memoize expensive components:

```jsx
import { memo } from 'react';

const UserCard = memo(({ user }) => {
  return <div>{user.name}</div>;
});

export default UserCard;
```

#### Hooks Optimization

Use proper dependency arrays:

```jsx
// BAD: Missing dependency
useEffect(() => {
  fetchUser(userId);
}, []); // Missing userId

// GOOD: Complete dependencies
useEffect(() => {
  fetchUser(userId);
}, [userId]);
```

### Accessibility

- Use semantic HTML
- Add alt text to images
- Ensure keyboard navigation
- Use proper ARIA labels
- Test with screen readers

```jsx
<button aria-label="Close menu" onClick={close}>
  ✕
</button>
```

### Security

- Never commit sensitive data (.env secrets)
- Validate user input
- Use HTTPS in production
- Sanitize API responses
- Keep dependencies updated

```bash
# Check for vulnerabilities
npm audit

# Update dependencies
npm update
```

## Questions?

- Check the SETUP.md for configuration
- Review existing components for patterns
- Check official documentation links
- Ask in issues or discussions

---

Thank you for contributing! 🚀
