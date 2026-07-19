/**
 * 城市更新政策智能检索系统 - 前端逻辑
 * 本地检索 + RAG 问答
 */

// ========== 全局状态 ==========
let records = [];      // 所有记录
let allData = null;    // 完整数据（按需加载）
let currentResults = [];
let activeRecord = null;
let apiConfig = { key: '', model: 'moonshot-v1-8k' };

// ========== 加载数据 ==========
async function loadData() {
    const loadingBar = document.querySelector('.loading-bar');
    const loadingText = document.querySelector('.loading-text');
    
    try {
        loadingBar.style.width = '30%';
        
        // 加载轻量索引
        const response = await fetch('index.json');
        if (!response.ok) throw new Error('加载索引失败');
        
        loadingBar.style.width = '60%';
        loadingText.textContent = '正在解析数据...';
        
        records = await response.json();
        
        loadingBar.style.width = '100%';
        loadingText.textContent = '加载完成！';
        
        // 更新统计
        updateStats();
        
        // 显示主界面
        setTimeout(() => {
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('app').style.display = 'block';
        }, 500);
        
    } catch (e) {
        loadingText.textContent = '加载失败: ' + e.message;
        loadingBar.style.background = '#ff4757';
        console.error('数据加载失败:', e);
    }
}

function updateStats() {
    const total = records.length;
    const standards = records.filter(r => r.source === 'standard').length;
    const policies = records.filter(r => r.source === 'policy').length;
    document.getElementById('stat-total').innerHTML = 
        `共 ${total} 条 · 标准 ${standards} · 政策 ${policies}`;
}

// ========== 本地检索 ==========
function search(query, category = 'all', topK = 30) {
    if (!query.trim()) return [];
    
    const terms = query.split(/\s+/).filter(t => t.length >= 2);
    if (terms.length === 0) return [];
    
    const results = [];
    
    for (const r of records) {
        // 分类过滤
        if (category !== 'all' && r.category !== category) continue;
        
        let score = 0;
        let matched = false;
        
        for (const term of terms) {
            const t = term.toLowerCase();
            // 不同字段权重
            if (r.code.toLowerCase().includes(t)) score += 15;
            if (r.name.toLowerCase().includes(t)) score += 12;
            if (r.title.toLowerCase().includes(t)) score += 10;
            if (r.keywords.some(k => k.toLowerCase().includes(t))) score += 6;
            if (r.abstract.toLowerCase().includes(t)) score += 4;
            if (r.clause.toLowerCase().includes(t)) score += 8;
            
            // 检查是否匹配
            if (r.code.toLowerCase().includes(t) ||
                r.name.toLowerCase().includes(t) ||
                r.title.toLowerCase().includes(t) ||
                r.keywords.some(k => k.toLowerCase().includes(t)) ||
                r.abstract.toLowerCase().includes(t)) {
                matched = true;
            }
        }
        
        if (matched && score > 0) {
            results.push({ record: r, score });
        }
    }
    
    // 按分数排序
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
}

// ========== 渲染结果 ==========
function renderResults(results) {
    const list = document.getElementById('results-list');
    const count = document.getElementById('result-count');
    
    count.textContent = results.length;
    
    if (results.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">😕</div>
                <div>未找到匹配结果</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:8px">试试其他关键词？</div>
            </div>
        `;
        return;
    }
    
    list.innerHTML = results.map((r, i) => {
        const rec = r.record;
        const catClass = getCategoryClass(rec.category);
        const typeClass = getTypeClass(rec.category);
        const typeName = getShortTypeName(rec.category);
        
        return `
            <div class="result-card ${catClass}" data-id="${rec.id}" style="animation-delay:${i * 0.03}s" onclick="showDetail(${rec.id})">
                <div class="result-header">
                    <span class="result-type ${typeClass}">${typeName}</span>
                    <span class="result-score">${r.score.toFixed(0)}</span>
                </div>
                <div class="result-title">${highlightText(rec.title, currentQuery)}</div>
                <div class="result-meta">
                    <span>${rec.code}</span>
                    <span>第${rec.clause}条</span>
                </div>
                <div class="result-abstract">${highlightText(rec.abstract, currentQuery)}</div>
            </div>
        `;
    }).join('');
}

let currentQuery = '';

function highlightText(text, query) {
    if (!query || !text) return text;
    const terms = query.split(/\s+/).filter(t => t.length >= 2);
    let result = text;
    for (const term of terms) {
        const re = new RegExp(`(${escapeRegExp(term)})`, 'gi');
        result = result.replace(re, '<span class="highlight">$1</span>');
    }
    return result;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getCategoryClass(cat) {
    const map = {
        '国家层面政策': 'cat-national',
        '天津市市级法规/纲领性政策': 'cat-policy',
        '天津市市直部门配套政策': 'cat-policy2',
        '天津市地方标准': 'cat-standard'
    };
    return map[cat] || 'cat-default';
}

function getTypeClass(cat) {
    const map = {
        '国家层面政策': 'type-national',
        '天津市市级法规/纲领性政策': 'type-policy',
        '天津市市直部门配套政策': 'type-policy2',
        '天津市地方标准': 'type-standard'
    };
    return map[cat] || 'type-default';
}

function getShortTypeName(cat) {
    const map = {
        '国家层面政策': '国家',
        '天津市市级法规/纲领性政策': '法规',
        '天津市市直部门配套政策': '部委',
        '天津市地方标准': '标准'
    };
    return map[cat] || '其他';
}

// ========== 详情展示 ==========
function showDetail(id) {
    const rec = records.find(r => r.id === id);
    if (!rec) return;
    
    activeRecord = rec;
    
    // 更新卡片激活状态
    document.querySelectorAll('.result-card').forEach(c => c.classList.remove('active'));
    document.querySelector(`.result-card[data-id="${id}"]`)?.classList.add('active');
    
    // 加载完整内容（如果已加载 data.json）
    let content = rec.abstract;
    if (allData) {
        const full = allData.find(r => r.id === id);
        if (full) content = full.content;
    }
    
    const detailEl = document.getElementById('detail-content');
    detailEl.innerHTML = `
        <div class="detail-header">
            <div class="detail-std-code">${rec.code}</div>
            <div class="detail-std-name">${rec.name}</div>
            <div class="detail-clause">第 ${rec.clause} 条</div>
        </div>
        <div class="detail-text">${highlightText(content, currentQuery)}</div>
    `;
    
    // 添加操作按钮
    const actions = document.createElement('div');
    actions.className = 'detail-actions';
    actions.innerHTML = `
        <button class="btn-primary" onclick="copyClause()">📋 复制条文</button>
        <button class="btn-secondary" onclick="viewFulltext()">📄 查看原文</button>
    `;
    
    // 移除旧的操作栏
    const oldActions = detailEl.querySelector('.detail-actions');
    if (oldActions) oldActions.remove();
    
    detailEl.appendChild(actions);
}

function copyClause() {
    if (!activeRecord) return;
    const text = `${activeRecord.code}《${activeRecord.name}》第${activeRecord.clause}条：\n${activeRecord.abstract}`;
    navigator.clipboard.writeText(text).then(() => {
        alert('已复制到剪贴板');
    }).catch(() => {
        alert('复制失败，请手动复制');
    });
}

function viewFulltext() {
    if (!activeRecord) return;
    const filename = activeRecord.name + '.txt';
    const url = 'viewer.html?file=' + encodeURIComponent(filename);
    window.open(url, '_blank');
}

// ========== 分类筛选 ==========
let activeCategory = 'all';

function initCategoryFilter() {
    document.querySelectorAll('.cat-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.cat-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeCategory = btn.dataset.cat;
            performSearch();
        });
    });
}

// ========== 搜索 ==========
function performSearch() {
    const query = document.getElementById('search-input').value.trim();
    currentQuery = query;
    
    if (!query) {
        document.getElementById('results-list').innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <div>输入关键词开始检索</div>
            </div>
        `;
        document.getElementById('result-count').textContent = '0';
        return;
    }
    
    const results = search(query, activeCategory);
    renderResults(results);
}

// ========== RAG 问答 ==========
function openRag() {
    document.getElementById('rag-modal').classList.add('show');
    document.getElementById('rag-input').focus();
    
    // 检查 API Key
    if (!apiConfig.key) {
        document.getElementById('rag-api-notice').style.display = 'block';
    } else {
        document.getElementById('rag-api-notice').style.display = 'none';
    }
}

function closeRag() {
    document.getElementById('rag-modal').classList.remove('show');
}

function closeConfig() {
    document.getElementById('config-modal').classList.remove('show');
}

function showConfig() {
    document.getElementById('rag-modal').classList.remove('show');
    document.getElementById('config-modal').classList.add('show');
    document.getElementById('api-key-input').value = apiConfig.key || '';
    document.getElementById('model-select').value = apiConfig.model;
}

function saveConfig() {
    apiConfig.key = document.getElementById('api-key-input').value.trim();
    apiConfig.model = document.getElementById('model-select').value;
    localStorage.setItem('standardsRagConfig', JSON.stringify(apiConfig));
    closeConfig();
    alert('配置已保存');
}

function loadConfig() {
    const saved = localStorage.getItem('standardsRagConfig');
    if (saved) {
        try {
            apiConfig = JSON.parse(saved);
        } catch (e) {
            console.error('配置加载失败:', e);
        }
    }
}

async function sendRag() {
    const input = document.getElementById('rag-input');
    const question = input.value.trim();
    if (!question) return;
    
    if (!apiConfig.key) {
        document.getElementById('rag-api-notice').style.display = 'block';
        return;
    }
    
    // 添加用户消息
    addRagMessage('user', question);
    input.value = '';
    
    // 本地检索相关条文
    const relevant = search(question, 'all', 8);
    
    // 构建上下文
    const context = relevant.map(r => {
        const rec = r.record;
        return `[${rec.code}]《${rec.name}》第${rec.clause}条：${rec.abstract}`;
    }).join('\n\n');
    
    // 添加思考中消息
    const thinkingId = addRagMessage('assistant', '正在思考...', true);
    
    try {
        const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiConfig.key
            },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [
                    {
                        role: 'system',
                        content: '你是城市更新政策专家。请基于提供的政策条文回答用户问题。严格依据条文内容，不要编造。如果条文不足以回答，请明确说明。回答要简洁准确，引用具体条文编号。'
                    },
                    {
                        role: 'user',
                        content: `问题：${question}\n\n相关条文：\n${context}\n\n请基于以上条文回答，并引用具体来源。如果条文不足，请明确说明。`
                    }
                ],
                temperature: 0.3
            })
        });
        
        if (!response.ok) {
            throw new Error('API 请求失败: ' + response.status);
        }
        
        const data = await response.json();
        const answer = data.choices?.[0]?.message?.content || '抱歉，未能获取回答。';
        
        // 移除思考中消息，添加实际回答
        removeRagMessage(thinkingId);
        addRagMessage('assistant', answer, false, relevant);
        
    } catch (e) {
        removeRagMessage(thinkingId);
        addRagMessage('assistant', '❌ 请求失败: ' + e.message + '\n\n请检查 API Key 是否正确，或网络连接是否正常。');
    }
}

function addRagMessage(role, content, isThinking = false, sources = null) {
    const container = document.getElementById('rag-messages');
    const msg = document.createElement('div');
    msg.className = 'rag-message ' + role;
    if (isThinking) msg.id = 'rag-thinking';
    
    let html = content;
    if (sources && sources.length > 0) {
        html += '<div class="rag-sources">📎 参考来源: ';
        sources.forEach((s, i) => {
            if (i > 0) html += ' | ';
            html += `<a href="#" onclick="showDetail(${s.record.id}); closeRag(); return false;">${s.record.code}</a>`;
        });
        html += '</div>';
    }
    
    msg.innerHTML = html;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg.id;
}

function removeRagMessage(id) {
    if (!id) return;
    const msg = document.getElementById(id);
    if (msg) msg.remove();
}

// ========== 事件绑定 ==========
function initEvents() {
    // 搜索
    document.getElementById('search-btn').addEventListener('click', performSearch);
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    // RAG
    document.getElementById('rag-btn').addEventListener('click', openRag);
    document.getElementById('rag-send').addEventListener('click', sendRag);
    document.getElementById('rag-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendRag();
    });
    
    // 配置
    document.getElementById('btn-config').addEventListener('click', showConfig);
    
    // 点击弹窗外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('show');
        });
    });
}

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    loadData();
    initCategoryFilter();
    initEvents();
});
