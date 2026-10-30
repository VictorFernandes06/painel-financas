import { useCallback, useEffect, useState } from 'react';

/**
 * Estado React sincronizado com o LocalStorage.
 *
 * - Lê o valor salvo na primeira renderização (ou usa `initialValue`).
 * - `validate` (opcional) descarta dados corrompidos ou adulterados.
 * - Salva automaticamente a cada mudança.
 * - Mantém abas diferentes do navegador sincronizadas.
 */
export function useLocalStorage(key, initialValue, validate) {
  const readValue = useCallback(() => {
    const fallback = typeof initialValue === 'function' ? initialValue() : initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      const parsed = JSON.parse(raw);
      if (validate && !validate(parsed)) return fallback;
      return parsed;
    } catch {
      // Modo privado, armazenamento bloqueado ou JSON inválido.
      return fallback;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const [value, setValue] = useState(readValue);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Cota excedida ou armazenamento indisponível: o app continua em memória.
    }
  }, [key, value]);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === key) setValue(readValue());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, readValue]);

  return [value, setValue];
}
