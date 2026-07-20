import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Key, Mail, ShieldAlert, ArrowLeft } from 'lucide-react';
import apiClient from '../../lib/api-client.js';
import { useToast } from '../../components/ui/toast.js';
import { Button, Input } from '../../components/ui/index.js';

const forgotSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const resetSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
});

type ForgotForm = z.infer<typeof forgotSchema>;
type ResetForm = z.infer<typeof resetSchema>;

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mockToken, setMockToken] = useState<string | null>(null);

  const forgotForm = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
  });

  const resetForm = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
  });

  const onForgotSubmit = async (data: ForgotForm) => {
    setIsSubmitting(true);
    try {
      const res = await apiClient.post('/auth/forgot-password', data);
      toast('Verification token generated!', 'success');
      if (res.data.mockResetToken) {
        setMockToken(res.data.mockResetToken);
        resetForm.setValue('token', res.data.mockResetToken);
      }
      setStep(2);
    } catch (err: any) {
      toast(err.response?.data?.error || 'Request failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onResetSubmit = async (data: ResetForm) => {
    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/reset-password', data);
      toast('Password updated successfully!', 'success');
      navigate('/login');
    } catch (err: any) {
      toast(err.response?.data?.error || 'Password reset failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 overflow-hidden">
      {/* Background neon dots */}
      <div className="glow-spot top-[-100px] left-[-100px]" />
      <div className="glow-spot bottom-[-100px] right-[-100px] bg-gradient-to-tr from-pink-500/10 to-indigo-500/10" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="glass w-full max-w-md rounded-2xl p-8 border border-white/20 shadow-2xl relative z-10"
      >
        <Link to="/login" className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground mb-6 transition">
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Login
        </Link>

        {step === 1 ? (
          <div>
            <div className="text-center mb-8">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-4 shadow-md shadow-primary/20">
                <Mail className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground font-sans">Reset Password</h1>
              <p className="text-sm text-muted-foreground mt-2 font-sans">
                Enter your email and we'll generate a password reset token
              </p>
            </div>

            <form onSubmit={forgotForm.handleSubmit(onForgotSubmit)} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
                    <Mail className="h-4.5 w-4.5" />
                  </span>
                  <Input
                    type="email"
                    className="pl-10"
                    placeholder="you@example.com"
                    {...forgotForm.register('email')}
                  />
                </div>
                {forgotForm.formState.errors.email && (
                  <p className="flex items-center text-xs text-rose-500 mt-1.5 font-medium">
                    <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                    {forgotForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <Button type="submit" variant="primary" className="w-full font-semibold" disabled={isSubmitting}>
                {isSubmitting ? 'Generating token...' : 'Generate Reset Token'}
              </Button>
            </form>
          </div>
        ) : (
          <div>
            <div className="text-center mb-8">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground mb-4 shadow-md shadow-primary/20">
                <Key className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground font-sans">Set New Password</h1>
              <p className="text-sm text-muted-foreground mt-2 font-sans">
                Enter the token and choose a strong password
              </p>
            </div>

            {mockToken && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl p-3.5 text-xs mb-6 font-mono break-all text-center">
                <strong>Mock token generated (auto-filled):</strong>
                <br />
                {mockToken.substring(0, 30)}...
              </div>
            )}

            <form onSubmit={resetForm.handleSubmit(onResetSubmit)} className="space-y-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Reset Token
                </label>
                <Input
                  type="text"
                  placeholder="Paste reset token here"
                  {...resetForm.register('token')}
                />
                {resetForm.formState.errors.token && (
                  <p className="flex items-center text-xs text-rose-500 mt-1.5 font-medium">
                    <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                    {resetForm.formState.errors.token.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  New Password
                </label>
                <Input
                  type="password"
                  placeholder="Min 8 characters"
                  {...resetForm.register('newPassword')}
                />
                {resetForm.formState.errors.newPassword && (
                  <p className="flex items-center text-xs text-rose-500 mt-1.5 font-medium">
                    <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                    {resetForm.formState.errors.newPassword.message}
                  </p>
                )}
              </div>

              <Button type="submit" variant="primary" className="w-full font-semibold" disabled={isSubmitting}>
                {isSubmitting ? 'Updating password...' : 'Update Password'}
              </Button>
            </form>
          </div>
        )}
      </motion.div>
    </div>
  );
};
