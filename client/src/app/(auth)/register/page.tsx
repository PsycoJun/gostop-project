
'use client';

import React from 'react';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import styles from './page.module.css';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { register } = useAuth();

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      await register(username, password);
      // Redirect is handled by the AuthContext
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred.');
      }
    }
  };

  return (
    <div className={styles.registerContainer}>
      <Card className={styles.registerCard}>
        <CardHeader className={styles.cardHeader}>
          <div className={styles.logoIconContainer}>
            <span className="text-3xl">🎴</span>
          </div>
          <CardTitle className={styles.cardTitle}>Join 고스톱</CardTitle>
          <p className={styles.welcomeMessage}>Create your account</p>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          {error && <p className={styles.errorMessage}>{error}</p>}
          <div className={styles.inputGroup}>
            <Label htmlFor="username" className={styles.inputLabel}>Username</Label>
            <Input id="username" placeholder="Enter your username" value={username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)} className={styles.textInput} />
          </div>
          <div className={styles.inputGroup}>
            <Label htmlFor="password" className={styles.inputLabel}>Password</Label>
            <Input id="password" type="password" placeholder="Create a password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} className={styles.textInput} />
          </div>
          <div className={styles.inputGroup}>
            <Label htmlFor="confirmPassword" className={styles.inputLabel}>Confirm Password</Label>
            <Input id="confirmPassword" type="password" placeholder="Confirm your password" value={confirmPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)} className={styles.textInput} />
          </div>
          <Button onClick={handleSignUp} className={styles.registerButton}>Create Account</Button>
          <div className={styles.loginLinkContainer}>
            <Link href="/login" className={styles.loginLink}>Already have an account? Sign In</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
