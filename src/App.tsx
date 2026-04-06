import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Leaf,
  Search,
  Mic,
  Camera,
  Activity,
  Heart,
  BookOpen,
  MessageSquare,
  User,
  LogOut,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Menu,
  X,
  Info,
  RefreshCw,
  Minus,
  Calculator,
  History,
  LayoutDashboard
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { 
  auth, db, signIn, signInRedirect, logOut, OperationType, handleFirestoreError,
  onAuthStateChanged, getRedirectResult, User as FirebaseUser,
  doc, onSnapshot, setDoc, collection, addDoc, query, orderBy, limit
} from './firebase';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { UserProfile, Favorite, HealthLog, Herb } from './types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

// --- Constants & Types ---
const AI_MODEL = "gemini-3-flash-preview";
const API_KEY = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenAI({ apiKey: API_KEY });

const isApiKeyMissing = !API_KEY;

const DOSHA_QUESTIONS = [
  {
    id: 1,
    question: "How would you describe your body frame?",
    options: [
      { text: "Thin, bony, small frame, hard to gain weight", dosha: "Vata" },
      { text: "Medium, athletic, well-proportioned", dosha: "Pitta" },
      { text: "Large, broad, sturdy frame, gains weight easily", dosha: "Kapha" }
    ]
  },
  {
    id: 2,
    question: "How is your skin texture?",
    options: [
      { text: "Dry, rough, thin, prone to cracking", dosha: "Vata" },
      { text: "Soft, warm, oily, prone to redness or acne", dosha: "Pitta" },
      { text: "Thick, smooth, cool, pale, well-hydrated", dosha: "Kapha" }
    ]
  },
  {
    id: 3,
    question: "How do you handle stress?",
    options: [
      { text: "Anxious, worried, fearful, overthinking", dosha: "Vata" },
      { text: "Irritable, angry, impatient, critical", dosha: "Pitta" },
      { text: "Calm, steady, slow to react, sometimes withdrawn", dosha: "Kapha" }
    ]
  },
  {
    id: 4,
    question: "What is your typical appetite?",
    options: [
      { text: "Irregular, variable, forgets to eat", dosha: "Vata" },
      { text: "Strong, sharp, cannot skip meals without getting irritable", dosha: "Pitta" },
      { text: "Slow but steady, likes heavy food, can easily skip meals", dosha: "Kapha" }
    ]
  },
  {
    id: 5,
    question: "How is your sleep pattern?",
    options: [
      { text: "Light, interrupted, difficulty falling asleep", dosha: "Vata" },
      { text: "Sound but short, wakes up easily but falls back asleep", dosha: "Pitta" },
      { text: "Deep, heavy, prolonged, hard to wake up", dosha: "Kapha" }
    ]
  },
  {
    id: 6,
    question: "How do you learn and remember things?",
    options: [
      { text: "Learn quickly, but forget quickly", dosha: "Vata" },
      { text: "Sharp memory, good focus, logical learner", dosha: "Pitta" },
      { text: "Slow to learn, but never forgets once learned", dosha: "Kapha" }
    ]
  },
  {
    id: 7,
    question: "What is your preferred weather?",
    options: [
      { text: "Warm and humid (dislikes cold and wind)", dosha: "Vata" },
      { text: "Cool and well-ventilated (dislikes heat)", dosha: "Pitta" },
      { text: "Warm and dry (dislikes cold and damp)", dosha: "Kapha" }
    ]
  },
  {
    id: 8,
    question: "How are your energy levels throughout the day?",
    options: [
      { text: "Bursts of energy followed by exhaustion", dosha: "Vata" },
      { text: "Moderate and consistent, driven by purpose", dosha: "Pitta" },
      { text: "Slow to start, but steady endurance all day", dosha: "Kapha" }
    ]
  }
];

const COMMON_SYMPTOMS = [
  "Headache", "Indigestion", "Dry Cough", "Sore Throat", "Acidity", 
  "Joint Pain", "Insomnia", "Anxiety", "Fatigue", "Skin Rash", 
  "Constipation", "Bloating", "Common Cold", "Fever", "Nausea",
  "Hair Fall", "Acne", "Muscle Cramps", "Stress", "Low Immunity"
];

const COMMON_AILMENTS = [
  {
    name: "Acidity & Heartburn",
    remedies: [
      { name: "Cold Milk", benefits: "Neutralizes acid", howToUse: "Sip half a cup of cold milk.", precautions: "Avoid if lactose intolerant." },
      { name: "Fennel Seeds (Saunf)", benefits: "Cooling effect, aids digestion", howToUse: "Chew 1 tsp after meals or boil in water and drink.", precautions: "None." },
      { name: "Cumin Seeds (Jeera)", benefits: "Reduces stomach acid", howToUse: "Boil 1 tsp in water, let it cool, and drink.", precautions: "None." }
    ]
  },
  {
    name: "Common Cold & Cough",
    remedies: [
      { name: "Ginger & Honey", benefits: "Anti-inflammatory, soothes throat", howToUse: "Extract ginger juice, mix with equal parts honey, take 1 tsp twice daily.", precautions: "Do not heat honey." },
      { name: "Tulsi (Holy Basil) Tea", benefits: "Immunity booster, clears congestion", howToUse: "Boil 5-7 leaves in water, add black pepper and drink warm.", precautions: "None." },
      { name: "Turmeric Milk (Haldi Doodh)", benefits: "Antimicrobial, healing", howToUse: "Add 1/2 tsp turmeric to warm milk before bed.", precautions: "Avoid if dairy sensitive." }
    ]
  },
  {
    name: "Indigestion & Bloating",
    remedies: [
      { name: "Buttermilk (Chaas)", benefits: "Probiotic, cooling, aids digestion", howToUse: "Drink with roasted cumin powder and black salt after lunch.", precautions: "Avoid at night." },
      { name: "Ajwain (Carom Seeds)", benefits: "Relieves gas and bloating", howToUse: "Chew 1/2 tsp with a pinch of black salt, follow with warm water.", precautions: "Can be heating, use in moderation." },
      { name: "Ginger Slice with Salt", benefits: "Stimulates digestive fire (Agni)", howToUse: "Chew a small slice of fresh ginger with rock salt 15 mins before meals.", precautions: "Avoid if you have severe acidity." }
    ]
  },
  {
    name: "Headache",
    remedies: [
      { name: "Peppermint Oil", benefits: "Cooling, relieves tension", howToUse: "Massage a drop onto temples and forehead.", precautions: "Keep away from eyes." },
      { name: "Warm Ghee (Nasya)", benefits: "Lubricates nasal passages, calms Vata", howToUse: "Put 2 drops of warm liquid ghee in each nostril before bed.", precautions: "Ensure ghee is only slightly warm, not hot." },
      { name: "Coriander Seed Tea", benefits: "Cools Pitta-related headaches", howToUse: "Steep 1 tsp crushed coriander seeds in hot water, strain and drink.", precautions: "None." }
    ]
  },
  {
    name: "Insomnia & Sleep Issues",
    remedies: [
      { name: "Nutmeg & Warm Milk", benefits: "Natural sedative, calms the mind", howToUse: "Add a pinch of nutmeg powder to warm milk before sleeping.", precautions: "Use only a tiny pinch of nutmeg." },
      { name: "Foot Massage (Padabhyanga)", benefits: "Grounds energy, promotes deep sleep", howToUse: "Massage soles of feet with warm sesame or coconut oil before bed.", precautions: "Wear old socks afterwards to avoid slipping." },
      { name: "Ashwagandha Powder", benefits: "Reduces stress and cortisol", howToUse: "Take 1/2 tsp with warm milk or water 30 mins before bed.", precautions: "Consult doctor if pregnant." }
    ]
  },
  {
    name: "Joint Pain & Stiffness",
    remedies: [
      { name: "Mahanarayan Oil Massage", benefits: "Reduces inflammation, lubricates joints", howToUse: "Warm the oil and gently massage into affected joints.", precautions: "Do not apply on open wounds." },
      { name: "Turmeric & Ginger Paste", benefits: "Strong anti-inflammatory", howToUse: "Make a paste with water, apply to joint, leave for 20 mins.", precautions: "Turmeric will stain skin and clothes." },
      { name: "Fenugreek Seeds (Methi)", benefits: "Reduces Vata and stiffness", howToUse: "Soak 1 tsp overnight, chew seeds and drink the water in the morning.", precautions: "Can increase Pitta in excess." }
    ]
  },
  {
    name: "Constipation",
    remedies: [
      { name: "Triphala Powder", benefits: "Gentle bowel tonic and cleanser", howToUse: "Take 1 tsp with warm water before bed.", precautions: "May cause loose stools initially." },
      { name: "Warm Water & Ghee", benefits: "Lubricates the digestive tract", howToUse: "Mix 1 tsp of ghee in a cup of warm water and drink on an empty stomach.", precautions: "Avoid if you have high cholesterol." },
      { name: "Soaked Raisins or Figs", benefits: "Natural laxative, rich in fiber", howToUse: "Soak 5-6 raisins or 2 figs overnight, eat them first thing in the morning.", precautions: "None." }
    ]
  },
  {
    name: "Anxiety & Stress",
    remedies: [
      { name: "Brahmi or Shankhpushpi", benefits: "Nervine tonic, calms the brain", howToUse: "Take 1/2 tsp powder with warm water or milk daily.", precautions: "None." },
      { name: "Alternate Nostril Breathing (Anulom Vilom)", benefits: "Balances left and right brain, calms nervous system", howToUse: "Practice for 5-10 minutes daily in a quiet space.", precautions: "Breathe gently, do not force." },
      { name: "Chamomile & Tulsi Tea", benefits: "Relaxing and grounding", howToUse: "Steep herbs in hot water for 5 mins, drink warm.", precautions: "None." }
    ]
  }
];

const HERB_LIBRARY: Herb[] = [
  {
    name: "Tulsi (Holy Basil)",
    scientificName: "Ocimum tenuiflorum",
    benefits: ["Immunity booster", "Stress relief", "Respiratory health"],
    uses: "Consume 2-3 fresh leaves daily or as tea.",
    precautions: "Avoid during pregnancy without consultation.",
    history: "Revered in India as the 'Queen of Herbs' for over 5000 years.",
    imageUrl: "https://picsum.photos/seed/tulsi/400/300",
    wikiUrl: "https://en.wikipedia.org/wiki/Ocimum_tenuiflorum"
  },
  {
    name: "Neem",
    scientificName: "Azadirachta indica",
    benefits: ["Blood purifier", "Skin health", "Anti-fungal"],
    uses: "Apply paste on skin or consume diluted juice.",
    precautions: "Not for long-term internal use without guidance.",
    history: "Known as 'The Village Pharmacy' in Indian villages.",
    imageUrl: "https://picsum.photos/seed/neem/400/300",
    wikiUrl: "https://en.wikipedia.org/wiki/Azadirachta_indica"
  },
  {
    name: "Ashwagandha",
    scientificName: "Withania somnifera",
    benefits: ["Energy booster", "Anxiety relief", "Muscle strength"],
    uses: "1/2 tsp powder with warm milk at night.",
    precautions: "Consult if you have thyroid issues.",
    history: "Used for centuries as a potent Rasayana (rejuvenative).",
    imageUrl: "https://picsum.photos/seed/ashwagandha/400/300",
    wikiUrl: "https://en.wikipedia.org/wiki/Withania_somnifera"
  },
  {
    name: "Turmeric (Haldi)",
    scientificName: "Curcuma longa",
    benefits: ["Anti-inflammatory", "Wound healing", "Antioxidant"],
    uses: "Add to food or drink with warm milk (Golden Milk).",
    precautions: "High doses may interfere with blood thinners.",
    history: "A staple in Ayurvedic medicine and Indian cuisine for millennia.",
    imageUrl: "https://picsum.photos/seed/turmeric/400/300",
    wikiUrl: "https://en.wikipedia.org/wiki/Curcuma_longa"
  }
];

const DOSHA_DIET_PLANS = {
  Vata: {
    title: "Vata Balancing Diet",
    description: "Focus on warm, moist, and grounding foods to balance your airy nature.",
    guidelines: [
      "Favor warm, cooked foods over raw salads.",
      "Include healthy fats like Ghee or Olive oil.",
      "Prefer sweet, sour, and salty tastes.",
      "Avoid cold drinks and dry, crunchy snacks."
    ],
    meals: {
      breakfast: "Warm oatmeal with soaked almonds, raisins, and a pinch of cinnamon.",
      lunch: "Steamed Basmati rice with Moong Dal and sautéed carrots/zucchini in Ghee.",
      dinner: "Hearty vegetable soup or a warm sweet potato mash with ginger.",
      snacks: "Dates, ripe bananas, or warm herbal tea."
    }
  },
  Pitta: {
    title: "Pitta Balancing Diet",
    description: "Focus on cooling, hydrating, and substantial foods to soothe your inner fire.",
    guidelines: [
      "Favor cool or room-temperature foods.",
      "Include hydrating fruits and vegetables.",
      "Prefer sweet, bitter, and astringent tastes.",
      "Avoid spicy, oily, and highly acidic foods."
    ],
    meals: {
      breakfast: "Fresh fruit salad (melons, grapes) or cold cereal with coconut milk.",
      lunch: "Quinoa salad with cucumber, cilantro, and chickpeas.",
      dinner: "Steamed broccoli and tofu with a mild coconut curry sauce.",
      snacks: "Coconut water, sweet pears, or sunflower seeds."
    }
  },
  Kapha: {
    title: "Kapha Balancing Diet",
    description: "Focus on light, warm, and stimulating foods to boost your metabolism.",
    guidelines: [
      "Favor warm, light, and dry-cooked foods.",
      "Use stimulating spices like ginger, black pepper, and cumin.",
      "Prefer pungent, bitter, and astringent tastes.",
      "Avoid heavy, oily, and cold dairy products."
    ],
    meals: {
      breakfast: "Baked apple with cinnamon or a light cornmeal porridge.",
      lunch: "Spicy red lentil soup with steamed kale and a sprinkle of black pepper.",
      dinner: "Light vegetable stir-fry with plenty of ginger and garlic.",
      snacks: "Dry fruits (apricots), spicy herbal tea, or a few pumpkin seeds."
    }
  }
};

// --- Components ---

const Navbar = ({ user, onLogout, activeTab, setActiveTab }: { user: FirebaseUser | null, onLogout: () => void, activeTab: string, setActiveTab: (t: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'symptoms', label: 'Remedy Finder', icon: Search },
    { id: 'scanner', label: 'Herb Scanner', icon: Camera },
    { id: 'dosha', label: 'Dosha Quiz', icon: Activity },
    { id: 'library', label: 'Herb Library', icon: BookOpen },
    { id: 'calories', label: 'Calorie Tracker', icon: Calculator },
    { id: 'remedy-maker', label: 'DIY Remedies', icon: Plus },
    { id: 'chatbot', label: 'AyurBot', icon: MessageSquare },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="bg-emerald-900 text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <Leaf className="text-emerald-400 w-8 h-8" />
            <span className="font-bold text-xl tracking-tight">Swasthya 360</span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1",
                  activeTab === item.id ? "bg-emerald-700 text-white" : "text-emerald-100 hover:bg-emerald-800"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
            {user && (
              <button onClick={onLogout} className="ml-4 p-2 hover:bg-emerald-800 rounded-full transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-md hover:bg-emerald-800">
              {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-emerald-800 px-2 pt-2 pb-3 space-y-1"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsOpen(false); }}
                className={cn(
                  "block w-full text-left px-3 py-2 rounded-md text-base font-medium",
                  activeTab === item.id ? "bg-emerald-700 text-white" : "text-emerald-100 hover:bg-emerald-700"
                )}
              >
                <div className="flex items-center gap-2">
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </div>
              </button>
            ))}
            {user && (
              <button onClick={onLogout} className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-300 hover:bg-emerald-700 flex items-center gap-2">
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const HealthTipBar = () => {
  const [tip, setTip] = useState<{ hindi: string, english: string } | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchTip = async () => {
    if (loading || isApiKeyMissing) {
      if (isApiKeyMissing && !tip) {
        setTip({ hindi: "स्वस्थं कुरु।", english: "Stay healthy and mindful." });
      }
      return;
    }
    setLoading(true);
    try {
      const response = await genAI.models.generateContent({
        model: AI_MODEL,
        contents: `Generate a unique, very simple, one-sentence Ayurvedic health tip. 
        Variety is key: pick a random topic like water, sleep, digestion, posture, or seasonal care.
        Provide it in two parts: 1. A short Hindi translation (Devanagari) and 2. A simple English explanation. 
        Keep it extremely brief and actionable. 
        Format as JSON: { "hindi": "...", "english": "..." }
        Timestamp for variety: ${Date.now()}`,
        config: { responseMimeType: "application/json" }
      });
      const data = JSON.parse(response.text);
      if (data.english !== tip?.english) {
        setTip(data);
      }
    } catch (e: any) {
      console.error("Error fetching tip:", e);
      if (e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('quota')) {
        setTip({ hindi: "विश्रामः आवश्यकः।", english: "API quota exceeded. Please try again later." });
      } else if (!tip) {
        setTip({ hindi: "स्वस्थं कुरु।", english: "Stay healthy and mindful." });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTip();
    const interval = setInterval(() => {
      // Only fetch if tab is active to save resources
      if (!document.hidden) {
        fetchTip();
      }
    }, 3600000); // Fetch every 1 hour instead of every 11 seconds
    return () => clearInterval(interval);
  }, [tip?.english]); // Re-bind if tip changes to ensure closure has latest state if needed

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 bg-emerald-900 text-white transition-all duration-300 z-40 border-t border-emerald-700 shadow-2xl",
      isMinimized ? "h-12" : "h-24"
    )}>
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="bg-emerald-700 p-2 rounded-full hidden sm:block">
            <Leaf className="w-5 h-5 text-emerald-400" />
          </div>
          {!isMinimized && (
            <AnimatePresence mode="wait">
              <motion.div
                key={tip?.english || 'loading'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col overflow-hidden"
              >
                <span className="text-emerald-300 font-medium text-sm truncate">{tip?.hindi}</span>
                <span className="text-white text-xs sm:text-sm truncate">{tip?.english} — Dash Ayurveda</span>
              </motion.div>
            </AnimatePresence>
          )}
          {isMinimized && <span className="text-emerald-300 text-sm font-medium">Daily Ayurvedic Tip</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={fetchTip} disabled={loading} className="p-2 hover:bg-emerald-800 rounded-full transition-colors">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </button>
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-2 hover:bg-emerald-800 rounded-full transition-colors">
            {isMinimized ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([]);

  const handleSignIn = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signIn();
    } catch (error: any) {
      console.error("Authentication error:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setAuthError("Sign-in popup was closed or blocked. If you are in a preview window, browsers often block popups. Please click 'Open in New Tab' (top right) or allow popups to sign in.");
      } else if (error.code === 'auth/unauthorized-domain') {
        setAuthError("This domain is not authorized for Firebase Authentication. Please add it in the Firebase Console.");
      } else if (error.code === 'auth/network-request-failed') {
        setAuthError("Network error. Please check your connection and try again.");
      } else {
        setAuthError(error.message || "An error occurred during sign-in.");
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignInRedirect = async () => {
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInRedirect();
    } catch (error: any) {
      console.error("Redirect auth error:", error);
      setAuthError(error.message || "An error occurred during redirect sign-in.");
      setIsSigningIn(false);
    }
  };

  // Auth Listener
  useEffect(() => {
    if (isApiKeyMissing) {
      console.warn("Gemini API Key is missing. Some features may not work.");
    }
    
    // Check for redirect result
    getRedirectResult(auth).catch((error) => {
      console.error("Redirect result error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        setAuthError("This domain is not authorized for Firebase Authentication. Please add it in the Firebase Console.");
      } else {
        setAuthError(error.message || "An error occurred after redirect.");
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (!u) {
        setProfile(null);
        setFavorites([]);
        setHealthLogs([]);
      }
    });
    return unsubscribe;
  }, []);

  // Profile & Data Listener
  useEffect(() => {
    if (!user) return;

    const profileUnsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        // Initialize profile
        const newProfile: UserProfile = {
          uid: user.uid,
          displayName: user.displayName || 'User',
          email: user.email || '',
          dosha: 'Unknown',
          createdAt: new Date().toISOString()
        };
        setDoc(doc(db, 'users', user.uid), newProfile).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    const favsUnsub = onSnapshot(collection(db, 'users', user.uid, 'favorites'), (snap) => {
      setFavorites(snap.docs.map(d => ({ id: d.id, ...d.data() } as Favorite)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/favorites`);
    });

    const logsUnsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'logs'), orderBy('date', 'desc'), limit(30)),
      (snap) => {
        setHealthLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as HealthLog)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/logs`);
      }
    );

    return () => {
      profileUnsub();
      favsUnsub();
      logsUnsub();
    };
  }, [user]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
          <Leaf className="w-12 h-12 text-emerald-600" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
        >
          <Leaf className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-emerald-900 mb-2">Swasthya 360</h1>
          <p className="text-emerald-700 mb-8">Your Holistic Ayurvedic Companion for Modern Life.</p>
          
          {authError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-xl text-left">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="text-red-500 w-5 h-5 shrink-0" />
                <p className="text-red-800 font-bold text-sm">Authentication Error</p>
              </div>
              <p className="text-red-700 text-xs">{authError}</p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSigningIn ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <User className="w-5 h-5" />
              )}
              {isSigningIn ? "Signing in..." : "Sign in with Google (Popup)"}
            </button>
            
            <button
              onClick={handleSignInRedirect}
              disabled={isSigningIn}
              className="w-full bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold py-3 px-6 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSigningIn ? "Redirecting..." : "Sign in with Redirect (Mobile/Preview)"}
            </button>
          </div>
          <p className="mt-6 text-xs text-emerald-500">
            By signing in, you agree to our terms and acknowledge that this app is for educational purposes only.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-emerald-50 pb-32">
      <Navbar user={user} onLogout={logOut} activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <Dashboard key="dash" profile={profile} favorites={favorites} logs={healthLogs} setActiveTab={setActiveTab} />}
          {activeTab === 'symptoms' && <SymptomFinder key="sym" profile={profile} favorites={favorites} />}
          {activeTab === 'scanner' && <HerbScanner key="scan" />}
          {activeTab === 'dosha' && <DoshaQuiz key="dosha" profile={profile} />}
          {activeTab === 'library' && <HerbLibrary key="lib" favorites={favorites} />}
          {activeTab === 'calories' && <CalorieTracker key="cal" profile={profile} logs={healthLogs} />}
          {activeTab === 'remedy-maker' && <DIYRemedyMaker key="rem" />}
          {activeTab === 'chatbot' && <Chatbot key="chat" profile={profile} />}
          {activeTab === 'profile' && <Profile key="prof" profile={profile} />}
        </AnimatePresence>
      </main>

      <HealthTipBar />
    </div>
  );
}

function Profile({ profile }: { profile: UserProfile | null }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    age: profile?.age || '',
    gender: profile?.gender || 'other',
    weight: profile?.weight || '',
    height: profile?.height || '',
    activityLevel: profile?.activityLevel || 'sedentary',
  });

  const handleSave = async () => {
    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        ...formData,
        age: Number(formData.age),
        weight: Number(formData.weight),
        height: Number(formData.height),
      }, { merge: true });
      setIsEditing(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users');
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-emerald-100">
      <h2 className="text-2xl font-bold text-emerald-900 mb-6">Your Profile</h2>
      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-emerald-700">Age</label>
            <input type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-full p-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-emerald-700">Gender</label>
            <select value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as any})} className="w-full p-2 border rounded-lg">
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-emerald-700">Weight (kg)</label>
            <input type="number" value={formData.weight} onChange={e => setFormData({...formData, weight: e.target.value})} className="w-full p-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-emerald-700">Height (cm)</label>
            <input type="number" value={formData.height} onChange={e => setFormData({...formData, height: e.target.value})} className="w-full p-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-emerald-700">Activity Level</label>
            <select value={formData.activityLevel} onChange={e => setFormData({...formData, activityLevel: e.target.value as any})} className="w-full p-2 border rounded-lg">
              <option value="sedentary">Sedentary</option>
              <option value="light">Light</option>
              <option value="moderate">Moderate</option>
              <option value="active">Active</option>
              <option value="very_active">Very Active</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="bg-emerald-600 text-white px-4 py-2 rounded-lg">Save</button>
            <button onClick={() => setIsEditing(false)} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p><strong>Age:</strong> {profile?.age || 'Not set'}</p>
          <p><strong>Gender:</strong> {profile?.gender || 'Not set'}</p>
          <p><strong>Weight:</strong> {profile?.weight || 'Not set'} kg</p>
          <p><strong>Height:</strong> {profile?.height || 'Not set'} cm</p>
          <p><strong>Activity Level:</strong> {profile?.activityLevel || 'Not set'}</p>
          <button onClick={() => setIsEditing(true)} className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-lg">Edit</button>
        </div>
      )}
    </div>
  );
}

// --- Feature Components ---

function Dashboard({ profile, favorites, logs, setActiveTab }: { profile: UserProfile | null, favorites: Favorite[], logs: HealthLog[], setActiveTab: (t: string) => void }) {
  const todayLog = logs.find(l => l.date === new Date().toISOString().split('T')[0]);
  const calorieProgress = todayLog && profile?.calorieGoal ? (todayLog.calories / profile.calorieGoal) * 100 : 0;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-emerald-900">Namaste, {profile?.displayName}</h1>
          <p className="text-emerald-600">Your Ayurvedic wellness journey today.</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-3 rounded-xl shadow-sm border border-emerald-100">
          <Activity className="text-emerald-600 w-5 h-5" />
          <span className="font-medium text-emerald-900">Dosha: <span className="text-emerald-600">{profile?.dosha || 'Unknown'}</span></span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Calorie Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-emerald-900 text-lg">Daily Calories</h3>
            <Calculator className="text-emerald-600 w-5 h-5" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-emerald-600">{todayLog?.calories || 0} / {profile?.calorieGoal || 2000} kcal</span>
              <span className="font-bold text-emerald-900">{Math.round(calorieProgress)}%</span>
            </div>
            <div className="w-full bg-emerald-100 h-3 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(calorieProgress, 100)}%` }}
                className="h-full bg-emerald-500"
              />
            </div>
          </div>
          <button onClick={() => setActiveTab('calories')} className="mt-6 text-emerald-600 text-sm font-medium flex items-center gap-1 hover:underline">
            Log Food <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Dosha Card */}
        <div className="bg-emerald-900 text-white p-6 rounded-2xl shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-xl mb-2">Your Dosha: {profile?.dosha}</h3>
            <p className="text-emerald-200 text-sm">
              {profile?.dosha === 'Unknown' ? 'Take the quiz to discover your Ayurvedic body type.' : `You have a ${profile?.dosha} dominant constitution.`}
            </p>
          </div>
          <button
            onClick={() => setActiveTab('dosha')}
            className="mt-6 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors w-fit"
          >
            {profile?.dosha === 'Unknown' ? 'Take Quiz' : 'Retake Quiz'}
          </button>
        </div>

        {/* Favorites Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-bold text-emerald-900 text-lg">Saved Remedies</h3>
            <Heart className="text-red-500 w-5 h-5 fill-current" />
          </div>
          <div className="space-y-2">
            {favorites.length > 0 ? (
              favorites.slice(0, 3).map(f => (
                <div key={f.id} className="flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  {f.name}
                </div>
              ))
            ) : (
              <p className="text-emerald-400 text-sm italic">No remedies saved yet.</p>
            )}
          </div>
          <button onClick={() => setActiveTab('symptoms')} className="mt-6 text-emerald-600 text-sm font-medium flex items-center gap-1 hover:underline">
            Explore Remedies <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <section>
        <h2 className="text-xl font-bold text-emerald-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { id: 'symptoms', label: 'Find Remedy', icon: Search, color: 'bg-blue-50 text-blue-600' },
            { id: 'scanner', label: 'Scan Herb', icon: Camera, color: 'bg-purple-50 text-purple-600' },
            { id: 'library', label: 'Herb Library', icon: BookOpen, color: 'bg-orange-50 text-orange-600' },
            { id: 'chatbot', label: 'Ask AyurBot', icon: MessageSquare, color: 'bg-emerald-50 text-emerald-600' },
          ].map(action => (
            <button
              key={action.id}
              onClick={() => setActiveTab(action.id)}
              className="bg-white p-4 rounded-xl shadow-sm border border-emerald-50 flex flex-col items-center gap-3 hover:shadow-md transition-all group"
            >
              <div className={cn("p-3 rounded-full transition-transform group-hover:scale-110", action.color)}>
                <action.icon className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-emerald-900">{action.label}</span>
            </button>
          ))}
        </div>
      </section>
    </motion.div>
  );
}

function SymptomFinder({ profile, favorites }: { profile: UserProfile | null, favorites: Favorite[] }) {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [severity, setSeverity] = useState<'Mild' | 'Moderate' | 'Severe' | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [ailmentSearch, setAilmentSearch] = useState('');

  const addSymptom = (s: string) => {
    if (s && !symptoms.includes(s)) {
      setSymptoms([...symptoms, s]);
      setInput('');
    }
  };

  const removeSymptom = (s: string) => setSymptoms(symptoms.filter(x => x !== s));

  const findRemedies = async () => {
    if (symptoms.length === 0) return;
    if (isApiKeyMissing) {
      console.error("Gemini API Key is missing. Please set GEMINI_API_KEY in your environment.");
      setResults([{
        name: "Warm Water & Rest",
        benefits: "Hydration and recovery",
        howToUse: "Sip warm water throughout the day.",
        precautions: "None"
      }]);
      setSeverity('Mild');
      return;
    }
    setLoading(true);
    setResults([]);
    setSeverity(null);
    try {
      const response = await genAI.models.generateContent({
        model: AI_MODEL,
        contents: `As an Ayurvedic expert, analyze these symptoms: ${symptoms.join(', ')}. 
        User Dosha: ${profile?.dosha || 'Unknown'}.
        Provide a comprehensive Ayurvedic solution.
        1. Determine severity (Mild, Moderate, Severe).
        2. Provide 3 specific Ayurvedic remedies with clear instructions.
        Format as JSON: { "severity": "Mild|Moderate|Severe", "remedies": [{ "name": "...", "benefits": "...", "howToUse": "...", "precautions": "..." }] }`,
        config: { responseMimeType: "application/json" }
      });
      
      if (response.text) {
        const data = JSON.parse(response.text);
        setResults(data.remedies || []);
        setSeverity(data.severity || 'Mild');
      } else {
        throw new Error("Empty response from AI");
      }
    } catch (e: any) {
      console.error("Remedy Finder Error:", e);
      if (e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('quota')) {
        setResults([{
          name: "API Quota Exceeded",
          benefits: "Please try again later.",
          howToUse: "The AI service has reached its limit for now.",
          precautions: "Wait a while before trying again."
        }]);
      } else {
        // Fallback to a generic message if AI fails
        setResults([{
          name: "Warm Water & Rest",
          benefits: "Hydration and recovery",
          howToUse: "Sip warm water throughout the day.",
          precautions: "None"
        }]);
      }
      setSeverity('Mild');
    } finally {
      setLoading(false);
    }
  };

  const selectAilment = (ailment: any) => {
    setResults(ailment.remedies);
    setSeverity('Mild');
    setSymptoms([ailment.name]);
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };

  const startVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      console.error("Speech recognition not supported in this browser.");
      return;
    }
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      addSymptom(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const saveFavorite = async (remedy: any) => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'favorites'), {
        uid: auth.currentUser.uid,
        remedyId: Math.random().toString(36).substr(2, 9),
        name: remedy.name,
        category: 'Remedy',
        savedAt: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'favorites');
    }
  };

  const filteredAilments = COMMON_AILMENTS.filter(a => 
    a.name.toLowerCase().includes(ailmentSearch.toLowerCase()) || 
    a.remedies.some(r => r.name.toLowerCase().includes(ailmentSearch.toLowerCase()) || r.benefits.toLowerCase().includes(ailmentSearch.toLowerCase()))
  );

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-emerald-900">Smart Remedy Finder</h1>
        <p className="text-emerald-600">Enter your symptoms for personalized Ayurvedic suggestions, or search our database.</p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-4">
        <h3 className="font-bold text-emerald-900 text-lg">AI Symptom Analyzer</h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addSymptom(input)}
              placeholder="e.g., Headache, Dry Cough, Indigestion"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-emerald-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
            />
            <Search className="absolute left-3 top-3.5 text-emerald-400 w-5 h-5" />
          </div>
          <button
            onClick={startVoiceInput}
            className={cn("p-3 rounded-xl transition-colors", isListening ? "bg-red-100 text-red-600 animate-pulse" : "bg-emerald-100 text-emerald-600 hover:bg-emerald-200")}
          >
            <Mic className="w-6 h-6" />
          </button>
          <button
            onClick={findRemedies}
            disabled={loading || symptoms.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Find Remedies"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {symptoms.map(s => (
            <span key={s} className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1">
              {s}
              <button onClick={() => removeSymptom(s)} className="hover:text-emerald-900"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>

        <div className="pt-4 border-t border-emerald-50">
          <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">Common Symptoms</p>
          <div className="flex flex-wrap gap-2">
            {COMMON_SYMPTOMS.filter(s => !symptoms.includes(s)).slice(0, 10).map(s => (
              <button
                key={s}
                onClick={() => addSymptom(s)}
                className="text-xs bg-white border border-emerald-100 text-emerald-600 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="font-bold text-emerald-900 text-xl">Quick Solutions Database</h3>
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={ailmentSearch}
              onChange={(e) => setAilmentSearch(e.target.value)}
              placeholder="Search ailments or remedies..."
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-emerald-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            />
            <Search className="absolute left-3 top-2.5 text-emerald-400 w-4 h-4" />
          </div>
        </div>

        {filteredAilments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredAilments.map((ailment, i) => (
              <button
                key={i}
                onClick={() => selectAilment(ailment)}
                className="bg-white p-4 rounded-xl border border-emerald-100 text-left hover:shadow-md hover:border-emerald-300 transition-all group flex flex-col justify-between h-full"
              >
                <div>
                  <h4 className="font-bold text-emerald-900 group-hover:text-emerald-600 transition-colors">{ailment.name}</h4>
                  <p className="text-xs text-emerald-500 mt-2 line-clamp-2">
                    {ailment.remedies.map(r => r.name).join(', ')}
                  </p>
                </div>
                <div className="mt-4 flex items-center text-xs font-bold text-emerald-600">
                  View Remedies <ChevronRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-xl border border-emerald-100 text-center">
            <p className="text-emerald-600">No predefined remedies found for "{ailmentSearch}". Try using the AI Analyzer above!</p>
          </div>
        )}
      </div>

      {severity === 'Severe' && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl flex items-center gap-3">
          <AlertTriangle className="text-red-500 w-6 h-6" />
          <div>
            <p className="text-red-800 font-bold">Severity Detected: Severe</p>
            <p className="text-red-700 text-sm">Please consult a qualified medical professional immediately. Ayurveda is a complementary system.</p>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-emerald-100">
          <h3 className="font-bold text-emerald-900 text-xl">Recommended Remedies</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {results.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-emerald-900 text-lg">{r.name}</h3>
                  <button onClick={() => saveFavorite(r)} className="text-emerald-400 hover:text-red-500 transition-colors">
                    <Heart className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4 flex-1">
                  <div>
                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Benefits</p>
                    <p className="text-sm text-emerald-700">{r.benefits}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">How to Use</p>
                    <p className="text-sm text-emerald-700">{r.howToUse}</p>
                  </div>
                  {r.precautions && r.precautions !== "None" && r.precautions !== "None." && (
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <p className="text-xs font-bold text-orange-600 uppercase tracking-wider flex items-center gap-1">
                        <Info className="w-3 h-3" /> Precautions
                      </p>
                      <p className="text-xs text-orange-700 mt-1">{r.precautions}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function HerbScanner() {
  const [image, setImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        analyzeImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async (base64: string) => {
    if (isApiKeyMissing) {
      console.error("Gemini API Key is missing.");
      return;
    }
    setScanning(true);
    setResult(null);
    try {
      const response = await genAI.models.generateContent({
        model: AI_MODEL,
        contents: {
          parts: [
            { text: "Identify this herb/plant. Provide: Name, Scientific Name, Confidence %, History, Benefits, Precautions, and a Wikipedia link. Also suggest 2 other possible matches. Format as JSON: { \"name\": \"...\", \"scientificName\": \"...\", \"confidence\": 85, \"history\": \"...\", \"benefits\": \"...\", \"precautions\": \"...\", \"wikiUrl\": \"...\", \"others\": [{\"name\": \"...\", \"confidence\": 10}] }" },
            { inlineData: { data: base64.split(',')[1], mimeType: "image/jpeg" } }
          ]
        },
        config: { responseMimeType: "application/json" }
      });
      setResult(JSON.parse(response.text));
    } catch (e: any) {
      console.error(e);
      if (e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('quota')) {
        setResult({
          name: "API Quota Exceeded",
          scientificName: "N/A",
          confidence: 0,
          history: "The AI service has reached its limit for now.",
          benefits: "Please try again later.",
          precautions: "Wait a while before trying again.",
          wikiUrl: "",
          others: []
        });
      } else {
        setResult({
          name: "Error identifying plant",
          scientificName: "N/A",
          confidence: 0,
          history: "An error occurred during analysis.",
          benefits: "N/A",
          precautions: "N/A",
          wikiUrl: "",
          others: []
        });
      }
    } finally {
      setScanning(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-emerald-900">Intelligent Herb Scanner</h1>
        <p className="text-emerald-600">Upload or capture a photo of any plant to identify its Ayurvedic properties.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="aspect-square bg-white rounded-2xl border-2 border-dashed border-emerald-200 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 transition-all overflow-hidden relative group"
          >
            {image ? (
              <img src={image} alt="Upload" className="w-full h-full object-cover" />
            ) : (
              <>
                <Camera className="w-12 h-12 text-emerald-300 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-emerald-500 font-medium">Click to Upload or Capture</span>
              </>
            )}
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
          </div>
          {image && (
            <button
              onClick={() => { setImage(null); setResult(null); }}
              className="w-full py-2 text-red-500 font-medium hover:bg-red-50 rounded-lg transition-colors"
            >
              Clear Image
            </button>
          )}
        </div>

        <div className="space-y-6">
          {scanning && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-emerald-100 flex flex-col items-center justify-center space-y-4 h-full">
              <RefreshCw className="w-12 h-12 text-emerald-500 animate-spin" />
              <div className="text-center">
                <p className="text-emerald-900 font-bold">Analyzing plant using AI...</p>
                <p className="text-emerald-500 text-sm">Comparing with 10,000+ Ayurvedic species</p>
              </div>
              <div className="w-full bg-emerald-100 h-2 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="h-full bg-emerald-500"
                />
              </div>
            </div>
          )}

          {result && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-emerald-900">{result.name}</h2>
                  <p className="text-emerald-500 italic">{result.scientificName}</p>
                </div>
                <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-bold">
                  {result.confidence}% Confidence
                </div>
              </div>

              {result.confidence < 60 && (
                <div className="bg-orange-50 p-3 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="text-orange-500 w-5 h-5 shrink-0" />
                  <p className="text-xs text-orange-700">Identification is uncertain. Please verify manually or consult an expert before use.</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-1"><History className="w-4 h-4" /> History</h4>
                  <p className="text-sm text-emerald-700 leading-relaxed">{result.history}</p>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Benefits</h4>
                  <p className="text-sm text-emerald-700 leading-relaxed">{result.benefits}</p>
                </div>
                <div className="bg-red-50 p-3 rounded-lg">
                  <h4 className="text-sm font-bold text-red-700 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Precautions</h4>
                  <p className="text-xs text-red-600 mt-1">{result.precautions}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-emerald-50 flex items-center justify-between">
                <a href={result.wikiUrl} target="_blank" rel="noreferrer" className="text-emerald-600 text-sm font-bold hover:underline flex items-center gap-1">
                  Wikipedia <ChevronRight className="w-4 h-4" />
                </a>
                <button className="text-emerald-400 text-xs hover:text-emerald-600 transition-colors">View Other Matches</button>
              </div>
            </motion.div>
          )}

          {!scanning && !result && (
            <div className="bg-emerald-50 p-8 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center h-full">
              <Info className="w-12 h-12 text-emerald-200 mb-4" />
              <p className="text-emerald-900 font-medium">Ready to scan</p>
              <p className="text-emerald-500 text-sm">Upload a clear photo of leaves or flowers for best results.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function DoshaQuiz({ profile }: { profile: UserProfile | null }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<{ primary: string, secondary: string | null, percentages: any } | null>(null);

  const handleAnswer = (dosha: string) => {
    const newAnswers = [...answers, dosha];
    if (step < DOSHA_QUESTIONS.length - 1) {
      setAnswers(newAnswers);
      setStep(step + 1);
    } else {
      // Calculate result
      const counts: Record<string, number> = { Vata: 0, Pitta: 0, Kapha: 0 };
      newAnswers.forEach(d => { counts[d] = (counts[d] || 0) + 1; });
      
      const total = newAnswers.length;
      const percentages = {
        Vata: Math.round((counts.Vata / total) * 100),
        Pitta: Math.round((counts.Pitta / total) * 100),
        Kapha: Math.round((counts.Kapha / total) * 100)
      };

      const sortedDoshas = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
      const primary = sortedDoshas[0];
      const secondary = counts[sortedDoshas[1]] > 0 && (counts[sortedDoshas[1]] / total) >= 0.3 ? sortedDoshas[1] : null;

      const finalResult = { primary, secondary, percentages };
      setResult(finalResult);
      updateProfile(primary);
    }
  };

  const updateProfile = async (dosha: string) => {
    if (!auth.currentUser) return;
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), { dosha }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users');
    }
  };

  if (result) {
    const { primary, secondary, percentages } = result;
    const doshaName = secondary ? `${primary}-${secondary}` : primary;

    return (
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="max-w-3xl mx-auto bg-white p-8 rounded-3xl shadow-xl space-y-8">
        <div className="text-center space-y-4">
          <div className="bg-emerald-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto">
            <Activity className="w-12 h-12 text-emerald-600" />
          </div>
          <h2 className="text-3xl font-bold text-emerald-900">Your Dosha: {doshaName}</h2>
          <p className="text-emerald-600 font-medium">Here is your unique mind-body constitution breakdown:</p>
        </div>

        <div className="space-y-4">
          {Object.entries(percentages).map(([dosha, pct]) => (
            <div key={dosha} className="space-y-1">
              <div className="flex justify-between text-sm font-bold text-emerald-900">
                <span>{dosha}</span>
                <span>{pct as number}%</span>
              </div>
              <div className="w-full bg-emerald-100 rounded-full h-3 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${pct}%` }} 
                  transition={{ duration: 1, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full",
                    dosha === 'Vata' ? 'bg-blue-400' : dosha === 'Pitta' ? 'bg-red-400' : 'bg-green-500'
                  )}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="text-emerald-800 space-y-4 leading-relaxed bg-emerald-50 p-6 rounded-2xl">
          <h3 className="font-bold text-lg text-emerald-900">Understanding Your Constitution</h3>
          {primary === 'Vata' && <p><strong>Vata (Air & Space):</strong> You are naturally creative, energetic, and adaptable. When balanced, you are lively and enthusiastic. When out of balance, you may experience anxiety, dry skin, or irregular digestion. Focus on grounding routines and warm, nourishing foods.</p>}
          {primary === 'Pitta' && <p><strong>Pitta (Fire & Water):</strong> You are naturally intelligent, focused, and driven. When balanced, you are a great leader with strong digestion. When out of balance, you may experience irritability, inflammation, or acidity. Focus on cooling foods and stress management.</p>}
          {primary === 'Kapha' && <p><strong>Kapha (Earth & Water):</strong> You are naturally calm, loyal, and steady. When balanced, you have great endurance and a loving nature. When out of balance, you may experience lethargy, weight gain, or congestion. Focus on regular exercise and light, stimulating foods.</p>}
          
          {secondary && (
            <p className="mt-4"><strong>Secondary {secondary}:</strong> You also have strong {secondary} traits, meaning you should adjust your lifestyle seasonally. For example, follow a {primary}-pacifying routine most of the time, but switch to a {secondary}-pacifying routine when its associated season or symptoms peak.</p>
          )}
        </div>

        <div className="bg-white border border-emerald-100 p-6 rounded-2xl text-left shadow-sm">
          <h4 className="font-bold text-emerald-900 mb-4 text-lg">Personalized Recommendations</h4>
          <ul className="text-sm text-emerald-700 space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" /> 
              <span><strong>Diet:</strong> {primary === 'Vata' ? 'Favor warm, moist, grounding foods (soups, stews, healthy fats). Avoid cold, raw, and dry foods.' : primary === 'Pitta' ? 'Favor cooling, hydrating, substantial foods (sweet fruits, bitter greens). Avoid spicy, fried, and overly sour foods.' : 'Favor light, warm, stimulating foods (spices, vegetables, legumes). Avoid heavy, oily, and sweet foods.'}</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" /> 
              <span><strong>Lifestyle:</strong> {primary === 'Vata' ? 'Maintain a strict daily routine, stay warm, and practice gentle yoga or meditation.' : primary === 'Pitta' ? 'Avoid excessive heat, balance work with play, and practice cooling breathwork (Sheetali).' : 'Wake up early, engage in vigorous daily exercise, and seek new stimulating experiences.'}</span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" /> 
              <span><strong>Herbs:</strong> {primary === 'Vata' ? 'Ashwagandha, Ginger, and Triphala' : primary === 'Pitta' ? 'Shatavari, Neem, and Amla' : 'Trikatu, Guggulu, and Tulsi'} are highly beneficial for your constitution.</span>
            </li>
          </ul>
        </div>
        
        <div className="text-center pt-4">
          <button onClick={() => { setStep(0); setAnswers([]); setResult(null); }} className="text-emerald-600 font-bold hover:text-emerald-800 transition-colors px-6 py-2 rounded-full hover:bg-emerald-50">
            Retake Quiz
          </button>
        </div>
      </motion.div>
    );
  }

  const progress = ((step) / DOSHA_QUESTIONS.length) * 100;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-2xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-emerald-900">Discover Your Dosha</h1>
        <p className="text-emerald-600">Answer these {DOSHA_QUESTIONS.length} questions to reveal your unique Ayurvedic mind-body constitution.</p>
        
        <div className="w-full max-w-md mx-auto bg-emerald-100 rounded-full h-2.5 mb-4 overflow-hidden">
          <motion.div 
            className="bg-emerald-600 h-2.5 rounded-full" 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Question {step + 1} of {DOSHA_QUESTIONS.length}</p>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-emerald-100 min-h-[300px] flex flex-col justify-center relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            <h3 className="text-xl sm:text-2xl font-bold text-emerald-900 mb-8 text-center">{DOSHA_QUESTIONS[step].question}</h3>
            <div className="space-y-3 sm:space-y-4">
              {DOSHA_QUESTIONS[step].options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(opt.dosha)}
                  className="w-full text-left p-4 sm:p-5 rounded-2xl border-2 border-emerald-50 hover:border-emerald-500 hover:bg-emerald-50 transition-all flex items-center justify-between group shadow-sm hover:shadow-md"
                >
                  <span className="text-emerald-800 font-medium text-sm sm:text-base">{opt.text}</span>
                  <ChevronRight className="w-5 h-5 text-emerald-300 group-hover:text-emerald-600 shrink-0 ml-4 transition-transform group-hover:translate-x-1" />
                </button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function HerbLibrary({ favorites }: { favorites: Favorite[] }) {
  const [search, setSearch] = useState('');
  const filteredHerbs = HERB_LIBRARY.filter(h => h.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-emerald-900">Herb Library</h1>
          <p className="text-emerald-600">Explore the healing power of nature.</p>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search herbs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 rounded-xl border border-emerald-200 focus:ring-2 focus:ring-emerald-500 outline-none w-full md:w-64"
          />
          <Search className="absolute left-3 top-2.5 text-emerald-400 w-5 h-5" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredHerbs.map((herb, i) => (
          <motion.div
            key={herb.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden hover:shadow-md transition-shadow group"
          >
            <div className="h-48 overflow-hidden relative">
              <img src={herb.imageUrl} alt={herb.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute top-2 right-2">
                <button className="p-2 bg-white/80 backdrop-blur-sm rounded-full text-emerald-600 hover:text-red-500 transition-colors">
                  <Heart className={cn("w-5 h-5", favorites.some(f => f.name === herb.name) && "fill-current text-red-500")} />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <h3 className="font-bold text-emerald-900 text-lg">{herb.name}</h3>
                <p className="text-xs text-emerald-500 italic">{herb.scientificName}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {herb.benefits.map(b => (
                  <span key={b} className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase">{b}</span>
                ))}
              </div>
              <p className="text-sm text-emerald-700 line-clamp-2">{herb.uses}</p>
              <a href={herb.wikiUrl} target="_blank" rel="noreferrer" className="text-emerald-600 text-xs font-bold flex items-center gap-1 hover:underline">
                Learn More <ChevronRight className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function CalorieTracker({ profile, logs }: { profile: UserProfile | null, logs: HealthLog[] }) {
  const [foodInput, setFoodInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(profile?.calorieGoal?.toString() || '2000');
  
  const today = new Date().toISOString().split('T')[0];
  const todayLog = logs.find(l => l.date === today);
  const currentCalories = todayLog?.calories || 0;
  const calorieGoal = profile?.calorieGoal || 2000;
  const progressPercentage = Math.min((currentCalories / calorieGoal) * 100, 100);

  const updateGoal = async () => {
    if (!auth.currentUser) return;
    const newGoal = parseInt(goalInput);
    if (isNaN(newGoal) || newGoal < 500 || newGoal > 10000) return;
    
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), { calorieGoal: newGoal }, { merge: true });
      setIsEditingGoal(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users');
    } finally {
      setLoading(false);
    }
  };

  const logFood = async () => {
    if (!foodInput || !auth.currentUser) return;
    setLoading(true);
    try {
      const response = await genAI.models.generateContent({
        model: AI_MODEL,
        contents: `Estimate calories for this food: "${foodInput}". Return ONLY the number.`,
      });
      const calories = parseInt(response.text.replace(/[^0-9]/g, '')) || 0;

      const logId = todayLog?.id || today;
      const newCalories = (todayLog?.calories || 0) + calories;
      const newFoodItems = [...(todayLog?.foodItems || []), foodInput];

      await setDoc(doc(db, 'users', auth.currentUser.uid, 'logs', logId), {
        uid: auth.currentUser.uid,
        date: today,
        calories: newCalories,
        foodItems: newFoodItems,
        updatedAt: new Date().toISOString()
      });
      setFoodInput('');
    } catch (e: any) {
      if (e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('quota')) {
        alert("API Quota Exceeded. Cannot estimate calories right now. Please try again later.");
      } else {
        handleFirestoreError(e, OperationType.WRITE, `users/${auth.currentUser.uid}/logs/${today}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    return logs.slice(0, 7).reverse().map(l => ({
      date: new Date(l.date).toLocaleDateString('en-US', { weekday: 'short' }),
      calories: l.calories
    }));
  }, [logs]);

  const dietPlan = profile?.dosha && profile.dosha !== 'Unknown' ? DOSHA_DIET_PLANS[profile.dosha as keyof typeof DOSHA_DIET_PLANS] : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-emerald-900">Ayurvedic Calorie Tracker</h1>
        <p className="text-emerald-600">Track your intake and stay balanced with your Dosha.</p>
      </div>

      {/* Daily Goal Progress Bar */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-emerald-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
          <div>
            <h3 className="font-bold text-emerald-900 text-lg">Today's Progress</h3>
            <p className="text-emerald-600 text-sm">{currentCalories} / {calorieGoal} kcal</p>
          </div>
          
          {isEditingGoal ? (
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="w-24 px-3 py-1 rounded-lg border border-emerald-200 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                placeholder="Goal"
              />
              <button 
                onClick={updateGoal}
                disabled={loading}
                className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                Save
              </button>
              <button 
                onClick={() => setIsEditingGoal(false)}
                className="text-emerald-600 px-3 py-1 rounded-lg text-sm font-medium hover:bg-emerald-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsEditingGoal(true)}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-4 py-2 rounded-xl transition-colors"
            >
              Edit Goal
            </button>
          )}
        </div>
        
        <div className="w-full bg-emerald-100 rounded-full h-4 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn(
              "h-full rounded-full",
              progressPercentage > 100 ? "bg-red-500" : progressPercentage > 80 ? "bg-yellow-400" : "bg-emerald-500"
            )}
          />
        </div>
        {progressPercentage >= 100 && (
          <p className="text-xs text-red-500 mt-2 font-medium">You have reached or exceeded your daily calorie goal.</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-6">
          <h3 className="font-bold text-emerald-900 text-lg">Log Your Meal</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={foodInput}
              onChange={(e) => setFoodInput(e.target.value)}
              placeholder="e.g., 2 Rotis and Dal"
              className="flex-1 px-4 py-2 rounded-xl border border-emerald-200 focus:ring-2 focus:ring-emerald-500 outline-none"
            />
            <button
              onClick={logFood}
              disabled={loading || !foodInput}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl font-bold transition-all disabled:opacity-50"
            >
              {loading ? "..." : "Add"}
            </button>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-emerald-900">Today's Intake</h4>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {todayLog?.foodItems.map((item, i) => (
                <div key={i} className="bg-emerald-50 p-3 rounded-lg text-sm text-emerald-700 flex justify-between items-center">
                  <span>{item}</span>
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                </div>
              ))}
              {(!todayLog || todayLog.foodItems.length === 0) && <p className="text-emerald-400 text-sm italic">Nothing logged yet today.</p>}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-6">
          <h3 className="font-bold text-emerald-900 text-lg">Weekly Progress</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0fdf4" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#065f46', fontSize: 12 }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f0fdf4' }}
                />
                <Bar dataKey="calories" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-emerald-900 text-white p-4 rounded-xl">

            <p className="text-xs text-emerald-300 uppercase font-bold mb-1">Dosha Tip</p>
            <p className="text-sm">
              {profile?.dosha === 'Vata' && "Focus on warm, grounding foods today to balance your airy nature."}
              {profile?.dosha === 'Pitta' && "Opt for cooling foods like cucumber and coconut to soothe your inner fire."}
              {profile?.dosha === 'Kapha' && "Spicy and light foods will help stimulate your metabolism today."}
              {profile?.dosha === 'Unknown' && "Discover your Dosha for personalized diet tips!"}
            </p>
          </div>
        </div>
      </div>

      {dietPlan && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-3xl shadow-sm border border-emerald-100 space-y-6"
        >
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-3 rounded-full">
              <BookOpen className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-emerald-900">{dietPlan.title}</h3>
              <p className="text-emerald-600">{dietPlan.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="font-bold text-emerald-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" /> Key Guidelines
              </h4>
              <ul className="space-y-2">
                {dietPlan.guidelines.map((g, i) => (
                  <li key={i} className="text-sm text-emerald-700 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full mt-1.5 shrink-0" />
                    {g}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-emerald-900 flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-500" /> Sample Daily Menu
              </h4>
              <div className="space-y-3">
                {Object.entries(dietPlan.meals).map(([meal, desc]) => (
                  <div key={meal} className="bg-emerald-50 p-3 rounded-xl">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">{meal}</p>
                    <p className="text-sm text-emerald-800">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function Chatbot({ profile }: { profile: UserProfile | null }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: `Namaste! I am AyurBot, your Ayurvedic guide. How can I assist you today? (Dosha: ${profile?.dosha || 'Unknown'})` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  const sendMessage = async () => {
    if (!input || loading) return;
    if (isApiKeyMissing) {
      setMessages(prev => [...prev, { role: 'model', text: "I apologize, but my AI wisdom is currently disconnected (API Key missing). Please check the configuration." }]);
      return;
    }
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const chat = genAI.chats.create({
        model: AI_MODEL,
        config: {
          systemInstruction: `You are AyurBot, a wise and compassionate Ayurvedic expert. 
          The user's Dosha is ${profile?.dosha || 'Unknown'}. 
          Provide advice based on classical Ayurvedic texts (Charaka Samhita, Sushruta Samhita). 
          Always include a disclaimer that you are an AI and not a doctor. 
          Keep replies structured with bullet points where appropriate.`,
        }
      });
      const response = await chat.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, { role: 'model', text: response.text }]);
    } catch (e: any) {
      if (e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('quota')) {
        setMessages(prev => [...prev, { role: 'model', text: "I apologize, but I have reached my daily limit for answering questions (API Quota Exceeded). Please try again later." }]);
      } else {
        setMessages(prev => [...prev, { role: 'model', text: "I apologize, I am having trouble connecting to my ancient wisdom. Please try again." }]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto h-[600px] flex flex-col bg-white rounded-3xl shadow-xl overflow-hidden border border-emerald-100">
      <div className="bg-emerald-900 p-4 text-white flex items-center gap-3">
        <div className="bg-emerald-700 p-2 rounded-full">
          <MessageSquare className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h3 className="font-bold">AyurBot</h3>
          <p className="text-xs text-emerald-300">Ayurvedic Expert AI</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-emerald-50/30">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm",
              m.role === 'user' ? "bg-emerald-600 text-white rounded-tr-none" : "bg-white text-emerald-900 rounded-tl-none border border-emerald-100"
            )}>
              <div className="prose prose-sm prose-emerald max-w-none">
                <ReactMarkdown>{m.text}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-emerald-100 flex gap-1">
              <span className="w-2 h-2 bg-emerald-300 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-emerald-300 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-2 h-2 bg-emerald-300 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-emerald-100 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about symptoms, herbs, or diet..."
          className="flex-1 px-4 py-3 rounded-xl border border-emerald-200 focus:ring-2 focus:ring-emerald-500 outline-none"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input}
          className="bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-xl transition-all disabled:opacity-50"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </motion.div>
  );
}

function DIYRemedyMaker() {
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [remedy, setRemedy] = useState<any>(null);

  const ingredients = [
    "Ginger", "Honey", "Turmeric", "Tulsi", "Lemon", "Black Pepper", "Cinnamon", "Clove", "Ghee", "Amla"
  ];

  const toggleIngredient = (ing: string) => {
    if (selectedIngredients.includes(ing)) {
      setSelectedIngredients(selectedIngredients.filter(i => i !== ing));
    } else {
      setSelectedIngredients([...selectedIngredients, ing]);
    }
  };

  const generateRemedy = async () => {
    if (selectedIngredients.length === 0) return;
    if (isApiKeyMissing) {
      console.error("Gemini API Key is missing.");
      return;
    }
    setLoading(true);
    try {
      const response = await genAI.models.generateContent({
        model: AI_MODEL,
        contents: `Create an Ayurvedic remedy using these ingredients: ${selectedIngredients.join(', ')}. 
        Include: 1. Health Benefits, 2. Preparation Method, 3. Best Time to Consume. 
        Format as JSON: { "name": "...", "benefits": "...", "method": "...", "timing": "..." }`,
        config: { responseMimeType: "application/json" }
      });
      setRemedy(JSON.parse(response.text));
    } catch (e: any) {
      console.error(e);
      if (e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('quota')) {
        setRemedy({
          name: "API Quota Exceeded",
          benefits: "Please try again later.",
          method: "The AI service has reached its limit for now.",
          timing: "Wait a while before trying again."
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-emerald-900">DIY Remedy Maker</h1>
        <p className="text-emerald-600">Select ingredients from your kitchen to create powerful Ayurvedic remedies.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-6">
          <h3 className="font-bold text-emerald-900 text-lg">Select Ingredients</h3>
          <div className="grid grid-cols-2 gap-3">
            {ingredients.map(ing => (
              <button
                key={ing}
                onClick={() => toggleIngredient(ing)}
                className={cn(
                  "px-4 py-2 rounded-xl border transition-all text-sm font-medium",
                  selectedIngredients.includes(ing)
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                    : "bg-white text-emerald-700 border-emerald-100 hover:border-emerald-300"
                )}
              >
                {ing}
              </button>
            ))}
          </div>
          <button
            onClick={generateRemedy}
            disabled={loading || selectedIngredients.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50"
          >
            {loading ? "Mixing Wisdom..." : "Generate Remedy"}
          </button>
        </div>

        <div className="space-y-6">
          {remedy ? (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 space-y-6">
              <h2 className="text-2xl font-bold text-emerald-900">{remedy.name}</h2>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-1"><Heart className="w-4 h-4 text-red-500" /> Benefits</h4>
                  <p className="text-sm text-emerald-700 leading-relaxed">{remedy.benefits}</p>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-1"><RefreshCw className="w-4 h-4 text-emerald-500" /> Preparation</h4>
                  <p className="text-sm text-emerald-700 leading-relaxed">{remedy.method}</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-1"><Info className="w-4 h-4" /> Best Time</h4>
                  <p className="text-sm text-emerald-700 mt-1">{remedy.timing}</p>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-emerald-50 p-8 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center h-full">
              <Plus className="w-12 h-12 text-emerald-200 mb-4" />
              <p className="text-emerald-900 font-medium">Start mixing</p>
              <p className="text-emerald-500 text-sm">Select at least one ingredient to see the magic of Ayurveda.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
