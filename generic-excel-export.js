const ExcelJS = require('exceljs');

/**
 * Enhanced Generic Excel Export Handler
 * Features:
 * - Selective column display
 * - Automatic display name formatting (*_Display columns)
 * - Currency and number formatting
 * - Custom column ordering
 */
class EnhancedExcelExport {
  constructor() {
    console.log('✅ Enhanced Excel Export initialized');
  }

  /**
   * Format display column names
   * Removes _Display/_Curr_Display suffix and formats to readable text
   * Examples:
   * - "Market_Cap_Curr_Display" -> "Market Cap"
   * - "user_email_Display" -> "User Email"
   * - "total_revenue" -> "Total Revenue"
   */
  _formatDisplayName(columnName) {
    // Remove common display suffixes
    let formatted = columnName
      .replace(/_Curr_Display$/i, '')
      .replace(/_Display$/i, '')
      .replace(/_curr$/i, '');
    
    // Convert snake_case to Title Case
    formatted = formatted
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    
    return formatted;
  }

  /**
   * Detect column type for formatting
   */
  _detectColumnType(columnName, sampleValue) {
    const lowerName = columnName.toLowerCase();
    
    // Currency columns
    if (lowerName.includes('_curr_display') || 
        lowerName.includes('_curr') ||
        lowerName.includes('price') ||
        lowerName.includes('amount') ||
        lowerName.includes('revenue') ||
        lowerName.includes('cost')) {
      return 'currency';
    }
    
    // Percentage columns
    if (lowerName.includes('percent') || 
        lowerName.includes('rate') ||
        lowerName.includes('_pct')) {
      return 'percentage';
    }
    
    // Number columns
    if (typeof sampleValue === 'number' && !lowerName.includes('id')) {
      return 'number';
    }
    
    // Date columns
    if (sampleValue instanceof Date || 
        lowerName.includes('date') || 
        lowerName.includes('_at')) {
      return 'date';
    }
    
    return 'text';
  }

  /**
   * Filter and order columns based on display configuration
   */
  _processColumns(allColumns, data, displayConfig = {}) {
    const {
      includeColumns = null,  // Array of columns to include (null = all)
      excludeColumns = [],    // Array of columns to exclude
      columnOrder = null      // Array defining order (null = original order)
    } = displayConfig;

    let processedColumns = allColumns;

    // Step 1: Include only specified columns
    if (includeColumns && includeColumns.length > 0) {
      processedColumns = processedColumns.filter(col => 
        includeColumns.includes(col)
      );
    }

    // Step 2: Exclude specified columns
    if (excludeColumns.length > 0) {
      processedColumns = processedColumns.filter(col => 
        !excludeColumns.includes(col)
      );
    }

    // Step 3: Apply custom ordering
    if (columnOrder && columnOrder.length > 0) {
      const ordered = [];
      const remaining = [...processedColumns];

      // Add columns in specified order
      columnOrder.forEach(col => {
        if (remaining.includes(col)) {
          ordered.push(col);
          remaining.splice(remaining.indexOf(col), 1);
        }
      });

      // Add any remaining columns at the end
      processedColumns = [...ordered, ...remaining];
    }

    // Step 4: Create display mapping
    const columnMapping = processedColumns.map(col => {
      // Get sample value for type detection
      const sampleValue = data.length > 0 ? data[0][col] : null;
      const columnType = this._detectColumnType(col, sampleValue);
      
      return {
        originalName: col,
        displayName: this._formatDisplayName(col),
        type: columnType
      };
    });

    return columnMapping;
  }

  /**
   * Apply cell formatting based on column type
   */
  _applyCellFormatting(cell, columnType, value) {
    // Base alignment
    cell.alignment = {
      vertical: 'middle',
      horizontal: columnType === 'number' || columnType === 'currency' || columnType === 'percentage' 
        ? 'right' 
        : 'left'
    };

    // Type-specific formatting
    switch (columnType) {
      case 'currency':
        // Indian Rupee format with thousand separators
        cell.numFmt = '₹#,##,##0.00';
        break;
      
      case 'percentage':
        cell.numFmt = '0.00%';
        break;
      
      case 'number':
        // Check if integer or decimal
        const isInteger = value !== null && value !== undefined && 
                         Number.isInteger(parseFloat(value));
        cell.numFmt = isInteger ? '#,##0' : '#,##0.00';
        break;
      
      case 'date':
        cell.numFmt = 'dd-mmm-yyyy';
        break;
      
      default:
        // Text - no special formatting
        break;
    }
  }

  /**
   * Convert JSON data to Excel workbook with enhanced formatting
   */
  async jsonToExcel(data, sqlColumns = null, options = {}) {
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Set workbook properties
      workbook.creator = options.creator || 'Enhanced Excel Export API';
      workbook.created = new Date();
      
      const worksheet = workbook.addWorksheet(options.sheetName || 'Export Data');
      
      if (!data || data.length === 0) {
        worksheet.addRow(['No data available for export']);
        return this._applyEmptyWorksheetStyle(worksheet);
      }

      // Determine columns
      const allColumns = sqlColumns || Object.keys(data[0]);
      
      // Process columns with display configuration
      const columnMapping = this._processColumns(allColumns, data, options.displayConfig || {});
      
      console.log(`📊 Creating Excel with ${data.length} rows and ${columnMapping.length} columns`);
      console.log(`📋 Column mapping:`, columnMapping.map(c => 
        `${c.originalName} -> ${c.displayName} [${c.type}]`
      ));

      // Add header row with display names
      this._addHeaderRow(worksheet, columnMapping, options);
      
      // Add data rows with formatting
      this._addDataRows(worksheet, data, columnMapping);
      
      // Apply overall styling
      this._applyWorksheetStyle(worksheet, columnMapping.length, options);
      
      // Auto-fit columns
      this._autoFitColumns(worksheet, columnMapping);

      console.log('✅ Excel workbook created successfully');
      return workbook;

    } catch (error) {
      console.error('❌ Excel creation error:', error);
      throw new Error(`Excel export failed: ${error.message}`);
    }
  }

  /**
   * Add header row with display names
   */
  _addHeaderRow(worksheet, columnMapping, options = {}) {
    const displayHeaders = columnMapping.map(col => col.displayName);
    const headerRow = worksheet.addRow(displayHeaders);
    
    // Style header row
    headerRow.eachCell((cell, colNumber) => {
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' },
        size: 12
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: options.headerColor || 'FF2E75B6' }
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      };
    });

    // Freeze header row
    worksheet.views = [
      { state: 'frozen', ySplit: 1 }
    ];
  }

  /**
   * Add data rows with type-based formatting
   */
  _addDataRows(worksheet, data, columnMapping) {
    data.forEach((row, rowIndex) => {
      const rowData = columnMapping.map(col => {
        const value = row[col.originalName];
        
        // Handle special data types
        if (value instanceof Date) {
          return value;
        } else if (value === null || value === undefined) {
          return '';
        } else if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        
        return value;
      });
      
      const addedRow = worksheet.addRow(rowData);
      
      // Apply formatting to each cell
      addedRow.eachCell((cell, colNumber) => {
        const columnInfo = columnMapping[colNumber - 1];
        
        // Apply type-based formatting
        this._applyCellFormatting(cell, columnInfo.type, cell.value);
        
        // Alternate row coloring
        if (rowIndex % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8F9FA' }
          };
        }
        
        // Add borders
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    });
  }

  /**
   * Apply overall worksheet styling
   */
  _applyWorksheetStyle(worksheet, columnCount, options) {
    worksheet.columns = Array(columnCount).fill().map(() => ({
      width: 15
    }));
  }

  /**
   * Auto-fit columns based on content
   */
  _autoFitColumns(worksheet, columnMapping) {
    worksheet.columns.forEach((column, index) => {
      let maxLength = 0;
      
      // Check header length
      const headerLength = columnMapping[index] ? 
        columnMapping[index].displayName.length : 10;
      maxLength = Math.max(maxLength, headerLength);
      
      // Check data length
      column.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.value) {
          const cellLength = cell.value.toString().length;
          maxLength = Math.max(maxLength, cellLength);
        }
      });
      
      // Set width with limits
      column.width = Math.min(Math.max(maxLength + 2, 12), 50);
    });
  }

  /**
   * Style empty worksheet
   */
  _applyEmptyWorksheetStyle(worksheet) {
    const row = worksheet.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFF0000' } };
    row.alignment = { horizontal: 'center' };
    worksheet.mergeCells('A1:D1');
    return worksheet.workbook;
  }

  /**
   * Generate Excel file buffer
   */
  async generateExcelBuffer(workbook) {
    try {
      const buffer = await workbook.xlsx.writeBuffer();
      console.log(`✅ Excel buffer generated: ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      console.error('❌ Buffer generation error:', error);
      throw new Error(`Excel buffer generation failed: ${error.message}`);
    }
  }

  /**
   * Generate Excel with custom filename and metadata
   */
  async generateExcelFile(data, options = {}) {
    const workbook = await this.jsonToExcel(
      data, 
      options.sqlColumns,  // Changed from customHeaders
      options
    );
    const buffer = await this.generateExcelBuffer(workbook);
    
    return {
      buffer: buffer,
      filename: options.filename || `export_${Date.now()}.xlsx`,
      sheetName: options.sheetName || 'Export Data',
      rowCount: data.length,
      columnCount: data.length > 0 ? Object.keys(data[0]).length : 0
    };
  }
}

module.exports = EnhancedExcelExport;