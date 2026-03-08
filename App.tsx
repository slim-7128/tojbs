import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  UploadCloud, 
  LogOut, 
  Globe, 
  Save, 
  Download, 
  Trash2, 
  ShieldCheck, 
  CheckCircle, 
  Loader2, 
  Search, 
  Menu, 
  X, 
  Plus, 
  Briefcase, 
  FileCheck, 
  FileSpreadsheet,
  TrendingUp,
  TrendingDown, 
  DollarSign,
  Landmark,
  ArrowRightLeft,
  Book,
  UserCog,
  Pencil,
  Settings,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  ArrowRight,
  UserPlus,
  KeyRound,
  ArrowLeft,
  Database,
  AlertTriangle,
  SaveAll,
  Cloud,
  RefreshCw
} from 'lucide-react';
import { Invoice, Language, Vendor, BankTransaction } from './types';
import { TRANSLATIONS } from './constants';
import { analyzeInvoice, analyzeBankStatement, analyzePCM } from './services/geminiService';
import { exportToExcel, exportSalesJournal, exportBankStatement, readExcelFile } from './services/excelService';
import { supabase } from './services/supabaseClient';

const SidebarItem = ({ icon: Icon, label, active, onClick, collapsed }: any) => (
  <button 
    onClick={onClick}
    className={`flex items-center w-full p-3 mb-2 rounded-lg transition-colors ${
      active ? 'bg-primary text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    }`}
  >
    <Icon size={20} />
    {!collapsed && <span className="mx-3 font-medium text-sm">{label}</span>}
  </button>
);

const StatCard = ({ title, value, subtext, colorClass, icon: Icon }: any) => (
  <div className="bg-surface p-6 rounded-xl shadow-lg border border-gray-800">
    <div className="flex justify-between items-start">
      <div>
        <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">{title}</h3>
        <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
        {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
      </div>
      {Icon && <Icon size={24} className="text-gray-600" />}
    </div>
  </div>
);

// Helper to find value in row with fuzzy key matching
const findVal = (row: any, keywords: string[]): any => {
    if (!row) return undefined;
    const keys = Object.keys(row);
    // 1. Exact match (case insensitive)
    for (const kw of keywords) {
        const exact = keys.find(k => k.toLowerCase().trim() === kw.toLowerCase().trim());
        if (exact) return row[exact];
    }
    // 2. Partial match
    for (const kw of keywords) {
        const partial = keys.find(k => k.toLowerCase().includes(kw.toLowerCase()));
        if (partial) return row[partial];
    }
    return undefined;
};

// Full Moroccan Plan Comptable Data (Updated from User PDF)
const PCM_DATA = [
  // Page 1
  { code: '1111000000', label: 'CAPITAL SOCIAL', class: 1 },
  { code: '1140000000', label: 'RESERVE LEGALE', class: 1 },
  { code: '1161000000', label: 'REPORT A NOUVEAU (SOLDE CREDITEUR)', class: 1 },
  { code: '1169000000', label: 'REPORT A NOUVEAU (SOLDE DEBITEUR)', class: 1 },
  { code: '1181000000', label: 'RESULTAT NET EN INSTANC. AFFECT. (CREDITEUR)', class: 1 },
  { code: '2331000000', label: 'INSTALLATIONS TECHNIQUES', class: 2 },
  { code: '2332000000', label: 'MATERIEL ET OUTILLAGE', class: 2 },
  { code: '2340000000', label: 'MATERIEL DE TRANSPORT (VOLKSWAGEN)', class: 2 },
  { code: '2351000000', label: 'MOBILIER DE BUREAU', class: 2 },
  { code: '2352000000', label: 'MATERIEL DE BUREAU', class: 2 },
  { code: '2355000000', label: 'MATERIEL INFORMATIQUE', class: 2 },
  { code: '2356000000', label: 'AGENCEMENT INSTAL. AMENAG. DIVERS', class: 2 },
  { code: '2486000000', label: 'DEPOTS ET CAUTIONNEMENTS VERSES', class: 2 },
  { code: '2833100000', label: 'AMORTISSEMENT DES INSTALLATIONS TECHNIQUES', class: 2 },
  { code: '2833200000', label: 'AMORTISSEMENT DU MATERIEL ET OUTILLAGE', class: 2 },
  { code: '2834000000', label: 'AMORT.MAT.TRANSPORT', class: 2 },
  { code: '2835100000', label: 'AMORTISSEMENT DU MOBILER DE BUREAU', class: 2 },
  { code: '2835200000', label: 'AMORTISSEMENT DU MATERIEL DE BUREAU', class: 2 },
  { code: '2835500000', label: 'AMORTISSEMENT DU MATERIEL INFORMATIQUE', class: 2 },
  { code: '2835600000', label: 'AMORTISSEMENT DES AGENCEM. INST. AMENAG. DIV.', class: 2 },
  { code: '3122000000', label: 'MATIERES+FOURNITURES CONSOM.', class: 3 },
  { code: '3134101000', label: 'TRA.R.NON.FCT', class: 3 },
  { code: '3411000000', label: 'FOURNIS.AVANC.ACOMP.SUR COM.EX', class: 3 },
  { code: '3421000002', label: 'DRI MEKNES', class: 3 },
  { code: '3421000009', label: 'THERMOPLAST', class: 3 },
  { code: '3421033000', label: 'DPI KENITRA', class: 3 },
  { code: '3421035000', label: 'KOUFACHA ROUTIERS', class: 3 },
  { code: '3421052000', label: 'MARINA BOUREGREG', class: 3 },
  { code: '3421053000', label: 'FONDATION ERRAWAJ', class: 3 },
  { code: '3421054000', label: 'CU SAISI FES', class: 3 },
  { code: '3421055000', label: 'CU DHAR LMAHRAZ FES', class: 3 },
  { code: '3421056000', label: 'AGENCE NATIONALE DE LA SECURITE ROUTIERE', class: 3 },
  { code: '3421057000', label: 'HDG TAMESNA', class: 3 },
  { code: '3421058000', label: 'CRRAR', class: 3 },
  { code: '3421070000', label: 'HOLCIM', class: 3 },
  { code: '3421120000', label: 'BANK AL MAGHRIB', class: 3 },
  { code: '3421140000', label: 'CIH BANK', class: 3 },
  { code: '3421230000', label: 'CONCASSAGE MA', class: 3 },
  { code: '3421460000', label: 'AFRIQUE ETANCHEITE', class: 3 },
  { code: '3421480000', label: 'DIRECTION DES DOMAINES DE L\'ETAT', class: 3 },
  { code: '3421942000', label: 'IPVET', class: 3 },
  { code: '3421947000', label: 'STE GRANAL', class: 3 },
  { code: '3424000000', label: 'CLIENTS DOUTEUX OU LITIGEUX', class: 3 },
  { code: '3450000000', label: 'ETAT DEBITEUR', class: 3 },
  { code: '3453000000', label: 'ACOMPTES SUR IMPOTS S.RESULTAT', class: 3 },
  { code: '3455100000', label: 'ETAT - TVA RECUPERABLE SUR LES IMMOBILISAT.', class: 3 },
  { code: '3455200000', label: 'ETAT - TVA RECUPERABLE SUR LES CHARGES', class: 3 },
  // Page 2
  { code: '3456000000', label: 'ETAT-CREDIT T.V.A.(SUIV.DECLAR)', class: 3 },
  { code: '3458000000', label: 'ETAT-AUTRES COMPTES DEBITEURS', class: 3 },
  { code: '3458023000', label: 'LE RESTE DE L\'EXCEDENT 2023', class: 3 },
  { code: '3458024000', label: 'EXCEDENT 2024', class: 3 },
  { code: '3458RAS000', label: 'RAS/TVA', class: 3 },
  { code: '3488000000', label: 'CAUTIONS', class: 3 },
  { code: '3497000000', label: 'COMPTES TRANSITOIRES OU AT.DEB', class: 3 },
  { code: '4411000015', label: 'SLIMCO SERVICES', class: 4 },
  { code: '4411000031', label: 'BELTRANSFO', class: 4 },
  { code: '4411000066', label: 'HOTEL ONOMO', class: 4 },
  { code: '4411000067', label: 'LOW TECH & SERVICES', class: 4 },
  { code: '4411000130', label: 'STE SALMI', class: 4 },
  { code: '4411001100', label: 'IAM', class: 4 },
  { code: '4411010000', label: 'REDAL', class: 4 },
  { code: '4411011000', label: 'NEXANS', class: 4 },
  { code: '4411025000', label: 'AUTOROUTES DE MAROC', class: 4 },
  { code: '4411040000', label: 'SOFA', class: 4 },
  { code: '4411080000', label: 'ELUMIRA', class: 4 },
  { code: '4411090000', label: 'OKSA MAROC', class: 4 },
  { code: '4411140000', label: 'BRICOMA', class: 4 },
  { code: '4411140012', label: 'OLA ENERGY HAY RIAD', class: 4 },
  { code: '4411170000', label: 'SCHIEL MAROC', class: 4 },
  { code: '4411210000', label: 'BESTMARK', class: 4 },
  { code: '4411320000', label: 'AXA ASSURANCE /MEGASSURE', class: 4 },
  { code: '4411360000', label: 'STE DE REFERENCE MATERIELS BUREAUX', class: 4 },
  { code: '4411410000', label: 'SODREYAS', class: 4 },
  { code: '4411700000', label: 'STE FERMOSTORE', class: 4 },
  { code: '4411943000', label: 'ORIMEX SA', class: 4 },
  { code: '4411944000', label: 'ELECTRO TADART', class: 4 },
  { code: '4411970000', label: 'PNEUMATIQUE TAMAZIRT', class: 4 },
  { code: '4411999013', label: 'SICOPEC SARL', class: 4 },
  { code: '4432000000', label: 'REMUNERATIONS DUES AU PERSON.', class: 4 },
  { code: '4438000000', label: 'PERSONNEL - AUTRES CREDITEURS', class: 4 },
  { code: '4441000000', label: 'CAISSE NATIONALE SECU. SOCIALE', class: 4 },
  { code: '4452500000', label: 'ETAT - IGR', class: 4 },
  { code: '4453000000', label: 'ETAT IMPOT SUR LES RESULTATS', class: 4 },
  { code: '4455000000', label: 'ETAT, T.V.A. FACTUREE', class: 4 },
  { code: '4456000000', label: 'ETAT T.V.A. DUE (SUIV.DECLARA)', class: 4 },
  { code: '4463000000', label: 'COMPTE COURANT ASSOCIE CREDITEUR', class: 4 },
  { code: '5115000000', label: 'VIREMENTS DE FONDS', class: 5 },
  { code: '5141010000', label: 'BANQUE POPULAIRE', class: 5 },
  { code: '5161000000', label: 'CAISSES', class: 5 },
  { code: '6122000000', label: 'ACHATS MAT+FOURN.CONSOMMABLES', class: 6 },
  { code: '6122300000', label: 'ACHAT DE COMBUSTIBLE', class: 6 },
  { code: '6124200000', label: 'VARIATION DE STOCK MATIERES ET FOURNITURES', class: 6 },
  { code: '6125100000', label: 'ACHATS DE FOURNITURES NON STOCKABLES (EAU,ELEC.)', class: 6 },
  { code: '6125101000', label: 'REDAL-DAHMANI AHMED', class: 6 },
  { code: '6125300000', label: 'ACHATS DE PETIT OUTILLAGE ET PETIT EQUIPEMENT', class: 6 },
  // Page 3
  { code: '6125400000', label: 'ACHATS DE FOURNITURES DE BUREAU', class: 6 },
  { code: '6126300000', label: 'ACHATS DES PRESTATIONS DE SERVICE', class: 6 },
  { code: '6133000000', label: 'ENTRETIEN ET REPARATIONS', class: 6 },
  { code: '6134500000', label: 'ASSURANCES - MATERIEL DE TRANSPORT', class: 6 },
  { code: '6136500000', label: 'HONORAIRES', class: 6 },
  { code: '6143000000', label: 'DEPLAC. RECEPTIONS MISSIONS', class: 6 },
  { code: '6143100000', label: 'VOYAGES DEPLACEMENTS', class: 6 },
  { code: '6143600000', label: 'RECEPTIONS', class: 6 },
  { code: '6145500000', label: 'FRAIS DE TELEPHONE', class: 6 },
  { code: '6147300000', label: 'FRAIS ET COMMISSIONS SUR SERVICES BANCAIRES', class: 6 },
  { code: '6161200000', label: 'PATENTE', class: 6 },
  { code: '6167100000', label: 'DROITS D\'ENREGISTREMENT ET DE TIMBRE', class: 6 },
  { code: '6167300000', label: 'TAXES SUR LES VEHICULES', class: 6 },
  { code: '6171000000', label: 'REMUNERATION DU PERSONNEL', class: 6 },
  { code: '6171300000', label: 'INDEMNITES ET AVANTAGES DIVERS', class: 6 },
  { code: '6174000000', label: 'CHARGES SOCIALES', class: 6 },
  { code: '6193400000', label: 'D.E.A. DU MATERIEL DE TRANSPORT', class: 6 },
  { code: '6193500000', label: 'D.E.A.DES MOBIL,MATER DE BURE ET AMEN DIVERS', class: 6 },
  { code: '6198000000', label: 'DOT. EXPLOIT. DES EXERC. ANT', class: 6 },
  { code: '6513000000', label: 'V.N.A IMMOB. CORPORELLES CEDEE', class: 6 },
  { code: '6583100000', label: 'PENALITES ET AMENDES FISCALES', class: 6 },
  { code: '6583400000', label: 'ARRONDIS', class: 6 },
  { code: '6705000000', label: 'IMPOSITION MINIMALE DES STES', class: 6 },
  { code: '7124300000', label: 'PRESTATIONS DE SERVICE', class: 7 },
  { code: '7513000000', label: 'P.C DES IMMOB CORPORELLES', class: 7 },
  { code: '7586400000', label: 'PRODUITS NON COURANTS - MEGASSURE', class: 7 }
];

export default function App() {
  const [lang, setLang] = useState<Language>('fr');
  const t = TRANSLATIONS[lang];

  // Initialize Auth from LocalStorage
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('tojbs_auth') === 'true';
  });
  const [currentUser, setCurrentUser] = useState(() => {
    return localStorage.getItem('tojbs_user_email') || '';
  });

  const [authView, setAuthView] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState(''); 
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'invoices' | 'vendors' | 'upload' | 'clients' | 'bank' | 'planComptable' | 'users' | 'settings'>('dashboard');
  const [uploadType, setUploadType] = useState<'purchase' | 'sale'>('purchase');
  
  // Data States - Initialized from LocalStorage
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    try {
      const saved = localStorage.getItem('tojbs_invoices');
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });

  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>(() => {
    try {
      const saved = localStorage.getItem('tojbs_bank');
      return saved ? JSON.parse(saved) : [];
    } catch(e) { return []; }
  });

  const [pcmList, setPcmList] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('tojbs_pcm');
      return saved ? JSON.parse(saved) : PCM_DATA;
    } catch(e) { return PCM_DATA; }
  });

  const [usersList, setUsersList] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('tojbs_users');
      let initialUsers = saved ? JSON.parse(saved) : [];
      const adminEmail = 'demo@example.com';
      const adminIndex = initialUsers.findIndex((u: any) => u.email === adminEmail);
      if (adminIndex >= 0) {
          initialUsers[adminIndex].role = 'Administrateur';
      } else {
          initialUsers = initialUsers.filter((u: any) => u.email !== 'admin@tojbs.com');
          initialUsers.unshift({ 
              id: 1, 
              name: 'Admin', 
              email: adminEmail, 
              role: 'Administrateur', 
              status: 'active', 
              lastLogin: 'Maintenant' 
          });
      }
      if (!initialUsers.find((u: any) => u.name === 'PPMI')) {
          initialUsers.push({ id: 2, name: 'PPMI', email: 'ppmi@tojbs.com', role: 'Éditeur', status: 'active', lastLogin: '-' });
      }
      if (!initialUsers.find((u: any) => u.name === 'MAPRELEC')) {
          initialUsers.push({ id: 3, name: 'MAPRELEC', email: 'maprelec@tojbs.com', role: 'Utilisateur', status: 'active', lastLogin: '-' });
      }
      return initialUsers;
    } catch(e) { 
        return [
            { id: 1, name: 'Admin', email: 'demo@example.com', role: 'Administrateur', status: 'active', lastLogin: 'Maintenant' },
            { id: 2, name: 'PPMI', email: 'ppmi@tojbs.com', role: 'Éditeur', status: 'active', lastLogin: '-' },
            { id: 3, name: 'MAPRELEC', email: 'maprelec@tojbs.com', role: 'Utilisateur', status: 'active', lastLogin: '-' }
        ];
    }
  });

  const currentUserRole = useMemo(() => {
    if (!currentUser) return '';
    const user = usersList.find(u => u.email === currentUser);
    return user ? user.role : 'Utilisateur'; 
  }, [currentUser, usersList]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('All');
  const [dataLoading, setDataLoading] = useState(false);

  // Modal State for User Management
  const [userModal, setUserModal] = useState<{
    isOpen: boolean;
    type: 'add' | 'edit' | 'delete';
    userData: { id: number; name: string; email?: string; role?: string; status?: string; } | null;
  }>({ isOpen: false, type: 'add', userData: null });

  // Modal State for Data Deletion (Invoice/Transaction)
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    type: 'invoice' | 'transaction';
  } | null>(null);

  // --- NEW: Document Modal State (View/Edit) ---
  const [documentModal, setDocumentModal] = useState<{
    isOpen: boolean;
    mode: 'view' | 'edit';
    type: 'invoice' | 'transaction' | 'pcm';
    data: any; // Holds Invoice, BankTransaction or PCM data
  }>({ isOpen: false, mode: 'view', type: 'invoice', data: null });

  // --- Computed ---
  const isRTL = lang === 'ar';

  const stats = useMemo(() => {
    const purchases = invoices.filter(inv => inv.type === 'purchase');
    const sales = invoices.filter(inv => inv.type === 'sale');

    const calculateTotals = (items: Invoice[]) => {
      const totalTTC = items.reduce((acc, inv) => acc + inv.amountTTC, 0);
      const totalHT = items.reduce((acc, inv) => acc + inv.amountHT, 0);
      const totalTVA = totalTTC - totalHT;
      return { totalTTC, totalHT, totalTVA };
    };

    const purchaseStats = calculateTotals(purchases);
    const salesStats = calculateTotals(sales);
    
    const vendorCounts: Record<string, number> = {};
    purchases.forEach(inv => {
      vendorCounts[inv.vendor] = (vendorCounts[inv.vendor] || 0) + 1;
    });
    const topVendor = Object.entries(vendorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    const clientCounts: Record<string, number> = {};
    sales.forEach(inv => {
      clientCounts[inv.vendor] = (clientCounts[inv.vendor] || 0) + 1;
    });
    const topClient = Object.entries(clientCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    return { 
      purchases: purchaseStats, 
      sales: salesStats, 
      topVendor,
      topClient,
      totalInvoices: invoices.length 
    };
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const targetType = activeTab === 'clients' ? 'sale' : 'purchase';
    if (activeTab === 'bank' || activeTab === 'planComptable' || activeTab === 'users' || activeTab === 'settings') return [];

    return invoices
      .filter(inv => inv.type === targetType)
      .filter(inv => 
        inv.vendor.toLowerCase().includes(searchQuery.toLowerCase()) || 
        inv.ice.includes(searchQuery) ||
        (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()))
      );
  }, [invoices, searchQuery, activeTab]);

  const filteredPCM = useMemo(() => {
    return pcmList.filter(acc => 
      acc.code.includes(searchQuery) || 
      acc.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [pcmList, searchQuery]);

  // --- Effects ---
  useEffect(() => {
    document.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang, isRTL]);

  useEffect(() => {
    localStorage.setItem('tojbs_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('tojbs_bank', JSON.stringify(bankTransactions));
  }, [bankTransactions]);

  useEffect(() => {
    localStorage.setItem('tojbs_users', JSON.stringify(usersList));
  }, [usersList]);

  useEffect(() => {
    localStorage.setItem('tojbs_pcm', JSON.stringify(pcmList));
  }, [pcmList]);

  useEffect(() => {
    if (activeTab === 'users' && currentUserRole !== 'Administrateur' && currentUserRole !== '') {
        setActiveTab('dashboard');
    }
  }, [activeTab, currentUserRole]);

  // --- Handlers ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        setIsAuthenticated(true);
        setCurrentUser(data.user.email || '');
        localStorage.setItem('tojbs_auth', 'true');
        localStorage.setItem('tojbs_user_email', data.user.email || '');
      }
    } catch (err: any) {
        // Fallback to demo accounts for ease of testing
        if ((email === 'demo@example.com' && password === 'Admin') || 
            (email === 'ppmi@tojbs.com' && password === 'PPMI') || 
            (email === 'maprelec@tojbs.com' && password === 'MAPRELEC')) {
            setIsAuthenticated(true);
            setCurrentUser(email);
            localStorage.setItem('tojbs_auth', 'true');
            localStorage.setItem('tojbs_user_email', email);
        } else {
            setAuthError(err.message || (lang === 'ar' 
              ? 'بيانات غير صحيحة.' 
              : 'Identifiants incorrects.'));
        }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    if (password !== confirmPassword) {
        setAuthError(lang === 'ar' ? 'كلمات المرور غير متطابقة' : 'Les mots de passe ne correspondent pas');
        setAuthLoading(false);
        return;
    }
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
      alert(lang === 'ar' ? 'تم إنشاء الحساب! يرجى التحقق من بريدك الإلكتروني' : 'Compte créé ! Veuillez vérifier votre email.');
      setAuthView('login');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setCurrentUser('');
    localStorage.removeItem('tojbs_auth');
    localStorage.removeItem('tojbs_user_email');
    setAuthView('login');
    setActiveTab('dashboard');
  };

  const handleSyncToCloud = async () => {
    if (!currentUser) {
        alert(lang === 'ar' ? 'يرجى تسجيل الدخول للمزامنة' : 'Veuillez vous connecter pour synchroniser');
        return;
    }
    setSyncing(true);
    try {
      const { error } = await supabase
        .from('user_data')
        .upsert({ 
          email: currentUser, 
          invoices: JSON.stringify(invoices),
          bank_transactions: JSON.stringify(bankTransactions),
          pcm_list: JSON.stringify(pcmList),
          updated_at: new Date().toISOString()
        }, { onConflict: 'email' });

      if (error) throw error;
      alert(lang === 'ar' ? 'تمت المزامنة بنجاح مع السحابة' : 'Synchronisation réussie avec le cloud');
    } catch (err: any) {
      console.error("Sync error:", err);
      alert(lang === 'ar' ? 'فشلت المزامنة. تأكد من إعداد Supabase' : 'Échec de la synchronisation. Vérifiez la configuration Supabase');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const loadCloudData = async () => {
      if (!currentUser || !isAuthenticated) return;
      setDataLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_data')
          .select('*')
          .eq('email', currentUser)
          .single();

        if (data && !error) {
          if (data.invoices) setInvoices(JSON.parse(data.invoices));
          if (data.bank_transactions) setBankTransactions(JSON.parse(data.bank_transactions));
          if (data.pcm_list) setPcmList(JSON.parse(data.pcm_list));
        }
      } catch (err) {
        console.error("Error loading cloud data:", err);
      } finally {
        setDataLoading(false);
      }
    };

    if (isAuthenticated) {
      loadCloudData();
    }
  }, [isAuthenticated, currentUser]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploading(true);
    const files: File[] = Array.from(e.target.files);
    try {
        // --- PLAN COMPTABLE ---
        if (activeTab === 'planComptable') {
            const newAccounts: any[] = [];
            const normalizeCode = (code: string) => {
                const cleaned = code.replace(/\D/g, '');
                if (!cleaned) return null;
                // Pad with trailing zeros to reach 10 digits
                return cleaned.padEnd(10, '0').substring(0, 10);
            };

            for (const file of files) {
                if (file.name.match(/\.(xlsx|xls|csv)$/i)) {
                    const excelData = await readExcelFile(file);
                    const mappedData = excelData.map((row: any) => {
                        const rawCode = String(findVal(row, ['Compte', 'Code', 'Numero']) || Object.values(row)[0] || "");
                        const normalized = normalizeCode(rawCode);
                        return {
                            code: normalized,
                            label: String(findVal(row, ['Intitulé', 'Libellé', 'Nom', 'Label']) || Object.values(row)[1] || "")
                        };
                    }).filter(acc => acc.code && acc.code.length === 10);

                    mappedData.forEach(item => {
                         newAccounts.push({ ...item, class: parseInt(item.code!.charAt(0)) || 0 });
                    });
                } else {
                    try {
                        const results = await analyzePCM(file);
                        const validatedResults = results.map(item => ({
                            ...item,
                            code: normalizeCode(item.code)
                        })).filter(item => item.code && item.code.length === 10);
                        newAccounts.push(...validatedResults);
                    } catch(e) { console.error(e); }
                }
            }
            if (newAccounts.length > 0) {
                setPcmList(prev => {
                    const existingCodes = new Set(prev.map(p => p.code));
                    const uniqueNew = newAccounts.filter(p => !existingCodes.has(p.code));
                    return [...prev, ...uniqueNew];
                });
                alert(`${newAccounts.length} comptes importés avec succès.`);
            } else {
                alert("Aucun compte n'a pu être extrait.");
            }
            setUploading(false);
            return;
        }

        // --- BANK STATEMENTS ---
        if (activeTab === 'bank') {
            let count = 0;
            for (const file of files) {
                if (file.name.match(/\.(xlsx|xls|csv)$/i)) {
                    const excelData = await readExcelFile(file);
                    const transactionsWithId = excelData.map((row: any) => {
                        const dateVal = String(findVal(row, ['Date', 'Opération', 'Jour']) || "");
                        if (!dateVal) return null; // Skip invalid rows

                        return {
                            id: Math.random().toString(36).substr(2, 9),
                            date: dateVal,
                            description: String(findVal(row, ['Libellé', 'Libelle', 'Description', 'Opération']) || ""),
                            reference: String(findVal(row, ['Référence', 'Ref', 'Reference', 'Piece']) || ""),
                            debit: parseFloat(findVal(row, ['Débit', 'Debit', 'Sortie']) || 0) || 0,
                            credit: parseFloat(findVal(row, ['Crédit', 'Credit', 'Entrée']) || 0) || 0,
                            contraAccount: String(findVal(row, ['Contre partie', 'Compte', 'C.Partie']) || "4710000000"),
                            user_id: 'local'
                        };
                    }).filter(t => t !== null) as BankTransaction[];

                    if (transactionsWithId.length > 0) {
                        setBankTransactions(prev => [...transactionsWithId, ...prev]);
                        count += transactionsWithId.length;
                    }
                } else {
                    try {
                        const results = await analyzeBankStatement(file);
                        const transactionsWithId = results.map(t => ({ 
                            ...t, 
                            id: Math.random().toString(36).substr(2, 9), 
                            user_id: 'local' 
                        }));
                        if (transactionsWithId.length > 0) {
                            setBankTransactions(prev => [...transactionsWithId, ...prev]);
                            count += transactionsWithId.length;
                        }
                    } catch (err) { console.error(err); }
                }
            }
            if (count === 0) alert("Aucune transaction n'a été importée. Vérifiez le format (Colonnes: Date, Libellé, Débit, Crédit).");
            else alert(`${count} transaction(s) importée(s).`);
            setUploading(false);
            return;
        }

        // --- INVOICES (Purchases/Sales) ---
        const invoiceType = uploadType;
        let count = 0;
        for (const file of files) {
            if (file.name.match(/\.(xlsx|xls|csv)$/i)) {
                const excelData = await readExcelFile(file);
                const newInvoices = excelData.map((row: any) => {
                    const dateVal = String(findVal(row, ['Date', 'Facturé le']) || "");
                    const amountTTC = parseFloat(findVal(row, ['TTC', 'Total', 'Net à payer', 'Montant TTC']) || 0) || 0;
                    
                    if (!dateVal || amountTTC === 0) return null; // Skip invalid rows

                    return {
                        id: Math.random().toString(36).substr(2, 9),
                        fileName: file.name,
                        vendor: String(findVal(row, ['Fournisseur', 'Client', 'Tiers', 'Nom']) || "Inconnu"),
                        date: dateVal,
                        ice: String(findVal(row, ['ICE', 'Identifiant']) || ""),
                        if_fiscal: String(findVal(row, ['IF', 'Fiscal']) || ""),
                        amountHT: parseFloat(findVal(row, ['HT', 'Net', 'Base', 'Hors Taxe']) || 0) || 0,
                        amountTTC: amountTTC,
                        tvaRate: "20%",
                        tvaBreakdown: [],
                        category: String(findVal(row, ['Catégorie', 'Type']) || "Divers"),
                        invoiceNumber: String(findVal(row, ['N°', 'Numéro', 'Reference', 'Piece']) || ""),
                        status: 'processed',
                        type: invoiceType,
                        timestamp: Date.now()
                    };
                }).filter(inv => inv !== null) as Invoice[];
                
                if (newInvoices.length > 0) {
                    setInvoices(prev => [...newInvoices, ...prev]); 
                    count += newInvoices.length;
                }
            } else {
                try {
                    const result = await analyzeInvoice(file, invoiceType);
                    const invoicePayload = {
                        id: Math.random().toString(36).substr(2, 9),
                        fileName: file.name,
                        vendor: result.vendor || "Inconnu",
                        date: result.date || "",
                        ice: result.ice || "",
                        if_fiscal: result.if_fiscal || "",
                        amountHT: result.amountHT || 0,
                        amountTTC: result.amountTTC || 0,
                        tvaRate: (result.tvaRate as any) || "20%",
                        tvaBreakdown: result.tvaBreakdown || [],
                        category: result.category || "",
                        invoiceNumber: result.invoiceNumber || "",
                        status: 'processed',
                        type: invoiceType,
                        timestamp: Date.now()
                    };
                    setInvoices(prev => [invoicePayload as Invoice, ...prev]); 
                    count++;
                } catch (err) {
                    console.error(err);
                }
            }
        }
        if (count === 0 && files.length > 0) alert("Aucune facture n'a été importée. Vérifiez vos fichiers.");
        else if (count > 0) alert(`${count} facture(s) importée(s) avec succès.`);

        setUploading(false);
    } catch (error) {
        console.error("Global upload error:", error);
        alert("Erreur lors de l'importation. Vérifiez vos fichiers.");
        setUploading(false);
    }
  };

  const promptDeleteInvoice = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (confirm("Voulez-vous vraiment supprimer cette facture ?")) {
          setInvoices(prev => prev.filter(i => i.id !== id));
      }
  };

  const promptDeleteTransaction = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (confirm("Voulez-vous vraiment supprimer cette transaction ?")) {
          setBankTransactions(prev => prev.filter(t => t.id !== id));
      }
  };

  const handleDeletePCM = (code: string) => {
    if (confirm("Voulez-vous vraiment supprimer ce compte ?")) {
      setPcmList(prev => prev.filter(acc => acc.code !== code));
    }
  };

  const handleClearPCM = () => {
    if (confirm("ATTENTION: Cela supprimera tout le plan comptable. Continuer ?")) {
      setPcmList([]);
      localStorage.removeItem('tojbs_pcm');
    }
  };

  const handleClearBank = () => {
    if (confirm("Voulez-vous vraiment supprimer toutes les transactions bancaires ?")) {
      setBankTransactions([]);
      localStorage.removeItem('tojbs_bank');
    }
  };

  const handleClearInvoices = () => {
    if (confirm("Voulez-vous vraiment supprimer toutes les factures ?")) {
      setInvoices([]);
      localStorage.removeItem('tojbs_invoices');
    }
  };

  const handleClearDocuments = () => {
    if (confirm("Voulez-vous vraiment supprimer toutes les factures et tous les relevés bancaires ?")) {
      setInvoices([]);
      setBankTransactions([]);
      localStorage.removeItem('tojbs_invoices');
      localStorage.removeItem('tojbs_bank');
    }
  };

  const saveWork = () => {
      localStorage.setItem('tojbs_invoices', JSON.stringify(invoices));
      localStorage.setItem('tojbs_bank', JSON.stringify(bankTransactions));
      localStorage.setItem('tojbs_pcm', JSON.stringify(pcmList));
      localStorage.setItem('tojbs_users', JSON.stringify(usersList));
      const backupData = {
          version: "1.0",
          timestamp: new Date().toISOString(),
          invoices,
          bankTransactions,
          usersList,
          pcmList
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tojbs_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    if (confirm("ATTENTION: Cela supprimera toutes vos données locales (Factures, Transactions et Plan Comptable). Continuer ?")) {
      setInvoices([]);
      setBankTransactions([]);
      setPcmList([]);
      localStorage.removeItem('tojbs_invoices');
      localStorage.removeItem('tojbs_bank');
      localStorage.removeItem('tojbs_pcm');
    }
  };

  const handleAddUser = () => {
    setUserModal({
        isOpen: true,
        type: 'add',
        userData: { id: 0, name: '', email: '', role: 'Utilisateur', status: 'active' }
    });
  };

  const handleEditUser = (id: number) => {
    const user = usersList.find(u => u.id === id);
    if (!user) return;
    setUserModal({
        isOpen: true,
        type: 'edit',
        userData: { id: user.id, name: user.name, email: user.email || '', role: user.role, status: user.status }
    });
  };

  const handleDeleteUser = (id: number) => {
    const user = usersList.find(u => u.id === id);
    if (!user) return;
    setUserModal({
        isOpen: true,
        type: 'delete',
        userData: { id: user.id, name: user.name }
    });
  };

  const handleModalConfirm = () => {
    if (userModal.type === 'add') {
       if (userModal.userData?.name.trim()) {
          const newUser = { 
              id: Date.now(),
              name: userModal.userData!.name.trim(), 
              email: userModal.userData!.email?.trim() || '',
              role: userModal.userData!.role || 'Utilisateur', 
              status: userModal.userData!.status || 'active', 
              lastLogin: '-' 
          };
          setUsersList(prev => [...prev, newUser]);
       }
    } else if (userModal.type === 'edit') {
       if (userModal.userData?.name.trim()) {
           setUsersList(prev => prev.map(u => u.id === userModal.userData!.id ? 
             { 
               ...u, 
               name: userModal.userData!.name.trim(), 
               email: userModal.userData!.email?.trim() || '',
               role: userModal.userData!.role || u.role,
               status: userModal.userData!.status || u.status
             } 
             : u));
       }
    } else if (userModal.type === 'delete') {
       setUsersList(prev => prev.filter(u => u.id !== userModal.userData!.id));
    }
    setUserModal({ ...userModal, isOpen: false });
  };

  // --- NEW HANDLERS FOR DOC MODAL ---
  const handleOpenDocModal = (mode: 'view' | 'edit', type: 'invoice' | 'transaction' | 'pcm', data: any) => {
      setDocumentModal({
          isOpen: true,
          mode,
          type,
          data: { ...data } // shallow copy to avoid mutating state directly
      });
  };

  const handleSaveDoc = () => {
      if (!documentModal.data) return;
      
      if (documentModal.type === 'invoice') {
          setInvoices(prev => prev.map(inv => inv.id === documentModal.data.id ? documentModal.data : inv));
      } else if (documentModal.type === 'transaction') {
          setBankTransactions(prev => prev.map(tx => tx.id === documentModal.data.id ? documentModal.data : tx));
      } else if (documentModal.type === 'pcm') {
          // Normalize code to 10 digits
          const cleaned = documentModal.data.code.replace(/\D/g, '');
          if (!cleaned) {
              alert("Le code comptable est obligatoire.");
              return;
          }
          const normalizedCode = cleaned.padEnd(10, '0').substring(0, 10);
          const validatedData = { 
              ...documentModal.data, 
              code: normalizedCode,
              class: parseInt(normalizedCode.charAt(0)) || 0
          };

          setPcmList(prev => {
              const exists = prev.find(acc => acc.code === validatedData.code);
              if (exists) {
                  return prev.map(acc => acc.code === validatedData.code ? validatedData : acc);
              } else {
                  return [validatedData, ...prev];
              }
          });
      }
      setDocumentModal({ ...documentModal, isOpen: false });
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen bg-secondary overflow-hidden">
        {/* Left Side - Visual (Hidden on small screens) */}
        <div className="hidden lg:flex w-1/2 relative flex-col justify-center items-center bg-surface overflow-hidden p-12">
            {/* Abstract Background */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2"></div>
            
            {/* Pattern */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>

            <div className="relative z-10 max-w-lg text-center">
                <div className="mx-auto mb-8 flex items-center justify-center">
                    <FileText size={80} className="text-primary" />
                </div>
                <h1 className="text-5xl font-bold text-white mb-6 tracking-tight leading-tight">
                   <span className="font-serif italic font-medium pr-2">ToJbs</span> <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Local Edition</span>
                </h1>
                <p className="text-lg text-gray-400 leading-relaxed mb-8">
                    Simplifiez votre comptabilité avec l'intelligence artificielle. Vos données restent stockées sur votre appareil.
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500 font-mono border border-gray-700/50 bg-gray-900/30 py-2 px-4 rounded-full w-fit mx-auto backdrop-blur-sm">
                   <CheckCircle size={14} className="text-green-500" />
                   <span>OCR Marocain</span>
                   <span className="mx-2">•</span>
                   <CheckCircle size={14} className="text-green-500" />
                   <span>Offline First</span>
                </div>
            </div>
        </div>

        {/* Right Side - Dynamic Auth Forms */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative z-10">
            {/* Mobile Background Blob */}
            <div className="lg:hidden absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

            <div className="w-full max-w-md space-y-8">
                {/* Header Text based on View */}
                <div className="text-center lg:text-left">
                    <h2 className="text-3xl font-bold text-white mb-2">
                        {authView === 'login' && t.welcome}
                        {authView === 'signup' && (lang === 'ar' ? 'إنشاء حساب جديد' : 'Créer un compte')}
                        {authView === 'forgot' && (lang === 'ar' ? 'استعادة كلمة المرور' : 'Récupération mot de passe')}
                    </h2>
                    <p className="text-gray-400">
                        {authView === 'login' && t.loginSubtitle}
                        {authView === 'signup' && (lang === 'ar' ? 'انضم إلينا لتبسيط إدارتك المالية.' : 'Rejoignez-nous pour simplifier votre gestion.')}
                        {authView === 'forgot' && (lang === 'ar' ? 'أدخل بريدك الإلكتروني لاستعادة الحساب.' : 'Entrez votre email pour réinitialiser.')}
                    </p>
                </div>

                {authError && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-xl text-sm flex items-center">
                        <X size={16} className="mr-2" />
                        {authError}
                    </div>
                )}

                <form onSubmit={authView === 'login' ? handleLogin : handleSignup} className="space-y-5">
                    
                    {/* Username Field - Common to all */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-300 ml-1">Email</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <UserIcon size={18} className="text-gray-500 group-focus-within:text-primary transition-colors" />
                            </div>
                            <input 
                                type="email" 
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-xl bg-gray-900/50 text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all sm:text-sm"
                                placeholder="demo@example.com"
                                required
                            />
                        </div>
                    </div>

                    {/* Password Field - Common to all except forgot (initial step) */}
                    {authView !== 'forgot' && (
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                           <label className="text-sm font-medium text-gray-300 ml-1">
                               {t.password}
                           </label>
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock size={18} className="text-gray-500 group-focus-within:text-primary transition-colors" />
                            </div>
                            <input 
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="block w-full pl-10 pr-10 py-3 border border-gray-700 rounded-xl bg-gray-900/50 text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all sm:text-sm"
                                placeholder={authView === 'login' ? 'Admin' : '••••••••'}
                                required
                            />
                            <div 
                              className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-gray-500 hover:text-white transition-colors"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </div>
                        </div>
                    </div>
                    )}

                    {/* Confirm Password - Only for Signup */}
                    {authView === 'signup' && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-4 duration-300">
                            <label className="text-sm font-medium text-gray-300 ml-1">
                                {lang === 'ar' ? 'تأكيد كلمة المرور' : 'Confirmer mot de passe'}
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <ShieldCheck size={18} className="text-gray-500 group-focus-within:text-primary transition-colors" />
                                </div>
                                <input 
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="block w-full pl-10 pr-10 py-3 border border-gray-700 rounded-xl bg-gray-900/50 text-white placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all sm:text-sm"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <button 
                        disabled={authLoading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg shadow-primary/20 text-sm font-bold text-white bg-primary hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-secondary transition-all transform active:scale-95"
                    >
                        {authLoading ? <Loader2 className="animate-spin" size={20} /> : (
                            <div className="flex items-center">
                                {authView === 'login' && t.loginBtn}
                                {authView === 'signup' && (lang === 'ar' ? 'تسجيل حساب' : 'S\'inscrire')}
                                {authView === 'forgot' && (lang === 'ar' ? 'إرسال الرابط' : 'Envoyer le lien')}
                                
                                <ArrowRight size={16} className={`ml-2 ${isRTL ? 'rotate-180' : ''}`} />
                            </div>
                        )}
                    </button>
                </form>

                {/* Back to Login Links */}
                {(authView === 'signup' || authView === 'forgot') && (
                    <div className="text-center">
                        <button 
                            onClick={() => { setAuthView('login'); setAuthError(''); }}
                            className="text-sm text-gray-400 hover:text-white flex items-center justify-center mx-auto transition-colors"
                        >
                            <ArrowLeft size={16} className={`mr-2 ${isRTL ? 'rotate-180' : ''}`} />
                            {lang === 'ar' ? 'العودة لتسجيل الدخول' : 'Retour à la connexion'}
                        </button>
                    </div>
                )}

                {/* Create Account Link (Only on Login) */}
                {authView === 'login' && (
                    <>
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-700"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-secondary text-gray-500">{t.or}</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                             {/* Create Account Button */}
                            <button 
                                onClick={() => { setAuthView('signup'); setAuthError(''); }}
                                className="w-full flex items-center justify-center px-4 py-3 border border-gray-700 rounded-xl shadow-sm bg-surface hover:bg-gray-800 text-sm font-medium text-white transition-all hover:border-primary group"
                            >
                                <UserPlus className="h-5 w-5 mr-2 text-gray-400 group-hover:text-primary transition-colors" />
                                {lang === 'ar' ? 'إنشاء حساب جديد' : 'Créer un compte'}
                            </button>
                        </div>
                    </>
                )}

                <div className="pt-6 flex justify-between items-center text-xs text-gray-500">
                    <button onClick={() => setLang(lang === 'fr' ? 'ar' : 'fr')} className="flex items-center hover:text-primary transition-colors">
                        <Globe size={14} className="mr-1" /> {lang === 'fr' ? 'العربية' : 'Français'}
                    </button>
                    <span>© {new Date().getFullYear()} SLIMANE CHAGRI</span>
                </div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen bg-secondary text-white font-sans ${isRTL ? 'font-arabic' : ''}`}>
      
      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-surface border-r border-gray-800 flex flex-col transition-all duration-300 z-20`}>
        <div className="p-6 flex items-center justify-between">
           {isSidebarOpen && <span className="text-2xl font-bold text-primary">ToJbs</span>}
           <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-gray-400 hover:text-white">
             {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
           </button>
        </div>

        <nav className="flex-1 px-3 py-4">
          <SidebarItem icon={LayoutDashboard} label={t.dashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} collapsed={!isSidebarOpen} />
          <SidebarItem icon={FileText} label={t.invoices} active={activeTab === 'invoices'} onClick={() => setActiveTab('invoices')} collapsed={!isSidebarOpen} />
          <SidebarItem icon={FileCheck} label={t.clients} active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} collapsed={!isSidebarOpen} />
          <SidebarItem icon={Landmark} label={t.bankStatements} active={activeTab === 'bank'} onClick={() => setActiveTab('bank')} collapsed={!isSidebarOpen} />
          <SidebarItem icon={Book} label={t.planComptable} active={activeTab === 'planComptable'} onClick={() => setActiveTab('planComptable')} collapsed={!isSidebarOpen} />
          
          {/* Only show Users tab for Administrators */}
          {currentUserRole === 'Administrateur' && (
            <SidebarItem icon={Users} label={t.usersManagement} active={activeTab === 'users'} onClick={() => setActiveTab('users')} collapsed={!isSidebarOpen} />
          )}
          
          <SidebarItem icon={UploadCloud} label={t.upload} active={activeTab === 'upload'} onClick={() => { setUploadType('purchase'); setActiveTab('upload'); }} collapsed={!isSidebarOpen} />
        </nav>

        <div className="p-3 border-t border-gray-800">
           <SidebarItem icon={Settings} label={t.settings} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} collapsed={!isSidebarOpen} />
           <SidebarItem icon={LogOut} label={t.logout} active={false} onClick={handleLogout} collapsed={!isSidebarOpen} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header */}
        <header className="h-16 bg-surface/50 backdrop-blur border-b border-gray-800 flex items-center justify-between px-6">
          <h2 className="text-xl font-semibold">{t[activeTab]}</h2>
          
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleSyncToCloud}
              disabled={syncing}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                syncing ? 'bg-gray-800 text-gray-500' : 'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
              title={lang === 'ar' ? 'مزامنة مع السحابة' : 'Synchroniser avec le cloud'}
            >
              {syncing ? <RefreshCw size={16} className="animate-spin" /> : <Cloud size={16} />}
              <span className="hidden sm:inline">{lang === 'ar' ? 'مزامنة' : 'Sync'}</span>
            </button>
            <button 
              onClick={() => setLang(prev => prev === 'fr' ? 'ar' : 'fr')}
              className="p-2 rounded-full hover:bg-gray-700 text-gray-400 transition-colors"
              title={t.language}
            >
              <Globe size={20} />
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-xs font-bold border border-white/20">
              {currentUser.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-6 relative">
          
          {/* Dashboard View */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Quick Actions */}
              <div className="flex justify-end gap-2">
                {(invoices.length > 0 || bankTransactions.length > 0) && (
                  <button 
                    onClick={handleClearDocuments}
                    className="flex items-center px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-500 border border-red-600/30 rounded-lg text-sm transition-colors"
                  >
                    <Trash2 size={16} className="mr-2" /> Vider les données
                  </button>
                )}
              </div>
              
              {/* Stats Sections with Loading State */}
              {dataLoading ? (
                 <div className="flex justify-center py-20">
                     <Loader2 className="animate-spin text-primary" size={48} />
                 </div>
              ) : (
              <>
              {/* Purchases Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
                  <TrendingDown size={20} className="text-red-400" />
                  {t.sectionPurchases}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatCard 
                    title={t.totalPurchasesTTC} 
                    value={`${stats.purchases.totalTTC.toFixed(2)} DH`} 
                    colorClass="text-white" 
                    icon={DollarSign}
                  />
                  <StatCard 
                    title={t.totalPurchasesHT} 
                    value={`${stats.purchases.totalHT.toFixed(2)} DH`} 
                    colorClass="text-accent" 
                    icon={FileText}
                  />
                  <StatCard 
                    title={t.totalPurchasesTVA} 
                    value={`${stats.purchases.totalTVA.toFixed(2)} DH`} 
                    colorClass="text-blue-400" 
                    icon={CheckCircle}
                  />
                </div>
              </div>

              {/* Sales Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
                  <TrendingUp size={20} className="text-green-400" />
                  {t.sectionSales}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <StatCard 
                    title={t.totalSalesTTC} 
                    value={`${stats.sales.totalTTC.toFixed(2)} DH`} 
                    colorClass="text-white"
                    icon={DollarSign} 
                  />
                  <StatCard 
                    title={t.totalSalesHT} 
                    value={`${stats.sales.totalHT.toFixed(2)} DH`} 
                    colorClass="text-green-400" 
                    icon={FileText}
                  />
                  <StatCard 
                    title={t.totalSalesTVA} 
                    value={`${stats.sales.totalTVA.toFixed(2)} DH`} 
                    colorClass="text-purple-400" 
                    icon={CheckCircle}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                 {/* Recent Invoices Mini Table */}
                 <div className="md:col-span-2 lg:col-span-2 bg-surface rounded-2xl p-6 border border-gray-800">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold">{t.recentActivity}</h3>
                      <button onClick={() => setActiveTab('invoices')} className="text-xs text-primary hover:underline">{t.invoices}</button>
                    </div>
                    {invoices.length === 0 ? (
                      <div className="text-center text-gray-500 py-10">{t.noData}</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-400">
                          <thead className="text-xs text-gray-500 uppercase bg-gray-800/50">
                            <tr>
                              <th className="px-4 py-3 rounded-l-lg">{t.tableDate}</th>
                              <th className="px-4 py-3">{t.tableVendor}</th>
                              <th className="px-4 py-3">Type</th>
                              <th className="px-4 py-3 text-right rounded-r-lg">TTC</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoices.slice(0, 5).map(inv => (
                              <tr key={inv.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                                <td className="px-4 py-3">{inv.date}</td>
                                <td className="px-4 py-3 text-white font-medium">{inv.vendor}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-[10px] px-2 py-1 rounded-full ${inv.type === 'sale' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {inv.type === 'sale' ? 'Vente' : 'Achat'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">{inv.amountTTC.toFixed(2)}</td>
                                <td className="px-4 py-3 text-center">
                                  <button 
                                    onClick={(e) => promptDeleteInvoice(e, inv.id)}
                                    className="text-red-500/70 hover:text-red-500 transition-colors"
                                    title={t.delete}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                 </div>

                 {/* Top Vendor - Clickable - REDIRECT TO INVOICES */}
                 <div 
                   onClick={() => setActiveTab('invoices')}
                   className="bg-surface rounded-2xl p-6 border border-gray-800 flex flex-col justify-center items-center text-center cursor-pointer hover:border-primary/50 hover:bg-gray-800/50 transition-all group"
                 >
                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                      <Users size={28} className="text-accent group-hover:text-white" />
                    </div>
                    <h3 className="text-gray-400 text-sm mb-1">{t.topVendor}</h3>
                    <p className="text-xl font-bold text-white truncate max-w-full">{stats.topVendor}</p>
                 </div>

                 {/* Top Client - Clickable */}
                 <div 
                   onClick={() => setActiveTab('clients')}
                   className="bg-surface rounded-2xl p-6 border border-gray-800 flex flex-col justify-center items-center text-center cursor-pointer hover:border-primary/50 hover:bg-gray-800/50 transition-all group"
                 >
                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                      <Briefcase size={28} className="text-green-400 group-hover:text-white" />
                    </div>
                    <h3 className="text-gray-400 text-sm mb-1">{t.topClient}</h3>
                    <p className="text-xl font-bold text-white truncate max-w-full">{stats.topClient}</p>
                 </div>

                 {/* Quick Access PCM */}
                 <div 
                    onClick={() => setActiveTab('planComptable')}
                    className="bg-surface rounded-2xl p-6 border border-gray-800 flex flex-col justify-center items-center text-center cursor-pointer hover:border-primary/50 hover:bg-gray-800/50 transition-all group"
                 >
                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4 group-hover:bg-primary transition-colors">
                      <Book size={28} className="text-purple-400 group-hover:text-white" />
                    </div>
                    <h3 className="text-gray-400 text-sm mb-1">{t.pcmTitle}</h3>
                    <p className="text-xs text-gray-500 line-clamp-2">{t.pcmSubtitle}</p>
                 </div>
              </div>
              </>
              )}
            </div>
          )}

          {/* Invoices List View (Purchases) */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-surface p-4 rounded-xl border border-gray-800">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type="text" 
                    placeholder={t.search} 
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                   <button onClick={() => { setUploadType('purchase'); setActiveTab('upload'); }} className="flex items-center px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm transition-colors shadow-lg shadow-primary/20">
                     <Plus size={16} className="mr-2" /> {t.addInvoice}
                   </button>
                   <button onClick={() => {
                     try {
                       exportToExcel(invoices.filter(i => i.type === 'purchase'), pcmList);
                     } catch (err: any) {
                       alert(err.message);
                     }
                   }} className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white border border-green-600 rounded-lg text-sm transition-colors shadow-lg shadow-green-600/20">
                     <FileSpreadsheet size={16} className="mr-2" /> {t.exportExcel}
                   </button>
                   <button onClick={saveWork} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors" title={t.saveWork}>
                     <Save size={16} />
                   </button>
                   <button onClick={handleClearInvoices} className="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-500 border border-red-600/30 rounded-lg transition-colors" title="Vider les factures">
                     <Trash2 size={16} />
                   </button>
                </div>
              </div>

              <div className="bg-surface rounded-xl border border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-400">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-900">
                      <tr>
                        <th className="px-6 py-4">{t.tableDate}</th>
                        <th className="px-6 py-4">N° Facture</th>
                        <th className="px-6 py-4">{t.tableVendor}</th>
                        <th className="px-6 py-4">{t.tableICE}</th>
                        <th className="px-6 py-4 text-right">{t.tableHT}</th>
                        <th className="px-6 py-4 text-center">{t.tableTVA}</th>
                        <th className="px-6 py-4 text-right">{t.tableTTC}</th>
                        <th className="px-6 py-4 text-center">{t.tableActions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv) => (
                        <tr key={inv.id} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
                          <td className="px-6 py-4">{inv.date}</td>
                          <td className="px-6 py-4 font-mono text-xs">{inv.invoiceNumber || '-'}</td>
                          <td className="px-6 py-4 font-medium text-white">{inv.vendor}</td>
                          <td className="px-6 py-4 font-mono text-xs">{inv.ice}</td>
                          <td className="px-6 py-4 text-right font-mono">{inv.amountHT.toFixed(2)}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${inv.tvaRate === '20%' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                              {inv.tvaBreakdown && inv.tvaBreakdown.length > 1 ? 'Multi' : inv.tvaRate}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-white font-mono">{inv.amountTTC.toFixed(2)}</td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                                <button 
                                  className="text-blue-400 hover:text-primary transition-colors" 
                                  title={t.view}
                                  onClick={() => handleOpenDocModal('view', 'invoice', inv)}
                                >
                                  <Eye size={16} />
                                </button>
                                <button 
                                  className="text-yellow-500/80 hover:text-yellow-400 transition-colors" 
                                  title={t.edit}
                                  onClick={() => handleOpenDocModal('edit', 'invoice', inv)}
                                >
                                  <Pencil size={16} />
                                </button>
                                <button className="text-red-500/70 hover:text-red-500 transition-colors" onClick={(e) => promptDeleteInvoice(e, inv.id)} title={t.delete}>
                                  <Trash2 size={16} />
                                </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredInvoices.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-gray-600">
                            {t.noData}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Vendors View Removed */}

          {/* Client Invoices View (Sales) */}
          {activeTab === 'clients' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-surface p-4 rounded-xl border border-gray-800">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
                  <input 
                    type="text" 
                    placeholder={t.search} 
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                   <button onClick={() => { setUploadType('sale'); setActiveTab('upload'); }} className="flex items-center px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm transition-colors shadow-lg shadow-primary/20">
                     <Plus size={16} className="mr-2" /> {t.addInvoice}
                   </button>
                   {/* Specific Sales Export Button */}
                   <button onClick={() => {
                     try {
                       exportSalesJournal(invoices.filter(i => i.type === 'sale'), pcmList);
                     } catch (err: any) {
                       alert(err.message);
                     }
                   }} className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white border border-purple-600 rounded-lg text-sm transition-colors shadow-lg shadow-purple-600/20">
                     <FileSpreadsheet size={16} className="mr-2" /> {t.exportSales}
                   </button>
                   <button onClick={saveWork} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors" title={t.saveWork}>
                     <Save size={16} />
                   </button>
                   <button onClick={handleClearInvoices} className="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-500 border border-red-600/30 rounded-lg transition-colors" title="Vider les factures">
                     <Trash2 size={16} />
                   </button>
                </div>
              </div>

              {/* Table (Visuals only - displaying same data for now per requirement) */}
              <div className="bg-surface rounded-xl border border-gray-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-400">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-900">
                      <tr>
                        <th className="px-6 py-4">{t.tableDate}</th>
                        <th className="px-6 py-4">N° Facture</th>
                        <th className="px-6 py-4">{t.tableClient}</th>
                        <th className="px-6 py-4">{t.tableICE}</th>
                        <th className="px-6 py-4 text-right">{t.tableHT}</th>
                        <th className="px-6 py-4 text-center">{t.tableTVA}</th>
                        <th className="px-6 py-4 text-right">{t.tableTTC}</th>
                        <th className="px-6 py-4 text-center">{t.tableActions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv) => (
                        <tr key={inv.id} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
                          <td className="px-6 py-4">{inv.date}</td>
                          <td className="px-6 py-4 font-mono text-xs">{inv.invoiceNumber || '-'}</td>
                          <td className="px-6 py-4 font-medium text-white">{inv.vendor}</td>
                          <td className="px-6 py-4 font-mono text-xs">{inv.ice}</td>
                          <td className="px-6 py-4 text-right font-mono">{inv.amountHT.toFixed(2)}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs ${inv.tvaRate === '20%' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                              {inv.tvaBreakdown && inv.tvaBreakdown.length > 1 ? 'Multi' : inv.tvaRate}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-white font-mono">{inv.amountTTC.toFixed(2)}</td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                                <button 
                                  className="text-blue-400 hover:text-primary transition-colors" 
                                  title={t.view}
                                  onClick={() => handleOpenDocModal('view', 'invoice', inv)}
                                >
                                  <Eye size={16} />
                                </button>
                                <button 
                                  className="text-yellow-500/80 hover:text-yellow-400 transition-colors" 
                                  title={t.edit}
                                  onClick={() => handleOpenDocModal('edit', 'invoice', inv)}
                                >
                                  <Pencil size={16} />
                                </button>
                                <button className="text-red-500/70 hover:text-red-500 transition-colors" onClick={(e) => promptDeleteInvoice(e, inv.id)} title={t.delete}>
                                  <Trash2 size={16} />
                                </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredInvoices.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-gray-600">
                            {t.noData}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Bank Statements View */}
          {activeTab === 'bank' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-surface p-4 rounded-xl border border-gray-800">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-500/20 rounded-lg mr-3">
                       <Landmark size={24} className="text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{t.bankStatements}</h3>
                      <p className="text-xs text-gray-400">Importez et analysez vos relevés (PDF/Images/Excel)</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                     <button onClick={() => { setUploading(true); document.getElementById('bank-upload')?.click(); }} className="flex items-center px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm transition-colors shadow-lg shadow-primary/20">
                       <Plus size={16} className="mr-2" /> Importer Relevé
                     </button>
                     <input 
                        id="bank-upload"
                        type="file" 
                        multiple 
                        accept=".pdf, .jpg, .jpeg, .png, .webp, .heic, .heif, .xlsx, .xls, .csv"
                        className="hidden"
                        onChange={(e) => {
                           handleFileUpload(e);
                           e.target.value = ''; // Reset
                        }}
                     />
                     
                     <button onClick={() => {
                       try {
                         exportBankStatement(bankTransactions, pcmList);
                       } catch (err: any) {
                         alert(err.message);
                       }
                     }} disabled={bankTransactions.length === 0} className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 rounded-lg text-sm transition-colors shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed">
                       <FileSpreadsheet size={16} className="mr-2" /> {t.exportBank}
                     </button>
                     <button onClick={saveWork} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors">
                       <Save size={16} />
                     </button>
                     <button onClick={handleClearBank} className="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-500 border border-red-600/30 rounded-lg transition-colors" title="Vider les relevés">
                       <Trash2 size={16} />
                     </button>
                  </div>
              </div>
              
              {uploading && activeTab === 'bank' && (
                 <div className="w-full p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-center text-blue-400 animate-pulse">
                    <Loader2 className="animate-spin mr-2" /> Analyse du relevé en cours...
                 </div>
              )}

              {bankTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 text-gray-500 border border-gray-800 rounded-2xl bg-surface/50">
                    <Landmark size={64} className="mb-6 opacity-20" />
                    <p className="max-w-md text-center opacity-70 mb-4">
                        Aucun relevé importé. Cliquez sur <strong>"Importer Relevé"</strong> pour analyser un document bancaire.
                    </p>
                    <div className="text-xs bg-gray-900 p-4 rounded border border-gray-800 font-mono text-left max-w-lg">
                        <p className="text-gray-400 mb-1">// Règles d'exportation configurées (10 chiffres) :</p>
                        <p>1. Compte Banque 5141000000</p>
                        <p>2. Détection automatique des contre-parties (TVA 3455200000, 4411..., 6147...)</p>
                        <p>3. Virements de fonds: 5115000000</p>
                        <p>4. Export équilibré (Débit/Crédit)</p>
                    </div>
                </div>
              ) : (
                <div className="bg-surface rounded-xl border border-gray-800 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-400">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-900">
                                <tr>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Libellé</th>
                                    <th className="px-6 py-4">Ref</th>
                                    <th className="px-6 py-4 text-center">Compte C.P.</th>
                                    <th className="px-6 py-4 text-right text-red-400">Débit</th>
                                    <th className="px-6 py-4 text-right text-green-400">Crédit</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bankTransactions.map(tx => (
                                    <tr key={tx.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                                        <td className="px-6 py-4 font-mono">{tx.date}</td>
                                        <td className="px-6 py-4 text-white">{tx.description}</td>
                                        <td className="px-6 py-4 text-xs">{tx.reference}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-gray-700 px-2 py-1 rounded text-xs text-gray-300 font-mono">
                                                {tx.contraAccount}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-red-400">
                                            {tx.debit > 0 ? tx.debit.toFixed(2) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-green-400">
                                            {tx.credit > 0 ? tx.credit.toFixed(2) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                  className="text-blue-400 hover:text-primary transition-colors" 
                                                  title={t.view}
                                                  onClick={() => handleOpenDocModal('view', 'transaction', tx)}
                                                >
                                                  <Eye size={16} />
                                                </button>
                                                <button 
                                                  className="text-yellow-500/80 hover:text-yellow-400 transition-colors" 
                                                  title={t.edit}
                                                  onClick={() => handleOpenDocModal('edit', 'transaction', tx)}
                                                >
                                                  <Pencil size={16} />
                                                </button>
                                                <button className="text-red-500/70 hover:text-red-500 transition-colors" onClick={(e) => promptDeleteTransaction(e, tx.id)} title={t.delete}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
              )}
            </div>
          )}

          {/* Plan Comptable View */}
          {activeTab === 'planComptable' && (
             <div className="space-y-4">
                <div className="flex justify-between items-center bg-surface p-4 rounded-xl border border-gray-800">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input 
                            type="text" 
                            placeholder={t.search} 
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-primary"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => document.getElementById('pcm-upload')?.click()} className="flex items-center px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm transition-colors">
                            <UploadCloud size={16} className="mr-2" /> {t.importBtn}
                        </button>
                        <button onClick={() => { if(pcmList.length > 0) handleOpenDocModal('view', 'pcm', pcmList[0]); }} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors">
                            <Eye size={16} className="mr-2" /> Consulter le PC
                        </button>
                        <button onClick={handleClearPCM} className="flex items-center px-4 py-2 bg-gray-800 hover:bg-red-900/30 text-red-400 hover:text-red-500 rounded-lg text-sm transition-colors">
                            <Trash2 size={16} className="mr-2" /> Supprimer le PC
                        </button>
                        <button onClick={() => handleOpenDocModal('edit', 'pcm', { code: '', label: '', class: 1 })} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors" title="Ajouter un compte">
                            <Plus size={20} />
                        </button>
                        <input 
                            id="pcm-upload"
                            type="file" 
                            multiple 
                            accept=".xlsx, .xls, .csv, .jpg, .png, .pdf"
                            className="hidden"
                            onChange={(e) => { handleFileUpload(e); e.target.value=''; }}
                        />
                    </div>
                </div>
                <div className="bg-surface rounded-xl border border-gray-800 overflow-hidden">
                    <div className="overflow-x-auto h-[calc(100vh-250px)]">
                        <table className="w-full text-sm text-left text-gray-400">
                            <thead className="text-xs text-gray-500 uppercase bg-gray-900 sticky top-0">
                                <tr>
                                    <th className="px-6 py-3">Code</th>
                                    <th className="px-6 py-3">Intitulé</th>
                                    <th className="px-6 py-3">Classe</th>
                                    <th className="px-6 py-3 text-center">{t.tableActions}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPCM.map((acc, idx) => (
                                    <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/40">
                                        <td className="px-6 py-3 font-mono text-white">{acc.code}</td>
                                        <td className="px-6 py-3">{acc.label}</td>
                                        <td className="px-6 py-3">{acc.class}</td>
                                        <td className="px-6 py-3 text-center">
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => handleOpenDocModal('view', 'pcm', acc)} className="text-blue-400 hover:text-white" title={t.view}><Eye size={16} /></button>
                                                <button onClick={() => handleOpenDocModal('edit', 'pcm', acc)} className="text-yellow-500/80 hover:text-blue-400" title={t.edit}><Pencil size={16} /></button>
                                                <button onClick={() => handleDeletePCM(acc.code)} className="text-red-500/70 hover:text-red-500" title={t.delete}><Trash2 size={16} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
          )}

          {/* Users View */}
          {activeTab === 'users' && currentUserRole === 'Administrateur' && (
             <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-surface p-4 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold mr-4">{t.usersManagement}</h3>
                        <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-800">
                            {['All', 'Administrateur', 'Éditeur', 'Utilisateur'].map(role => (
                                <button
                                    key={role}
                                    onClick={() => setUserRoleFilter(role)}
                                    className={`px-3 py-1 text-xs rounded-md transition-colors ${userRoleFilter === role ? 'bg-primary text-white' : 'text-gray-400 hover:text-white'}`}
                                >
                                    {role === 'All' ? 'Tous' : role}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={handleAddUser} className="flex items-center px-4 py-2 bg-primary hover:bg-blue-600 text-white rounded-lg text-sm transition-colors">
                        <UserPlus size={16} className="mr-2" /> {t.addUser}
                    </button>
                </div>
                <div className="bg-surface rounded-xl border border-gray-800 overflow-hidden">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-900">
                            <tr>
                                <th className="px-6 py-4">{t.username}</th>
                                <th className="px-6 py-4">{t.emailLabel}</th>
                                <th className="px-6 py-4">{t.role}</th>
                                <th className="px-6 py-4">{t.status}</th>
                                <th className="px-6 py-4">{t.lastLogin}</th>
                                <th className="px-6 py-4 text-center">{t.tableActions}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usersList
                                .filter(user => userRoleFilter === 'All' || user.role === userRoleFilter)
                                .map(user => (
                                <tr key={user.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                                    <td className="px-6 py-4 font-medium text-white">{user.name}</td>
                                    <td className="px-6 py-4">{user.email}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs ${user.role === 'Administrateur' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className={`h-2 w-2 rounded-full mr-2 ${user.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                                            {user.status}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{user.lastLogin}</td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => handleEditUser(user.id)} className="text-blue-400 hover:text-white"><Pencil size={16} /></button>
                                            <button onClick={() => handleDeleteUser(user.id)} className="text-red-500/70 hover:text-red-500"><Trash2 size={16} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          )}

          {/* Upload View */}
          {activeTab === 'upload' && (
             <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-gray-800 rounded-2xl bg-surface/30 p-12">
                <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6">
                    {uploading ? <Loader2 size={40} className="animate-spin text-primary" /> : <UploadCloud size={40} className="text-gray-400" />}
                </div>
                <h3 className="text-2xl font-bold mb-2">{t.uploadTitle}</h3>
                <p className="text-gray-400 mb-8 max-w-md text-center">{t.uploadSubtitle}</p>
                
                <div className="flex gap-4">
                    <label className="cursor-pointer bg-primary hover:bg-blue-600 text-white px-8 py-3 rounded-xl font-medium transition-all transform hover:scale-105 shadow-lg shadow-primary/25">
                        {t.importBtn}
                        <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                    </label>
                </div>
                <p className="mt-4 text-sm text-gray-500">
                    Destination: <span className="text-white font-medium">{uploadType === 'purchase' ? 'Achats' : 'Ventes'}</span>
                </p>
            </div>
          )}
          
          {/* Settings View */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-surface p-6 rounded-2xl border border-gray-800">
                    <h3 className="text-lg font-bold mb-4 flex items-center"><Globe size={20} className="mr-2" /> {t.language}</h3>
                    <div className="flex gap-4">
                        <button onClick={() => setLang('fr')} className={`px-4 py-2 rounded-lg border ${lang === 'fr' ? 'bg-primary border-primary text-white' : 'border-gray-700 hover:bg-gray-800'}`}>Français</button>
                        <button onClick={() => setLang('ar')} className={`px-4 py-2 rounded-lg border ${lang === 'ar' ? 'bg-primary border-primary text-white' : 'border-gray-700 hover:bg-gray-800'}`}>العربية</button>
                    </div>
                </div>
                
                <div className="bg-surface p-6 rounded-2xl border border-gray-800">
                    <h3 className="text-lg font-bold mb-4 flex items-center text-red-400"><AlertTriangle size={20} className="mr-2" /> Zone Danger</h3>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={handleClearInvoices} className="px-4 py-2 border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center">
                            <Trash2 size={16} className="mr-2" /> Vider les factures
                        </button>
                        <button onClick={handleClearBank} className="px-4 py-2 border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center">
                            <Trash2 size={16} className="mr-2" /> Vider les relevés
                        </button>
                        <button onClick={handleClearPCM} className="px-4 py-2 border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center">
                            <Trash2 size={16} className="mr-2" /> Vider le PCM
                        </button>
                        <button onClick={handleClearDocuments} className="px-4 py-2 border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex items-center">
                            <Trash2 size={16} className="mr-2" /> Vider Factures & Relevés
                        </button>
                        <button onClick={clearAll} className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors flex items-center">
                            <Trash2 size={16} className="mr-2" /> Tout effacer
                        </button>
                    </div>
                </div>
            </div>
          )}

        </main>
        
        {/* User Modal */}
        {userModal.isOpen && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-surface p-6 rounded-2xl border border-gray-700 w-full max-w-md shadow-2xl">
                    <h3 className="text-xl font-bold mb-4">
                        {userModal.type === 'add' ? t.addUser : 
                         userModal.type === 'edit' ? t.edit : t.delete}
                    </h3>
                    
                    {userModal.type === 'delete' ? (
                        <p className="text-gray-400 mb-6">{t.confirmDelete}</p>
                    ) : (
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">{t.username}</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white"
                                    value={userModal.userData?.name || ''}
                                    onChange={e => setUserModal({...userModal, userData: {...userModal.userData!, name: e.target.value}})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">{t.emailLabel}</label>
                                <input 
                                    type="email" 
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white"
                                    value={userModal.userData?.email || ''}
                                    onChange={e => setUserModal({...userModal, userData: {...userModal.userData!, email: e.target.value}})}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">{t.role}</label>
                                    <select 
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white"
                                        value={userModal.userData?.role || 'Utilisateur'}
                                        onChange={e => setUserModal({...userModal, userData: {...userModal.userData!, role: e.target.value}})}
                                    >
                                        <option value="Administrateur">Administrateur</option>
                                        <option value="Éditeur">Éditeur</option>
                                        <option value="Utilisateur">Utilisateur</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">{t.status}</label>
                                    <select 
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white"
                                        value={userModal.userData?.status || 'active'}
                                        onChange={e => setUserModal({...userModal, userData: {...userModal.userData!, status: e.target.value}})}
                                    >
                                        <option value="active">Actif</option>
                                        <option value="offline">Inactif</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setUserModal({...userModal, isOpen: false})}
                            className="px-4 py-2 rounded-lg hover:bg-gray-800 text-gray-300"
                        >
                            Annuler
                        </button>
                        <button 
                            onClick={handleModalConfirm}
                            className={`px-4 py-2 rounded-lg text-white ${userModal.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:bg-blue-600'}`}
                        >
                            {userModal.type === 'delete' ? t.delete : 'Confirmer'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- DOCUMENT MODAL (View/Edit) --- */}
        {documentModal.isOpen && documentModal.data && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
                <div className="bg-surface border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                    <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-white flex items-center">
                            {documentModal.mode === 'view' ? <Eye className="mr-2" /> : <Pencil className="mr-2" />}
                            {documentModal.mode === 'view' ? 'Consulter' : 'Modifier'} {documentModal.type === 'invoice' ? 'Facture' : documentModal.type === 'transaction' ? 'Transaction' : 'Compte PCM'}
                        </h3>
                        <button onClick={() => setDocumentModal({ ...documentModal, isOpen: false })} className="text-gray-400 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="p-6 overflow-y-auto space-y-4">
                        {documentModal.type === 'invoice' ? (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Date</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            value={documentModal.data.date}
                                            disabled={documentModal.mode === 'view'}
                                            onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, date: e.target.value}})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">N° Facture</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            value={documentModal.data.invoiceNumber || ''}
                                            disabled={documentModal.mode === 'view'}
                                            onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, invoiceNumber: e.target.value}})}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">{t.tableVendor} / Client</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={documentModal.data.vendor}
                                        disabled={documentModal.mode === 'view'}
                                        onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, vendor: e.target.value}})}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">ICE</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            value={documentModal.data.ice || ''}
                                            disabled={documentModal.mode === 'view'}
                                            onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, ice: e.target.value}})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">IF (Fiscal)</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            value={documentModal.data.if_fiscal || ''}
                                            disabled={documentModal.mode === 'view'}
                                            onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, if_fiscal: e.target.value}})}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Montant HT</label>
                                        <input 
                                            type="number" 
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono text-right"
                                            value={documentModal.data.amountHT}
                                            disabled={documentModal.mode === 'view'}
                                            onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, amountHT: parseFloat(e.target.value)}})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Taux TVA</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-center"
                                            value={documentModal.data.tvaRate}
                                            disabled={documentModal.mode === 'view'}
                                            onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, tvaRate: e.target.value}})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Total TTC</label>
                                        <input 
                                            type="number" 
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono font-bold text-right"
                                            value={documentModal.data.amountTTC}
                                            disabled={documentModal.mode === 'view'}
                                            onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, amountTTC: parseFloat(e.target.value)}})}
                                        />
                                    </div>
                                </div>
                            </>
                        ) : documentModal.type === 'transaction' ? (
                            <>
                                {/* Bank Transaction Form */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Date</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            value={documentModal.data.date}
                                            disabled={documentModal.mode === 'view'}
                                            onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, date: e.target.value}})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Référence</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            value={documentModal.data.reference}
                                            disabled={documentModal.mode === 'view'}
                                            onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, reference: e.target.value}})}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Libellé</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={documentModal.data.description}
                                        disabled={documentModal.mode === 'view'}
                                        onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, description: e.target.value}})}
                                    />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Débit</label>
                                        <input 
                                            type="number" 
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-red-400 focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono text-right"
                                            value={documentModal.data.debit}
                                            disabled={documentModal.mode === 'view'}
                                            onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, debit: parseFloat(e.target.value)}})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Crédit</label>
                                        <input 
                                            type="number" 
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-green-400 focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono text-right"
                                            value={documentModal.data.credit}
                                            disabled={documentModal.mode === 'view'}
                                            onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, credit: parseFloat(e.target.value)}})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">C.Partie</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-center font-mono"
                                            value={documentModal.data.contraAccount}
                                            disabled={documentModal.mode === 'view'}
                                            onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, contraAccount: e.target.value}})}
                                        />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* PCM Account Form */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Code</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                                            value={documentModal.data.code}
                                            disabled={documentModal.mode === 'view' || pcmList.some(acc => acc.code === documentModal.data.code && documentModal.data.code !== '')}
                                            onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, code: e.target.value}})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-400 mb-1">Classe</label>
                                        <input 
                                            type="number" 
                                            className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-center"
                                            value={documentModal.data.class}
                                            disabled={documentModal.mode === 'view'}
                                            onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, class: parseInt(e.target.value)}})}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Intitulé</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:border-primary focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        value={documentModal.data.label}
                                        disabled={documentModal.mode === 'view'}
                                        onChange={(e) => setDocumentModal({...documentModal, data: {...documentModal.data, label: e.target.value}})}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="p-6 border-t border-gray-700 flex justify-end gap-3 bg-gray-900/50">
                        <button 
                            onClick={() => {
                                if (confirm("Voulez-vous vraiment supprimer cet élément ?")) {
                                    if (documentModal.type === 'invoice') {
                                        setInvoices(prev => prev.filter(i => i.id !== documentModal.data.id));
                                    } else if (documentModal.type === 'transaction') {
                                        setBankTransactions(prev => prev.filter(t => t.id !== documentModal.data.id));
                                    } else if (documentModal.type === 'pcm') {
                                        setPcmList(prev => prev.filter(acc => acc.code !== documentModal.data.code));
                                    }
                                    setDocumentModal({ ...documentModal, isOpen: false });
                                }
                            }}
                            className="px-4 py-2 rounded-lg text-red-400 hover:text-white hover:bg-red-600/20 transition-colors flex items-center mr-auto"
                        >
                            <Trash2 size={16} className="mr-2" /> Supprimer
                        </button>
                        <button 
                            onClick={() => setDocumentModal({ ...documentModal, isOpen: false })}
                            className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                        >
                            Fermer
                        </button>
                        {documentModal.mode === 'edit' && (
                            <button 
                                onClick={handleSaveDoc}
                                className="px-4 py-2 rounded-lg text-white font-medium bg-primary hover:bg-blue-600 shadow-lg shadow-primary/20 flex items-center"
                            >
                                <SaveAll size={16} className="mr-2" /> Enregistrer
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}