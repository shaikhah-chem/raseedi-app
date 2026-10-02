import { useCallback, useEffect, useRef, useState } from 'react';

// تحميل بيانات غير متزامن مع إعادة تحميل
export function useLoad(fn, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn); fnRef.current = fn;
  const seq = useRef(0);
  const reload = useCallback(async (silent = false) => {
    const my = ++seq.current;
    if (!silent) setLoading(true);
    try {
      const d = await fnRef.current();
      if (my === seq.current) { setData(d); setError(null); }
    } catch (e) {
      if (my === seq.current) setError(e.message || String(e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, deps);
  return { data, error, loading, reload, setData };
}

export function useInterval(cb, ms) {
  const r = useRef(cb); r.current = cb;
  useEffect(() => { const id = setInterval(() => r.current(), ms); return () => clearInterval(id); }, [ms]);
}
