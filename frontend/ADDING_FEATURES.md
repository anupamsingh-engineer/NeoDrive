# Adding Features to Your React Template

This guide walks you through adding common features to the template.

## 1. Adding a New API Endpoint

### Step 1: Create API Slice

Create `src/store/api/features/userApi.js`:

```javascript
import { baseApi } from '../baseApi';

export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Get all users
    getAllUsers: builder.query({
      query: () => '/users',
      providesTags: ['Users'],
    }),

    // Get user by ID
    getUser: builder.query({
      query: (userId) => `/users/${userId}`,
      providesTags: (result, error, userId) => [{ type: 'Users', id: userId }],
    }),

    // Update user
    updateUser: builder.mutation({
      query: ({ userId, ...data }) => ({
        url: `/users/${userId}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Users'],
    }),

    // Delete user
    deleteUser: builder.mutation({
      query: (userId) => ({
        url: `/users/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Users'],
    }),
  }),
});

export const {
  useGetAllUsersQuery,
  useGetUserQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
} = userApi;
```

### Step 2: Use in Component

```jsx
import { useGetAllUsersQuery, useDeleteUserMutation } from '@/store/api/features/userApi';
import logger from '@/utils/logger';

const UsersPage = () => {
  const { data: users, isLoading, error } = useGetAllUsersQuery();
  const [deleteUser] = useDeleteUserMutation();

  const handleDelete = async (userId) => {
    try {
      await deleteUser(userId).unwrap();
      logger.info('User deleted', { userId });
    } catch (err) {
      logger.error('Delete failed', err);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {users?.map(user => (
        <div key={user.id}>
          {user.name}
          <button onClick={() => handleDelete(user.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
};

export default UsersPage;
```

## 2. Adding a New Page

### Step 1: Create Page Component

Create `src/pages/app/users/index.jsx`:

```jsx
import { useState } from 'react';
import { useGetAllUsersQuery } from '@/store/api/features/userApi';
import logger from '@/utils/logger';

const UsersPage = () => {
  const { data: users, isLoading, error } = useGetAllUsersQuery();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users?.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  if (error) {
    logger.error('Failed to load users', error);
    return <div>Error loading users</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>Users</h1>

      <input
        type="text"
        placeholder="Search users..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          padding: '8px',
          marginBottom: '20px',
          width: '100%',
          maxWidth: '300px',
        }}
      />

      {isLoading ? (
        <div>Loading users...</div>
      ) : (
        <div>
          {filteredUsers.map(user => (
            <div key={user.id} style={{
              padding: '10px',
              border: '1px solid #ddd',
              marginBottom: '10px',
              borderRadius: '4px',
            }}>
              <h3>{user.name}</h3>
              <p>{user.email}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UsersPage;
```

### Step 2: Add Route

Edit `src/router/routes/PrivateRoutes.jsx`:

```jsx
const Users = React.lazy(() => import("../../pages/app/users"));

const AppPageRouter = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route path="dashboard" element={<Dashboard />} index />
          <Route path="users" element={<Users />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Suspense>
  );
};
```

## 3. Adding Global State (Redux Slice)

### Create Auth User Slice

Create `src/store/slices/userSlice.js`:

```javascript
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null,
  preferences: {
    theme: 'light',
    language: 'en',
  },
  loading: false,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
    },
    updatePreferences: (state, action) => {
      state.preferences = { ...state.preferences, ...action.payload };
    },
    clearUser: (state) => {
      state.user = null;
      state.preferences = initialState.preferences;
    },
  },
});

export const { setUser, updatePreferences, clearUser } = userSlice.actions;
export const selectUser = (state) => state.user.user;
export const selectPreferences = (state) => state.user.preferences;

export default userSlice.reducer;
```

### Register in Root Reducer

Edit `src/store/rootReducer.js`:

```javascript
import userReducer from './slices/userSlice';

const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  auth: authReducer,
  user: userReducer, // Add this
});
```

### Use in Component

```jsx
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, setUser } from '@/store/slices/userSlice';

const Profile = () => {
  const user = useSelector(selectUser);
  const dispatch = useDispatch();

  const handleUpdate = (newData) => {
    dispatch(setUser(newData));
  };

  return <div>{user?.name}</div>;
};
```

## 4. Adding a Custom Hook

Create `src/hooks/useUserProfile.js`:

```javascript
import { useGetUserQuery } from '@/store/api/features/userApi';
import { useSelector } from 'react-redux';
import { selectAuthState } from '@/store/slices/authSlice';
import logger from '@/utils/logger';

/**
 * Custom hook to manage user profile
 * @returns {Object} User profile data and utilities
 */
export const useUserProfile = () => {
  const authState = useSelector(selectAuthState);
  const { data: profile, isLoading, error, refetch } = useGetUserQuery(
    authState.user?.id,
    { skip: !authState.user?.id }
  );

  const reload = async () => {
    try {
      await refetch();
      logger.info('Profile reloaded');
    } catch (err) {
      logger.error('Failed to reload profile', err);
    }
  };

  return {
    profile,
    isLoading,
    error,
    reload,
  };
};
```

Use in component:

```jsx
import { useUserProfile } from '@/hooks/useUserProfile';

const ProfilePage = () => {
  const { profile, isLoading } = useUserProfile();

  if (isLoading) return <div>Loading...</div>;

  return <div>{profile?.name}</div>;
};
```

## 5. Adding Form Validation

### Using Zod (recommended)

```bash
npm install zod
```

Create `src/utils/validators.js`:

```javascript
import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const userSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  age: z.number().min(18, 'Must be 18 or older'),
});
```

Use in form:

```jsx
import { useState } from 'react';
import { loginSchema } from '@/utils/validators';
import logger from '@/utils/logger';

const LoginForm = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();

    try {
      const validated = loginSchema.parse(formData);
      logger.info('Form valid, submitting...');
      // Submit form
    } catch (error) {
      const fieldErrors = {};
      error.errors.forEach((err) => {
        fieldErrors[err.path[0]] = err.message;
      });
      setErrors(fieldErrors);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.username}
        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
      />
      {errors.username && <span>{errors.username}</span>}
      {/* More fields */}
      <button type="submit">Login</button>
    </form>
  );
};
```

## 6. Adding Protected Sub-Routes

Create `src/components/common/PrivateRoute.jsx`:

```jsx
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectAuthState } from '@/store/slices/authSlice';

const PrivateRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, user } = useSelector(selectAuthState);

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/app/dashboard" />;
  }

  return children;
};

export default PrivateRoute;
```

Use in router:

```jsx
<Route path="admin" element={
  <PrivateRoute requiredRole="admin">
    <AdminPanel />
  </PrivateRoute>
} />
```

## 7. Adding Error Notifications

Create a notification context (when UI library is added):

```jsx
// src/contexts/NotificationContext.jsx
import { createContext, useState, useCallback } from 'react';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback(({ type, message, duration = 3000 }) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, type, message }]);

    if (duration) {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, duration);
    }

    return id;
  }, []);

  return (
    <NotificationContext.Provider value={{ addNotification, notifications }}>
      {children}
    </NotificationContext.Provider>
  );
};
```

## 8. Adding Environment-Specific Configuration

Edit `.env.production`:

```env
VITE_API_BASE_URL=https://api.production.com
VITE_API_TIMEOUT=30000
VITE_APP_NAME=Production App
VITE_SOURCEMAP=false
```

Access in code:

```javascript
const apiUrl = import.meta.env.VITE_API_BASE_URL;
const isDev = import.meta.env.DEV;
const isProd = import.meta.env.PROD;
```

## 9. Adding Middleware for API Interceptors

Create `src/store/middleware/apiInterceptor.js`:

```javascript
export const apiInterceptor = (store) => (next) => (action) => {
  // Log API calls
  if (action.type.startsWith('api/')) {
    console.log('API Action:', action.type);
  }

  return next(action);
};
```

Register in store:

```javascript
const store = configureStore({
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(baseApi.middleware, loggingMiddleware, apiInterceptor),
});
```

## 10. Testing Examples

When adding tests, use this pattern:

```javascript
// src/pages/app/users/Users.test.jsx
import { render, screen } from '@testing-library/react';
import UsersPage from './index';

describe('UsersPage', () => {
  it('renders loading state', () => {
    render(<UsersPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
```

---

## Best Practices Summary

✅ **Do:**
- Use custom hooks for shared logic
- Create API endpoints using RTK Query
- Log important actions
- Handle errors explicitly
- Use environment variables for config
- Keep components small and focused
- Test critical features

❌ **Don't:**
- Mix API and Redux state
- Create too many Redux slices
- Ignore errors
- Hardcode values
- Create god components
- Mix concerns in components

For more examples, refer to existing components in the project!
