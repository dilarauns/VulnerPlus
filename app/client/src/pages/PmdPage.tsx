// PMD.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './PmdPage.css';

/* ---------- Tip Tanımları ---------- */
interface PmdViolation {
  beginline: number;
  begincolumn: number;
  endline: number;
  endcolumn: number;
  description: string;
  rule: string;
  ruleset: string;
  priority: number;
  externalInfoUrl: string;
}

interface PmdFileResult { filename: string; violations: PmdViolation[]; }

interface PmdAnalysisResult {
  formatVersion: number;
  pmdVersion: string;
  timestamp: string;
  files: PmdFileResult[];
  suppressedViolations: any[];
  processingErrors: any[];
  configurationErrors: any[];
  aiComment?: string;
}

interface InferIssue {
  bug_type: string;
  qualifier: string;
  severity: string;
  line: number;
  column: number;
  procedure: string;
  file: string;
}

interface AnalysisResult {
  pmdResults?: PmdAnalysisResult;
  inferResults?: InferIssue[];
  aiComment?: string;
}

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

interface CodeProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

/* ---------- Yardımcı Bileşenler ---------- */
const ChatMessage: React.FC<{ message: ChatMessage }> = ({ message }) => (
  <div className={`chat-message ${message.role}`}>
    <div className="message-content">
      <ReactMarkdown
        components={{
          code: ({ className, children, ...props }: CodeProps) => {
            const match = /language-(\w+)/.exec(className || '');
            return !className?.includes('inline') && match ? (
              <div className="code-block">
                <SyntaxHighlighter
                  style={vscDarkPlus as any}
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code className={className} {...props}>{children}</code>
            );
          }
        }}
      >
        {message.content}
      </ReactMarkdown>
    </div>
  </div>
);

const AIComment: React.FC<{ content: string }> = ({ content }) => (
  <div className="comment-content">
    <ReactMarkdown
      components={{
        code: ({ className, children, ...props }: CodeProps) => {
          const match = /language-(\w+)/.exec(className || '');
          return !className?.includes('inline') && match ? (
            <div className="code-block">
              <SyntaxHighlighter
                style={vscDarkPlus as any}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code className={className} {...props}>{children}</code>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

/* ---------- Ana Bileşen ---------- */
const PMD: React.FC = () => {
  /* ---- State'ler ---- */
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiComment, setAiComment] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userQuestion, setUserQuestion] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [sourceCode, setSourceCode] = useState('');
  const [analysisId, setAnalysisId] = useState<string | null>(null);

  /* --- Yeni: görünüm kontrolü --- */
  const [view, setView] = useState<'summary' | 'ai'>('summary');

  /* ---- AI polling ---- */
  const pollAiResults = useCallback(
    async (id: string, tool: 'pmd' | 'infer') => {
      try {
        const res = await fetch(`/api/${tool}/ai-status/${id}`);
        const data = await res.json();
        if (data.status === 'completed') {
          setAiComment(data.ai_comment);
          setAiLoading(false);
          return true;
        }
      } catch (e) { console.error('AI polling error:', e); }
      return false;
    },
    []
  );

  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | undefined;
    if (analysisId && aiLoading) {
      const tool = analysisId.startsWith('pmd_') ? 'pmd' : 'infer';
      poll = setInterval(async () => {
        const done = await pollAiResults(analysisId, tool);
        if (done && poll) clearInterval(poll);
      }, 2000);
    }
    return () => {
      if (poll) clearInterval(poll);
    };
  }, [analysisId, aiLoading, pollAiResults]);

  /* ---- Dropzone ---- */
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept: {},
    onDrop: async (accepted) => {
      const f = accepted[0];
      if (!f) return;
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      const allowed = ['java', 'js', 'jsx', 'c', 'cpp'];
      if (!allowed.includes(ext)) {
        alert('Desteklenmeyen dosya türü!');
        return;
      }

      /* reset */
      setFile(f); setLoading(true); setError(null);
      setResults(null); setAiComment(null); setAnalysisId(null);
      setView('summary');

      /* kaynak kodu oku */
      const reader = new FileReader();
      reader.onload = (e) => setSourceCode(String(e.target?.result || ''));
      reader.readAsText(f);

      try {
        const form = new FormData();
        form.append('file', f);

        const tool = ['c', 'cpp'].includes(ext) ? 'infer' : 'pmd';
        const res = await fetch(`/api/${tool}/analyze`, { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok || data.status === 'error') throw new Error(data.error || 'Analiz hatası');

        const newResult: AnalysisResult = {};
        if (tool === 'pmd') {
          const pr = typeof data.pmd_result === 'string' ? JSON.parse(data.pmd_result) : data.pmd_result;
          newResult.pmdResults = pr;
        } else {
          const ir = typeof data.infer_result === 'string' ? JSON.parse(data.infer_result) : data.infer_result;
          newResult.inferResults = Array.isArray(ir) ? ir : [];
        }

        setResults(newResult);
        setAnalysisId(data.analysis_id);
        setAiLoading(true);
      } catch (e) {
        console.error(e);
        setError(e instanceof Error ? e.message : 'Bilinmeyen hata');
        setAiLoading(false);
      } finally { setLoading(false); }
    }
  });

  /* ---- Yardımcılar ---- */
  const totalViolations = (p: PmdAnalysisResult) =>
    p.files.reduce((t, f) => t + f.violations.length, 0);

  const adjustTextareaHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const ta = e.target; ta.style.height = 'auto'; ta.style.height = `${ta.scrollHeight}px`;
  };

  /* ---- Chat gönder ---- */
  const handleSendMessage = async () => {
    if (!userQuestion.trim() || !results || !sourceCode) return;
    const newMsg: ChatMessage = { role: 'user', content: userQuestion };
    setChatMessages((p) => [...p, newMsg]);
    setUserQuestion(''); setIsChatLoading(true);

    try {
      const tool = results.pmdResults ? 'pmd' : 'infer';
      const res = await fetch(`/api/${tool}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          analysis_result: results.pmdResults || results.inferResults,
          source_code: sourceCode,
          question: userQuestion
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setChatMessages((p) => [...p, { role: 'assistant', content: data.response || '---' }]);
    } catch (e) {
      setChatMessages((p) => [...p, { role: 'assistant', content: 'Bir hata oluştu.' }]);
    } finally { setIsChatLoading(false); }
  };

  /* ---------- JSX ---------- */
  return (
    <div className="pmd-container">
      <div className="page-title"><h1>PMD Code Analysis</h1></div>

      {/* Dosya yükleme */}
      <div {...getRootProps()} className="dropzone">
        <input {...getInputProps()} />
        <div className={`drag-drop-area ${isDragActive ? 'active' : ''}`}>
          {isDragActive ? <p>Dosyayı buraya bırakın…</p> : (
            <>
              <p>Analiz için dosya seç / sürükle</p>
              <p className="file-info">.java .js .jsx .c .cpp</p>
            </>
          )}
        </div>
      </div>

      {/* Seçili dosya */}
      {file && (
        <div className="selected-file">
          <p>{file.name}</p>
          <button className="clear-button" onClick={() => {
            setFile(null); setResults(null); setError(null); setAiComment(null);
          }}>Temizle</button>
        </div>
      )}

      {/* Yükleme / Hata */}
      {loading && <div className="loading"><div className="spinner" /><p>Analiz ediliyor…</p></div>}
      {error && <div className="error-message"><p>{error}</p></div>}

      {/* Görünüm geçiş düğmeleri */}
      {results && (
        <div className="view-toggle-buttons">
          <button className={view === 'summary' ? 'active' : ''} onClick={() => setView('summary')}>
            Özet
          </button>
          <button
            className={view === 'ai' ? 'active' : ''}
            onClick={() => setView('ai')}
            disabled={aiLoading}
          >
            {aiLoading ? 'AI Yükleniyor…' : 'AI Sonucu'}
          </button>
        </div>
      )}

      {/* SONUÇ */}
      {results && (
        <div className="analysis-row">
          {/* -------- ÖZET -------- */}
          {view === 'summary' && (
            <div className="analysis-col">
              <div className="analysis-results">
                {/* PMD */}
                {results.pmdResults && !!results.pmdResults.files.length && (
                  <>
                    <div className="results-header"><h2>PMD Analiz Sonucu</h2></div>
                    <div className="summary-view">
                      <div className="summary-card">
                        <h3>Genel Bakış</h3>
                        <p>Toplam İhlal: {totalViolations(results.pmdResults)}</p>
                        <p>PMD Versiyonu: {results.pmdResults.pmdVersion}</p>
                        <p>Analiz Tarihi: {new Date(results.pmdResults.timestamp).toLocaleString()}</p>
                      </div>
                      {results.pmdResults.files.map((f, i) => (
                        <div key={i} className="file-results">
                          <h3>Dosya: {file?.name || f.filename}</h3>
                          <div className="violations-list">
                            {f.violations.map((v, j) => (
                              <div key={j} className="violation-item">
                                <div className="violation-header">
                                  <span className="rule-name">{v.rule}</span>
                                  <span className={`priority priority-${v.priority}`}>
                                    Öncelik: {v.priority}
                                  </span>
                                </div>
                                <p className="violation-description">{v.description}</p>
                                <p className="violation-location">
                                  Satır {v.beginline}:{v.begincolumn} – {v.endline}:{v.endcolumn}
                                </p>
                                <p className="violation-ruleset">Kural Seti: {v.ruleset}</p>
                                <a className="rule-link" href={v.externalInfoUrl} target="_blank" rel="noreferrer">
                                  Kural Detayları
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Infer */}
                {results.inferResults && (
                  <div className="summary-view">
                    <div className="summary-card">
                      <h3>Infer Analiz Özeti</h3>
                      <p>Toplam Sorun: {results.inferResults.length}</p>
                    </div>
                    {results.inferResults.length ? results.inferResults.map((iss, i) => (
                      <div key={i} className="violation-item">
                        <div className="violation-header">
                          <span className="rule-name">{iss.bug_type}</span>
                          <span className="priority priority-1">{iss.severity}</span>
                        </div>
                        <p className="violation-description">{iss.qualifier}</p>
                        <p className="violation-location">Satır {iss.line}:{iss.column}</p>
                        <p className="violation-ruleset">Fonksiyon: {iss.procedure}</p>
                        <p className="violation-ruleset">Dosya: {iss.file}</p>
                      </div>
                    )) : <div className="no-issues">Sorun yok.</div>}
                  </div>
                )}

                {/* Hiç sonuç yoksa */}
                {results.pmdResults && !results.pmdResults.files.length && (
                  <div className="no-issues">Herhangi bir sorun bulunamadı.</div>
                )}
              </div>
            </div>
          )}

          {/* -------- AI + Chat -------- */}
          {view === 'ai' && (
            <div className="analysis-col">
              {aiLoading ? (
                <div className="ai-comments"><h2>AI Yorum</h2><p>Yükleniyor…</p></div>
              ) : aiComment ? (
                <div className="ai-comments">
                  <h2>AI Yorum</h2>
                  <AIComment content={aiComment} />
                  {/* ---- Chat ---- */}
                  <div className="chat-interface">
                    <div className="chat-messages">
                      {chatMessages.map((m, i) => <ChatMessage key={i} message={m} />)}
                      {isChatLoading && (
                        <div className="chat-message assistant">
                          <div className="message-content">Yanıt yazılıyor…</div>
                        </div>
                      )}
                    </div>
                    <div className="chat-input">
                      <textarea
                        value={userQuestion}
                        onChange={e => { setUserQuestion(e.target.value); adjustTextareaHeight(e); }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                        placeholder="Analiz hakkında soru sor…"
                        rows={1}
                        className="chat-textarea"
                      />
                      <button onClick={handleSendMessage} disabled={isChatLoading || !userQuestion.trim()}>
                        Gönder
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ai-comments"><p>AI sonucu henüz hazır değil.</p></div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PMD;
