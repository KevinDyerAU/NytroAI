import { AuthLayout } from '../components/auth/AuthLayout';
import { LoginForm } from '../components/auth/LoginForm';

export function LoginPage() {
  return (
    <AuthLayout
      title="Sign In"
      subtitle="Welcome back to Nytro"
    >
      <LoginForm />
    </AuthLayout>
  );
}
