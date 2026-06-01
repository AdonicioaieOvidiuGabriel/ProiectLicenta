import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';

  const nextParams = new URLSearchParams();
  if (email) {
    nextParams.set('email', email);
  }
  if (token) {
    nextParams.set('token', token);
  }
  nextParams.set('reset', '1');

  return <Navigate to={`/?${nextParams.toString()}`} replace />;
}
