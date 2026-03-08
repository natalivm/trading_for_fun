import { useState } from 'react';

function InstallPrompt({ canInstall, onInstall, notificationPermission, onEnableNotifications }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const showInstall = canInstall;
  const showNotifications = notificationPermission === 'default';

  if (!showInstall && !showNotifications) return null;

  return (
    <div className="mx-auto mt-3 max-w-sm rounded-xl border border-slate-700/50 bg-slate-900/80 p-4">
      {showInstall && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-200">Install TradingFun</p>
            <p className="text-xs text-slate-400">Add to your home screen for quick access</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setDismissed(true)}
              className="rounded-lg px-3 py-1.5 text-xs text-slate-400 transition hover:bg-slate-800"
            >
              Later
            </button>
            <button
              onClick={onInstall}
              className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/30"
            >
              Install
            </button>
          </div>
        </div>
      )}

      {showInstall && showNotifications && (
        <div className="my-3 border-t border-slate-800" />
      )}

      {showNotifications && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-200">Enable notifications</p>
            <p className="text-xs text-slate-400">Get notified about important updates</p>
          </div>
          <div className="flex gap-2">
            {!showInstall && (
              <button
                onClick={() => setDismissed(true)}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-400 transition hover:bg-slate-800"
              >
                Later
              </button>
            )}
            <button
              onClick={onEnableNotifications}
              className="rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-400 transition hover:bg-blue-500/30"
            >
              Enable
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InstallPrompt;
