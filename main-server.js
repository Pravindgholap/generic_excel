const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
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

const excelExport = new EnhancedExcelExport();

// Middleware
app.use(cors());
app.use(express.json());

// Global variable to track SQL endpoints
let sqlEndpoints = new Map();

/**
 * Create or update endpoint for a SQL file
 */
function createEndpointForSQLFile(file) {
  try {
    const routeName = path.basename(file, '.sql').toLowerCase();
    const filePath = path.join(__dirname, 'sql_files', file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`❌ SQL file not found: ${filePath}`);
      return false;
    }

    const sqlContent = fs.readFileSync(filePath, 'utf8').trim();
    
    console.log(`📊 Creating endpoint: /api/${routeName} from ${file}`);

    // Remove existing endpoints if they exist
    if (sqlEndpoints.has(routeName)) {
      // In Express, we can't easily remove routes, so we'll rely on the new handlers
      console.log(`🔄 Updating existing endpoint: /api/${routeName}`);
    }

    // Store the SQL content
    sqlEndpoints.set(routeName, sqlContent);

    // Create GET endpoint
    const getHandler = async (req, res) => {
      try {
        const { 
          download = 'false', 
          filename = routeName,
          sheetName = routeName.replace(/_/g, ' '),
          ...queryParams 
        } = req.query;

        console.log(`📥 GET Request to /api/${routeName} - Download: ${download}`);
        
        // Convert query params to array for prepared statements
        const params = Object.values(queryParams);
        
        // Execute SQL query
        const queryResult = await sqlHandler.executeQuery(sqlContent, params);

        if (!queryResult.success) {
          return res.status(400).json(queryResult);
        }

        // If Excel download requested
        if (download === 'true') {
          const excelFile = await excelExport.generateExcelFile(queryResult.data, {
            filename: `${filename}.xlsx`,
            sheetName: sheetName,
            sqlColumns: queryResult.columns,
            creator: 'SQL File API'
          });

          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${excelFile.filename}"`);
          
          return res.send(excelFile.buffer);
        }

        // Return JSON response
        res.json(queryResult);

      } catch (error) {
        console.error(`❌ Error in GET /api/${routeName}:`, error);
        res.status(500).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };

    // Create POST endpoint
    const postHandler = async (req, res) => {
      try {
        const { 
          download = false, 
          filename = routeName,
          sheetName = routeName.replace(/_/g, ' '),
          displayConfig = {},
          params = [],
          ...otherParams 
        } = req.body;

        console.log(`📥 POST Request to /api/${routeName} - Download: ${download}`);
        
        // Combine body params with explicit params array
        const allParams = params.length > 0 ? params : Object.values(otherParams);
        
        // Execute SQL query
        const queryResult = await sqlHandler.executeQuery(sqlContent, allParams);

        if (!queryResult.success) {
          return res.status(400).json(queryResult);
        }

        // If Excel download requested
        if (download) {
          const excelFile = await excelExport.generateExcelFile(queryResult.data, {
            filename: `${filename}.xlsx`,
            sheetName: sheetName,
            sqlColumns: queryResult.columns,
            displayConfig: displayConfig,
            creator: 'SQL File API'
          });

          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename="${excelFile.filename}"`);
          
          return res.send(excelFile.buffer);
        }

        // Return JSON response
        res.json(queryResult);

      } catch (error) {
        console.error(`❌ Error in POST /api/${routeName}:`, error);
        res.status(500).json({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };

    // Apply routes - these will override any previous routes with same path
    app.get(`/api/${routeName}`, getHandler);
    app.post(`/api/${routeName}`, postHandler);

    return true;
  } catch (error) {
    console.error(`❌ Failed to create endpoint for ${file}:`, error);
    return false;
  }
}

/**
 * Load all SQL files and create endpoints
 */
function loadAllSQLFiles() {
  const sqlDir = path.join(__dirname, 'sql_files');
  
  // Create sql_files directory if it doesn't exist
  if (!fs.existsSync(sqlDir)) {
    fs.mkdirSync(sqlDir, { recursive: true });
    console.log('📁 Created sql_files directory');
    return;
  }

  // Read all .sql files
  const files = fs.readdirSync(sqlDir).filter(file => file.endsWith('.sql'));
  
  console.log(`\n📊 Found ${files.length} SQL files:`);
  
  let successCount = 0;
  files.forEach(file => {
    if (createEndpointForSQLFile(file)) {
      successCount++;
      console.log(`   ✅ ${file} → /api/${path.basename(file, '.sql').toLowerCase()}`);
    } else {
      console.log(`   ❌ ${file} → FAILED`);
    }
  });
  
  console.log(`✅ Successfully loaded ${successCount}/${files.length} SQL endpoints`);
}

/**
 * Dynamic endpoint to reload SQL files
 */
app.post('/api/reload-sql', (req, res) => {
  try {
    console.log('🔄 Reloading SQL endpoints...');
    loadAllSQLFiles();
    res.json({
      success: true,
      message: 'SQL endpoints reloaded successfully',
      timestamp: new Date().toISOString(),
      endpoints: Array.from(sqlEndpoints.keys()).map(route => `/api/${route}`)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Original generic query endpoint (kept for backward compatibility)
 */
app.post('/api/query', async (req, res) => {
  try {
    const { 
      sql, 
      params = [], 
      download = false, 
      filename = 'export',
      sheetName = 'Export Data',
      displayConfig = {}
    } = req.body;

    if (!sql) {
      return res.status(400).json({
        success: false,
        error: 'SQL query is required',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`📥 Request to /api/query - Download: ${download}`);
    
    // Execute SQL query
    const queryResult = await sqlHandler.executeQuery(sql, params);

    if (!queryResult.success) {
      return res.status(400).json(queryResult);
    }

    // If Excel download requested
    if (download) {
      const excelFile = await excelExport.generateExcelFile(queryResult.data, {
        filename: filename,
        sheetName: sheetName,
        sqlColumns: queryResult.columns,
        displayConfig: displayConfig,
        creator: 'Generic Query API'
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${excelFile.filename}"`);
      
      return res.send(excelFile.buffer);
    }

    // Return JSON response
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
  
  const endpoints = Array.from(sqlEndpoints.keys()).map(route => `/api/${route}`);
  
  res.json({
    status: 'OK',
    database: dbStatus.connected ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString(),
    service: 'Enhanced SQL & Excel Export API',
    sqlEndpoints: endpoints,
    totalEndpoints: endpoints.length
  });
});

/**
 * List all available SQL endpoints
 */
app.get('/api/sql-endpoints', (req, res) => {
  const endpoints = Array.from(sqlEndpoints.entries()).map(([routeName, sqlContent]) => {
    return {
      endpoint: `/api/${routeName}`,
      filename: `${routeName}.sql`,
      sqlPreview: sqlContent.substring(0, 100) + (sqlContent.length > 100 ? '...' : ''),
      methods: ['GET', 'POST'],
      example: {
        get: `http://localhost:${PORT}/api/${routeName}?download=false`,
        download: `http://localhost:${PORT}/api/${routeName}?download=true`
      }
    };
  });

  res.json({ 
    endpoints,
    reload: `POST http://localhost:${PORT}/api/reload-sql`
  });
});

/**
 * Create endpoint for a specific SQL file
 */
app.post('/api/create-endpoint', (req, res) => {
  try {
    const { filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        error: 'Filename is required',
        timestamp: new Date().toISOString()
      });
    }

    if (!filename.endsWith('.sql')) {
      return res.status(400).json({
        success: false,
        error: 'File must be a .sql file',
        timestamp: new Date().toISOString()
      });
    }

    const success = createEndpointForSQLFile(filename);
    
    if (success) {
      res.json({
        success: true,
        message: `Endpoint created for ${filename}`,
        endpoint: `/api/${path.basename(filename, '.sql').toLowerCase()}`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: `Failed to create endpoint for ${filename}`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Initial load of SQL files
loadAllSQLFiles();

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Enhanced SQL & Excel API Server running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Available SQL endpoints: http://localhost:${PORT}/api/sql-endpoints`);
  console.log(`🔄 Reload endpoints: POST http://localhost:${PORT}/api/reload-sql`);
  console.log(`\n📁 Place your .sql files in the 'sql_files' directory and reload!`);
});

module.exports = app;