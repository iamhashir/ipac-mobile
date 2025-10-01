import * as React from 'react';
import { cn } from '../../utils/cn';

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number; // pixels
  className?: string;
}

function getInitials(name?: string | null) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts[1]?.[0] || '';
  return (first + last).toUpperCase() || first.toUpperCase() || 'U';
}

const Avatar: React.FC<AvatarProps> = ({ uri, name, size = 64, className }) => {
  const style: React.CSSProperties = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <img
        src={uri || undefined}
        alt={name || 'avatar'}
        style={style}
        className={cn('bg-gray-100 border border-gray-200 object-cover', className)}
      />
    );
  }
  return (
    <div style={style} className={cn('bg-gray-200 border border-gray-300 flex items-center justify-center', className)}>
      <span style={{ fontSize: size * 0.4 }} className="text-gray-700 font-semibold">
        {getInitials(name)}
      </span>
    </div>
  );
};

export default Avatar;
