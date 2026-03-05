function NotificationBanner({ update, onDismiss }) {
  if (!update) return null;

  return (
    <div className="mx-4 mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-emerald-400">{update.title}</p>
          {update.body && (
            <p className="mt-1 text-sm text-slate-300">{update.body}</p>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default NotificationBanner;
