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

// Enhanced markdown table normalization
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

// Enhanced text processing with proper bold formatting
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
  const margin = 45;
  const pageHeight = pdf.internal.pageSize.getHeight();
  const footerHeight = 80; // Increased footer space
  const effectivePageHeight = pageHeight - footerHeight;

  // Enhanced page break logic
  const checkForPageBreak = (requiredHeight: number, lineHeight: number = 20): number => {
    const remainingSpace = effectivePageHeight - y;
    
    if (remainingSpace < requiredHeight) {
      // Improved logic for preventing orphans and widows
      if (remainingSpace < lineHeight * 2) {
        // Not enough space for at least 2 lines
        pdf.addPage();
        return margin;
      } else if (requiredHeight <= lineHeight && remainingSpace >= requiredHeight) {
        // Single line that fits, but check if it creates an orphan
        const linesOnCurrentPage = Math.floor((y - margin) / lineHeight);
        if (linesOnCurrentPage < 2) {
          // Would create orphan, move to next page
          pdf.addPage();
          return margin;
        }
        return y;
      } else {
        // Multi-line content that doesn't fit
        pdf.addPage();
        return margin;
      }
    }
    
    return y;
  };

  // Process headings with proper spacing
  if (heading1Regex.test(line)) {
    const requiredHeight = 50;
    y = checkForPageBreak(requiredHeight, 25);
    
    pdf.setFont('CaslonGrad-Regular', 'normal');
    pdf.setFontSize(24);
    const text = (line.match(heading1Regex)?.[1] || '').replace(/\*\*(.*?)\*\*/g, '$1');
    pdf.text(text, x, y);
    return { y: y + 40, newPage: false };
  }

  if (heading2Regex.test(line)) {
    const requiredHeight = 40;
    y = checkForPageBreak(requiredHeight, 20);
    
    pdf.setFont('CaslonGrad-Regular', 'normal');
    pdf.setFontSize(18);
    const text = (line.match(heading2Regex)?.[1] || '').replace(/\*\*(.*?)\*\*/g, '$1');
    pdf.text(text, x, y);
    return { y: y + 30, newPage: false };
  }

  if (heading3Regex.test(line)) {
    const requiredHeight = 35;
    y = checkForPageBreak(requiredHeight, 18);
    
    pdf.setFont('CaslonGrad-Regular', 'normal');
    pdf.setFontSize(14);
    const text = (line.match(heading3Regex)?.[1] || '').replace(/\*\*(.*?)\*\*/g, '$1');
    pdf.text(text, x, y);
    return { y: y + 25, newPage: false };
  }

  if (heading4Regex.test(line)) {
    const requiredHeight = 30;
    y = checkForPageBreak(requiredHeight, 16);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    const text = (line.match(heading4Regex)?.[1] || '').replace(/\*\*(.*?)\*\*/g, '$1');
    pdf.text(text, x, y);
    return { y: y + 22, newPage: false };
  }

  // Enhanced table processing
  const tableRegex = /^\|(.*)\|$/;
  if (tableRegex.test(line)) {
    const cellPadding = 5;
    const tableWidth = usableWidth;
    
    const cells = line.split('|').filter(cell => cell.trim() !== '');
    
    const isSeparatorRow = line.includes('|-') && line.includes('-|');
    if (isSeparatorRow) {
      return { y, newPage: false };
    }
    
    const isHeaderRow = cells.some(cell => {
      const trimmedCell = cell.trim();
      const matchesKeywords = /\b(recommendation|impact|effort|priority|action|description|timeline)\b/i.test(trimmedCell);
      return matchesKeywords && trimmedCell.length < 20;
    });
    
    if (!isSeparatorRow) {
      const colWidths: number[] = [];
      const colCount = cells.length;
      
      if (colCount === 4) {
        colWidths[0] = tableWidth * 0.5;
        colWidths[1] = tableWidth * 0.15;
        colWidths[2] = tableWidth * 0.15;
        colWidths[3] = tableWidth * 0.2;
      } else if (colCount === 3) {
        colWidths[0] = tableWidth * 0.5;
        colWidths[1] = tableWidth * 0.25;
        colWidths[2] = tableWidth * 0.25;
      } else {
        for (let i = 0; i < colCount; i++) {
          colWidths[i] = tableWidth / colCount;
        }
      }
      
      const baseRowHeight = 28;
      const firstCellText = cells[0] ? cells[0].replace(/\*\*(.*?)\*\*/g, '$1').trim() : '';
      const estimatedLines = Math.max(1, Math.ceil(pdf.getTextWidth(firstCellText) / (colWidths[0] - cellPadding * 2) * 10));
      const rowHeight = Math.max(baseRowHeight, estimatedLines * 12);
      
      y = checkForPageBreak(rowHeight, baseRowHeight);
      
      let xPosition = margin;
      
      cells.forEach((cellContent, i) => {
        const colWidth = colWidths[i] || (tableWidth / colCount);
        
        if (isHeaderRow) {
          pdf.setFillColor(240, 240, 240);
          pdf.rect(xPosition, y - 15, colWidth, rowHeight, 'F');
        }
        
        pdf.setDrawColor(180, 180, 180);
        pdf.rect(xPosition, y - 15, colWidth, rowHeight, 'S');
        
        // Enhanced text rendering with bold support
        let textToRender = cellContent.trim().replace(/\*\*(.*?)\*\*/g, '$1');
        
        if (isHeaderRow) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(11);
        } else {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
        }
        
        if (i === 0 && !isHeaderRow) {
          const maxWidth = colWidth - (cellPadding * 2);
          const wrappedText = pdf.splitTextToSize(textToRender, maxWidth);
          const totalTextHeight = wrappedText.length * 11;
          const yOffset = Math.max(0, (rowHeight - totalTextHeight) / 2) + 3;
          
          wrappedText.forEach((textLine: string, lineIndex: number) => {
            pdf.text(textLine, xPosition + cellPadding, y - 15 + yOffset + cellPadding + (lineIndex * 11));
          });
        } else {
          const textWidth = pdf.getTextWidth(textToRender);
          const xPos = xPosition + (colWidth - textWidth) / 2;
          const yPos = y - 15 + (rowHeight / 2) + 3;
          pdf.text(textToRender, xPos, yPos);
        }
        
        xPosition += colWidth;
      });
      
      y += rowHeight;
    }
    
    return { y, newPage: false };
  }

  // Enhanced bullet point processing
  const bulletRegex = /^[\s]*[-*]\s+(.*)/;
  if (bulletRegex.test(line)) {
    const match = line.match(bulletRegex);
    if (match) {
      const content = match[1];
      const indent = (line.length - line.trimStart().length) * 2;
      const bulletIndent = 15 + indent;
      const textIndent = 25 + indent;
      const lineHeight = 18;
      
      y = checkForPageBreak(lineHeight);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      pdf.text('•', x + bulletIndent, y);
      
      const wrappedLines = pdf.splitTextToSize(content, usableWidth - textIndent);
      for (let i = 0; i < wrappedLines.length; i++) {
        const wrappedLine = wrappedLines[i];
        if (i > 0) {
          y += lineHeight;
          y = checkForPageBreak(lineHeight);
        }
        addFormattedTextWithBold(pdf, wrappedLine, x + textIndent, y);
      }
      
      return { y: y + lineHeight + 5, newPage: false };
    }
  }

  // Regular text with enhanced bold formatting
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  const lineHeight = 20;

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

  return { y: y + 5, newPage };
};

// Enhanced text formatting with proper bold support
const addFormattedTextWithBold = (pdf: jsPDF, text: string, x: number, y: number) => {
  const boldTextRegex = /\*\*(.*?)\*\*/g;
  let currentX = x;
  let lastIndex = 0;
  let match;

  boldTextRegex.lastIndex = 0;

  while ((match = boldTextRegex.exec(text)) !== null) {
    // Text before bold section
    const beforeBold = text.substring(lastIndex, match.index);
    if (beforeBold) {
      pdf.setFont('helvetica', 'normal');
      pdf.text(beforeBold, currentX, y);
      currentX += pdf.getTextWidth(beforeBold);
    }
    
    // Bold text
    const boldText = match[1];
    pdf.setFont('helvetica', 'bold');
    pdf.text(boldText, currentX, y);
    currentX += pdf.getTextWidth(boldText);
    
    lastIndex = match.index + match[0].length;
  }
  
  // Remaining text after last bold section
  const remaining = text.substring(lastIndex);
  if (remaining) {
    pdf.setFont('helvetica', 'normal');
    pdf.text(remaining, currentX, y);
  }
  
  // If no bold text was found, render normally
  if (lastIndex === 0) {
    pdf.setFont('helvetica', 'normal');
    pdf.text(text, x, y);
  }
};

// Enhanced hyperlink support
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
      pdf.setTextColor(0, 0, 0);
      addFormattedTextWithBold(pdf, beforeText, currentX, y);
      currentX += pdf.getTextWidth(beforeText.replace(/\*\*(.*?)\*\*/g, '$1'));
    }
    
    pdf.setTextColor(0, 102, 204);
    pdf.setFont('helvetica', 'normal');
    pdf.text(phrase, currentX, y);
    
    const linkWidth = pdf.getTextWidth(phrase);
    pdf.link(currentX, y - 10, linkWidth, 12, { url });
    
    currentX += linkWidth;
    processedLength += beforeText.length + phrase.length;
    remainingText = text.substring(processedLength);
  }
  
  if (remainingText) {
    pdf.setTextColor(0, 0, 0);
    addFormattedTextWithBold(pdf, remainingText, currentX, y);
  }
};

// Enhanced brand name rendering with proper wrapping
const renderBrandNameOnTitlePage = (pdf: jsPDF, brandName: string, pageWidth: number, pageHeight: number) => {
  pdf.setFont('IbarraRealNova-Bold', 'bold');
  pdf.setFontSize(32);
  pdf.setTextColor(255, 255, 255);

  const maxWidth = pageWidth * 0.8; // Use 80% of page width for safety margin
  const brandNameLines = pdf.splitTextToSize(brandName.toUpperCase(), maxWidth);
  
  // Calculate starting Y position to center the text block
  const lineHeight = 35;
  const totalHeight = brandNameLines.length * lineHeight;
  let startY = pageHeight * 0.85 - (totalHeight / 2);
  
  // Ensure we don't go below the page
  if (startY + totalHeight > pageHeight * 0.95) {
    startY = pageHeight * 0.95 - totalHeight;
  }
  
  // Ensure we don't go above reasonable position
  if (startY < pageHeight * 0.7) {
    startY = pageHeight * 0.7;
  }

  brandNameLines.forEach((line: string, index: number) => {
    const lineWidth = pdf.getTextWidth(line);
    const xPosition = (pageWidth - lineWidth) / 2;
    const yPosition = startY + (index * lineHeight);
    pdf.text(line, xPosition, yPosition);
  });
};

export const generatePDF = async ({ brandName, reportParts, phaseName }: PdfOptions): Promise<void> => {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  console.log('Generating PDF report for:', phaseName);

  // Add custom fonts
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

  // Add title page with enhanced brand name rendering
  const titlePageImage = getTitlePage(phaseName);
  pdf.addImage(titlePageImage, 'PNG', 0, 0, pageWidth, pageHeight);
  
  // Enhanced brand name rendering that properly wraps
  renderBrandNameOnTitlePage(pdf, brandName, pageWidth, pageHeight);

  // Add second page only for final report
  if (isFinalReport) {
    pdf.addPage();
    pdf.addImage(secondpage, 'PNG', 0, 0, pageWidth, pageHeight);
  }

  // Start content on a new page
  pdf.addPage();
  pdf.setTextColor(0, 0, 0);

  // Process each report part with enhanced formatting
  reportParts.forEach((reportContent, index) => {
    const normalizedContent = normalizeMarkdownTables(reportContent);
    
    let yPosition = margin;

    if (index > 0) {
      pdf.addPage();
      yPosition = margin;
    }

    const lines = normalizedContent.split('\n');
    lines.forEach(line => {
      const { y, newPage } = processTextLine(pdf, line, margin, yPosition, usableWidth);
      yPosition = y;

      if (newPage) {
        pdf.addPage();
        yPosition = margin;
      }
    });
  });

  // Add footer with page numbers and logo only for final report
  if (isFinalReport) {
    const pageCount = pdf.getNumberOfPages();
    const logoHeight = 0.25 * margin;
    const logoWidth = 2.34 * margin;
    
    for (let i = 3; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.setFont('CaslonGrad-Regular', 'normal');
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${i - 2} of ${pageCount - 2}`, margin, pageHeight - margin / 2, { align: 'left' });
      pdf.addImage(smallLogo, 'PNG', pageWidth - logoWidth - margin, pageHeight - logoHeight - margin / 2, logoWidth, logoHeight);
    }
  }

  // Generate safer filename with shorter brand names
  const sanitizedPhaseName = phaseName.toLowerCase().replace(/\s+/g, '-');
  const sanitizedBrandName = brandName.toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .substring(0, 30); // Limit length to prevent extremely long filenames
  
  const fileName = `${sanitizedBrandName}-${sanitizedPhaseName}.pdf`;
  pdf.save(fileName);
};