// Canonical keys so the same test lines up across reports even when labs/AI name it differently.
const SYN = [
  ['ast_alt', /(sgot|\bast)\s*\/\s*(sgpt|alt\b)/],
  ['alt', /\b(alt|sgpt|alanine (amino)?transaminase)\b/],
  ['ast', /\b(ast|sgot|aspartate (amino)?transaminase)\b/],
  ['ggt', /\b(ggt|gamma.?glutamyl)/],
  ['alp', /\b(alp|alkaline phosphatase)\b/],
  ['hdl_ldl', /hdl\s*\/\s*ldl/],
  ['ldl_hdl', /ldl\s*\/\s*hdl/],
  ['chol_hdl', /(total )?cholesterol\s*\/\s*hdl/],
  ['non_hdl', /non.?hdl/],
  ['hdl', /\b(hdl|high.density lipoprotein)\b/],
  ['vldl', /\b(vldl|very.low.density)\b/],
  ['ldl', /\b(ldl|low.density lipoprotein)\b/],
  ['tg', /triglyceride/],
  ['chol', /^(total )?cholesterol(,? total)?$|cholesterol,? total|total cholesterol/],
  ['hba1c', /\b(hba1c|glycated|glycosylated)\b/],
  ['mbg', /mean (blood|plasma) glucose|estimated average glucose|\beag\b/],
  ['fbs', /(fasting).*(glucose|sugar)|glucose.*fasting|\bfbs\b/],
  ['tsh', /\b(tsh|thyroid stimulating)\b/],
  ['t3', /\b(t3|triiodothyronine)\b/],
  ['t4', /\b(t4|thyroxine)\b/],
  ['vitd', /vitamin d|25.?(oh|hydroxy)/],
  ['b12', /\b(b12|cobalamin)\b/],
  ['esr', /\b(esr|erythrocyte sedimentation)\b/],
  ['hb', /^(hb|haemoglobin|hemoglobin)\b|\(hb\)/],
  ['egfr', /\begfr\b|glomerular filtration/],
  ['bun_creat', /bun\s*\/\s*creatinine/],
  ['bun', /\b(bun|blood urea nitrogen)\b/],
  ['creat', /creatinine/],
  ['uric', /uric acid/],
  ['urea', /^urea\b|serum urea|blood urea$/],
  ['tibc', /\btibc\b|total iron binding/],
  ['uibc', /\buibc\b|unsaturated iron/],
  ['tsat', /transferrin saturation/],
  ['iron', /^(serum )?iron\b/],
  ['plt', /platelet count/],
  ['mpv', /\bmpv\b|mean platelet volume/],
  ['wbc', /total (wbc|leu[ck]ocyte)|\btlc\b|wbc count/],
  ['rbc', /\brbc count\b|red blood cell count|^rbc$/],
  ['pcv', /hematocrit|haematocrit|\bpcv\b/],
  ['mchc', /\bmchc\b/], ['mch', /\bmch\b/], ['mcv', /\bmcv\b/], ['rdw', /\brdw/],
];
export function labKey(name = '') {
  const n = name.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
  for (const [k, re] of SYN) {
    if (!re.test(n)) continue;
    // a ratio (A/B) must never merge into a single test like ALT or HDL
    if ((n.includes('/') || n.includes('ratio')) && !k.includes('_') && k !== 'tsat') break;
    return k;
  }
  return n.replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').sort().join(' ');
}
