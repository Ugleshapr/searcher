export class Normalizer {
  constructor() {
    // Транслитерация
    this.translitMap = {
      'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh',
      'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
      'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
      'ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
      'a':'а','b':'б','v':'в','g':'г','d':'д','e':'е','f':'ф','h':'х',
      'i':'и','j':'й','k':'к','l':'л','m':'м','n':'н','o':'о','p':'п',
      'r':'р','s':'с','t':'т','u':'у','w':'в','x':'кс','y':'ы','z':'з'
    };

    // Омографы
    this.homoglyphCanon = new Map([
  ['a','a'],['b','b'],['c','c'],['e','e'],['h','h'],['k','k'],
  ['m','m'],['o','o'],['p','p'],['t','t'],['x','x'],['y','y'],['f','f'], ['r','p'], 

  ['а','a'],['в','b'],['с','c'],['д','d'],['е','e'],['н','h'],['л','l'],['к','k'],
  ['м','m'],['о','o'],['р','p'],['т','t'],['х','x'],['у','y'], ['ф','f'],
  
  ['A','a'],['B','b'],['C','c'],['E','e'],['H','h'],['K','k'],
  ['M','m'],['O','o'],['P','p'],['T','t'],['X','x'],['Y','y'],['F','f'], ['R','p'], 

  ['А','a'],['В','b'],['С','c'],['Д','d'],['Е','e'],['Н','h'],['Л','L'],['К','k'],
  ['М','m'],['О','o'],['Р','p'],['Т','t'],['Х','x'],['У','y'],['Ф','f'],
]);


    this.homoglyphClass = new Map([
      ['a','[aа]'],['b','[bв]'],['c','[cс]'],['d','[dд]'],['e','[eе]'],
      ['h','[hн]'],['k','[kк]'],['m','[mм]'],['o','[oо]'],
      ['p','[prр]'],['r','[prр]'],['t','[tт]'],['x','[xх]'],['y','[yу]'],['f','[fф]'],
    ]);
  }

  normalizeForFuzzySearch(text) {
    if (!text) return '';
    const lower = String(text).toLowerCase();
    let canon = '';
    for (const ch of lower) {
      canon += this.homoglyphCanon.has(ch) ? this.homoglyphCanon.get(ch) : ch;
    }
    return canon.replace(/[^a-z0-9а-яё/]/g, '');
  }

  canonKeepDelims(text) {
    if (!text) return '';
    const lower = String(text).toLowerCase();
    let out = '';
    for (const ch of lower) {
      out += this.homoglyphCanon.has(ch) ? this.homoglyphCanon.get(ch) : ch;
    }
    return out;
  }

  transliterate(text) {
    return String(text)
      .toLowerCase()
      .split('')
      .map(c => this.translitMap[c] || c)
      .join('');
  }

  applyUZAliases(str = '') {
    let s = String(str);
    s = s.replace(
      /(^|[^A-Za-zА-Яа-яЁё0-9])ухл[зЗ](?=$|[^A-Za-zА-Яа-яЁё0-9])/gi,
      (_m, pre) => pre + 'ухл3'
    );
    s = s.replace(
      /(^|[^A-Za-zА-Яа-яЁё0-9])у[зЗ](?=$|[^A-Za-zА-Яа-яЁё0-9])/gi,
      (_m, pre) => pre + 'у3'
    );
    return s;
  }

  buildHomoglyphRegexToken(token) {
    let out = '';
    for (const raw of String(token)) {
      const lower = raw.toLowerCase();
      const canon = this.homoglyphCanon.get(raw) || this.homoglyphCanon.get(lower) || lower;
      if (this.homoglyphClass.has(canon)) {
        out += this.homoglyphClass.get(canon);
      } else if (/[a-z0-9а-яё]/i.test(raw)) {
        out += this.escapeRegExp(raw);
      } else {
        out += this.escapeRegExp(raw);
      }
    }
    return out;
  }

  escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

