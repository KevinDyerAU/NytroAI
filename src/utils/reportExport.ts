export const exportReportToPDF = async (
  element: HTMLElement,
  fileName: string
) => {
  // Use browser's print-to-PDF functionality
  // This is more reliable than external libraries and works in all modern browsers
  try {
    // Clone the element to avoid modifying the original
    const clone = element.cloneNode(true) as HTMLElement;

    // Create a temporary container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.width = '210mm'; // A4 width
    container.style.padding = '10mm';
    container.style.backgroundColor = 'white';

    container.appendChild(clone);
    document.body.appendChild(container);

    // Trigger print dialog with PDF output
    const printWindow = window.open('', '', 'width=800,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${fileName}</title>
            <style>
              * { margin: 0; padding: 0; }
              body { font-family: system-ui, -apple-system, sans-serif; }
              @media print {
                body { margin: 0; padding: 10mm; }
              }
            </style>
          </head>
          <body>
            ${container.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();

      // Wait for content to load then trigger print
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }

    // Clean up the temporary container
    document.body.removeChild(container);
  } catch (error) {
    console.warn('Error exporting to PDF, using print dialog instead:', error);
    window.print();
  }
};

export const printReport = () => {
  window.print();
};
