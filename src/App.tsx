import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  Briefcase, 
  Sparkles, 
  Download, 
  Copy, 
  Check, 
  Loader2,
  Trash2,
  FileDown,
  ArrowRight,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import html2pdf from 'html2pdf.js';
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { motion, AnimatePresence } from 'motion/react';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [resumeText, setResumeText] = useState<string>('');
  const [jobDescription, setJobDescription] = useState<string>('');
  const [socialLinks, setSocialLinks] = useState<{ label: string, url: string }[]>(() => {
    try {
      const saved = localStorage.getItem('socialLinks');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [{ label: 'LinkedIn', url: '' }, { label: 'GitHub', url: '' }];
  });
  const [skills, setSkills] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('skills');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });
  const [skillInput, setSkillInput] = useState('');
  const [isExtractingSkills, setIsExtractingSkills] = useState(false);
  const [mode, setMode] = useState<'general' | 'ats'>(() => {
    return (localStorage.getItem('resumeMode') as 'general' | 'ats') || 'ats';
  });
  const [generatedResume, setGeneratedResume] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('socialLinks', JSON.stringify(socialLinks));
  }, [socialLinks]);

  useEffect(() => {
    localStorage.setItem('skills', JSON.stringify(skills));
  }, [skills]);

  useEffect(() => {
    localStorage.setItem('resumeMode', mode);
  }, [mode]);

  const extractTextFromPdf = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    return fullText;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);

    try {
      let text = '';
      if (file.type === 'application/pdf') {
        text = await extractTextFromPdf(file);
      } else if (file.type === 'text/plain') {
        text = await file.text();
      } else {
        alert('Please upload a PDF or Text file.');
        return;
      }
      
      setResumeText(text);
      extractLinksFromText(text);
      extractSkillsFromText(text);
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Failed to read file. Please try pasting your resume manually.');
    } finally {
      setIsLoading(false);
    }
  };

  const extractSkillsFromText = async (text: string) => {
    setIsExtractingSkills(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Extract all technical and professional skills from this resume. Return ONLY a comma-separated list of skills with no explanation, no categories, no bullet points. Example: JavaScript, React, Node.js, SQL, Git\n\nResume:\n${text}`,
      });
      const raw = response.text?.trim() || '';
      const extracted = raw
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0 && s.length < 50);
      if (extracted.length > 0) {
        setSkills(extracted);
      }
    } catch {
      // silently fail — skills section remains empty
    } finally {
      setIsExtractingSkills(false);
    }
  };

  const extractLinksFromText = (text: string) => {
    const githubRegex = /(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9_-]+/gi;
    const linkedinRegex = /(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/gi;

    const githubMatches = text.match(githubRegex) || [];
    const linkedinMatches = text.match(linkedinRegex) || [];
    
    setSocialLinks(prev => {
      const newLinks = [...prev];
      let updated = false;

      if (githubMatches.length > 0) {
        const url = githubMatches[0];
        const idx = newLinks.findIndex(l => l.label.toLowerCase() === 'github');
        if (idx !== -1) {
          if (!newLinks[idx].url) {
            newLinks[idx].url = url;
            updated = true;
          }
        } else {
          newLinks.push({ label: 'GitHub', url });
          updated = true;
        }
      }

      if (linkedinMatches.length > 0) {
        const url = linkedinMatches[0];
        const idx = newLinks.findIndex(l => l.label.toLowerCase() === 'linkedin');
        if (idx !== -1) {
          if (!newLinks[idx].url) {
            newLinks[idx].url = url;
            updated = true;
          }
        } else {
          newLinks.push({ label: 'LinkedIn', url });
          updated = true;
        }
      }

      return updated ? newLinks : prev;
    });
  };

  const generateTailoredResume = async () => {
    if (!resumeText || (mode === 'ats' && !jobDescription)) {
      alert(mode === 'ats' ? 'Please provide both your resume and the job description.' : 'Please provide your resume.');
      return;
    }

    setIsLoading(true);
    try {
      const linksContext = socialLinks
        .filter(link => link.url.trim() !== '')
        .map(link => `${link.label}: ${link.url}`)
        .join('\n');

      const skillsContext = skills.length > 0 ? skills.join(', ') : '';

      const sharedRules = `
          CRITICAL ACCURACY RULES — NEVER VIOLATE:
          - Only use facts from the original resume. Do NOT invent, fabricate, or embellish any job titles, companies, dates, degrees, institutions, or accomplishments.
          - If information is not in the original resume, omit it entirely.
          - Keep all dates, employer names, and school names exactly as provided.

          HARVARD STYLE FORMAT — follow precisely:
          1. Start with: # FULL NAME (all caps, exactly as in the resume)
          2. After the name, two SEPARATE paragraphs (blank line between them):
             - Paragraph 1: email · phone · city, state (contact info ONLY — no links here)
             - Paragraph 2: markdown hyperlinks separated by · using the exact format [Label](url) — e.g. [LinkedIn](https://linkedin.com/in/...) · [GitHub](https://github.com/...) — ONLY include a link if a URL for it is explicitly provided in the "Professional Links" section below. Never add a link without a URL. If no links are provided, omit paragraph 2 entirely.
          3. Section headings as ## (e.g., ## EDUCATION, ## EXPERIENCE, ## SKILLS)
          4. Under each experience entry use ### for "Company Name — Job Title" then a line for dates in italics, then bullet points
          5. Under education use ### for "Institution Name" then degree and date
          6. Bullet points start with strong action verbs; each is one concise achievement-oriented sentence
          7. ## SKILLS section: each category MUST be its own separate paragraph with a blank line between them (e.g., "**Languages:** Python, Java\n\n**Frameworks:** React, Django"). NEVER put multiple categories in the same paragraph. List only actual technical skills and tools. NEVER include the candidate's own name or parts of their name as a skill.
          8. No tables, no columns, no icons — clean single-column Markdown only
          9. Do NOT add a "Professional Summary" section unless the original resume already has one`;

      const prompt = mode === 'ats'
        ? `You are an expert professional resume writer. Rewrite the provided resume to target the given job description, formatted in Harvard resume style using Markdown.
          ${sharedRules}

          ATS OPTIMIZATION:
          - Naturally incorporate relevant keywords from the job description
          - Mirror the exact terminology used in the job posting where truthful
          - Prioritize the most relevant experiences and skills for this specific role

          Professional Links to include (if provided):
          ${linksContext || 'None provided'}

          ${skillsContext ? `Candidate's known skills (incorporate into ## SKILLS section, grouped by category):\n          ${skillsContext}\n` : ''}
          Original Resume:
          ${resumeText}

          Job Description:
          ${jobDescription}

          Output only the Markdown resume. No preamble, no commentary, no code fences.`
        : `You are an expert professional resume writer. Rewrite the provided resume into a clean, professional, general-purpose resume using Harvard resume style Markdown. Do not tailor to any specific job. Improve the content: strengthen weak bullet points with strong action verbs, quantify achievements where possible, remove filler or vague language, and ensure every bullet is concise and impact-focused. Fix grammar and phrasing throughout.
          ${sharedRules}

          Professional Links to include (if provided):
          ${linksContext || 'None provided'}

          ${skillsContext ? `Candidate's known skills (incorporate into ## SKILLS section, grouped by category):\n          ${skillsContext}\n` : ''}
          Original Resume:
          ${resumeText}

          Output only the Markdown resume. No preamble, no commentary, no code fences.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setGeneratedResume(response.text || '');
    } catch (error) {
      console.error('Error generating resume:', error);
      alert('Failed to generate resume. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const addLink = () => {
    setSocialLinks([...socialLinks, { label: '', url: '' }]);
  };

  const updateLink = (index: number, field: 'label' | 'url', value: string) => {
    const newLinks = [...socialLinks];
    newLinks[index][field] = value;
    setSocialLinks(newLinks);
  };

  const removeLink = (index: number) => {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
  };

  const addSkill = (raw: string) => {
    const trimmed = raw.trim().replace(/,$/, '').trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed]);
    }
    setSkillInput('');
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(skillInput);
    } else if (e.key === 'Backspace' && skillInput === '') {
      setSkills(skills.slice(0, -1));
    }
  };

  const removeSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedResume);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const downloadAsText = () => {
    const element = document.createElement("a");
    const file = new Blob([generatedResume], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = "tailored-resume.md";
    document.body.appendChild(element);
    element.click();
  };

  const downloadAsPdf = async () => {
    const previewEl = document.querySelector('.resume-preview') as HTMLElement;
    if (!previewEl) return;

    const nameMatch = generatedResume.match(/^#\s+(.+)/m);
    const name = nameMatch ? nameMatch[1].trim() : 'tailored-resume';

    await document.fonts.ready;

    // Temporarily apply Harvard-standard padding and shrink h1 for export
    const h1 = previewEl.querySelector('h1') as HTMLElement | null;
    const prevH1Size = h1?.style.fontSize ?? '';
    const prevPadding = previewEl.style.padding;
    const prevBoxShadow = previewEl.style.boxShadow;
    const prevMaxWidth = previewEl.style.maxWidth;

    if (h1) h1.style.fontSize = '18pt';
    previewEl.style.padding = '0.5in 1in';
    previewEl.style.boxShadow = 'none';
    previewEl.style.maxWidth = 'none';

    // Prevent paragraphs and list items from splitting across pages
    const allPs = previewEl.querySelectorAll('p');
    const allLis = previewEl.querySelectorAll('li');
    allPs.forEach((el: HTMLElement) => { el.style.pageBreakInside = 'avoid'; });
    allLis.forEach((el: HTMLElement) => { el.style.pageBreakInside = 'avoid'; });

    const opt = {
      margin: [0.75, 1, 0.75, 1],
      filename: `${name}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: ['.resume-preview h2', '.resume-preview h3', '.resume-preview li', '.resume-preview p'] },
    };

    await html2pdf().set(opt).from(previewEl).save();

    if (h1) h1.style.fontSize = prevH1Size;
    previewEl.style.padding = prevPadding;
    previewEl.style.boxShadow = prevBoxShadow;
    previewEl.style.maxWidth = prevMaxWidth;
    allPs.forEach((el: HTMLElement) => { el.style.pageBreakInside = ''; });
    allLis.forEach((el: HTMLElement) => { el.style.pageBreakInside = ''; });
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Resume</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Garamond&family=EB+Garamond:ital,wght@0,400;0,700;1,400;1,700&display=swap');

            @page {
              size: Letter;
              margin: 0.85in 1in;
            }

            * { box-sizing: border-box; margin: 0; padding: 0; }

            body {
              font-family: 'EB Garamond', 'Garamond', Georgia, serif;
              font-size: 11pt;
              color: #111;
              background: white;
              line-height: 1.45;
            }

            h1 {
              font-size: 29pt;
              font-weight: 700;
              text-align: center;
              text-transform: uppercase;
              letter-spacing: 0.15em;
              margin-bottom: 4pt;
            }

            /* Contact line */
            p:first-of-type {
              text-align: center;
              font-size: 9.5pt;
              margin-bottom: 4pt;
              opacity: 0.8;
            }

            /* Links line */
            p:first-of-type + p {
              text-align: center;
              font-size: 9.5pt;
              margin-bottom: 12pt;
              opacity: 0.8;
            }

            /* Links line (2nd paragraph) */
            p:nth-of-type(2) {
              text-align: center;
              font-size: 9.5pt;
              margin-bottom: 12pt;
              opacity: 0.8;
            }

            /* Body paragraphs — justified */
            p:nth-of-type(n+3) {
              text-align: justify;
            }

            /* Links */
            a {
              color: inherit;
              text-decoration: underline;
            }

            h2 {
              font-size: 9pt;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.2em;
              border-bottom: 1pt solid #111;
              margin-top: 14pt;
              margin-bottom: 5pt;
              padding-bottom: 2pt;
            }

            h3 {
              font-size: 10.5pt;
              font-weight: 700;
              margin-top: 7pt;
              margin-bottom: 1pt;
            }

            p { font-size: 10.5pt; margin-bottom: 2pt; text-align: justify; }

            ul {
              list-style-type: disc;
              padding-left: 18pt;
              margin-bottom: 6pt;
              margin-top: 2pt;
            }

            li { font-size: 10.5pt; margin-bottom: 2pt; line-height: 1.4; text-align: justify; }

            strong { font-weight: 700; }
            em { font-style: italic; }

            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${document.querySelector('.resume-preview')?.innerHTML || ''}
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-accent selection:text-white">
      {/* Editorial Header */}
      <header className="border-b border-ink/10 sticky top-0 z-50 bg-paper/80 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-baseline gap-4">
            <h1 className="text-3xl display-title italic">Resume Architect</h1>
            <span className="mono-label hidden sm:block">Professional Resume Architect / v1.0</span>
          </div>
          <div className="flex items-center gap-8">
            <div className="hidden md:flex items-center gap-6 text-[11px] font-bold uppercase tracking-widest opacity-40">
              <span>01. Upload</span>
              <ArrowRight className="w-3 h-3" />
              <span>02. Paste</span>
              <ArrowRight className="w-3 h-3" />
              <span>03. Refine</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full p-8">
        <div className="editorial-grid min-h-[80vh]">
          
          {/* Input Section */}
          <div className="editorial-cell col-span-12 lg:col-span-5 border-r border-ink/10 flex flex-col gap-12">
            <motion.section 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <span className="mono-label">Source Material / Resume</span>
                {resumeText && (
                  <button 
                    onClick={() => { setResumeText(''); setFileName(null); }}
                    className="text-[10px] uppercase font-bold text-accent hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              {!resumeText ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-video border-2 border-ink/5 bg-ink/[0.02] hover:bg-ink/[0.05] transition-all cursor-pointer flex flex-col items-center justify-center group relative overflow-hidden"
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="absolute top-4 left-4 mono-label">Drop File Here</div>
                    <div className="absolute bottom-4 right-4 mono-label">PDF / TXT</div>
                  </div>
                  <Upload className="w-12 h-12 text-ink/20 group-hover:text-accent transition-colors mb-4" />
                  <p className="font-serif italic text-2xl">Upload Resume</p>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden" 
                    accept=".pdf,.txt"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-ink text-paper">
                    <FileText className="w-4 h-4" />
                    <span className="text-xs font-mono truncate">{fileName || 'Custom Content'}</span>
                  </div>
                  <textarea
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    className="w-full h-48 bg-transparent border border-ink/10 p-6 text-sm font-mono focus:outline-none focus:border-accent resize-none"
                    placeholder="Raw text content..."
                  />
                </div>
              )}
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.03 }}
              className="space-y-3"
            >
              <span className="mono-label">Resume Mode</span>
              <div className="flex gap-2">
                {(['general', 'ats'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      'flex-1 py-2 text-[10px] font-mono uppercase tracking-widest border transition-colors',
                      mode === m
                        ? 'bg-accent text-white border-accent'
                        : 'bg-transparent text-ink/40 border-ink/10 hover:border-accent hover:text-accent'
                    )}
                  >
                    {m === 'general' ? 'General' : 'ATS / Targeted'}
                  </button>
                ))}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <span className="mono-label">Professional Links / Optional</span>
                <div className="flex items-center gap-3">
                  {socialLinks.length > 0 && (
                    <button
                      onClick={() => setSocialLinks([])}
                      className="text-[10px] uppercase font-bold text-ink/30 hover:text-red-500 transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                  <button
                    onClick={addLink}
                    className="text-[10px] uppercase font-bold text-accent hover:underline flex items-center gap-1"
                  >
                    + Add Link
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                {socialLinks.map((link, index) => (
                  <motion.div 
                    layout
                    key={index} 
                    className="flex items-center gap-2 group"
                  >
                    <input 
                      type="text"
                      value={link.label}
                      onChange={(e) => updateLink(index, 'label', e.target.value)}
                      placeholder="Label (e.g. LinkedIn)"
                      className="w-1/3 bg-transparent border border-ink/10 p-3 text-[10px] font-mono uppercase tracking-widest focus:outline-none focus:border-accent"
                    />
                    <input 
                      type="text"
                      value={link.url}
                      onChange={(e) => updateLink(index, 'url', e.target.value)}
                      placeholder="URL"
                      className="flex-1 bg-transparent border border-ink/10 p-3 text-xs font-mono focus:outline-none focus:border-accent"
                    />
                    <button 
                      onClick={() => removeLink(index)}
                      className="p-3 text-ink/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.section>

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.075 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <span className="mono-label flex items-center gap-2">
                  Skills / Optional
                  {isExtractingSkills && (
                    <Loader2 className="w-3 h-3 animate-spin text-accent" />
                  )}
                </span>
                {skills.length > 0 && !isExtractingSkills && (
                  <button
                    onClick={() => setSkills([])}
                    className="text-[10px] uppercase font-bold text-ink/30 hover:text-red-500 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 border border-ink/10 p-3 min-h-[48px] focus-within:border-accent transition-colors">
                {isExtractingSkills && (
                  <span className="text-[10px] font-mono text-ink/30 uppercase tracking-widest animate-pulse">
                    Extracting skills...
                  </span>
                )}
                {skills.map((skill, i) => (
                  <motion.span
                    layout
                    key={skill}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1 border border-ink/20 px-2 py-1 text-[10px] font-mono uppercase tracking-widest"
                  >
                    {skill}
                    <button
                      onClick={() => removeSkill(i)}
                      className="ml-1 text-ink/30 hover:text-red-500 transition-colors leading-none"
                    >
                      ×
                    </button>
                  </motion.span>
                ))}
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleSkillKeyDown}
                  onBlur={() => { if (skillInput.trim()) addSkill(skillInput); }}
                  placeholder={skills.length === 0 ? 'Add a skill and press Enter...' : ''}
                  className="flex-1 min-w-[120px] bg-transparent text-[10px] font-mono uppercase tracking-widest focus:outline-none"
                />
              </div>
            </motion.section>

            {mode === 'ats' && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-6 flex-1 flex flex-col"
              >
                <span className="mono-label">Target Context / Job Description</span>
                <div className="flex-1 relative">
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="w-full h-full min-h-[300px] bg-transparent border border-ink/10 p-8 text-sm leading-relaxed focus:outline-none focus:border-accent resize-none"
                    placeholder="Paste the job requirements here..."
                  />
                  <div className="absolute bottom-4 right-4 mono-label pointer-events-none opacity-20">
                    {jobDescription.length} characters
                  </div>
                </div>
              </motion.section>
            )}

            <button
              onClick={generateTailoredResume}
              disabled={isLoading || !resumeText || (mode === 'ats' && !jobDescription)}
              className="w-full bg-accent text-white py-8 text-xl display-title italic hover:bg-ink transition-all disabled:opacity-20 disabled:cursor-not-allowed group relative overflow-hidden"
            >
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div 
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-4"
                  >
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Architecting...</span>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center gap-4"
                  >
                    <span>Tailor Resume</span>
                    <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>

          {/* Output Section */}
          <div className={cn(
            "editorial-cell col-span-12 lg:col-span-7 flex flex-col transition-all duration-700",
            isFullscreen ? "fixed inset-0 z-[100] bg-paper" : "relative"
          )}>
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-baseline gap-4">
                <span className="mono-label">Refined Output</span>
                {generatedResume && (
                  <span className="text-[10px] font-bold text-accent animate-pulse">GENERATION COMPLETE</span>
                )}
              </div>
              
              {generatedResume && (
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="p-2 hover:bg-ink/5 rounded transition-colors"
                    title="Toggle Focus Mode"
                  >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  <div className="h-4 w-[1px] bg-ink/10" />
                  <button 
                    onClick={copyToClipboard}
                    className="mono-label hover:text-accent transition-colors flex items-center gap-2"
                  >
                    {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {isCopied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={downloadAsPdf}
                    className="mono-label hover:text-accent transition-colors flex items-center gap-2"
                  >
                    <FileDown className="w-3 h-3" />
                    PDF
                  </button>
                  <button
                    onClick={handlePrint}
                    className="mono-label hover:text-accent transition-colors flex items-center gap-2"
                  >
                    <Download className="w-3 h-3" />
                    Print
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 relative">
              <AnimatePresence mode="wait">
                {!generatedResume && !isLoading && (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center text-center p-12"
                  >
                    <div className="w-32 h-[1px] bg-ink/10 mb-8" />
                    <h3 className="text-4xl display-title italic mb-4 opacity-10">Awaiting Input.</h3>
                    <p className="mono-label max-w-xs">
                      The architectural process begins once source material is provided.
                    </p>
                  </motion.div>
                )}

                {isLoading && (
                  <motion.div 
                    key="loading-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-paper/50 backdrop-blur-sm z-10"
                  >
                    <div className="flex flex-col items-center gap-8">
                      <div className="w-24 h-24 relative">
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-0 border border-ink/5 border-t-accent rounded-full"
                        />
                        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent w-8 h-8" />
                      </div>
                      <div className="text-center space-y-2">
                        <p className="display-title italic text-2xl">Refining Experience...</p>
                        <p className="mono-label animate-pulse">Consulting Gemini Intelligence</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div
                layout
                className={cn(
                  "resume-preview",
                  isFullscreen ? "my-20" : "my-4"
                )}
              >
                <ReactMarkdown
                  components={{
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                        {children}
                      </a>
                    ),
                  }}
                >{generatedResume}</ReactMarkdown>
              </motion.div>
            </div>
          </div>
        </div>
      </main>

      {/* Watermark Footer */}
      {/* <footer className="py-12 flex justify-center items-center">
        <a 
          href="https://blaisemercado-portfolio.vercel.app/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="mono-label text-[10px] opacity-20 hover:opacity-100 transition-opacity tracking-[0.4em] uppercase group"
        >
          Built by <span className="text-accent group-hover:underline">BLAISE PASCAL MERCADO</span>
        </a>
      </footer> */}
    </div>
  );
}
