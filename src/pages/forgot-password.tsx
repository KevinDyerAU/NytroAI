import { AuthLayout } from '../components/auth/AuthLayout';
import { ForgotPasswordForm } from '../components/auth/ForgotPasswordForm';

export function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Reset Password"
      subtitle="We'll help you get back into your account"
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
