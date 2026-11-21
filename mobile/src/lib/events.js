// Tiny cross-platform event emitter (web uses window events; RN has none).
const subs = {};
export function on(name, fn) { (subs[name] ||= new Set()).add(fn); return () => subs[name].delete(fn); }
export function emit(name, detail) { (subs[name] || []).forEach((fn) => { try { fn(detail); } catch { /* ignore */ } }); }
export const toast = (text, tone = 'ok') => emit('toast', { text, tone });
