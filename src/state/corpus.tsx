import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Corpus = 'tang' | 'primary';
const STORAGE_KEY = 'feihuaCorpus';

interface CorpusCtx {
  corpus: Corpus;
  setCorpus: (c: Corpus) => void;
}

const Ctx = createContext<CorpusCtx | null>(null);

export function CorpusProvider({ children }: { children: ReactNode }) {
  const [corpus, setCorpusState] = useState<Corpus>(() => {
    if (typeof localStorage === 'undefined') return 'tang';
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'primary' ? 'primary' : 'tang';
  });

  // 跨标签页同步
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'primary' || e.newValue === 'tang' || e.newValue === null)) {
        setCorpusState(e.newValue === 'primary' ? 'primary' : 'tang');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setCorpus = (c: Corpus) => {
    setCorpusState(c);
    try { localStorage.setItem(STORAGE_KEY, c); } catch {}
  };

  return <Ctx.Provider value={{ corpus, setCorpus }}>{children}</Ctx.Provider>;
}

export function useCorpus(): Corpus {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCorpus outside CorpusProvider');
  return v.corpus;
}

export function useSetCorpus(): (c: Corpus) => void {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCorpus outside CorpusProvider');
  return v.setCorpus;
}
