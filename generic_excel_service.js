import { generateStyledExcel, FORMAT_STYLE } from '../download-stock-report-excel/download_stocks_report_services.js';
import { executeGenericSQL } from '../../db/postgresDB/DAO/GenericSQL/get_data_from_scripts.js';
import logger from '../../common/logger.js';

export class GenericExcelService {
  /**
   * Generic method to export any SQL data to Excel using alias-based auto-configuration
   */
  static async exportToExcel(keyFileName, params, excelConfig = {}) {
    try {
      logger.info(`Starting Excel export for ${keyFileName} with params: ${JSON.stringify(params)}`);

      // Fetch data using generic SQL
      const data = await executeGenericSQL(keyFileName, params);
      
      if (!data || data.length === 0) {
        throw new Error('No data available for export');
      }

      // Prepare response structure expected by generateStyledExcel
      const responseData = {
        stocks: data,
        total: data[0]?.total_count || data.length
      };

      // Auto-generate configuration from column names
      const autoConfig = this._generateConfigFromColumns(data[0], keyFileName);

      const finalConfig = { ...autoConfig, ...excelConfig };

      logger.info(`Auto-generated Excel config for ${keyFileName}: ${finalConfig.headers_object.length} columns`);

      return {
        data: responseData,
        config: finalConfig
      };
      
    } catch (error) {
      logger.error(`Generic Excel export error for ${keyFileName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate complete Excel configuration from column aliases
   */
  static _generateConfigFromColumns(sampleData, keyFileName) {
    if (!sampleData) return { headers_object: [], formatKeys: [] };

    const headers_object = [];
    const formatKeys = [];

    Object.keys(sampleData)
      .filter(key => key !== 'total_count')
      .forEach(key => {
        if (key.endsWith('_Display')) {
          const { headerName, formatStyle, isValue } = this._parseColumnAlias(key);
          
          headers_object.push({
            headerName,
            row_key: key,
            value: isValue
          });

          if (formatStyle && formatStyle !== FORMAT_STYLE.DEFAULT) {
            formatKeys.push({
              key: key,
              format_style: formatStyle
            });
          }
        }
      });

    // If no _Display columns found, fall back to all columns
    if (headers_object.length === 0) {
      Object.keys(sampleData)
        .filter(key => key !== 'total_count')
        .forEach(key => {
          headers_object.push({
            headerName: this._formatHeaderName(key),
            row_key: key,
            value: this._isNumericValue(sampleData[key])
          });

          const autoFormat = this._autoDetectFormat(key, sampleData[key]);
          if (autoFormat) {
            formatKeys.push({
              key: key,
              format_style: autoFormat
            });
          }
        });
    }

    return {
      titleName: this._formatTitle(keyFileName),
      sheetName: this._formatSheetName(keyFileName),
      headers_object,
      formatKeys
    };
  }

  /**
   * Parse column alias to extract header name and format
   */
  static _parseColumnAlias(columnName) {
    const withoutDisplay = columnName.replace(/_Display$/, '');
    const parts = withoutDisplay.split('_');
    
    let formatStyle = FORMAT_STYLE.DEFAULT;
    let isValue = false;
    let headerNameParts = [];

    const lastPart = parts[parts.length - 1].toLowerCase();
    
    switch (lastPart) {
      case 'curr':
        formatStyle = FORMAT_STYLE.RUPEES_SYMBOL;
        isValue = true;
        headerNameParts = parts.slice(0, -1);
        break;
      case 'num':
        formatStyle = FORMAT_STYLE.INDIAN_NUMBERING_SYSTEM;
        headerNameParts = parts.slice(0, -1);
        break;
      case 'pct':
        formatStyle = FORMAT_STYLE.PERCENTAGE;
        isValue = true;
        headerNameParts = parts.slice(0, -1);
        break;
      case 'dec':
        formatStyle = FORMAT_STYLE.DECIMAL;
        headerNameParts = parts.slice(0, -1);
        break;
      default:
        headerNameParts = parts;
        const autoFormat = this._autoDetectFormat(columnName, null);
        if (autoFormat) {
          formatStyle = autoFormat;
          isValue = autoFormat === FORMAT_STYLE.PERCENTAGE;
        }
        break;
    }

    const headerName = headerNameParts
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');

    return { headerName, formatStyle, isValue };
  }

  /**
   * Auto-detect format based on column name
   */
  static _autoDetectFormat(columnName, sampleValue) {
    const lowerKey = columnName.toLowerCase();
    
    if (lowerKey.includes('price') || lowerKey.includes('amount') || 
        lowerKey.includes('ltp') || lowerKey.includes('close') ||
        lowerKey.includes('mcap') || lowerKey.includes('market_cap')) {
      return FORMAT_STYLE.RUPEES_SYMBOL;
    }
    
    if (lowerKey.includes('volume') || lowerKey.includes('quantity') || 
        lowerKey.includes('count') || lowerKey.includes('qty')) {
      return FORMAT_STYLE.INDIAN_NUMBERING_SYSTEM;
    }
    
    if (lowerKey.includes('percent') || lowerKey.includes('pct') || 
        lowerKey.includes('return') || lowerKey.includes('change') ||
        lowerKey.includes('growth')) {
      return FORMAT_STYLE.PERCENTAGE;
    }
    
    if (lowerKey.includes('ratio') || lowerKey.includes('pe') || 
        lowerKey.includes('pb') || lowerKey.includes('debt')) {
      return FORMAT_STYLE.DECIMAL;
    }
    
    return null;
  }

  /**
   * Format header name for fallback
   */
  static _formatHeaderName(columnName) {
    return columnName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Check if value should be treated as numeric
   */
  static _isNumericValue(value) {
    if (value === null || value === undefined) return false;
    return !isNaN(Number(value)) && !Array.isArray(value) && typeof value !== 'object';
  }

  /**
   * Format title from SQL filename
   */
  static _formatTitle(keyFileName) {
    return keyFileName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format sheet name from SQL filename
   */
  static _formatSheetName(keyFileName) {
    return this._formatTitle(keyFileName).substring(0, 31);
  }
}