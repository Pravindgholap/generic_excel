const express = require('express');
const cors = require('cors');
require('dotenv').config();

const GenericSQLHandler = require('./generic-sql-handler');
const EnhancedExcelExport = require('./generic-excel-export');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize handlers
const sqlHandler = new GenericSQLHandler({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'test_api',
  connectionLimit: 10
});

const excelExport = new EnhancedExcelExport(); // Updated to use enhanced version

// Middleware
app.use(cors());
app.use(express.json());

/**
 * Enhanced API Endpoint with Display Configuration
 * 
 * Request body options:
 * - sql: SQL query string (required)
 * - params: Query parameters array
 * - download: Boolean for Excel export
 * - filename: Custom filename for download
 * - sheetName: Excel sheet name
 * - displayConfig: Column display configuration
 *   - includeColumns: Array of columns to show (if null, shows all)
 *   - excludeColumns: Array of columns to hide
 *   - columnOrder: Array defining column order
 */
app.post('/api/query', async (req, res) => {
  try {
    const { 
      sql, 
      params = [], 
      download = false, 
      filename = 'export',
      sheetName = 'Export Data',
      displayConfig = {} // New parameter for column control
    } = req.body;

    if (!sql) {
      return res.status(400).json({
        success: false,
        error: 'SQL query is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📥 Request - Download: ${download}, Display Config:`, displayConfig);
    console.log(`SQL: ${sql.substring(0, 100)}...`);

    // Execute SQL query
    const queryResult = await sqlHandler.executeQuery(sql, params);

    if (!queryResult.success) {
      return res.status(400).json(queryResult);
    }

    // If Excel download requested
    if (download) {
      try {
        console.log(`📊 Generating Excel with display config...`);
        
        const excelFile = await excelExport.generateExcelFile(queryResult.data, {
          filename: filename,
          sheetName: sheetName,
          sqlColumns: queryResult.columns, // Pass SQL column names
          displayConfig: displayConfig,    // Pass display configuration
          creator: 'Enhanced SQL Excel Export API'
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${excelFile.filename}"`);
        res.setHeader('Content-Length', excelFile.buffer.length);
        res.setHeader('X-Row-Count', excelFile.rowCount);
        res.setHeader('X-Column-Count', excelFile.columnCount);
        
        console.log(`✅ Excel sent: ${excelFile.filename} (${excelFile.buffer.length} bytes)`);
        
        return res.send(excelFile.buffer);

      } catch (excelError) {
        console.error('❌ Excel generation failed:', excelError);
        return res.status(500).json({
          success: false,
          error: `Excel export failed: ${excelError.message}`,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Return JSON response
    console.log(`✅ JSON response: ${queryResult.count} rows`);
    res.json(queryResult);

  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET endpoint for simple queries
 */
app.get('/api/query', async (req, res) => {
  try {
    const { sql, download = 'false', filename = 'export' } = req.query;
    
    if (!sql) {
      return res.status(400).json({
        success: false,
        error: 'SQL query is required',
        timestamp: new Date().toISOString()
      });
    }

    const queryResult = await sqlHandler.executeQuery(sql);

    if (!queryResult.success) {
      return res.status(400).json(queryResult);
    }

    if (download === 'true') {
      const excelFile = await excelExport.generateExcelFile(queryResult.data, {
        filename: filename,
        sqlColumns: queryResult.columns
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${excelFile.filename}"`);
      
      return res.send(excelFile.buffer);
    }

    res.json(queryResult);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  const dbStatus = await sqlHandler.testConnection();
  
  res.json({
    status: 'OK',
    database: dbStatus.connected ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString(),
    service: 'Enhanced SQL & Excel Export API'
  });
});

/**
 * Demo endpoint showing different display configurations
 */
app.get('/api/demo-export', async (req, res) => {
  try {
    const { type = 'basic' } = req.query;

    // Sample data with various column types
    const sampleData = [
      { 
        user_id: 1, 
        full_name: 'John Doe', 
        email: 'john@example.com',
        age: 30,
        Market_Cap_Curr_Display: 1500000,
        revenue_curr: 250000,
        growth_rate_pct: 0.15,
        created_at: new Date('2024-01-15'),
        internal_code: 'XYZ123' // This might be excluded
      },
      { 
        user_id: 2, 
        full_name: 'Jane Smith', 
        email: 'jane@example.com',
        age: 25,
        Market_Cap_Curr_Display: 2300000,
        revenue_curr: 380000,
        growth_rate_pct: 0.22,
        created_at: new Date('2024-02-20'),
        internal_code: 'ABC456'
      }
    ];

    let displayConfig = {};
    let filename = 'demo_export.xlsx';

    switch(type) {
      case 'filtered':
        // Show only specific columns
        displayConfig = {
          includeColumns: ['full_name', 'Market_Cap_Curr_Display', 'revenue_curr', 'growth_rate_pct']
        };
        filename = 'filtered_columns.xlsx';
        break;

      case 'ordered':
        // Custom column order
        displayConfig = {
          columnOrder: ['full_name', 'email', 'Market_Cap_Curr_Display', 'age']
        };
        filename = 'custom_order.xlsx';
        break;

      case 'excluded':
        // Exclude internal columns
        displayConfig = {
          excludeColumns: ['user_id', 'internal_code']
        };
        filename = 'public_data.xlsx';
        break;

      default:
        // Show all columns with default formatting
        filename = 'all_columns.xlsx';
    }

    const excelFile = await excelExport.generateExcelFile(sampleData, {
      filename: filename,
      sheetName: 'Demo Data',
      displayConfig: displayConfig,
      creator: 'Demo Export'
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${excelFile.filename}"`);
    
    res.send(excelFile.buffer);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Enhanced SQL & Excel API Server running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 Demo exports:`);
  console.log(`   - All columns: http://localhost:${PORT}/api/demo-export?type=basic`);
  console.log(`   - Filtered: http://localhost:${PORT}/api/demo-export?type=filtered`);
  console.log(`   - Ordered: http://localhost:${PORT}/api/demo-export?type=ordered`);
  console.log(`   - Excluded: http://localhost:${PORT}/api/demo-export?type=excluded`);
});

module.exports = app;