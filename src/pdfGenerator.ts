import jsPDF from 'jspdf';
import { CaslonGradReg } from './fonts/CaslonGrad-Regular.js';
import { IbarraRealNovaBold } from './fonts/IbarraRealNova-Bold.js';
import titlepage from './assets/bam-spark-1.png';
import secondpage from './assets/bam-spark-2.png';
import title1Core from './assets/title1-core-essence.png';
import title2Messaging from './assets/title2-messaging.png';
import title3Audience from './assets/title3-audience.png';
import smallLogo from './assets/black-logo.png';

interface PdfOptions {
  brandName: string;
  reportParts: string[];
  phaseName: string;
}

const linkConfigs = [
  { 
    phrase: "Brand Alchemy Mastery course", 
    url: "https://dfl0.us/s/ab4d2c7a?em=%7B%7Bcontact.email%7D%7D" 
  },
  { 
    phrase: "Let's get you there", 
    url: "https://dfl0.us/s/ab4d2c7a?em=%7B%7Bcontact.email%7D%7D" 
  }
];

// Enhanced markdown table normalization with better error handling
function normalizeMarkdownTables(markdown: string): string {
  const tablePattern = /(\|.*\|)\n(\|[-:|]+\|)/g;
  
  return markdown.replace(tablePattern, (_, headerRow) => {
    const headerCols = headerRow.split('|').filter(Boolean);
    const properSeparator = '|' + headerCols.map(() => '-------------').join('|') + '|';
    return headerRow + '\n' + properSeparator;
  });
}

// Get appropriate title page based on phase
const getTitlePage = (phaseName: string): string => {
  switch (phaseName.toLowerCase()) {
    case 'discovery':
      return title1Core;
    case 'messaging':
      return title2Messaging;
    case 'audience':
      return title3Audience;
    case 'complete brand analysis':
    case 'brand spark analysis':
      return titlepage;
    default:
      return titlepage;
  }
};

// Enhanced text processing with FIXED heading overflow and better wrapping
const processTextLine = (
  pdf: jsPDF,
  line: string,
  x: number,
  y: number,
  usableWidth: number,
): { y: number; newPage: boolean } => {
  const heading1Regex = /^# (.*)/;
  const heading2Regex = /^## (.*)/;
  const heading3Regex = /^### (.*)/;
  const heading4Regex = /^#### (.*)/;
  const boldTextRegex = /\*\*(.*?)\*\*/g;
  const bulletRegex = /^[\s]*[-*]\s+(.*)/;
  const numberedRegex = /^[\s]*(\d+)\.\s+(.*)/;
  const margin = 45;
  const pageHeight = pdf.internal.pageSize.getHeight();
  const footerHeight = 80;
  const effectivePageHeight = pageHeight - footerHeight;

  // Enhanced page break logic with orphan/widow prevention
  const checkForPageBreak = (requiredHeight: number, lineHeight: number = 20): number => {
    const remainingSpace = effectivePageHeight - y;
    
    if (remainingSpace < requiredHeight) {
      if (remainingSpace < lineHeight * 2.5) {
        pdf.addPage();
        return margin;
      } else if (requiredHeight <= lineHeight && remainingSpace >= requiredHeight) {
        const linesOnCurrentPage = Math.floor((y - margin) / lineHeight);
        if (linesOnCurrentPage < 2) {
          pdf.addPage();
          return margin;
        }
        return y;
      } else {
        pdf.addPage();
        return margin;
      }
    }
    
    return y;
  };

  // FIXED: Enhanced heading processing with proper text wrapping
  if (heading1Regex.test(line)) {
    const text = (line.match(heading1Regex)?.[1] || '').replace(/\*\*(.*?)\*\*/g, '$1');
    
    // Check if heading fits on one line
    pdf.setFont('CaslonGrad-Regular', 'normal');
    pdf.setFontSize(28);
    
    const textWidth = pdf.getTextWidth(text);
    if (textWidth > usableWidth) {
      // FIXED: Wrap long headings properly
      const wrappedLines = pdf.splitTextToSize(text, usableWidth);
      const totalHeight = wrappedLines.length * 35 + 10; // Line height + spacing
      
      y = checkForPageBreak(totalHeight, 35);
      
      pdf.setTextColor(0, 0, 0);
      wrappedLines.forEach((wrappedLine: string, index: number) => {
        pdf.text(wrappedLine, x, y + (index * 35));
      });
      
      return { y: y + (wrappedLines.length * 35) + 10, newPage: false };
    } else {
      // Original single-line logic
      const requiredHeight = 60;
      y = checkForPageBreak(requiredHeight, 30);
      
      pdf.setTextColor(0, 0, 0);
      pdf.text(text, x, y);
      return { y: y + 35, newPage: false };
    }
  }

  // FIXED: Enhanced heading 2 with wrapping
  if (heading2Regex.test(line)) {
    const text = (line.match(heading2Regex)?.[1] || '').replace(/\*\*(.*?)\*\*/g, '$1');
    
    pdf.setFont('CaslonGrad-Regular', 'normal');
    pdf.setFontSize(20);
    
    const textWidth = pdf.getTextWidth(text);
    if (textWidth > usableWidth) {
      const wrappedLines = pdf.splitTextToSize(text, usableWidth);
      const totalHeight = wrappedLines.length * 28 + 8;
      
      y = checkForPageBreak(totalHeight, 28);
      
      pdf.setTextColor(0, 0, 0);
      wrappedLines.forEach((wrappedLine: string, index: number) => {
        pdf.text(wrappedLine, x, y + (index * 28));
      });
      
      return { y: y + (wrappedLines.length * 28) + 8, newPage: false };
    } else {
      const requiredHeight = 45;
      y = checkForPageBreak(requiredHeight, 25);
      
      pdf.setTextColor(0, 0, 0);
      pdf.text(text, x, y);
      return { y: y + 25, newPage: false };
    }
  }

  // FIXED: Enhanced heading 3 with wrapping
  if (heading3Regex.test(line)) {
    const text = (line.match(heading3Regex)?.[1] || '').replace(/\*\*(.*?)\*\*/g, '$1');
    
    pdf.setFont('CaslonGrad-Regular', 'normal');
    pdf.setFontSize(16);
    
    const textWidth = pdf.getTextWidth(text);
    if (textWidth > usableWidth) {
      const wrappedLines = pdf.splitTextToSize(text, usableWidth);
      const totalHeight = wrappedLines.length * 24 + 6;
      
      y = checkForPageBreak(totalHeight, 24);
      
      pdf.setTextColor(0, 0, 0);
      wrappedLines.forEach((wrappedLine: string, index: number) => {
        pdf.text(wrappedLine, x, y + (index * 24));
      });
      
      return { y: y + (wrappedLines.length * 24) + 6, newPage: false };
    } else {
      const requiredHeight = 40;
      y = checkForPageBreak(requiredHeight, 22);
      
      pdf.setTextColor(0, 0, 0);
      pdf.text(text, x, y);
      return { y: y + 18, newPage: false };
    }
  }

  // FIXED: Enhanced heading 4 with wrapping
  if (heading4Regex.test(line)) {
    const text = (line.match(heading4Regex)?.[1] || '').replace(/\*\*(.*?)\*\*/g, '$1');
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    
    const textWidth = pdf.getTextWidth(text);
    if (textWidth > usableWidth) {
      const wrappedLines = pdf.splitTextToSize(text, usableWidth);
      const totalHeight = wrappedLines.length * 20 + 5;
      
      y = checkForPageBreak(totalHeight, 20);
      
      pdf.setTextColor(0, 0, 0);
      wrappedLines.forEach((wrappedLine: string, index: number) => {
        pdf.text(wrappedLine, x, y + (index * 20));
      });
      
      return { y: y + (wrappedLines.length * 20) + 5, newPage: false };
    } else {
      const requiredHeight = 35;
      y = checkForPageBreak(requiredHeight, 20);
      
      pdf.setTextColor(0, 0, 0);
      pdf.text(text, x, y);
      return { y: y + 15, newPage: false };
    }
  }

  // Enhanced table processing with better formatting
  const tableRegex = /^\|(.*)\|$/;
  if (tableRegex.test(line)) {
    const cellPadding = 8;
    const tableWidth = usableWidth;
    
    const cells = line.split('|').filter(cell => cell.trim() !== '');
    
    const isSeparatorRow = line.includes('|-') && line.includes('-|');
    if (isSeparatorRow) {
      return { y, newPage: false };
    }
    
    const isHeaderRow = cells.some(cell => {
      const trimmedCell = cell.trim();
      const matchesKeywords = /\b(recommendation|impact|effort|priority|action|description|timeline)\b/i.test(trimmedCell);
      return matchesKeywords && trimmedCell.length < 25;
    });
    
    if (!isSeparatorRow) {
      const colWidths: number[] = [];
      const colCount = cells.length;
      
      if (colCount === 4) {
        colWidths[0] = tableWidth * 0.45;
        colWidths[1] = tableWidth * 0.18;
        colWidths[2] = tableWidth * 0.18;
        colWidths[3] = tableWidth * 0.19;
      } else if (colCount === 3) {
        colWidths[0] = tableWidth * 0.5;
        colWidths[1] = tableWidth * 0.25;
        colWidths[2] = tableWidth * 0.25;
      } else {
        for (let i = 0; i < colCount; i++) {
          colWidths[i] = tableWidth / colCount;
        }
      }
      
      const baseRowHeight = 32;
      const firstCellText = cells[0] ? cells[0].replace(/\*\*(.*?)\*\*/g, '$1').trim() : '';
      const estimatedLines = Math.max(1, Math.ceil(firstCellText.length / 40));
      const rowHeight = Math.max(baseRowHeight, estimatedLines * 14);
      
      y = checkForPageBreak(rowHeight, baseRowHeight);
      
      let xPosition = margin;
      
      cells.forEach((cellContent, i) => {
        const colWidth = colWidths[i] || (tableWidth / colCount);
        
        if (isHeaderRow) {
          pdf.setFillColor(245, 245, 245);
          pdf.rect(xPosition, y - 18, colWidth, rowHeight, 'F');
        }
        
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.rect(xPosition, y - 18, colWidth, rowHeight, 'S');
        
        let textToRender = cellContent.trim().replace(/\*\*(.*?)\*\*/g, '$1');
        
        if (isHeaderRow) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(12);
          pdf.setTextColor(50, 50, 50);
        } else {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(11);
          pdf.setTextColor(80, 80, 80);
        }
        
        if (i === 0 && !isHeaderRow) {
          const maxWidth = colWidth - (cellPadding * 2);
          const wrappedText = pdf.splitTextToSize(textToRender, maxWidth);
          const totalTextHeight = wrappedText.length * 12;
          const yOffset = Math.max(0, (rowHeight - totalTextHeight) / 2) + 5;
          
          wrappedText.forEach((textLine: string, lineIndex: number) => {
            pdf.text(textLine, xPosition + cellPadding, y - 18 + yOffset + cellPadding + (lineIndex * 12));
          });
        } else {
          const textWidth = pdf.getTextWidth(textToRender);
          const xPos = xPosition + (colWidth - textWidth) / 2;
          const yPos = y - 18 + (rowHeight / 2) + 4;
          pdf.text(textToRender, xPos, yPos);
        }
        
        xPosition += colWidth;
      });
      
      y += rowHeight + 2;
    }
    
    return { y, newPage: false };
  }

  // Enhanced numbered list processing with proper indentation
  const numberedMatch = line.match(numberedRegex);
  if (numberedMatch) {
    const number = numberedMatch[1];
    const content = numberedMatch[2];
    const indent = (line.length - line.trimStart().length) * 3;
    const numberIndent = 15 + indent;
    const textIndent = 35 + indent;
    const lineHeight = 18;
    
    y = checkForPageBreak(lineHeight * 2);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.setTextColor(60, 60, 60);
    
    pdf.text(`${number}.`, x + numberIndent, y);
    
    const wrappedLines = pdf.splitTextToSize(content, usableWidth - textIndent - 10);
    for (let i = 0; i < wrappedLines.length; i++) {
      const wrappedLine = wrappedLines[i];
      if (i > 0) {
        y += lineHeight;
        y = checkForPageBreak(lineHeight);
      }
      addFormattedTextWithBold(pdf, wrappedLine, x + textIndent, y);
    }
    
    return { y: y + lineHeight + 6, newPage: false };
  }

  // Enhanced bullet point processing with consistent indentation
  if (bulletRegex.test(line)) {
    const match = line.match(bulletRegex);
    if (match) {
      const content = match[1];
      const indent = (line.length - line.trimStart().length) * 3;
      const bulletIndent = 15 + indent;
      const textIndent = 28 + indent;
      const lineHeight = 18;
      
      y = checkForPageBreak(lineHeight * 2);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      pdf.setTextColor(60, 60, 60);
      pdf.text('•', x + bulletIndent, y);
      
      const wrappedLines = pdf.splitTextToSize(content, usableWidth - textIndent - 10);
      for (let i = 0; i < wrappedLines.length; i++) {
        const wrappedLine = wrappedLines[i];
        if (i > 0) {
          y += lineHeight;
          y = checkForPageBreak(lineHeight);
        }
        addFormattedTextWithBold(pdf, wrappedLine, x + textIndent, y);
      }
      
      return { y: y + lineHeight + 6, newPage: false };
    }
  }

  // Enhanced regular text processing with better typography
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.setTextColor(70, 70, 70);
  const lineHeight = 22;

  const wrappedLines = pdf.splitTextToSize(line, usableWidth);
  let newPage = false;

  for (const wrappedLine of wrappedLines) {
    y = checkForPageBreak(lineHeight);
    
    if (linkConfigs.some(config => wrappedLine.includes(config.phrase))) {
      addHyperlinkToText(pdf, wrappedLine, x, y, linkConfigs);
    } else {
      addFormattedTextWithBold(pdf, wrappedLine, x, y);
    }

    y += lineHeight;
    newPage = y > effectivePageHeight;
  }

  return { y: y + 4, newPage };
};

// Enhanced text formatting with improved bold support and spacing
const addFormattedTextWithBold = (pdf: jsPDF, text: string, x: number, y: number) => {
  const boldTextRegex = /\*\*(.*?)\*\*/g;
  let currentX = x;
  let lastIndex = 0;
  let match;

  boldTextRegex.lastIndex = 0;

  while ((match = boldTextRegex.exec(text)) !== null) {
    const beforeBold = text.substring(lastIndex, match.index);
    if (beforeBold) {
      pdf.setFont('helvetica', 'normal');
      pdf.text(beforeBold, currentX, y);
      currentX += pdf.getTextWidth(beforeBold);
    }
    
    const boldText = match[1];
    pdf.setFont('helvetica', 'bold');
    pdf.text(boldText, currentX, y);
    currentX += pdf.getTextWidth(boldText);
    
    lastIndex = match.index + match[0].length;
  }
  
  const remaining = text.substring(lastIndex);
  if (remaining) {
    pdf.setFont('helvetica', 'normal');
    pdf.text(remaining, currentX, y);
  }
  
  if (lastIndex === 0) {
    pdf.setFont('helvetica', 'normal');
    pdf.text(text, x, y);
  }
};

// Enhanced hyperlink support with better styling
const addHyperlinkToText = (
  pdf: jsPDF,
  text: string, 
  x: number, 
  y: number, 
  linkConfigs: Array<{
    phrase: string,
    url: string
  }>
) => {
  if (linkConfigs.length === 0) {
    addFormattedTextWithBold(pdf, text, x, y);
    return;
  }

  const sortedConfigs = [...linkConfigs].sort((a, b) => {
    return text.indexOf(a.phrase) - text.indexOf(b.phrase);
  });
  
  const validConfigs = sortedConfigs.filter(config => text.indexOf(config.phrase) !== -1);
  if (validConfigs.length === 0) {
    addFormattedTextWithBold(pdf, text, x, y);
    return;
  }

  let currentX = x;
  let remainingText = text;
  let processedLength = 0;

  for (const config of validConfigs) {
    const { phrase, url } = config;
    const phraseIndex = remainingText.indexOf(phrase);
    
    if (phraseIndex === -1) continue;

    const beforeText = remainingText.substring(0, phraseIndex);
    if (beforeText) {
      pdf.setTextColor(70, 70, 70);
      addFormattedTextWithBold(pdf, beforeText, currentX, y);
      currentX += pdf.getTextWidth(beforeText.replace(/\*\*(.*?)\*\*/g, '$1'));
    }
    
    pdf.setTextColor(0, 102, 204);
    pdf.setFont('helvetica', 'normal');
    pdf.text(phrase, currentX, y);
    
    const linkWidth = pdf.getTextWidth(phrase);
    pdf.link(currentX, y - 12, linkWidth, 14, { url });
    
    pdf.setDrawColor(0, 102, 204);
    pdf.setLineWidth(0.3);
    pdf.line(currentX, y + 1, currentX + linkWidth, y + 1);
    
    currentX += linkWidth;
    processedLength += beforeText.length + phrase.length;
    remainingText = text.substring(processedLength);
  }
  
  if (remainingText) {
    pdf.setTextColor(70, 70, 70);
    addFormattedTextWithBold(pdf, remainingText, currentX, y);
  }
};

// Enhanced brand name rendering with better typography and positioning
const renderBrandNameOnTitlePage = (pdf: jsPDF, brandName: string, pageWidth: number, pageHeight: number) => {
  pdf.setFont('IbarraRealNova-Bold', 'bold');
  pdf.setFontSize(36);
  pdf.setTextColor(255, 255, 255);

  const maxWidth = pageWidth * 0.75;
  const brandNameLines = pdf.splitTextToSize(brandName.toUpperCase(), maxWidth);
  
  const lineHeight = 40;
  const totalHeight = brandNameLines.length * lineHeight;
  let startY = pageHeight * 0.84 - (totalHeight / 2);
  
  if (startY + totalHeight > pageHeight * 0.94) {
    startY = pageHeight * 0.94 - totalHeight;
  }
  
  if (startY < pageHeight * 0.68) {
    startY = pageHeight * 0.68;
  }

  brandNameLines.forEach((line: string, index: number) => {
    const lineWidth = pdf.getTextWidth(line);
    const xPosition = (pageWidth - lineWidth) / 2;
    const yPosition = startY + (index * lineHeight);
    
    pdf.setTextColor(0, 0, 0, 0.3);
    pdf.text(line, xPosition + 1, yPosition + 1);
    
    pdf.setTextColor(255, 255, 255);
    pdf.text(line, xPosition, yPosition);
  });
};

export const generatePDF = async ({ brandName, reportParts, phaseName }: PdfOptions): Promise<void> => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  console.log('Generating enhanced PDF report for:', phaseName);

  pdf.addFileToVFS('CaslonGrad-Regular.ttf', CaslonGradReg);
  pdf.addFileToVFS('IbarraRealNova-Bold.ttf', IbarraRealNovaBold);
  pdf.addFont('CaslonGrad-Regular.ttf', 'CaslonGrad-Regular', 'normal');
  pdf.addFont('IbarraRealNova-Bold.ttf', 'IbarraRealNova-Bold', 'bold');

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 50;
  const usableWidth = pageWidth - 2 * margin;
  
  const isFinalReport = phaseName.toLowerCase().includes('complete') || 
                       phaseName.toLowerCase().includes('brand spark');

  const titlePageImage = getTitlePage(phaseName);
  pdf.addImage(titlePageImage, 'PNG', 0, 0, pageWidth, pageHeight);
  
  renderBrandNameOnTitlePage(pdf, brandName, pageWidth, pageHeight);

  if (isFinalReport) {
    pdf.addPage();
    pdf.addImage(secondpage, 'PNG', 0, 0, pageWidth, pageHeight);
  }

  pdf.addPage();
  pdf.setTextColor(0, 0, 0);

  reportParts.forEach((reportContent, index) => {
    const normalizedContent = normalizeMarkdownTables(reportContent);
    
    let yPosition = margin + 20;

    if (index > 0) {
      pdf.addPage();
      yPosition = margin + 20;
    }

    const lines = normalizedContent.split('\n');
    lines.forEach(line => {
      const { y, newPage } = processTextLine(pdf, line, margin, yPosition, usableWidth);
      yPosition = y;

      if (newPage) {
        pdf.addPage();
        yPosition = margin + 20;
      }
    });
  });

  if (isFinalReport) {
    const pageCount = pdf.getNumberOfPages();
    const logoHeight = 0.28 * margin;
    const logoWidth = 2.5 * margin;
    
    for (let i = 3; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(120, 120, 120);
      
      const pageNumber = `${i - 2} of ${pageCount - 2}`;
      pdf.text(pageNumber, margin, pageHeight - margin / 2 + 5, { align: 'left' });
      
      pdf.addImage(smallLogo, 'PNG', 
        pageWidth - logoWidth - margin, 
        pageHeight - logoHeight - margin / 2, 
        logoWidth, 
        logoHeight
      );
    }
  }

  const sanitizedPhaseName = phaseName.toLowerCase()
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
    
  const sanitizedBrandName = brandName.toLowerCase()
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 30);
  
  const fileName = `${sanitizedBrandName}-${sanitizedPhaseName}.pdf`;
  
  try {
    pdf.save(fileName);
    console.log('PDF generated successfully:', fileName);
  } catch (error) {
    console.error('Error saving PDF:', error);
    throw new Error('Failed to generate PDF file');
  }
};