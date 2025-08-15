// Приложение для поиска по Excel прайс-листу
class PriceListSearchApp {
    constructor() {
        this.data = [];
        this.filteredData = [];
        this.translitMap = {
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
            'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
            'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
            'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
            'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д', 'e': 'е', 'f': 'ф', 'h': 'х',
            'i': 'и', 'j': 'й', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о', 'p': 'п',
            'r': 'р', 's': 'с', 't': 'т', 'u': 'у', 'w': 'в', 'x': 'кс', 'y': 'ы', 'z': 'з'
        };
        
        this.initializeEventListeners();
        this.loadDefaultFile(); // сразу подгружаем base.xlsx
    } 

    async loadDefaultFile() {
        this.showLoadingIndicator(true);
        try {
            const response = await fetch('base.xlsx');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            const requiredColumns = ['Наименование', 'Артикул', 'Цена'];
            const firstRow = jsonData[0] || {};
            const missingColumns = requiredColumns.filter(col => !(col in firstRow));
            if (missingColumns.length > 0) {
                throw new Error(`Отсутствуют колонки: ${missingColumns.join(', ')}`);
            }

            this.data = jsonData;
            this.showFileStatus(`Файл base.xlsx загружен (${this.data.length} записей)`, 'success');
            this.hideUploadCard();
            this.showSearchSection();
        } catch (err) {
            console.error(err);
            this.showError('Не удалось загрузить файл base.xlsx');
        } finally {
            this.showLoadingIndicator(false);
        }
    }

    normalizeForFuzzySearch(text) {
        if (!text) return '';
        return text.toLowerCase().replace(/[^а-яёa-z0-9]/g, '');
    }

    initializeEventListeners() {
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', () => this.performSearch());
    }

    transliterate(text) {
        return text.toLowerCase().split('').map(char => {
            return this.translitMap[char] || char;
        }).join('');
    }

    createSearchVariants(query) {
        const normalizedQuery = query.toLowerCase().trim();
        const transliteratedQuery = this.transliterate(normalizedQuery);
        const variants = [normalizedQuery];
        if (transliteratedQuery !== normalizedQuery) variants.push(transliteratedQuery);
        return variants;
    }

    performSearch() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) {
            this.filteredData = [];
            this.displayResults();
            return;
        }
        const parts = query.split(/\s+/).map(part => this.normalizeForFuzzySearch(part)).filter(Boolean);
        this.filteredData = this.data.filter(item => {
            const name = item['Наименование'] ? this.normalizeForFuzzySearch(item['Наименование']) : '';
            const article = item['Артикул'] ? this.normalizeForFuzzySearch(item['Артикул']) : '';
            return parts.every(part => name.includes(part) || article.includes(part));
        });
        this.displayResults();
    }

    highlightMatches(text, searchVariants) {
        if (!text || !searchVariants.length) return text;
        let result = String(text);
        const normalizedText = text.toLowerCase();
        searchVariants.forEach(variant => {
            const regex = new RegExp(`(${this.escapeRegExp(variant)})`, 'gi');
            if (normalizedText.includes(variant.toLowerCase())) {
                result = result.replace(regex, '<span class="highlight">$1</span>');
            }
        });
        return result;
    }

    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    displayResults() {
        const resultsSection = document.getElementById('resultsSection');
        const resultsBody = document.getElementById('resultsBody');
        const resultsCount = document.getElementById('resultsCount');
        const noResults = document.getElementById('noResults');
        const query = document.getElementById('searchInput').value.trim();

        resultsSection.style.display = 'block';
        resultsSection.classList.add('fade-in');

        if (this.filteredData.length === 0) {
            resultsBody.innerHTML = '';
            noResults.style.display = 'block';
            resultsCount.textContent = 'Найдено: 0 результатов';
            return;
        }

        noResults.style.display = 'none';
        const searchVariants = query ? this.createSearchVariants(query) : [];
        resultsBody.innerHTML = this.filteredData.map(item => `
            <tr>
                <td>${this.highlightMatches(item['Наименование'] || '', searchVariants)}</td>
                <td>${this.highlightMatches(item['Артикул'] || '', searchVariants)}</td>
                <td class="text-price">${this.formatPrice(item['Цена'])}</td>
            </tr>
        `).join('');
        resultsCount.textContent = `Найдено: ${this.filteredData.length} результатов`;
    }

    formatPrice(price) {
        if (price === null || price === undefined || price === '') return '—';
        const numPrice = parseFloat(price);
        if (isNaN(numPrice)) return price;
        return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', minimumFractionDigits: 2 }).format(numPrice);
    }

    showSearchSection() {
        document.getElementById('searchSection').style.display = 'block';
        document.getElementById('searchSection').classList.add('fade-in');
    }

    showLoadingIndicator(show) {
        const loadingIndicator = document.getElementById('loadingIndicator');
        const uploadInfo = document.querySelector('.upload-info');
        if (show) {
            loadingIndicator.classList.remove('hidden');
            uploadInfo.style.display = 'none';
        } else {
            loadingIndicator.classList.add('hidden');
            uploadInfo.style.display = 'block';
        }
    }

    showFileStatus(message, type) {
        const fileStatus = document.getElementById('fileStatus');
        fileStatus.textContent = message;
        fileStatus.className = `file-status ${type}`;
        fileStatus.style.display = 'block';
    }

    hideUploadCard() {
        const uploadCard = document.getElementById('uploadCard');
        if (uploadCard) uploadCard.style.display = 'none';
    }

    showError(message) {
        const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
        document.getElementById('errorMessage').textContent = message;
        errorModal.show();
        this.showLoadingIndicator(false);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PriceListSearchApp();
});


