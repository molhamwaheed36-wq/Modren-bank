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
              className="w-full bg-[#0f1612] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] transition-colors"            />
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
                  ? "bg-[#1e3d2a] text-[#8fd9a8] border-[#3d8b5a]"
                  : "border-[#1e2b24] text-[#7a9485] hover:border-[#2a4035]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "accounts" && (
          <div className="space-y-3">
            {ids.length === 0 && (
              <p className="text-sm text-[#5a7565] text-center py-8">ما في حسابات بعد.</p>
            )}
            {ids.map((u) => (
              <AdminAccountRow
                key={u}
                username={u}
                account={accounts[u]}
                currencies={currencies}
                allAccounts={accounts}
                onMint={onMint}
                onTransfer={onTransfer}
                onWithdraw={onWithdraw}
              />
            ))}
          </div>
        )}

        {tab === "new" && (
          <div className="rounded-2xl border border-[#1a2620] bg-[#0f1612] p-5">
            <NewAccountForm onSubmit={onCreateAccount} />
          </div>
        )}

        {tab === "currencies" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#1a2620] bg-[#0f1612] p-5">
              <NewCurrencyForm accounts={accounts} onSubmit={onCreateCurrency} />
            </div>
            <div className="space-y-2">
              {codes.map((c) => (
                <div
                  key={c}
                  className="rounded-xl border border-[#1a2620] bg-[#0f1612] p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-display font-medium text-sm">{currencies[c].name}</div>
                    <div className="font-mono text-[11px] text-[#5a7565] mt-0.5">{c}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-xs font-mono text-[#7a9485]">
                      {currencies[c].managerUsername
                        ? `مسؤول: ${accounts[currencies[c].managerUsername]?.name || currencies[c].managerUsername}`
                        : "المدير فقط"}
                    </div>
                    {currencies[c].allowNegative && (
                      <div className="text-[10px] font-mono text-[#d98f8f] bg-[#2a1313] border border-[#8b3d3d] rounded-full px-2 py-0.5">
                        يسمح بالسالب
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "debts" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#1a2620] bg-[#0f1612] p-5">
              <AdminDebtForm accounts={accounts} currencies={currencies} onSubmit={onCreateDebt} />
            </div>
            <div className="space-y-2">
              {debts.length === 0 && (
                <p className="text-sm text-[#5a7565] text-center py-8">لا يوجد ديون مسجلة.</p>
              )}
              {debts.map((d) => (
                <DebtRow key={d.id} debt={d} accounts={accounts} onForgive={onForgiveDebt} isAdmin />
              ))}
            </div>
          </div>
        )}

        {tab === "cards" && (
          <div className="space-y-5">
            {ids.length === 0 && (
              <p className="text-sm text-[#5a7565] text-center py-8">ما في حسابات بعد.</p>
            )}
            {ids.map((u) => (
              <BankCard key={u} username={u} account={accounts[u]} readOnly />
            ))}
          </div>
        )}

        {tab === "ledger" && (
          <div className="space-y-2">
            {ledger.length === 0 && (
              <p className="text-sm text-[#5a7565] text-center py-8">لا يوجد نشاط بعد.</p>
            )}
            {ledger.map((e) => (
              <LedgerRow key={e.id} entry={e} accounts={accounts} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Admin Account Row ─── */
function AdminAccountRow({ username, account, currencies, onMint, onTransfer, onWithdraw, allAccounts }) {
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState(Object.keys(currencies)[0] || "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [toUser, setToUser] = useState("");
  const codes = Object.keys(currencies);

  return (
    <div className="rounded-xl border border-[#1a2620] bg-[#0f1612] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-[#121c17] transition-colors"
      >
        <div className="text-right">
          <div className="font-display font-medium text-sm">{account.name}</div>
          <div className="font-mono text-[11px] text-[#5a7565]">@{username}</div>
        </div>
        <ChevronDown
          size={16}
          className={`text-[#5a7565] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        {codes.map((c) => (
          <div
            key={c}
            className={`font-mono text-[11px] border rounded-full px-2.5 py-1 ${
              bal(account, c) < 0
                ? "bg-[#2a1313] border-[#8b3d3d] text-[#d98f8f]"
                : "bg-[#0a0f0d] border-[#1e2b24] text-[#6bbf8a]"
            }`}
          >
            {fmt(bal(account, c))} {c}
          </div>
        ))}
      </div>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-[#1a2620] space-y-2.5">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#3d8b5a]"
          >
            {codes.map((c) => (
              <option key={c} value={c}>
                {currencies[c].name} ({c})
              </option>
            ))}
          </select>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="مبلغ"
            className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#3d8b5a] font-mono"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ملاحظة (اختياري)"
            className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#3d8b5a]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                onMint(currency, username, amount, note);
                setAmount("");
                setNote("");
              }}
              className="flex-1 bg-[#1e3d2a] text-[#8fd9a8] font-medium py-2.5 rounded-lg text-xs hover:bg-[#26523a] transition-colors"
            >
              إصدار له
            </button>
            <button
              onClick={() => {
                onWithdraw(currency, username, amount, note);
                setAmount("");
                setNote("");
              }}
              className="flex-1 border border-[#8b3d3d] text-[#d98f8f] font-medium py-2.5 rounded-lg text-xs hover:bg-[#2a1313] transition-colors flex items-center justify-center gap-1"
            >
              <MinusCircle size={13} /> سحب منه
            </button>
          </div>
          <div className="flex gap-2 pt-1">
            <select
              value={toUser}
              onChange={(e) => setToUser(e.target.value)}
              className="flex-1 bg-[#0a0f0d] border border-[#1e2b24] rounded-lg px-2 py-2 text-xs outline-none"
            >
              <option value="">تحويل يدوي إلى…</option>
              {Object.entries(allAccounts)
                .filter(([u]) => u !== username)
                .map(([u, a]) => (
                  <option key={u} value={u}>
                    {a.name}
                  </option>
                ))}
            </select>
            <button
              onClick={() => {
                onTransfer(currency, username, toUser, amount, note);
                setAmount("");
                setNote("");
                setToUser("");
              }}
              className="border border-[#2a4035] px-3.5 py-2 rounded-lg text-xs hover:border-[#3d8b5a] transition-colors"
            >
              تحويل
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Debt Row ─── */
function DebtRow({ debt, accounts, onForgive, onRepay, viewerUsername, isAdmin }) {
  const creditorName = accounts[debt.creditor]?.name || debt.creditor;
  const debtorName = accounts[debt.debtor]?.name || debt.debtor;
  return (
    <div className="rounded-xl border border-[#1a2620] bg-[#0f1612] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm min-w-0">
          <span className="text-[#d4a84b]">{debtorName}</span> مديون لـ{" "}
          <span className="text-[#6bbf8a]">{creditorName}</span>
          <div className="font-mono text-[10px] text-[#5a7565] mt-0.5">
            {debt.currency}
            {debt.note ? ` · ${debt.note}` : ""}
          </div>
        </div>
        <div className="text-left shrink-0">
          <div className="font-mono text-sm tabular-nums">{fmt(debt.remaining)}</div>
          {debt.settled && (
            <div className="text-[10px] text-[#6bbf8a] mt-0.5">
              {debt.forgiven ? "تم الإسقاط" : "تم السداد"}
            </div>
          )}
        </div>
      </div>
      {!debt.settled && (onRepay || isAdmin) && (
        <div className="flex gap-2 mt-3">
          {onRepay && debt.debtor === viewerUsername && (
            <button
              onClick={() => onRepay(debt)}
              className="flex-1 bg-[#1e3d2a] text-[#8fd9a8] font-medium py-2 rounded-lg text-xs hover:bg-[#26523a] transition-colors"
            >
              سداد كامل المبلغ
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => onForgive(debt.id)}
              className="flex-1 border border-[#2a4035] text-[#7a9485] font-medium py-2 rounded-lg text-xs hover:border-[#3d8b5a] transition-colors"
            >
              إسقاط الدين
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AdminDebtForm({ accounts, currencies, onSubmit }) {
  const [creditor, setCreditor] = useState("");
  const [debtor, setDebtor] = useState("");
  const [currency, setCurrency] = useState(Object.keys(currencies)[0] || "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <div className="text-sm font-display font-medium mb-1">تسجيل دين جديد</div>
      <select
        value={creditor}
        onChange={(e) => setCreditor(e.target.value)}
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a]"
      >
        <option value="">الدائن (المستحق له)</option>
        {Object.entries(accounts).map(([u, a]) => (
          <option key={u} value={u}>
            {a.name}
          </option>
        ))}
      </select>
      <select
        value={debtor}
        onChange={(e) => setDebtor(e.target.value)}
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a]"
      >
        <option value="">المدين (عليه الدين)</option>
        {Object.entries(accounts).map(([u, a]) => (
          <option key={u} value={u}>
            {a.name}
          </option>
        ))}
      </select>
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a]"
      >
        {Object.keys(currencies).map((c) => (
          <option key={c} value={c}>
            {currencies[c].name} ({c})
          </option>
        ))}
      </select>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="المبلغ"
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] font-mono"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="سبب الدين (اختياري)"
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a]"
      />
      <button
        onClick={() => {
          onSubmit(creditor, debtor, currency, amount, note);
          setCreditor("");
          setDebtor("");
          setAmount("");
          setNote("");
        }}
        className="w-full bg-gradient-to-r from-[#2a5c3d] to-[#1e4a30] text-[#e6f0ea] font-medium py-3 rounded-xl text-sm hover:from-[#347049] hover:to-[#265c3a] transition-all"
      >
        تسجيل الدين
      </button>
    </div>
  );
}

/* ─── Ledger Row ─── */
function LedgerRow({ entry, accounts, onReturn, canReturn }) {
  const fromName = entry.fromUser ? accounts[entry.fromUser]?.name || entry.fromUser : null;
  const toName = accounts[entry.toUser]?.name || entry.toUser;

  return (
    <div className="flex items-center justify-between border-b border-[#1a2620] py-3 last:border-0">
      <div className="text-sm min-w-0">
        {entry.type === "mint" ? (
          <span>
            <span className="text-[#6bbf8a]">إصدار</span> لـ {toName}
          </span>
        ) : entry.type === "return" ? (
          <span>
            <span className="text-[#d4a84b]">إرجاع</span> {fromName}{" "}
            <span className="text-[#5a7565]">←</span> {toName}
          </span>
        ) : entry.type === "withdraw" ? (
          <span>
            <span className="text-[#d98f8f]">سحب</span> من {fromName}
          </span>
        ) : (
          <span>
            {fromName} <span className="text-[#5a7565]">←</span> {toName}
          </span>
        )}
        <span className="font-mono text-[10px] text-[#5a7565] mr-2">{entry.currency}</span>
        {entry.note && <div className="text-xs text-[#5a7565] mt-0.5 truncate">{entry.note}</div>}
      </div>
      <div className="flex items-center gap-2.5 shrink-0 mr-2">
        <div className="font-mono text-sm tabular-nums">{fmt(entry.amount)}</div>
        {canReturn && (
          <button
            onClick={() => onReturn(entry)}
            title="إرجاع المبلغ"
            className="text-[#5a7565] hover:text-[#d4a84b] transition-colors p-1"
          >
            <Undo2 size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Bank Card ─── */
function BankCard({ username, account, readOnly, onUpdateCard }) {
  const fileRef = useRef(null);
  const qrData = encodeURIComponent(`MODREN-CARD:${username}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=0&color=0a0f0d&bgcolor=ffffff&data=${qrData}`;

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      alert("الصورة كبيرة، اختر صورة أصغر من 1.5 ميغا");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onUpdateCard({ cardPhoto: reader.result });
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <div className="relative rounded-2xl overflow-hidden p-5 bg-gradient-to-br from-[#152a1e] via-[#0f1a14] to-[#0a120e] border border-[#243830] card-glow">
        <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-[#3d8b5a]/8 blur-3xl" />
        <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-[#1e3d2a]/30 blur-2xl" />

        <div className="relative flex items-center justify-between mb-7">
          <div className="flex items-center gap-2 text-[#6bbf8a] font-display font-bold text-sm">
            <div className="w-5 h-5 rounded-full border border-[#6bbf8a]/60 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-[#6bbf8a]" />
            </div>
            Modren Bank
          </div>          <CreditCard size={18} className="text-[#4a6655]" />
        </div>

        <div className="relative flex items-center gap-3.5 mb-7">
          <div className="w-14 h-14 rounded-full bg-[#0a0f0d] border border-[#2a4035] overflow-hidden shrink-0 flex items-center justify-center">
            {account.cardPhoto ? (
              <img src={account.cardPhoto} alt="" className="w-full h-full object-cover" />
            ) : (
              <User size={22} className="text-[#4a6655]" />
            )}
          </div>
          <div>
            <div className="font-display font-semibold text-base">{account.name}</div>
            <div className="font-mono text-[11px] text-[#7a9485]">@{username}</div>
          </div>
        </div>

        <div className="relative font-mono text-lg tracking-[0.18em] text-[#e6f0ea] mb-5">
          {cardNumberFromUsername(username)}
        </div>

        <div className="relative flex items-end justify-between">
          <div>
            <div className="text-[10px] font-mono text-[#4a6655] mb-1 tracking-wider">CARDHOLDER NOTE</div>
            <div className="text-xs text-[#8aa395] max-w-[150px] break-words leading-relaxed">
              {account.cardNote || "—"}
            </div>
          </div>
          <img src={qrUrl} alt="QR" width={68} height={68} className="rounded-lg bg-white p-1.5 shadow-sm" />
        </div>
      </div>

      {!readOnly && (
        <div className="mt-3.5 space-y-2.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 border border-[#2a4035] text-[#c8d9cf] font-medium py-2.5 rounded-xl text-xs hover:border-[#3d8b5a] hover:text-[#8fd9a8] transition-all"
          >
            <Camera size={14} /> تغيير الصورة
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <input
            defaultValue={account.cardNote}
            onBlur={(e) => onUpdateCard({ cardNote: e.target.value })}
            placeholder="نص على البطاقة (مثلاً توقيع أو شعار شخصي)"
            className="w-full bg-[#0f1612] border border-[#1e2b24] rounded-xl px-4 py-2.5 text-xs outline-none focus:border-[#3d8b5a] transition-colors"
          />
        </div>
      )}
    </div>
  );
}

/* ─── User Panel ─── */
function UserPanel({
  username,
  account,
  accounts,
  currencies,
  ledger,
  onLogout,
  onTransfer,
  onReturn,
  onMint,
  onUpdateCard,
  debts,
  onCreateDebt,
  onRepayDebt,
}) {
  const [view, setView] = useState("home");
  const codes = Object.keys(currencies);
  const managed = codes.filter((c) => currencies[c].managerUsername === username);
  const returnedIds = new Set(ledger.filter((e) => e.type === "return").map((e) => e.originalTxId));
  const owedByMe = debts.filter((d) => d.debtor === username);
  const owedToMe = debts.filter((d) => d.creditor === username);

  return (
    <div>
      <Header title={account.name} sub={`@${username}`} onLogout={onLogout} />
      <div className="max-w-md mx-auto px-5 py-6">
        <div className="flex gap-1.5 mb-6">
          {[
            ["home", "الرئيسية"],
            ["debts", "الديون"],
            ["card", "البطاقة"],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={`font-mono text-xs px-4 py-1.5 rounded-full border transition-all ${
                view === k
                  ? "bg-[#1e3d2a] text-[#8fd9a8] border-[#3d8b5a]"
                  : "border-[#1e2b24] text-[#7a9485] hover:border-[#2a4035]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {view === "card" && (
          <div className="mb-6">
            <BankCard username={username} account={account} onUpdateCard={onUpdateCard} />
          </div>
        )}

        {view === "debts" && (
          <div className="mb-6 space-y-5">
            <div className="rounded-2xl border border-[#1a2620] bg-[#0f1612] p-5">
              <div className="flex items-center gap-2 text-sm font-display font-medium mb-4">
                <Banknote size={16} className="text-[#d4a84b]" /> تسجيل دين على حدا
              </div>
              <UserDebtForm currencies={currencies} onSubmit={onCreateDebt} />
              <p className="text-[11px] text-[#5a7565] mt-3">
                هذا بس تسجيل بالدفتر — ما بينقل مصاري. المبلغ الحقيقي بينتقل لما هو يسدد.
              </p>
            </div>

            <div>
              <div className="text-xs font-mono text-[#5a7565] mb-2">ديون عليك</div>
              {owedByMe.length === 0 ? (
                <p className="text-sm text-[#5a7565] italic">ما في ديون عليك.</p>
              ) : (
                <div className="space-y-2">
                  {owedByMe.map((d) => (
                    <DebtRow key={d.id} debt={d} accounts={accounts} onRepay={onRepayDebt} viewerUsername={username} />
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-xs font-mono text-[#5a7565] mb-2">ديون لك عند غيرك</div>
              {owedToMe.length === 0 ? (
                <p className="text-sm text-[#5a7565] italic">ما في ديون لك.</p>
              ) : (
                <div className="space-y-2">
                  {owedToMe.map((d) => (
                    <DebtRow key={d.id} debt={d} accounts={accounts} viewerUsername={username} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view !== "card" && view !== "debts" && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {codes.map((c) => (
                <div
                  key={c}
                  className={`rounded-2xl border p-4 ${
                    bal(account, c) < 0
                      ? "border-[#8b3d3d] bg-gradient-to-br from-[#2a1313] to-[#1a0d0d]"
                      : "border-[#1a2620] bg-gradient-to-br from-[#121c17] to-[#0d1410]"
                  }`}
                >
                  <div className="text-[11px] font-mono text-[#5a7565] mb-1.5">{c}</div>
                  <div
                    className={`font-display text-2xl font-bold tracking-tight ${
                      bal(account, c) < 0 ? "text-[#d98f8f]" : ""
                    }`}
                  >
                    {fmt(bal(account, c))}
                  </div>
                  <div className="text-[10px] text-[#5a7565] mt-1">{currencies[c].name}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setView(view === "send" ? "home" : "send")}
              className="w-full mb-5 flex items-center justify-center gap-2 bg-gradient-to-r from-[#2a5c3d] to-[#1e4a30] text-[#e6f0ea] font-medium py-3 rounded-xl text-sm hover:from-[#347049] hover:to-[#265c3a] transition-all shadow-lg shadow-[#1e3d2a]/30"
            >
              <ArrowRightLeft size={16} /> إرسال
            </button>

            {view === "send" && (
              <div className="rounded-2xl border border-[#1a2620] bg-[#0f1612] p-5 mb-5">
                <SendForm currencies={currencies} onSubmit={onTransfer} />
                <p className="text-[11px] text-[#5a7565] mt-4 leading-relaxed">
                  اكتب اسم المستخدم يدوياً. لو أرسلت لشخص غلط، هو يقدر يرجع المبلغ من سجله.
                </p>
              </div>
            )}

            {managed.length > 0 && (
              <div className="rounded-2xl border border-[#2a4035] bg-[#0f1612] p-5 mb-5">
                <div className="flex items-center gap-2 text-sm font-display font-medium mb-4">
                  <Coins size={16} className="text-[#6bbf8a]" /> إدارتك للعملة
                </div>
                <ManageCurrencyForm currencies={currencies} managed={managed} onMint={onMint} />
                <p className="text-[11px] text-[#5a7565] mt-3">اكتب اسم المستخدم اللي بدك تصدر له.</p>
              </div>
            )}

            <div className="text-xs font-mono text-[#5a7565] mb-3 flex items-center gap-1.5">
              <History size={12} /> سجلك الشخصي
            </div>
            {ledger.length === 0 ? (
              <p className="text-sm text-[#5a7565] italic text-center py-6">لا يوجد نشاط بعد.</p>
            ) : (
              <div className="space-y-1">
                {ledger.map((e) => (
                  <LedgerRow
                    key={e.id}
                    entry={e}
                    accounts={accounts}
                    onReturn={onReturn}
                    canReturn={e.type === "transfer" && e.toUser === username && !returnedIds.has(e.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Forms ─── */
function NewAccountForm({ onSubmit }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="الاسم"
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] transition-colors"
      />
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="اسم المستخدم (بالإنجليزي)"
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] font-mono transition-colors"
        dir="ltr"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="كلمة المرور"
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] transition-colors"
      />
      <button
        onClick={() => {
          onSubmit(username, name, password);
          setName("");
          setUsername("");
          setPassword("");
        }}
        className="w-full bg-gradient-to-r from-[#2a5c3d] to-[#1e4a30] text-[#e6f0ea] font-medium py-3 rounded-xl text-sm hover:from-[#347049] hover:to-[#265c3a] transition-all flex items-center justify-center gap-2"
      >
        <Lock size={15} /> فتح حساب
      </button>
    </div>
  );
}

function NewCurrencyForm({ accounts, onSubmit }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [manager, setManager] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);

  return (
    <div className="space-y-3">
      <div className="text-sm font-display font-medium mb-1">عملة جديدة</div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="اسم العملة (مثلاً: Gold Coin)"
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] transition-colors"
      />
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="رمز قصير (مثلاً: GLD)"
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] font-mono transition-colors"
        dir="ltr"
        maxLength={6}
      />
      <select
        value={manager}
        onChange={(e) => setManager(e.target.value)}
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a]"
      >
        <option value="">بدون مسؤول (أنت بس اللي تصدرها)</option>
        {Object.entries(accounts).map(([u, a]) => (
          <option key={u} value={u}>
            اجعل {a.name} مسؤول عنها
          </option>
        ))}
      </select>
      <label className="flex items-start gap-2.5 bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={allowNegative}
          onChange={(e) => setAllowNegative(e.target.checked)}
          className="mt-0.5 accent-[#3d8b5a]"
        />
        <span className="text-xs text-[#c8d9cf] leading-relaxed">
          اسمح بالرصيد السالب لهاي العملة — يعني الشخص يقدر يرسل أو يُسحب منه أكتر من رصيده، وبيصير رصيده بالسالب (دين تلقائي).
        </span>
      </label>
      <button
        onClick={() => {
          onSubmit(code, name, manager, allowNegative);
          setCode("");
          setName("");
          setManager("");
          setAllowNegative(false);
        }}
        className="w-full bg-gradient-to-r from-[#2a5c3d] to-[#1e4a30] text-[#e6f0ea] font-medium py-3 rounded-xl text-sm hover:from-[#347049] hover:to-[#265c3a] transition-all"
      >
        إنشاء العملة
      </button>
    </div>
  );
}

function ManageCurrencyForm({ currencies, managed, onMint }) {
  const [currency, setCurrency] = useState(managed[0]);
  const [toUser, setToUser] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3">
      {managed.length > 1 && (
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a]"
        >
          {managed.map((c) => (
            <option key={c} value={c}>
              {currencies[c].name} ({c})
            </option>
          ))}
        </select>
      )}
      <input
        value={toUser}
        onChange={(e) => setToUser(e.target.value)}
        placeholder="اسم المستخدم"
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] font-mono transition-colors"
        dir="ltr"
      />
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="المبلغ"
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] font-mono transition-colors"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="ملاحظة (اختياري)"
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] transition-colors"
      />
      <button
        onClick={() => {
          onMint(currency, toUser, amount, note);
          setAmount("");
          setNote("");
          setToUser("");
        }}
        className="w-full border border-[#3d8b5a] text-[#6bbf8a] font-medium py-3 rounded-xl text-sm hover:bg-[#1e3d2a]/40 transition-all"
      >
        إصدار {currency}
      </button>
    </div>
  );
}

function UserDebtForm({ currencies, onSubmit }) {
  const codes = Object.keys(currencies);
  const [debtor, setDebtor] = useState("");
  const [currency, setCurrency] = useState(codes[0] || "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <input
        value={debtor}
        onChange={(e) => setDebtor(e.target.value)}
        placeholder="اسم المستخدم المديون لك"
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] font-mono transition-colors"
        dir="ltr"
      />
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a]"
      >
        {codes.map((c) => (
          <option key={c} value={c}>
            {currencies[c].name} ({c})
          </option>
        ))}
      </select>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="المبلغ"
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] font-mono transition-colors"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="سبب الدين (اختياري)"
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] transition-colors"
      />
      <button
        onClick={() => {
          onSubmit(debtor, currency, amount, note);
          setDebtor("");
          setAmount("");
          setNote("");
        }}
        className="w-full border border-[#3d8b5a] text-[#6bbf8a] font-medium py-3 rounded-xl text-sm hover:bg-[#1e3d2a]/40 transition-all"
      >
        تسجيل الدين
      </button>
    </div>
  );
}

function SendForm({ currencies, onSubmit }) {
  const codes = Object.keys(currencies);
  const [currency, setCurrency] = useState(codes[0] || "");
  const [toUser, setToUser] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-3">
      <select
        value={currency}
        onChange={(e) => setCurrency(e.target.value)}
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a]"
      >
        {codes.map((c) => (
          <option key={c} value={c}>
            {currencies[c].name} ({c})
          </option>
        ))}
      </select>
      <input
        value={toUser}
        onChange={(e) => setToUser(e.target.value)}
        placeholder="اسم المستخدم"
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] font-mono transition-colors"
        dir="ltr"
      />
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="المبلغ"
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] font-mono transition-colors"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="ملاحظة (اختياري)"
        className="w-full bg-[#0a0f0d] border border-[#1e2b24] rounded-xl px-4 py-3 text-sm outline-none focus:border-[#3d8b5a] transition-colors"
      />
      <button
        onClick={async () => {
          const ok = await onSubmit(currency, toUser, amount, note);
          if (ok !== false) {
            setAmount("");
            setNote("");
            setToUser("");
          }
        }}
        className="w-full bg-gradient-to-r from-[#2a5c3d] to-[#1e4a30] text-[#e6f0ea] font-medium py-3 rounded-xl text-sm hover:from-[#347049] hover:to-[#265c3a] transition-all"
      >
        إرسال
      </button>
    </div>
  );
            }
