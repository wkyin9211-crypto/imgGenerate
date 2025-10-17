/**
 * Webhook 配置
 * 在这里填入各功能对应的完整 webhook URL
 * 例如：音频转录使用 n8n 测试 webhook，触发方式为点击工作流后仅一次有效 [0]
 */
const WEBHOOK_MAP = {
    // 图片生成：请替换为你的实际 webhook URL
    '/api/generate-image': 'REPLACE_WITH_IMAGE_GENERATE_WEBHOOK_URL',
    // 图片修复：请替换为你的实际 webhook URL
    '/api/fix-image': 'REPLACE_WITH_IMAGE_FIX_WEBHOOK_URL',
    // 音频合成：请替换为你的实际 webhook URL
    '/api/synthesize-audio': 'REPLACE_WITH_AUDIO_SYNTHESIS_WEBHOOK_URL',
    // 音频转录：使用你提供的测试地址
    '/api/transcribe-audio': 'https://x6x8.cloudns.be/webhook/0c0c9b05-d9b7-446f-8a5e-71964c57cc7c',
    // 语音列表（如需从后端获取）：可替换为实际 webhook URL
    '/api/voices': 'REPLACE_WITH_VOICE_LIST_WEBHOOK_URL'
};

/**
 * AI图像和音频生成器主类
 * 负责管理整个应用的功能和交互
 */
class AIGenerator {
    constructor() {
        this.currentTab = 'image';
        this.uploadedImages = [];
        this.uploadedAudios = [];
        this.transcriptionAudios = [];
        this.voiceList = [];
        this.isLoading = false;
        
        this.init();
    }

    /**
     * 初始化应用
     */
    init() {
        this.initTheme();
        this.bindEvents();
        this.switchTab('image');
        this.loadVoiceList();
    }

    /**
     * 初始化主题
     */
    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.textContent = savedTheme === 'light' ? '🌙' : '☀️';
        }
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        // 主题切换
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // 选项卡切换
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tab = e.target.closest('.tab-btn').dataset.tab;
                this.switchTab(tab);
            });
        });

        // 图像上传
        const imageUpload = document.getElementById('imageFileInput');
        const imageUploadArea = document.getElementById('imageUploadArea');
        
        if (imageUpload && imageUploadArea) {
            imageUpload.addEventListener('change', (e) => this.handleImageUpload(e));
            
            // 点击上传区域触发文件选择
            imageUploadArea.addEventListener('click', () => {
                imageUpload.click();
            });
            
            // 拖拽上传
            imageUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                imageUploadArea.classList.add('drag-over');
            });
            
            imageUploadArea.addEventListener('dragleave', () => {
                imageUploadArea.classList.remove('drag-over');
            });
            
            imageUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                imageUploadArea.classList.remove('drag-over');
                this.handleImageUpload(e);
            });
        }

        // 音频上传
        const audioUpload = document.getElementById('audioFileInput');
        const audioUploadArea = document.getElementById('audioUploadArea');
        
        if (audioUpload && audioUploadArea) {
            audioUpload.addEventListener('change', (e) => this.handleAudioUpload(e));
            
            // 点击上传区域触发文件选择
            audioUploadArea.addEventListener('click', () => {
                audioUpload.click();
            });
        }

        // 转录音频上传
        const transcriptionUpload = document.getElementById('transcriptionFileInput');
        const transcriptionUploadArea = document.getElementById('transcriptionUploadArea');
        
        if (transcriptionUpload && transcriptionUploadArea) {
            transcriptionUpload.addEventListener('change', (e) => this.handleTranscriptionUpload(e));
            
            // 点击上传区域触发文件选择
            transcriptionUploadArea.addEventListener('click', () => {
                transcriptionUpload.click();
            });
        }

        // 按钮事件
        const generateBtn = document.getElementById('generateImageBtn');
        const fixBtn = document.getElementById('repairImageBtn');
        const synthesizeBtn = document.getElementById('synthesizeAudioBtn');
        const transcribeBtn = document.getElementById('transcribeAudioBtn');

        if (generateBtn) generateBtn.addEventListener('click', () => this.generateImage());
        if (fixBtn) fixBtn.addEventListener('click', () => this.fixImage());
        if (synthesizeBtn) synthesizeBtn.addEventListener('click', () => this.synthesizeAudio());
        if (transcribeBtn) transcribeBtn.addEventListener('click', () => this.transcribeAudio());

        // 语速控制
        const speechRate = document.getElementById('speechRate');
        const rateValue = document.getElementById('rateValue');
        if (speechRate && rateValue) {
            speechRate.addEventListener('input', (e) => {
                rateValue.textContent = e.target.value + 'x';
            });
        }
    }

    /**
     * 切换主题
     */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
            }
        }
    }

    /**
     * 切换选项卡
     * @param {string} tab - 选项卡名称
     */
    switchTab(tab) {
        this.currentTab = tab;
        
        // 更新选项卡按钮状态
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
        
        // 显示对应的内容
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tab}-tab`).classList.add('active');
    }

    /**
     * 处理图像上传
     * @param {Event} event - 上传事件
     */
    handleImageUpload(event) {
        const files = event.target.files || event.dataTransfer.files;
        
        Array.from(files).forEach(file => {
            if (this.validateFile(file, 'image')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageData = {
                        id: 'img-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                        file: file,
                        url: e.target.result,
                        name: file.name,
                        size: file.size
                    };
                    
                    this.uploadedImages.push(imageData);
                    this.renderUploadedImages();
                };
                reader.readAsDataURL(file);
            }
        });
    }

    /**
     * 处理音频上传
     * @param {Event} event - 上传事件
     */
    handleAudioUpload(event) {
        const files = event.target.files;
        
        Array.from(files).forEach(file => {
            if (this.validateFile(file, 'audio')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const audioData = {
                        id: 'audio-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                        file: file,
                        url: e.target.result,
                        name: file.name,
                        size: file.size
                    };
                    
                    this.uploadedAudios.push(audioData);
                    this.renderUploadedAudios();
                };
                reader.readAsDataURL(file);
            }
        });
    }

    /**
     * 处理转录音频上传
     * @param {Event} event - 文件上传事件
     */
    handleTranscriptionUpload(event) {
        const files = Array.from(event.target.files);
        
        files.forEach(file => {
            if (this.validateFile(file, 'audio')) {
                const audioId = Date.now() + Math.random();
                this.transcriptionAudios.push({
                    id: audioId,
                    file: file,
                    name: file.name,
                    size: file.size,
                    url: URL.createObjectURL(file)
                });
            }
        });
        
        this.renderTranscriptionAudios();
    }

    /**
     * 加载音色列表
     */
    async loadVoiceList() {
        try {
            const response = await this.makeWebhookRequest('/api/voices');
            if (response.success) {
                this.voiceList = response.data;
                this.renderVoiceList();
            }
        } catch (error) {
            console.error('加载音色列表失败:', error);
        }
    }

    /**
     * 渲染音色列表
     */
    renderVoiceList() {
        const voiceListContainer = document.querySelector('.voice-list');
        if (!voiceListContainer) return;

        voiceListContainer.innerHTML = this.voiceList.map(voice => `
            <div class="voice-item" data-voice-id="${voice.id}">
                <div class="voice-info">
                    <span class="voice-name">${voice.name}</span>
                    <span class="voice-type">${voice.type}</span>
                </div>
                <div class="voice-controls">
                    <button class="preview-btn" onclick="aiGenerator.previewVoice('${voice.id}')">
                        试听
                    </button>
                    <input type="radio" name="selected-voice" value="${voice.id}">
                </div>
            </div>
        `).join('');
    }

    /**
     * 试听音色
     * @param {string} voiceId - 音色ID
     */
    async previewVoice(voiceId) {
        const voice = this.voiceList.find(v => v.id === voiceId);
        if (!voice || !voice.previewUrl) return;

        const audio = new Audio(voice.previewUrl);
        audio.play().catch(error => {
            console.error('音频播放失败:', error);
        });
    }

    /**
     * 验证文件
     * @param {File} file - 文件对象
     * @param {string} type - 文件类型 ('image' 或 'audio')
     * @returns {boolean} 验证结果
     */
    validateFile(file, type) {
        const maxSize = type === 'image' ? 10 * 1024 * 1024 : 50 * 1024 * 1024; // 图片10MB，音频50MB
        const allowedTypes = type === 'image' 
            ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
            : [
                'audio/mpeg',
                'audio/mp3',
                'audio/wav',
                'audio/ogg',
                'audio/flac',
                'audio/x-flac',
                'audio/aac',
                'audio/mp4',
                'audio/m4a',
                'audio/x-m4a'
            ];

        if (file.size > maxSize) {
            alert(`文件大小不能超过 ${formatFileSize(maxSize)}`);
            return false;
        }

        if (!allowedTypes.includes(file.type)) {
            alert(`不支持的文件类型: ${file.type}`);
            return false;
        }

        return true;
    }

    /**
     * 渲染已上传的图片
     */
    renderUploadedImages() {
        const container = document.querySelector('.uploaded-images');
        if (!container) return;

        const maxItems = 6;
        const imagesToShow = this.uploadedImages.slice(0, maxItems);

        container.innerHTML = imagesToShow.map(img => `
            <div class="uploaded-image" data-id="${img.id}" onclick="aiGenerator.openImageLightbox('${img.url}')">
                <img src="${img.url}" alt="${img.name}">
                <button class="remove-btn" onclick="event.stopPropagation(); aiGenerator.removeImage('${img.id}')">×</button>
            </div>
        `).join('');
    }

    /**
     * 渲染已上传的音频
     */
    renderUploadedAudios() {
        const container = document.getElementById('audioUploadedAudios');
        if (!container) return;

        container.innerHTML = this.uploadedAudios.map(audio => `
            <div class="uploaded-item" data-id="${audio.id}">
                <audio controls src="${audio.url}"></audio>
                <div class="item-info">
                    <span class="item-name">${audio.name}</span>
                    <span class="item-size">${formatFileSize(audio.size)}</span>
                </div>
                <button class="remove-btn" onclick="aiGenerator.removeAudio('${audio.id}')">×</button>
            </div>
        `).join('');
    }

    /**
     * 渲染转录音频列表
     */
    renderTranscriptionAudios() {
        const container = document.getElementById('transcriptionUploadedAudios');
        if (!container) return;

        container.innerHTML = this.transcriptionAudios.map(audio => `
            <div class="uploaded-item" data-id="${audio.id}">
                <audio controls src="${audio.url}"></audio>
                <div class="item-info">
                    <span class="item-name">${audio.name}</span>
                    <span class="item-size">${formatFileSize(audio.size)}</span>
                </div>
                <button class="remove-btn" onclick="aiGenerator.removeTranscriptionAudio('${audio.id}')">×</button>
            </div>
        `).join('');
    }

    /**
     * 移除图片
     * @param {string} imageId - 图片ID
     */
    removeImage(imageId) {
        this.uploadedImages = this.uploadedImages.filter(img => img.id !== imageId);
        this.renderUploadedImages();
    }

    /**
     * 打开图片灯箱
     */
    openImageLightbox(url) {
        let overlay = document.getElementById('image-lightbox');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'image-lightbox';
            overlay.className = 'lightbox-overlay';
            overlay.innerHTML = `
                <div class="lightbox-content">
                    <button class="lightbox-close" onclick="aiGenerator.closeImageLightbox()">×</button>
                    <img class="lightbox-image" src="${url}" alt="preview">
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            const img = overlay.querySelector('.lightbox-image');
            if (img) img.src = url;
        }

        overlay.addEventListener('click', (e) => {
            if (e.target.id === 'image-lightbox') {
                this.closeImageLightbox();
            }
        });
        overlay.classList.add('show');
    }

    /**
     * 关闭图片灯箱
     */
    closeImageLightbox() {
        const overlay = document.getElementById('image-lightbox');
        if (overlay) overlay.classList.remove('show');
    }

    /**
     * 移除音频
     * @param {string} audioId - 音频ID
     */
    removeAudio(audioId) {
        this.uploadedAudios = this.uploadedAudios.filter(audio => audio.id !== audioId);
        this.renderUploadedAudios();
    }

    /**
     * 移除转录音频
     * @param {string} audioId - 音频ID
     */
    removeTranscriptionAudio(audioId) {
        this.transcriptionAudios = this.transcriptionAudios.filter(audio => audio.id !== audioId);
        this.renderTranscriptionAudios();
    }

    /**
     * 生成图像
     */
    async generateImage() {
        const prompt = document.getElementById('image-prompt').value.trim();
        if (!prompt) {
            alert('请输入图像描述');
            return;
        }

        this.setLoading(true);
        
        try {
            const response = await this.makeWebhookRequest('/api/generate-image', {
                prompt: prompt,
                images: this.uploadedImages.map(img => ({
                    id: img.id,
                    name: img.name
                }))
            });

            if (response.success) {
                this.displayResult(response.data, 'image');
            } else {
                throw new Error(response.error || '生成失败');
            }
        } catch (error) {
            console.error('图像生成失败:', error);
            alert('图像生成失败: ' + error.message);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 转录音频
     */
    async transcribeAudio() {
        if (this.transcriptionAudios.length === 0) {
            alert('请先上传音频文件');
            return;
        }

        // 读取选项（与 index.html 中的ID保持一致，并提供容错默认值）
        const tsEl = document.getElementById('enableTimestamps');
        const sdEl = document.getElementById('enableSpeakerDiarization');
        const langEl = document.getElementById('transcriptionLanguage');

        const includeTimestamps = tsEl ? tsEl.checked : true; // 默认开启时间戳
        const speakerDiarization = sdEl ? sdEl.checked : false; // 默认关闭说话人分离
        const language = langEl ? langEl.value : 'auto'; // 默认自动检测

        this.setLoading(true);
        
        try {
            const form = new FormData();
            this.transcriptionAudios.forEach(audio => {
                if (audio.file) {
                    form.append('files[]', audio.file, audio.name);
                }
            });
            form.append('includeTimestamps', includeTimestamps ? 'true' : 'false');
            form.append('speakerDiarization', speakerDiarization ? 'true' : 'false');
            form.append('language', language);

            const response = await this.makeWebhookRequest('/api/transcribe-audio', form);

            if (response.success) {
                this.displayTranscriptionResult(response.data);
            } else {
                throw new Error(response.error || '转录失败');
            }
        } catch (error) {
            console.error('音频转录失败:', error);
            alert('转录失败: ' + error.message);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 修复图像
     */
    async fixImage() {
        if (this.uploadedImages.length === 0) {
            alert('请先上传图像');
            return;
        }

        const prompt = document.getElementById('image-prompt').value.trim();
        
        this.setLoading(true);
        
        try {
            const response = await this.makeWebhookRequest('/api/fix-image', {
                prompt: prompt,
                images: this.uploadedImages.map(img => ({
                    id: img.id,
                    name: img.name
                }))
            });

            if (response.success) {
                this.displayResult(response.data, 'image');
            } else {
                throw new Error(response.error || '修复失败');
            }
        } catch (error) {
            console.error('图像修复失败:', error);
            alert('图像修复失败: ' + error.message);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 合成音频
     */
    async synthesizeAudio() {
        const text = document.getElementById('audio-text').value.trim();
        const selectedVoice = document.querySelector('input[name="selected-voice"]:checked');
        
        if (!text) {
            alert('请输入要合成的文本');
            return;
        }
        
        if (!selectedVoice) {
            alert('请选择音色');
            return;
        }

        this.setLoading(true);
        
        try {
            const form = new FormData();
            form.append('text', text);
            form.append('voiceId', selectedVoice.value);
            this.uploadedAudios.forEach(audio => {
                if (audio.file) {
                    form.append('files[]', audio.file, audio.name);
                }
            });
            const response = await this.makeWebhookRequest('/api/synthesize-audio', form);

            if (response.success) {
                this.displayResult(response.data, 'audio');
            } else {
                throw new Error(response.error || '合成失败');
            }
        } catch (error) {
            console.error('音频合成失败:', error);
            alert('音频合成失败: ' + error.message);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 显示结果
     * @param {Object} data - 结果数据
     * @param {string} type - 结果类型 ('image' 或 'audio')
     */
    displayResult(data, type) {
        const resultContainer = document.querySelector('.result-display');
        if (!resultContainer) return;

        if (type === 'image') {
            resultContainer.innerHTML = `
                <div class="result-item">
                    <img src="${data.url}" alt="Generated Image">
                    <div class="result-actions">
                        <button onclick="aiGenerator.downloadResult('${data.url}', 'generated-image.png')">
                            下载图片
                        </button>
                    </div>
                </div>
            `;
        } else if (type === 'audio') {
            resultContainer.innerHTML = `
                <div class="result-item">
                    <audio controls>
                        <source src="${data.url}" type="audio/wav">
                    </audio>
                    <div class="result-info">
                        <span>时长: ${data.duration || '未知'}</span>
                    </div>
                    <div class="result-actions">
                        <button onclick="aiGenerator.downloadResult('${data.url}', 'synthesized-audio.wav')">
                            下载音频
                        </button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * 显示转录结果
     * @param {Object} data - 转录结果数据
     */
    displayTranscriptionResult(data) {
        const resultContainer = document.querySelector('#transcription-tab .result-area');
        if (!resultContainer) return;

        const formatDuration = (seconds) => {
            const s = Math.max(0, Math.floor(seconds || 0));
            const m = Math.floor(s / 60);
            const sec = s % 60;
            return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
        };

        const formatStamp = (t) => {
            if (typeof t !== 'number' || isNaN(t)) return '';
            const s = Math.max(0, Math.floor(t));
            const m = Math.floor(s / 60);
            const sec = s % 60;
            return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
        };

        const guessLanguage = (txt) => {
            if (!txt) return '未知';
            if (/[\u4e00-\u9fff]/.test(txt)) return 'zh';
            if (/[\u3040-\u30ff]/.test(txt)) return 'ja';
            if (/[\uac00-\ud7af]/.test(txt)) return 'ko';
            return '未知';
        };

        const deepUnwrap = (raw) => {
            const flattenArray = (arr) => {
                if (!Array.isArray(arr)) return arr;
                if (arr.length === 0) return arr;
                if (arr.every(e => e && typeof e === 'object' && ('json' in e || 'data' in e))) {
                    return arr.map(e => (e.json ?? e.data));
                }
                return arr;
            };

            let obj = raw;
            obj = flattenArray(obj);

            let guard = 0;
            while (obj && guard < 6) {
                guard++;
                if (Array.isArray(obj)) {
                    obj = flattenArray(obj);
                    break;
                } else if (typeof obj === 'object') {
                    if ('json' in obj) { obj = obj.json; continue; }
                    if ('data' in obj) { obj = obj.data; continue; }
                    if ('body' in obj) { obj = obj.body; continue; }
                    if ('items' in obj && Array.isArray(obj.items)) { obj = obj.items; continue; }
                    if ('result' in obj && obj.result != null) { obj = obj.result; continue; }
                    if ('results' in obj && obj.results != null && !Array.isArray(obj.results)) { obj = obj.results; continue; }
                    break;
                } else {
                    break;
                }
            }
            return obj;
        };

        const pickSegments = (r) => {
            if (Array.isArray(r)) {
                const looksLikeSegments = r.length > 0 && r.every(x => typeof x === 'object' && ((('text' in x) && ('start' in x || 'end' in x)) || ('word' in x)));
                if (looksLikeSegments) return r;
                const itemWithSegments = r.find(it => {
                    const inner = (it?.json ?? it?.data ?? it);
                    return Array.isArray(inner?.segments);
                });
                if (itemWithSegments) {
                    const inner = (itemWithSegments.json ?? itemWithSegments.data ?? itemWithSegments);
                    return inner.segments;
                }
                return null;
            }
            if (Array.isArray(r?.segments)) return r.segments;
            if (Array.isArray(r?.results)) return r.results;
            if (r && typeof r === 'object') {
                const key = Object.keys(r).find(k => Array.isArray(r[k]) && r[k].length > 0 && typeof r[k][0] === 'object' && (('text' in r[k][0]) || ('start' in r[k][0]) || ('word' in r[k][0])));
                if (key) return r[key];
            }
            return null;
        };

        const normalize = (raw) => {
            const r = deepUnwrap(raw);

            if (Array.isArray(r?.transcriptions)) return r.transcriptions;

            let language = r?.language || r?.lang || r?.detected_language || '未知';

            const makeSeg = (s) => {
                const start = s.start ?? s.begin ?? s.ts ?? s.startTime ?? undefined;
                const end = s.end ?? s.finish ?? s.endTime ?? undefined;
                return {
                    text: s.text ?? s.word ?? '',
                    start,
                    end,
                    timestamp: (start != null || end != null) ? `${formatStamp(start ?? 0)}${end != null ? '-' + formatStamp(end) : ''}` : undefined,
                    speaker: s.speaker ?? s.spk ?? s.speakerId ?? undefined
                };
            };

            const segsRaw = pickSegments(r);
            if (Array.isArray(segsRaw)) {
                const segs = segsRaw.map(makeSeg);
                const endMax = Math.max(...segsRaw.map(x => (x.end ?? x.finish ?? x.endTime ?? 0)));
                const duration = (typeof r?.duration === 'number')
                    ? formatDuration(r.duration)
                    : (typeof r?.duration === 'string')
                        ? r.duration
                        : (endMax ? formatDuration(endMax) : '未知');
                const textJoined = segs.map(s => s.text).join(' ');
                if (language === '未知') language = guessLanguage(textJoined);
                return [{ id: 'tr-' + Date.now(), language, duration, text: textJoined, segments: segs }];
            }

            const text = r?.text ?? '';
            const duration = (typeof r?.duration === 'number')
                ? formatDuration(r.duration)
                : (typeof r?.duration === 'string')
                    ? r.duration
                    : (r?.end ? formatDuration(r.end) : '未知');
            if (language === '未知') language = guessLanguage(text);
            return [{ id: 'tr-' + Date.now(), language, duration, text }];
        };

        const transcriptions = normalize(data);

        if (!transcriptions.length) {
            resultContainer.innerHTML = `<div class="transcription-result"><div class="transcription-text">未收到可显示的转录数据</div></div>`;
            return;
        }

        const transcriptionHtml = transcriptions.map(transcription => `
            <div class="transcription-result" data-transcription-id="${transcription.id}">
                <div class="transcription-meta">
                    <span>语言: ${transcription.language || '未知'}</span>
                    <span>时长: ${transcription.duration || '未知'}</span>
                </div>
                <div class="transcription-box">
                    <div class="box-header">句子时间戳</div>
                    <div class="transcription-segments">
                        ${Array.isArray(transcription.segments) ? transcription.segments.map(segment => `
                            <div class="transcription-segment">
                                ${segment.timestamp ? `<span class="timestamp">${segment.timestamp}</span>` : ''}
                                ${segment.speaker ? `<span class="speaker">${segment.speaker}:</span>` : ''}
                                <span class="text">${segment.text}</span>
                            </div>
                        `).join('') : `<div class="transcription-segment"><span class="text">${transcription.text || ''}</span></div>`}
                    </div>
                    <div class="box-actions">
                        <button class="btn" onclick="aiGenerator.copySegments('${transcription.id}')">复制</button>
                    </div>
                </div>
                <div class="transcription-box">
                    <div class="box-header">完整文本</div>
                    <div class="transcription-fulltext"><span class="text">${transcription.text || ''}</span></div>
                    <div class="box-actions">
                        <button class="btn" onclick="aiGenerator.copyFullText('${transcription.id}')">复制</button>
                    </div>
                </div>
            </div>
        `).join('');

        resultContainer.innerHTML = transcriptionHtml;
    }

    /**
     * 下载结果
     * @param {string} url - 文件URL
     * @param {string} filename - 文件名
     */
    downloadResult(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    /**
     * 复制转录文本
     * @param {string} transcriptionId - 转录ID
     */
    copyTranscription(transcriptionId) {
        const transcriptionElement = document.querySelector(`[data-transcription-id="${transcriptionId}"] .transcription-text`);
        if (!transcriptionElement) return;

        const text = transcriptionElement.textContent.trim();
        navigator.clipboard.writeText(text).then(() => {
            alert('文本已复制到剪贴板');
        }).catch(err => {
            console.error('复制失败:', err);
            alert('复制失败');
        });
    }

    /**
     * 下载转录文本
     * @param {string} transcriptionId - 转录ID
     * @param {string} filename - 原文件名
     */
    downloadTranscription(transcriptionId, filename) {
        const transcriptionElement = document.querySelector(`[data-transcription-id="${transcriptionId}"] .transcription-text`);
        if (!transcriptionElement) return;

        const text = transcriptionElement.textContent.trim();
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename.replace(/\.[^/.]+$/, '')}_transcription.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
    }

    // 为“句子时间戳”框添加复制
    copySegments(transcriptionId) {
        const container = document.querySelector(`[data-transcription-id="${transcriptionId}"] .transcription-segments`);
        if (!container) {
            alert('未找到句子时间戳内容');
            return;
        }
        const lines = Array.from(container.querySelectorAll('.transcription-segment')).map(seg => {
            const ts = seg.querySelector('.timestamp')?.textContent?.trim();
            const speaker = seg.querySelector('.speaker')?.textContent?.trim();
            const content = seg.querySelector('.text')?.textContent?.trim() || '';
            const parts = [];
            if (ts) parts.push(ts);
            if (speaker) parts.push(speaker);
            parts.push(content);
            return parts.join(' ');
        }).join('\n');

        const tryCopy = async (text, okMsg) => {
            try {
                await navigator.clipboard.writeText(text);
                alert(okMsg);
            } catch (err) {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                try {
                    document.execCommand('copy');
                    alert(okMsg);
                } catch (e) {
                    console.error('复制失败:', e);
                    alert('复制失败');
                }
                document.body.removeChild(ta);
            }
        };

        tryCopy(lines, '已复制句子时间戳内容');
    }

    // 为“完整文本”框添加复制
    copyFullText(transcriptionId) {
        const el = document.querySelector(`[data-transcription-id="${transcriptionId}"] .transcription-fulltext .text`);
        if (!el) {
            alert('未找到完整文本内容');
            return;
        }
        const text = el.textContent.trim();

        const tryCopy = async (t, okMsg) => {
            try {
                await navigator.clipboard.writeText(t);
                alert(okMsg);
            } catch (err) {
                const ta = document.createElement('textarea');
                ta.value = t;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                try {
                    document.execCommand('copy');
                    alert(okMsg);
                } catch (e) {
                    console.error('复制失败:', e);
                    alert('复制失败');
                }
                document.body.removeChild(ta);
            }
        };

        tryCopy(text, '已复制完整文本');
    }

    /**
     * 设置加载状态
     * @param {boolean} loading - 是否加载中
     */
    setLoading(loading) {
        this.isLoading = loading;
        
        const loadingOverlay = document.querySelector('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = loading ? 'flex' : 'none';
        }
        
        // 禁用/启用按钮
        const buttons = document.querySelectorAll('button:not(.theme-toggle):not(.tab-button)');
        buttons.forEach(btn => {
            btn.disabled = loading;
        });
    }

    /**
     * 发送Webhook请求（模拟）
     * @param {string} endpoint - API端点
     * @param {Object} data - 请求数据
     * @returns {Promise<Object>} 响应数据
     */
    async makeWebhookRequest(endpoint, data = {}) {
        // 如果配置了真实的Webhook URL，则进行真实请求
        const mappedUrl = WEBHOOK_MAP[endpoint];
        if (mappedUrl && mappedUrl.startsWith('http')) {
            try {
                const isForm = typeof FormData !== 'undefined' && data instanceof FormData;
                const fetchOptions = { method: 'POST' };

                if (isForm) {
                    // 发送 multipart/form-data，交由浏览器自动设置 boundary
                    fetchOptions.body = data;
                } else {
                    // 发送 JSON
                    fetchOptions.headers = { 'Content-Type': 'application/json' };
                    fetchOptions.body = JSON.stringify(data);
                }

                const res = await fetch(mappedUrl, fetchOptions);
                const json = await res.json().catch(() => ({}));
                if (!res.ok) {
                    return { success: false, error: `HTTP ${res.status}`, data: json };
                }
                return { success: true, data: json };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }

        // 未配置Webhook时，保持原来的本地模拟数据，便于前端开发联调
        await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 1200));

        if (endpoint === '/api/voices') {
            return {
                success: true,
                data: [
                    { id: 'voice1', name: '甜美女声', type: '女声', previewUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav' },
                    { id: 'voice2', name: '磁性男声', type: '男声', previewUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav' },
                    { id: 'voice3', name: '童声', type: '儿童', previewUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav' },
                    { id: 'voice4', name: '老年男声', type: '男声', previewUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav' },
                    { id: 'voice5', name: '知性女声', type: '女声', previewUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav' }
                ]
            };
        }

        if (endpoint === '/api/generate-image' || endpoint === '/api/fix-image') {
            return {
                success: true,
                data: {
                    url: 'https://picsum.photos/512/512?random=' + Date.now(),
                    id: 'img-' + Date.now()
                }
            };
        }

        if (endpoint === '/api/synthesize-audio') {
            return {
                success: true,
                data: {
                    url: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
                    id: 'audio-' + Date.now(),
                    duration: '00:03'
                }
            };
        }

        if (endpoint === '/api/transcribe-audio') {
            return {
                success: true,
                data: {
                    transcriptions: [
                        {
                            id: 'tr-' + Date.now(),
                            filename: 'audio.wav',
                            language: 'zh',
                            duration: '00:05',
                            text: '这是一段示例转录文本，用于前端开发联调。'
                        }
                    ]
                }
            };
        }

        return { success: false, error: 'Unknown endpoint' };
    }
}

// 实用工具函数
/**
 * 格式化文件大小
 * @param {number} bytes - 文件大小（字节）
 * @returns {string} 格式化后的文件大小
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 错误处理函数
 * @param {Error} error - 错误对象
 * @param {string} context - 错误上下文
 */
function handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    // 显示用户友好的错误消息
    const message = error.message || '发生了未知错误';
    const notification = document.createElement('div');
    notification.className = 'notification error';
    notification.innerHTML = `
        <div class="notification-content">
            <strong>错误</strong>
            <p>${context ? `${context}: ` : ''}${message}</p>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // 3秒后自动移除通知
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

/**
 * 清理临时文件和资源
 */
function cleanup() {
    // 清理临时创建的 URL 对象
    const images = document.querySelectorAll('img[src^="blob:"]');
    images.forEach(img => {
        URL.revokeObjectURL(img.src);
    });
    
    const audios = document.querySelectorAll('audio[src^="blob:"]');
    audios.forEach(audio => {
        URL.revokeObjectURL(audio.src);
    });
    
    // 清理本地存储中的临时数据
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith('temp_') || key.startsWith('cache_')) {
            localStorage.removeItem(key);
        }
    });
}

// 全局错误处理
window.addEventListener('error', (event) => {
    handleError(event.error, '全局错误');
});

window.addEventListener('unhandledrejection', (event) => {
    handleError(new Error(event.reason), 'Promise 拒绝');
    event.preventDefault();
});

// 页面卸载时清理资源
window.addEventListener('beforeunload', cleanup);

// 全局变量
let aiGenerator;

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    try {
        aiGenerator = new AIGenerator();
        window.aiGenerator = aiGenerator;
    } catch (error) {
        handleError(error, '应用初始化');
    }
});