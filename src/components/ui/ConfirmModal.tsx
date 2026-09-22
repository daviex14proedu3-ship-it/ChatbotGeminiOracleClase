import React from 'react';
import { Modal } from './Modal';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  loading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'warning',
  loading = false,
}) => {
  const variantStyles = {
    danger: {
      icon: <AlertCircle className="w-10 h-10 text-rose-500" />,
      bgIcon: 'bg-rose-500/10',
      btn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30',
    },
    warning: {
      icon: <AlertTriangle className="w-10 h-10 text-amber-500" />,
      bgIcon: 'bg-amber-500/10',
      btn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/30',
    },
    info: {
      icon: <Info className="w-10 h-10 text-sky-500" />,
      bgIcon: 'bg-sky-500/10',
      btn: 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-900/30',
    },
    success: {
      icon: <CheckCircle className="w-10 h-10 text-emerald-500" />,
      bgIcon: 'bg-emerald-500/10',
      btn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30',
    },
  }[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="md"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 rounded-xl transition"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={loading}
            className={`px-4 py-2 text-sm font-semibold rounded-xl shadow-lg transition flex items-center gap-2 ${variantStyles.btn}`}
          >
            {loading ? 'Procesando...' : confirmText}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-4 py-2">
        <div className={`p-3 rounded-2xl flex-shrink-0 ${variantStyles.bgIcon}`}>
          {variantStyles.icon}
        </div>
        <p className="text-sm text-slate-300 leading-relaxed pt-1">{message}</p>
      </div>
    </Modal>
  );
};
