import React, { useState, useRef } from 'react';
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
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { motion, AnimatePresence } from 'motion/react';

// Initialize PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [resumeText, setResumeText] = useState<string>('');
  const [jobDescription, setJobDescription] = useState<string>('');
  const [socialLinks, setSocialLinks] = useState<{ label: string, url: string }[]>([
    { label: 'LinkedIn', url: '' },
    { label: 'GitHub', url: '' }
  ]);
  const [generatedResume, setGeneratedResume] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Failed to read file. Please try pasting your resume manually.');
    } finally {
      setIsLoading(false);
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
    if (!resumeText || !jobDescription) {
      alert('Please provide both your resume and the job description.');
      return;
    }

    setIsLoading(true);
    try {
      const linksContext = socialLinks
        .filter(link => link.url.trim() !== '')
        .map(link => `${link.label}: ${link.url}`)
        .join('\n');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `
          You are an expert career coach and professional resume writer specializing in ATS (Applicant Tracking System) optimization. 
          Your task is to rewrite the following resume to perfectly match the provided job description while ensuring it is 100% ATS-friendly.
          
          ATS Optimization Guidelines:
          1. Use standard section headings (e.g., "Professional Experience", "Education", "Skills").
          2. Incorporate relevant keywords and phrases from the job description naturally.
          3. Use a clean, single-column layout structure in the Markdown.
          4. Avoid complex tables or unusual formatting that might confuse older ATS systems.
          5. Highlight relevant skills and experiences that match the job requirements.
          6. Use professional, action-oriented language (e.g., "Spearheaded", "Optimized", "Developed").
          7. Maintain the original facts but rephrase them for maximum impact and keyword alignment.
          8. Format the output in clean, professional Markdown.
          9. Include sections: Contact Info (including the social links provided below if any), Professional Summary, Experience, Skills, and Education.
          10. Ensure the tone is professional, confident, and tailored to the specific industry.
          
          Professional Links to include:
          ${linksContext || 'None provided'}

          Original Resume:
          ${resumeText}
          
          Job Description:
          ${jobDescription}
        `,
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

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title></title>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;700&display=swap');
            
            @page { 
              margin: 0; 
            }
            
            body { 
              font-family: 'Fraunces', serif; 
              padding: 40px; 
              color: #1a1a1a; 
              background: white; 
              line-height: 1.5; 
            }
            
            h1 { text-align: center; font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 5px; }
            h2 { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 25px; margin-bottom: 5px; border-bottom: 1px solid #1a1a1a; display: block; width: 100%; }
            p, li { font-size: 13px; margin-bottom: 4px; }
            ul { list-style-type: disc; padding-left: 20px; margin-bottom: 15px; }
            p:first-of-type { text-align: center; font-size: 11px; margin-bottom: 20px; opacity: 0.8; font-style: italic; }
            
            @media print { 
              body { 
                padding: 1in; 
              } 
            }
          </style>
        </head>
        <body>
          <div class="max-w-4xl mx-auto">
            ${document.querySelector('.resume-preview')?.innerHTML || ''}
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
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
              transition={{ delay: 0.05 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <span className="mono-label">Professional Links / Optional</span>
                <button 
                  onClick={addLink}
                  className="text-[10px] uppercase font-bold text-accent hover:underline flex items-center gap-1"
                >
                  + Add Link
                </button>
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

            <button
              onClick={generateTailoredResume}
              disabled={isLoading || !resumeText || !jobDescription}
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
                  "resume-preview max-w-3xl mx-auto",
                  isFullscreen ? "py-20" : "py-4"
                )}
              >
                <ReactMarkdown>{generatedResume}</ReactMarkdown>
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
