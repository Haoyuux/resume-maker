/// <reference types="vite/client" />

declare module '*?url' {
  const content: string;
  export default content;
}

declare module 'html2pdf.js' {
  function html2pdf(): {
    set(opt: object): ReturnType<typeof html2pdf>;
    from(element: HTMLElement): ReturnType<typeof html2pdf>;
    save(): Promise<void>;
  };
  export default html2pdf;
}
