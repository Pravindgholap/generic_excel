const mysql = require('mysql2/promise');

/**
 * Generic SQL Query Handler
 * Handles database operations with connection pooling and proper error handling
 */
class GenericSQLHandler {
  constructor(dbConfig) {
    // Create connection pool for efficient database connections
    this.pool = mysql.createPool({
      host: dbConfig.host || 'localhost',
      user: dbConfig.user || 'root',
      password: dbConfig.password || '',
      database: dbConfig.database || 'test',
      waitForConnections: true,
      connectionLimit: dbConfig.connectionLimit || 10,
      queueLimit: 0,
      acquireTimeout: 60000, // 60 seconds
      timeout: 60000, // 60 seconds
    });
    
    console.log('✅ Generic SQL Handler initialized');
  }

  /**
   * Execute SQL query with parameters
   * @param {string} sql - SQL query string
   * @param {Array} params - Query parameters for prepared statements
   * @returns {Object} - Result with success status and data
   */
  async executeQuery(sql, params = []) {
    let connection;
    try {
      // Get connection from pool
      connection = await this.pool.getConnection();
      
      console.log(`🔍 Executing SQL: ${sql}`);
      console.log(`📋 Parameters:`, params);

      // Execute query with parameters (prevents SQL injection)
      const [rows, fields] = await connection.execute(sql, params);
      
      // Extract column names from query result
      const columns = fields ? fields.map(field => field.name) : [];
      
      return {
        success: true,
        data: rows,
        columns: columns, // Return column names for Excel headers
        count: rows.length,
        executionTime: new Date().toISOString(),
        sql: sql, // Return the executed SQL for debugging
        params: params // Return parameters used
      };

    } catch (error) {
      console.error('❌ SQL Execution Error:', error.message);
      
      return {
        success: false,
        error: error.message,
        sql: sql,
        params: params,
        executionTime: new Date().toISOString()
      };

    } finally {
      // Always release connection back to pool
      if (connection) {
        connection.release();
      }
    }
  }

  /**
   * Execute multiple queries in transaction
   * @param {Array} queries - Array of {sql, params} objects
   */
  async executeTransaction(queries) {
    let connection;
    try {
      connection = await this.pool.getConnection();
      await connection.beginTransaction();

      const results = [];
      for (const query of queries) {
        const [rows] = await connection.execute(query.sql, query.params || []);
        results.push(rows);
      }

      await connection.commit();
      return { success: true, results: results };

    } catch (error) {
      if (connection) await connection.rollback();
      return { success: false, error: error.message };

    } finally {
      if (connection) connection.release();
    }
  }

  /**
   * Test database connection
   */
  async testConnection() {
    try {
      const result = await this.executeQuery('SELECT 1 as connection_test');
      return {
        connected: result.success,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Close connection pool
   */
  async close() {
    await this.pool.end();
    console.log('🔒 Database connection pool closed');
  }
}

module.exports = GenericSQLHandler;