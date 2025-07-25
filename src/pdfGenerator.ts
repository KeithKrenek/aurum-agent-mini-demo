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

// Helper function to normalize markdown tables before PDF generation
function normalizeMarkdownTables(markdown: string): string {
  // Find table sections in the markdown
  const tablePattern = /(\|.*\|)\n(\|[-:|]+\|)/g;
  
  return markdown.replace(tablePattern, (_, headerRow) => {
    // Extract header columns (remove empty elements from splitting the string)
    const headerCols = headerRow.split('|').filter(Boolean);
    
    // Generate consistent separator row with proper formatting
    const properSeparator = '|' + headerCols.map(() => '-------------').join('|') + '|';
    
    return headerRow + '\n' + properSeparator;
  });
}

// Helper function to get the title page image based on phase
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

// Process text with bold headings and inline bold content
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
  const footerHeight = 60; // Increased to ensure ample space for footer
  const effectivePageHeight = pageHeight - footerHeight;

  // Function to handle page breaks
  const checkForPageBreak = (requiredHeight: number, lineHeight: number = 20): number => {
    const remainingSpace = effectivePageHeight - y;
    
    // If there's not enough space for the current line
    if (remainingSpace < requiredHeight) {
      // If there's very little space left (less than 1.5 lines), consider it too small
      // for the current line and possibly move more content to the next page
      if (remainingSpace < lineHeight * 1.5 && requiredHeight <= lineHeight) {
        // This is a single line that would create an orphan
        // Check if we have at least 2 lines on the current page
        const linesOnCurrentPage = Math.floor((y - margin) / lineHeight);
        
        if (linesOnCurrentPage >= 2) {
          // We have enough content on this page, so we can move to the next
          pdf.addPage();
          return margin;
        } else {
          // Try to squeeze the line onto the current page by reducing spacing
          // (only if it's a single line that's close to fitting)
          if (requiredHeight <= lineHeight && remainingSpace >= requiredHeight * 0.8) {
            // Squeeze it in by returning the current position
            return y;
          }
          
          // Otherwise, move to a new page
          pdf.addPage();
          return margin;
        }
      } else {
        // Normal page break case - not enough space and not a single line
        pdf.addPage();
        return margin;
      }
    }
    
    // Enough space, no page break needed
    return y;
  };

  // Top-level heading
  if (heading1Regex.test(line)) {
    const requiredHeight = 40; // Height needed for heading
    const lineHeight = 20; // Default line height
    y = checkForPageBreak(requiredHeight, lineHeight);
    
    pdf.setFont('CaslonGrad-Regular', 'normal');
    pdf.setFontSize(24);
    const text = line.match(heading1Regex)?.[1] || '';
    pdf.text(text, x, y);
    return { y: y + requiredHeight, newPage: false };
  }

  // Sub-level heading
  if (heading2Regex.test(line)) {
    const requiredHeight = 30;
    y = checkForPageBreak(requiredHeight);
    
    pdf.setFont('CaslonGrad-Regular', 'normal');
    pdf.setFontSize(18);
    const text = line.match(heading2Regex)?.[1] || '';
    pdf.text(text, x, y);
    return { y: y + requiredHeight, newPage: false };
  }

  // Sub-sub-level heading
  if (heading3Regex.test(line)) {
    const requiredHeight = 30;
    y = checkForPageBreak(requiredHeight);
    
    pdf.setFont('CaslonGrad-Regular', 'normal');
    pdf.setFontSize(14);
    const text = line.match(heading3Regex)?.[1] || '';
    pdf.text(text, x, y);
    return { y: y + requiredHeight, newPage: false };
  }

  // Sub-sub-sub-level heading
  if (heading4Regex.test(line)) {
    const requiredHeight = 30;
    y = checkForPageBreak(requiredHeight);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    const text = line.match(heading4Regex)?.[1] || '';
    pdf.text(text, x, y);
    return { y: y + requiredHeight, newPage: false };
  }

  // Handle tables - detect and render tables from markdown format
  const tableRegex = /^\|(.*)\|$/;
  if (tableRegex.test(line)) {
    const cellPadding = 5;
    const tableWidth = usableWidth;
    
    // Parse table row
    const cells = line.split('|').filter(cell => cell.trim() !== '');
    
    // Check if this is a separator row (contains only dashes, colons and pipes)
    const isSeparatorRow = line.includes('|-') && line.includes('-|');
    if (isSeparatorRow) {
      // Skip rendering separator rows completely
      return { y, newPage: false };
    }
    
    // Determine if this is a header row
    // const isHeaderRow = cells.some(cell => 
    //   /recommendation|impact|effort|priority/i.test(cell.trim())
    // );
    const isHeaderRow = cells.some(cell => {
      const trimmedCell = cell.trim();
      const matchesKeywords = /\b(recommendation|impact|effort|priority)\b/i.test(trimmedCell);
      return matchesKeywords && trimmedCell.length < 15;
    });
    
    if (!isSeparatorRow) {
      // Define proportional column widths based on content type
      // First column (Recommendation) gets 50% of width, others split the rest
      const colWidths: number[] = [];
      const colCount = cells.length;
      
      if (colCount === 4) { // Standard prioritization matrix format
        colWidths[0] = tableWidth * 0.5; // Recommendation column (50%)
        colWidths[1] = tableWidth * 0.15; // Impact column (15%)
        colWidths[2] = tableWidth * 0.15; // Effort column (15%)
        colWidths[3] = tableWidth * 0.2;  // Priority column (20%)
      } else {
        // Fallback for other tables: distribute evenly
        for (let i = 0; i < colCount; i++) {
          colWidths[i] = tableWidth / colCount;
        }
      }
      
      // Row height calculation - use taller rows for the first column which may need wrapping
      const baseRowHeight = 25;
      const estimatedLines = Math.ceil(pdf.getTextWidth(cells[0]) / colWidths[0]) || 1;
      const rowHeight = Math.max(baseRowHeight, estimatedLines * 15); // 15px per text line
      
      // Check if we need a new page for this row
      y = checkForPageBreak(rowHeight, baseRowHeight);
      
      // Calculate positions
      let xPosition = margin;
      
      // Draw cells
      cells.forEach((cellContent, i) => {
        const colWidth = colWidths[i] || (tableWidth / colCount);
        
        // Set background color for header row
        if (isHeaderRow) {
          pdf.setFillColor(240, 240, 240); // Light gray background
          pdf.rect(
            xPosition, 
            y - 15, 
            colWidth, 
            rowHeight, 
            'F'
          );
        }
        
        // Draw cell border
        pdf.setDrawColor(180, 180, 180);
        pdf.rect(
          xPosition, 
          y - 15, 
          colWidth, 
          rowHeight, 
          'S'
        );
        
        // Format text based on cell type
        let textToRender = cellContent.trim();
        
        // Set font style based on cell type
        if (isHeaderRow) {
          pdf.setFont('CaslonGrad-Regular', 'normal');
          pdf.setFontSize(12);
        } else {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
        }
        
        // Handle text wrapping for the first column (recommendations)
        if (i === 0 && !isHeaderRow) {
          // Split text for wrapping if needed
          const maxWidth = colWidth - (cellPadding * 2);
          const wrappedText = pdf.splitTextToSize(textToRender, maxWidth);
          
          // Calculate vertical positioning to center text
          const totalTextHeight = wrappedText.length * 12; // 12px line height
          const yOffset = Math.max(0, (rowHeight - totalTextHeight) / 2) + 4; // Adjust for text baseline
          
          // Add each line with proper vertical centering
          wrappedText.forEach((textLine: string, lineIndex: number) => {
            pdf.text(
              textLine, 
              xPosition + cellPadding,
              y - 15 + yOffset + cellPadding + (lineIndex * 12)
            );
          });
        } else {
          // Center text for other columns
          const textWidth = pdf.getTextWidth(textToRender);
          const xPos = xPosition + (colWidth - textWidth) / 2;
          
          // Vertically center the text
          const yPos = y - 15 + (rowHeight / 2) + 4; // +4 is an adjustment for text baseline
          
          pdf.text(textToRender, xPos, yPos);
        }
        
        // Move to next cell position
        xPosition += colWidth;
      });
      
      y += rowHeight;
    }
    
    return { y, newPage: false };
  }

  // Handle bullet points
  const bulletRegex = /^[\s]*[-*]\s+(.*)/;
  if (bulletRegex.test(line)) {
    const match = line.match(bulletRegex);
    if (match) {
      const content = match[1];
      // Calculate indentation based on leading spaces
      const indent = (line.length - line.trimStart().length) * 2; // Adjust multiplier as needed
      const bulletIndent = 15 + indent;
      const textIndent = 25 + indent;
      const lineHeight = 18;
      
      y = checkForPageBreak(lineHeight);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      // Render the bullet point
      pdf.text('•', x + bulletIndent, y);
      
      // Split the content to handle wrapping
      const wrappedLines = pdf.splitTextToSize(content, usableWidth - textIndent);
      for (let i = 0; i < wrappedLines.length; i++) {
        const wrappedLine = wrappedLines[i];
        // For subsequent lines, ensure they start at the same indented position
        if (i > 0) {
          y += lineHeight;
           y = checkForPageBreak(lineHeight);
        }
        pdf.text(wrappedLine, x + textIndent, y);
      }
      
      return { y: y + lineHeight, newPage: false };
    }
  }

  // Regular text with inline bold content
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  const lineHeight = 20;

  const wrappedLines = pdf.splitTextToSize(line, usableWidth);
  let newPage = false;

  for (const wrappedLine of wrappedLines) {
    // Check if we need a new page for this line
    y = checkForPageBreak(lineHeight);
    
    // Check if this line contains the course mention for hyperlinking
    if (linkConfigs.some(config => wrappedLine.includes(config.phrase))) {
      // Handle line with hyperlink(s)
      addHyperlinkToText(pdf, wrappedLine, x, y, linkConfigs);
    } else {
      // Regular text processing with bold formatting
      let currentX = x;
      const segments = wrappedLine.split(boldTextRegex);
      
      segments.forEach((segment: string, index: number) => {
        if (index % 2 === 1) {
          // Bold text
          pdf.setFont('helvetica', 'bold');
        } else {
          // Regular text
          pdf.setFont('helvetica', 'normal');
        }
        
        pdf.text(segment, currentX, y);
        currentX += pdf.getTextWidth(segment) + 2;
      });
    }
  
    y += lineHeight;
    newPage = y > effectivePageHeight;
  }

  return { y, newPage };
};

// New version that supports multiple link phrases
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
  // If no links, just render text normally
  if (linkConfigs.length === 0) {
    pdf.text(text, x, y);
    return;
  }

  // Sort link configs by their position in the text (to handle them in order)
  const sortedConfigs = [...linkConfigs].sort((a, b) => {
    return text.indexOf(a.phrase) - text.indexOf(b.phrase);
  });
  
  // Check for invalid or non-existent phrases
  const validConfigs = sortedConfigs.filter(config => text.indexOf(config.phrase) !== -1);
  if (validConfigs.length === 0) {
    pdf.text(text, x, y);
    return;
  }

  let currentX = x;
  let remainingText = text;
  let processedLength = 0;

  // Process each segment
  for (const config of validConfigs) {
    const { phrase, url } = config;
    const phraseIndex = remainingText.indexOf(phrase);
    
    if (phraseIndex === -1) continue; // Skip if phrase not found in remaining text

    // Text before current link
    const beforeText = remainingText.substring(0, phraseIndex);
    if (beforeText) {
      pdf.setTextColor(0, 0, 0);
      pdf.text(beforeText, currentX, y);
      currentX += pdf.getTextWidth(beforeText);
    }
    
    // The linked text in blue
    pdf.setTextColor(0, 102, 204);
    pdf.text(phrase, currentX, y);
    
    // Add clickable link annotation
    const linkWidth = pdf.getTextWidth(phrase);
    pdf.link(currentX, y - 10, linkWidth, 12, { url });
    
    // Update position and remaining text
    currentX += linkWidth;
    processedLength += beforeText.length + phrase.length;
    remainingText = text.substring(processedLength);
  }
  
  // Render any remaining text after the last link
  if (remainingText) {
    pdf.setTextColor(0, 0, 0);
    pdf.text(remainingText, currentX, y);
  }
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
  
  // Determine if this is the final combined report
  const isFinalReport = phaseName.toLowerCase().includes('complete') || 
                       phaseName.toLowerCase().includes('brand spark');

  // Add appropriate title page
  const titlePageImage = getTitlePage(phaseName);
  pdf.addImage(titlePageImage, 'PNG', 0, 0, pageWidth, pageHeight);
  pdf.setFont('IbarraRealNova-Bold', 'bold');
  pdf.setFontSize(32);
  pdf.setTextColor(255, 255, 255);

  const brandNameWidth = pdf.getTextWidth(brandName.toUpperCase());
  pdf.text(brandName.toUpperCase(), (pageWidth - brandNameWidth) / 2, pageHeight * 0.9);

  // Add second page only for final report
  if (isFinalReport) {
    pdf.addPage();
    pdf.addImage(secondpage, 'PNG', 0, 0, pageWidth, pageHeight);
  }

  // Start content on a new page
  pdf.addPage();
  pdf.setTextColor(0, 0, 0);

  // Process each report part
  reportParts.forEach((reportContent, index) => {
    // Normalize tables in the content
    const normalizedContent = normalizeMarkdownTables(reportContent);
    
    let yPosition = margin;

    // Add a new page for each report part (except the first one)
    if (index > 0) {
      pdf.addPage();
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
    
    for (let i = 3; i <= pageCount; i++) { // Skip footer on cover page and second page
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.setFont('CaslonGrad-Regular', 'normal');
      pdf.text(`${i} of ${pageCount}`, margin, pageHeight - margin / 2, { align: 'left' });
      pdf.addImage(smallLogo, 'PNG', pageWidth - logoWidth - margin, pageHeight - logoHeight - margin / 2, logoWidth, logoHeight);
    }
  }

  // Save the PDF with dynamic phase-based name
  const sanitizedPhaseName = phaseName.toLowerCase().replace(/\s+/g, '-');
  const fileName = `${brandName.toLowerCase().replace(/\s+/g, '-')}-${sanitizedPhaseName}.pdf`;
  pdf.save(fileName);
};