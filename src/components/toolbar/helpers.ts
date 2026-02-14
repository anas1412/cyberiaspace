export const getStatusColor = (space: any, isReadOnly: boolean) => {
  if (isReadOnly) return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
  if (!space?.publishedId) return 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]';

  const lastPub = space.lastPublished ? new Date(space.lastPublished).getTime() : 0;
  const updatedAt = space.updatedAt ? new Date(space.updatedAt).getTime() : 0;

  if (lastPub >= updatedAt - 1000) { // 1s tolerance
    return 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
  } else {
    return 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]';
  }
};

export const formatLastUpdated = (isoString: string | null) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = Math.abs(now.getTime() - date.getTime());
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
