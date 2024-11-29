class CryptoAnalyzer {
    constructor() {
        this.apiKey = 'nc3cvP0d3LZzL9AIIgQQsjU6MKN8g5oanFkiAo4BdykbaOlce3HsTbWB3mPCoL8z';
        this.baseUrl = 'https://api.binance.com';
        this.isScanning = false;
        this.soundEnabled = false;
        this.timeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
        this.results = new Map();
        this.sortColumn = 'timestamp';
        this.sortDirection = 'desc';

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        document.getElementById('toggleScan').addEventListener('click', () => this.toggleScan());
        document.getElementById('soundToggle').addEventListener('change', (e) => this.soundEnabled = e.target.checked);

        // Add sort listeners to table headers
        document.querySelectorAll('th[data-sort]').forEach(header => {
            header.addEventListener('click', () => this.sortTable(header.dataset.sort));
        });
    }

    async getSpotSymbols() {
        try {
            const response = await fetch(`${this.baseUrl}/api/v3/exchangeInfo`);
            const data = await response.json();
            return data.symbols
                .filter(symbol => symbol.quoteAsset === 'USDT' && symbol.status === 'TRADING')
                .map(symbol => symbol.symbol);
        } catch (error) {
            console.error('Error fetching symbols:', error);
            return [];
        }
    }

    async getKlines(symbol, interval, limit = 10) {
        try {
            const response = await fetch(
                `${this.baseUrl}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
            );
            return await response.json();
        } catch (error) {
            console.error(`Error fetching klines for ${symbol}:`, error);
            return [];
        }
    }

    isDoji(kline) {
        const [, open, high, low, close] = kline.map(Number);
        const bodySize = Math.abs(close - open);
        const totalSize = high - low;
        return bodySize / totalSize < 0.1;
    }

    async analyzeSymbol(symbol, interval) {
        const klines = await this.getKlines(symbol, interval);
        if (klines.length < 6) return null;

        // Check for 4 consecutive red candles
        let consecutiveRed = 0;
        for (let i = klines.length - 6; i < klines.length - 2; i++) {
            if (Number(klines[i][4]) < Number(klines[i][1])) {
                consecutiveRed++;
            } else {
                consecutiveRed = 0;
            }
        }

        if (consecutiveRed >= 4) {
            // Check for Doji
            const dojiIndex = klines.length - 2;
            if (this.isDoji(klines[dojiIndex])) {
                // Check for green candle breaking Doji's high
                const lastCandle = klines[klines.length - 1];
                const dojiHigh = Number(klines[dojiIndex][2]);
                if (Number(lastCandle[4]) > Number(lastCandle[1]) && Number(lastCandle[2]) > dojiHigh) {
                    return {
                        symbol,
                        timeframe: interval,
                        price: Number(lastCandle[4]),
                        volume: Number(lastCandle[5]),
                        trend: 'صاعد 📈',
                        targets: this.calculateTargets(Number(lastCandle[4])),
                        stopLoss: this.calculateStopLoss(Number(lastCandle[4]), Number(klines[dojiIndex][3])),
                        timestamp: new Date().toLocaleString('en-US', { hour12: false })
                    };
                }
            }
        }
        return null;
    }

    calculateTargets(currentPrice) {
        const targets = [
            currentPrice * 1.03,
            currentPrice * 1.05,
            currentPrice * 1.08
        ];
        return targets.map(t => t.toFixed(8)).join(' | ');
    }

    calculateStopLoss(currentPrice, dojiLow) {
        return (dojiLow * 0.99).toFixed(8);
    }

    async startScanning() {
        const symbols = await this.getSpotSymbols();
        while (this.isScanning) {
            for (const symbol of symbols) {
                for (const timeframe of this.timeframes) {
                    const result = await this.analyzeSymbol(symbol, timeframe);
                    if (result) {
                        const key = `${symbol}-${timeframe}`;
                        if (!this.results.has(key)) {
                            this.results.set(key, result);
                            this.updateTable();
                            if (this.soundEnabled) {
                                document.getElementById('notificationSound').play();
                            }
                        }
                    }
                }
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    toggleScan() {
        this.isScanning = !this.isScanning;
        const button = document.getElementById('toggleScan');
        if (this.isScanning) {
            button.textContent = '⏹️ إيقاف البحث';
            button.style.backgroundColor = '#f44336';
            this.startScanning();
        } else {
            button.textContent = '▶️ بدء البحث';
            button.style.backgroundColor = '';
        }
    }

    sortTable(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }
        this.updateTable();
    }

    updateTable() {
        const tbody = document.querySelector('#resultsTable tbody');
        const sortedResults = Array.from(this.results.values()).sort((a, b) => {
            let comparison = 0;
            if (this.sortColumn === 'price' || this.sortColumn === 'volume') {
                comparison = a[this.sortColumn] - b[this.sortColumn];
            } else {
                comparison = String(a[this.sortColumn]).localeCompare(String(b[this.sortColumn]));
            }
            return this.sortDirection === 'asc' ? comparison : -comparison;
        });

        tbody.innerHTML = sortedResults.map(result => `
            <tr>
                <td>${result.symbol}</td>
                <td>${result.price}</td>
                <td>${result.timeframe}</td>
                <td>${result.volume.toFixed(2)}</td>
                <td class="up-trend">${result.trend}</td>
                <td>${result.targets}</td>
                <td>${result.stopLoss}</td>
                <td>${result.timestamp}</td>
            </tr>
        `).join('');
    }
}

// Initialize the analyzer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CryptoAnalyzer();
});