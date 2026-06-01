import React from 'react';
import { CircleUserRound, LogOut } from 'lucide-react';

export default function AccountBadge({ account, onClick, onLogout }) {
  if (!account) {
    return null;
  }

  return (
    <div
      className={`hidden md:flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-white shadow-sm backdrop-blur-sm ${onClick ? 'cursor-pointer transition-colors hover:bg-white/15' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      } : undefined}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-300/15 text-blue-200">
        <CircleUserRound size={18} />
      </div>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="max-w-[180px] truncate text-sm font-semibold">{account.fullName || account.email}</span>
        <span className="text-[11px] uppercase tracking-[0.16em] text-white/55">{account.role || 'account'}</span>
      </div>
      {onLogout && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onLogout();
          }}
          className="rounded-full border border-white/10 bg-white/5 p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Deconectează-te"
          title="Deconectează-te"
        >
          <LogOut size={16} />
        </button>
      )}
    </div>
  );
}