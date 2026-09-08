import { describe, it, expect, beforeEach } from 'vitest';
import {
  initDesignVariant, getDesignVariant, setDesignVariant, toggleDesignVariant, DEFAULT_VARIANT,
} from '../designSystem';

describe('designSystem A/B runtime', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    delete document.documentElement.dataset.design;
  });

  it('falls back to the default variant', () => {
    expect(initDesignVariant()).toBe(DEFAULT_VARIANT);
    expect(document.documentElement.dataset.design).toBe(DEFAULT_VARIANT);
  });

  it('reads a persisted choice from localStorage', () => {
    localStorage.setItem('velvet.design', 'a');
    expect(initDesignVariant()).toBe('a');
    expect(document.documentElement.dataset.design).toBe('a');
  });

  it('lets ?design= override and persist', () => {
    localStorage.setItem('velvet.design', 'b');
    window.history.replaceState({}, '', '/lobby?design=a');
    expect(initDesignVariant()).toBe('a');
    expect(localStorage.getItem('velvet.design')).toBe('a');
  });

  it('ignores invalid values', () => {
    localStorage.setItem('velvet.design', 'purple');
    window.history.replaceState({}, '', '/?design=c');
    expect(initDesignVariant()).toBe(DEFAULT_VARIANT);
  });

  it('setDesignVariant and toggleDesignVariant update the document and storage', () => {
    initDesignVariant();
    setDesignVariant('a');
    expect(getDesignVariant()).toBe('a');
    expect(document.documentElement.dataset.design).toBe('a');
    expect(localStorage.getItem('velvet.design')).toBe('a');
    toggleDesignVariant();
    expect(getDesignVariant()).toBe('b');
    expect(document.documentElement.dataset.design).toBe('b');
  });
});
