const PREFIX = 'velvet:draft:';

export const getDraft = (key: string): string => {
  try {
    return sessionStorage.getItem(PREFIX + key) ?? '';
  } catch {
    return '';
  }
};

export const setDraft = (key: string, value: string): void => {
  try {
    if (value) sessionStorage.setItem(PREFIX + key, value);
    else sessionStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
};

export const clearDraft = (key: string): void => {
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
};
