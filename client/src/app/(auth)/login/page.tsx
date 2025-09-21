'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import styles from './page.module.css';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async () => {
    try {
      await login(username, password);
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
    <div className={styles.loginContainer}>
      <Card className={styles.loginCard}>
        <CardHeader className={styles.cardHeader}>
          <div className={styles.logoIconContainer}>
            <span className="text-3xl">🎴</span>
          </div>
          <CardTitle className={styles.cardTitle}>고스톱</CardTitle>
          <p className={styles.welcomeMessage}>Welcome back!</p>
        </CardHeader>
        <CardContent className={styles.cardContent}>
          {error && <p className={styles.errorMessage}>{error}</p>}
          <div className={styles.inputGroup}>
            <Label htmlFor="username" className={styles.inputLabel}>Username</Label>
            <Input id="username" placeholder="Enter your username" value={username} onChange={(e) => setUsername(e.target.value)} className={styles.textInput} />
          </div>
          <div className={styles.inputGroup}>
            <Label htmlFor="password" className={styles.inputLabel}>Password</Label>
            <Input id="password" type="password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className={styles.textInput} />
          </div>
          <Button onClick={handleLogin} className={styles.loginButton}>Sign In</Button>
          <div className={styles.registerLinkContainer}>
            <Link href="/register" className={styles.registerLink}>Don't have an account? Sign Up</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
