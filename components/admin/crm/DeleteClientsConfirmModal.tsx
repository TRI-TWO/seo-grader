"use client";

type Props = {
  open: boolean;
  count: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteClientsConfirmModal({ open, count, loading, onConfirm, onCancel }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal
        className="w-full max-w-md rounded-2xl border border-slate-600/80 bg-slate-950 p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-white">Remove selected clients?</h2>
        <p className="mt-2 text-sm text-slate-300">
          You are about to remove <strong>{count}</strong> client{count === 1 ? "" : "s"} from the Admin CRM and
          Arch portal access. Accounts will be deactivated (soft delete) and will no longer appear in active lists.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          This is intended for offboarding. Data retained for audit where applicable.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="rounded-lg border border-rose-600/80 bg-rose-900/40 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-900/60 disabled:opacity-50"
          >
            {loading ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
