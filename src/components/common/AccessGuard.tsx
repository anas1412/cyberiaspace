import React, { cloneElement, type ReactElement } from 'react';
import type { User } from '../../constants';
import { isPro, isAuthenticated } from '../../utils/access';
import { useModalStore } from '../../store/useModalStore';

interface AccessGuardProps {
  user: User | null;
  mode: 'remove' | 'disable' | 'modal';
  feature: 'pro' | 'auth';
  children: ReactElement;
  modalTitle?: string;
  modalMessage?: string;
}

export function AccessGuard({
  user,
  mode,
  feature,
  children,
  modalTitle,
  modalMessage,
}: AccessGuardProps) {
  const { openModal } = useModalStore();

  const hasAccess =
    feature === 'pro' ? isPro(user) : isAuthenticated(user);

  if (!hasAccess) {
    if (mode === 'remove') {
      return null;
    }

    if (mode === 'disable') {
      const child = children as React.ReactElement<{
        className?: string;
        disabled?: boolean;
      }>;
      const currentClassName = child.props.className || '';
      return cloneElement(child, {
        disabled: true,
        className: `${currentClassName} opacity-50 pointer-events-none`.trim(),
      });
    }

    if (mode === 'modal') {
      const child = children as React.ReactElement<{ onClick?: (e: React.MouseEvent) => void }>;
      const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (feature === 'pro') {
          window.location.href = '/pricing';
        } else {
          openModal({
            title: modalTitle || 'Sign in required',
            description: modalMessage || 'Please sign in to continue.',
            type: 'alert',
          });
        }
      };

      return cloneElement(child, {
        onClick: handleClick,
      });
    }
  }

  return children;
}
