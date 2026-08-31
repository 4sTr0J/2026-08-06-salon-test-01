import { Gift } from 'lucide-react';

const VoucherList = ({ vouchers, onUseVoucher }) => (
  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
      <Gift className="w-5 h-5 text-rose-500" /> My Vouchers
    </h3>
    {vouchers.length === 0 ? (
      <p className="text-slate-500 text-sm">No vouchers yet.</p>
    ) : (
      <div className="space-y-3">
        {vouchers.map((v) => (
          <div
            key={v.id}
            className={`p-3 border border-dashed rounded-xl flex justify-between items-center ${
              v.status === 'ACTIVE'
                ? 'border-rose-200 bg-rose-50'
                : 'border-slate-200 bg-slate-50 opacity-70'
            }`}
          >
            <div>
              <p
                className={`font-bold font-mono tracking-wider ${
                  v.status === 'ACTIVE' ? 'text-rose-700' : 'text-slate-500'
                }`}
              >
                {v.voucher_code}
              </p>
              <p className={`text-xs ${v.status === 'ACTIVE' ? 'text-rose-500' : 'text-slate-400'}`}>
                Status: {v.status}
              </p>
            </div>
            {v.status === 'ACTIVE' && (
              <button
                onClick={() => onUseVoucher(v.voucher_code)}
                className="text-xs bg-rose-500 hover:bg-rose-600 transition-colors text-white px-3 py-1 rounded-full font-medium shadow-sm"
              >
                Use Now
              </button>
            )}
            {v.status !== 'ACTIVE' && (
              <span className="text-xs text-slate-400 font-medium px-3 py-1 bg-white border border-slate-200 rounded-full">
                {v.status}
              </span>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

export default VoucherList;
