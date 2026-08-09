import React, { useState, useEffect, useCallback, useRef } from "react";
import { storage } from "./storage";
import {
  ArrowRightLeft,
  Plus,
  History,
  LogOut,
  Shield,
  Lock,
  User,
  Undo2,
  Coins,
  ChevronDown,
  CreditCard,
  Camera,
  Wallet,
  Sparkles,
  Banknote,
  MinusCircle,
} from "lucide-react";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "Mol1452013mol"; // غيّرها قبل المشاركة

/* ─── Helpers ─── */
function fmt(n) {
  return new Intl.NumberFormat("en-US").format(n || 0);
}
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
async function hash(str) {
  const enc = new TextEncoder().encode(str);
  const buf = await window.crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function bal(account, code) {
  return (account?.balances?.[code]) || 0;
}
function cardNumberFromUsername(username) {
  let seed = 0;
  for (let i = 0; i < username.length; i++) {
    seed = (seed * 31 + username.charCodeAt(i)) >>> 0;
  }
  const digits = String(seed).padStart(12, "0").slice(0, 12);
  return "6288 " + digits.match(/.{1,4}/g).join(" ");
}

/* ─── Main App ─── */
export default function Bank() {
  const [accounts, setAccounts] = useState(null);
  const [currencies, setCurrencies] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2600);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const a = await storage.get("modren-bank:accounts");
      const c = await storage.get("modren-bank:currencies");
      const l = await storage.get("modren-bank:ledger");
      const d = await storage.get("modren-bank:debts");
      const acc = a ? JSON.parse(a.value) : {};
      let cur = c ? JSON.parse(c.value) : null;
      if (!cur) {
        cur = { MOD: { name: "Modren Coin", managerUsername: null } };
        await storage.set("modren-bank:currencies", JSON.stringify(cur));
      }
      setAccounts(acc);
      setCurrencies(cur);
      setLedger(l ? JSON.parse(l.value) : []);
      setDebts(d ? JSON.parse(d.value) : []);
    } catch {
      setAccounts({});
      setCurrencies({ MOD: { name: "Modren Coin", managerUsername: null } });
      setLedger([]);
      setDebts([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const persistAccounts = async (next) => {
    setAccounts(next);
    try {
      await storage.set("modren-bank:accounts", JSON.stringify(next));
    } catch {
      showToast("تعذر الحفظ", "error");
    }
  };
  const persistCurrencies = async (next) => {
    setCurrencies(next);
    try {
      await storage.set("modren-bank:currencies", JSON.stringify(next));
    } catch {
      showToast("تعذر حفظ العملات", "error");
    }
  };
  const persistLedger = async (next) => {
    setLedger(next);
    try {
      await storage.set("modren-bank:ledger", JSON.stringify(next));
    } catch {
      showToast("تعذر حفظ السجل", "error");
    }
  };
  const addEntry = async (entry) => {
    const withId = { id: uid(), time: Date.now(), ...entry };
    await persistLedger([withId, ...ledger].slice(0, 800));
    return withId;
  };
  const persistDebts = async (next) => {
    setDebts(next);
    try {
      await storage.set("modren-bank:debts", JSON.stringify(next));
    } catch {
      showToast("تعذر حفظ الديون", "error");
    }
  };

  const createAccount = async (username, name, password) => {
    const u = username.trim().toLowerCase();
    if (!u || !name.trim() || !password) {
      showToast("عبّي كل الحقول", "error");
      return;
    }
    if (accounts[u] || u === ADMIN_USERNAME) {
      showToast("اسم المستخدم موجود مسبقاً", "error");
      return;
    }
    const passwordHash = await hash(password);
    await persistAccounts({
      ...accounts,
      [u]: { name: name.trim(), passwordHash, balances: {}, cardPhoto: null, cardNote: "" },
    });
    showToast(`تم فتح حساب لـ ${name}`, "success");
  };

  const createCurrency = async (code, name, managerUsername, allowNegative) => {
    const c = code.trim().toUpperCase();
    if (!c || !name.trim()) {
      showToast("عبّي كل الحقول", "error");
      return;
    }
    if (currencies[c]) {
      showToast("رمز العملة مستخدم مسبقاً", "error");
      return;
    }
    await persistCurrencies({
      ...currencies,
      [c]: { name: name.trim(), managerUsername: managerUsername || null, allowNegative: !!allowNegative },
    });
    showToast(`تم إنشاء عملة ${c}`, "success");
  };

  const canManage = (currency, actingUsername, isAdmin) =>
    isAdmin || (currencies[currency]?.managerUsername === actingUsername);

  const mint = async (currency, toUsername, amount, note, actingUsername, isAdmin) => {
    const amt = Number(amount);
    if (!accounts[toUsername] || !amt || amt <= 0) {
      showToast("تأكد من المبلغ", "error");
      return;
    }
    if (!canManage(currency, actingUsername, isAdmin)) {
      showToast("ما إلك صلاحية على هالعملة", "error");
      return;
    }
    const acc = accounts[toUsername];
    await persistAccounts({
      ...accounts,
      [toUsername]: {
        ...acc,
        balances: { ...acc.balances, [currency]: bal(acc, currency) + amt },
      },
    });
    await addEntry({ type: "mint", currency, fromUser: null, toUser: toUsername, amount: amt, note: note || "" });
    showToast(`تم إصدار ${fmt(amt)} ${currency} لـ ${acc.name}`, "success");
  };

  const transfer = async (currency, fromUser, toUsernameRaw, amount, note) => {
    const amt = Number(amount);
    const toUser = toUsernameRaw.trim().toLowerCase();
    if (!accounts[toUser]) {
      showToast("ما في حساب بهاد الاسم", "error");
      return false;
    }
    if (toUser === fromUser || !amt || amt <= 0) {
      showToast("تأكد من بيانات التحويل", "error");
      return false;
    }
    const currencyAllowsNegative = currencies[currency]?.allowNegative;
    if (!currencyAllowsNegative && bal(accounts[fromUser], currency) < amt) {
      showToast("الرصيد غير كافٍ", "error");
      return false;
    }
    const fromAcc = accounts[fromUser];
    const toAcc = accounts[toUser];
    await persistAccounts({
      ...accounts,
      [fromUser]: {
        ...fromAcc,
        balances: { ...fromAcc.balances, [currency]: bal(fromAcc, currency) - amt },
      },
      [toUser]: {
        ...toAcc,
        balances: { ...toAcc.balances, [currency]: bal(toAcc, currency) + amt },
      },
    });
    await addEntry({ type: "transfer", currency, fromUser, toUser, amount: amt, note: note || "" });
    showToast(`تم إرسال ${fmt(amt)} ${currency}`, "success");
    return true;
  };

  const returnTx = async (entry, byUser) => {
    if (bal(accounts[byUser], entry.currency) < entry.amount) {
      showToast("رصيدك ما عاد كافي للإرجاع", "error");
      return;
    }
    const fromAcc = accounts[byUser];
    const toAcc = accounts[entry.fromUser];
    await persistAccounts({
      ...accounts,
      [byUser]: {
        ...fromAcc,
        balances: { ...fromAcc.balances, [entry.currency]: bal(fromAcc, entry.currency) - entry.amount },
      },
      [entry.fromUser]: {
        ...toAcc,
        balances: { ...toAcc.balances, [entry.currency]: bal(toAcc, entry.currency) + entry.amount },
      },
    });
    await addEntry({
      type: "return",
      currency: entry.currency,
      fromUser: byUser,
      toUser: entry.fromUser,
      amount: entry.amount,
      note: "إرجاع",
      originalTxId: entry.id,
    });
    showToast("تم إرجاع المبلغ", "success");
  };

  const updateCard = async (username, patch) => {
    const acc = accounts[username];
    await persistAccounts({ ...accounts, [username]: { ...acc, ...patch } });
  };

  // ─── Debt system ───
  // Recording a debt is bookkeeping only — it doesn't move balances. Money only
  // moves when the debtor repays (a normal transfer to the creditor).
  const createDebt = async (creditor, debtorRaw, currency, amount, note) => {
    const debtor = debtorRaw.trim().toLowerCase();
    const amt = Number(amount);
    if (!accounts[debtor] || !accounts[creditor] || debtor === creditor || !amt || amt <= 0) {
      showToast("تأكد من بيانات الدين", "error");
      return;
    }
    const entry = {
      id: uid(),
      time: Date.now(),
      creditor,
      debtor,
      currency,
      amount: amt,
      remaining: amt,
      note: note || "",
      settled: false,
    };
    await persistDebts([entry, ...debts]);
    showToast("تم تسجيل الدين", "success");
  };

  const repayDebt = async (debt, payingUser) => {
    if (!currencies[debt.currency]?.allowNegative && bal(accounts[payingUser], debt.currency) < debt.remaining) {
      showToast("رصيدك غير كافٍ للسداد", "error");
      return;
    }
    const ok = await transfer(debt.currency, payingUser, debt.creditor, debt.remaining, "سداد دين");
    if (ok === false) return;
    await persistDebts(debts.map((d) => (d.id === debt.id ? { ...d, remaining: 0, settled: true } : d)));
    showToast("تم سداد الدين بالكامل", "success");
  };

  const forgiveDebt = async (debtId) => {
    await persistDebts(
      debts.map((d) => (d.id === debtId ? { ...d, remaining: 0, settled: true, forgiven: true } : d))
    );
    showToast("تم إسقاط الدين", "success");
  };

  // Admin-only: pulls currency out of an account without sending it anywhere (opposite of mint).
  const withdraw = async (currency, fromUsername, amount, note) => {
    const amt = Number(amount);
    if (!accounts[fromUsername] || !amt || amt <= 0) {
      showToast("تأكد من المبلغ", "error");
      return;
    }
    if (!currencies[currency]?.allowNegative && bal(accounts[fromUsername], currency) < amt) {
      showToast("الرصيد غير كافٍ للسحب", "error");
      return;
    }
    const acc = accounts[fromUsername];
    await persistAccounts({
      ...accounts,
      [fromUsername]: {
        ...acc,
        balances: { ...acc.balances, [currency]: bal(acc, currency) - amt },
      },
    });
    await addEntry({ type: "withdraw", currency, fromUser: fromUsername, toUser: null, amount: amt, note: note || "" });
    showToast(`تم سحب ${fmt(amt)} ${currency} من ${acc.name}`, "success");
  };

  if (loading || !currencies) {
    return (
      <div className="min-h-screen bg-[#0a0f0d] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#3d8b5a] border-t-transparent animate-spin" />
          <div className="text-[#6bbf8a] font-mono text-xs tracking-widest">جارٍ الفتح…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f0d] text-[#e6f0ea] font-sans" dir="rtl">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        .font-display { font-family: 'Tajawal', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; direction: ltr; }
        .card-glow { box-shadow: 0 0 40px -12px rgba(61, 139, 90, 0.35); }
      `}</style>

      {toast && (
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-sm font-display shadow-lg max-w-[90vw] text-center border ${
            toast.type === "success"
              ? "bg-[#132a1c] border-[#3d8b5a] text-[#8fd9a8]"
              : toast.type === "error"
              ? "bg-[#2a1313] border-[#8b3d3d] text-[#d98f8f]"
              : "bg-[#13201a] border-[#2a4035] text-[#c8d9cf]"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {!session ? (
        <LoginScreen
          onAdminLogin={(pass) => {
            if (pass === ADMIN_PASSWORD) setSession({ role: "admin", username: ADMIN_USERNAME });
            else showToast("كلمة مرور خاطئة", "error");
          }}
          onUserLogin={async (username, password) => {
            const u = username.trim().toLowerCase();
            const acc = accounts[u];
            if (!acc) {
              showToast("الحساب غير موجود", "error");
              return;
            }
            const h = await hash(password);
            if (h !== acc.passwordHash) {
              showToast("كلمة مرور خاطئة", "error");
              return;
            }
            setSession({ role: "user", username: u });
          }}
        />
      ) : session.role === "admin" ? (
        <AdminPanel
          accounts={accounts}
          currencies={currencies}
          ledger={ledger}
          debts={debts}
          onLogout={() => setSession(null)}
          onCreateAccount={createAccount}
          onCreateCurrency={createCurrency}
          onMint={(currency, to, amt, note) => mint(currency, to, amt, note, ADMIN_USERNAME, true)}
          onTransfer={(currency, from, to, amt, note) => transfer(currency, from, to, amt, note)}
          onWithdraw={withdraw}
          onCreateDebt={createDebt}
          onForgiveDebt={forgiveDebt}
        />
      ) : (
        <UserPanel
          username={session.username}
          account={accounts[session.username]}
          accounts={accounts}
          currencies={currencies}
          ledger={ledger.filter(
            (e) => e.fromUser === session.username || e.toUser === session.username
          )}
          onLogout={() => setSession(null)}
          onTransfer={(currency, to, amt, note) =>
            transfer(currency, session.username, to, amt, note)
          }
          onReturn={(entry) => returnTx(entry, session.username)}
          onMint={(currency, to, amt, note) =>
            mint(currency, to, amt, note, session.username, false)
          }
          onUpdateCard={(patch) => updateCard(session.username, patch)}
          debts={debts.filter((d) => d.creditor === session.username || d.debtor === session.username)}
          onCreateDebt={(debtorUsername, currency, amt, note) =>
            createDebt(session.username, debtorUsername, currency, amt, note)
          }
          onRepayDebt={(debt) => repayDebt(debt, session.username)}
        />
      )}
    </div>
  );
}

/* ─── Header ─── */
function Header({ title, sub, onLogout }) {
  return (
    <header className="border-b border-[#1a2620] px-5 py-4 flex items-center justify-between sticky top-0 bg-[#0a0f0d]/85 backdrop-blur-md z-10">
      <div>
        <div className="font-display font-bold text-lg tracking-tight">{title}</div>
        {sub && <div className="text-xs font-mono text-[#5a7565] mt-0.5">{sub}</div>}
      </div>
      {onLogout && (
        <button
          onClick={onLogout}
          className="text-[#5a7565] hover:text-[#e6f0ea] flex items-center gap-1.5 text-sm transition-colors"
        >
          خروج <LogOut size={15} />
        </button>
      )}
    </header>
  );
}

/* ─── Login ─── */
function LoginScreen({ onAdminLogin, onUserLogin }) {
  const [mode, setMode] = useState("user");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adminPass, setAdminPass] = useState("");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1e3d2a] to-[#0f1a14] border border-[#2a4035] flex items-center justify-center mb-5 card-glow">
        <Sparkles size={20} className="text-[#6bbf8a]" />
      </div>
      <div className="font-display font-bold text-2xl mb-1 tracking-tight">Modren Bank</div>
      <div className="text-xs font-mono text-[#5a7565] mb-10">سجل الدخول لعرض حسابك</div>

      <div className="w-full max-w-xs">
        <div className="flex gap-1 mb-6 bg-[#0f1612] rounded-xl p-1 border border-[#1a2620]">
          <button
            onClick={() => setMode("user")}
            className={`flex-1 py-2 rounded-lg text-sm font-display transition-all ${
              mode === "user"
                ? "bg-[#1e3d2a] text-[#8fd9a8] font-medium shadow-sm"
                : "text-[#7a9485] hover:text-[#c8d9cf]"
            }`}
          >
            عضو
          </button>
          <button
            onClick={() => setMode("admin")}
            className={`flex-1 py-2 rounded-lg text-sm font-display transition-all ${
              mode === "admin"
                ? "bg-[#1e3d2a] text-[#8fd9a8] font-medium shadow-sm"
                : "text-[#7a9485] hover:text-[#c8d9cf]"
            }`}
          >
            مدير
          </button>
        </div>

        {mode === "user" ? (
          <div className="space-y-3">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="اسم المستخدم"
              className="w-full bg-[#0f1612] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] transition-colors"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة المرور"
              className="w-full bg-[#0f1612] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] transition-colors"
            />
            <button
              onClick={() => onUserLogin(username, password)}
              className="w-full bg-gradient-to-r from-[#2a5c3d] to-[#1e4a30] text-[#e6f0ea] font-medium py-3 rounded-xl text-sm hover:from-[#347049] hover:to-[#265c3a] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#1e3d2a]/40"
            >
              <User size={16} /> دخول
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="password"
              value={adminPass}
              onChange={(e) => setAdminPass(e.target.value)}
              placeholder="كلمة مرور المدير"
              className="w-full bg-[#0f1612] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] transition-colors"
            />
            <button
              onClick={() => onAdminLogin(adminPass)}
              className="w-full border border-[#2a4035] text-[#c8d9cf] font-medium py-3 rounded-xl text-sm hover:border-[#3d8b5a] hover:text-[#8fd9a8] transition-all flex items-center justify-center gap-2"
            >
              <Shield size={16} /> دخول كمدير
            </button>
          </div>
        )}
      </div>
      <p className="text-[11px] font-mono text-[#3a4a42] mt-10 text-center max-w-xs leading-relaxed">
        الحسابات يفتحها المدير فقط. اطلب من المدير يعطيك اسم مستخدم وكلمة مرور.
      </p>
    </div>
  );
}

/* ─── Admin Panel ─── */
function AdminPanel({
  accounts,
  currencies,
  ledger,
  debts,
  onLogout,
  onCreateAccount,
  onCreateCurrency,
  onMint,
  onTransfer,
  onWithdraw,
  onCreateDebt,
  onForgiveDebt,
}) {
  const [tab, setTab] = useState("accounts");
  const ids = Object.keys(accounts);
  const codes = Object.keys(currencies);

  const tabs = [
    ["accounts", "الحسابات"],
    ["new", "حساب جديد"],
    ["currencies", "العملات"],
    ["debts", "الديون"],
    ["cards", "البطاقات"],
    ["ledger", "كل السجلات"],
  ];

  return (
    <div>
      <Header title="لوحة المدير" sub={`${ids.length} حساب · ${codes.length} عملة`} onLogout={onLogout} />
      <div className="max-w-md mx-auto px-5 py-6">
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`shrink-0 font-mono text-xs px-3.5 py-1.5 rounded-full border transition-all ${
                tab === k
                  ? "bg-[#1e3
