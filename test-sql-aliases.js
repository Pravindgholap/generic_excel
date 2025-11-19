const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testSQLAliases() {
  console.log('🧪 Testing SQL Aliases as Excel Headers...\n');

  const testQueries = [
    {
      name: 'Basic Aliases',
      sql: `SELECT 
        id as user_id,
        name as full_name,
        email as user_email,
        age as user_age
      FROM users LIMIT 3`
    },
    {
      name: 'Complex Aliases with Calculations',
      sql: `SELECT
        u.id as user_id,
        CONCAT(u.name, ' - ', u.email) as user_info,
        TIMESTAMPDIFF(YEAR, u.created_at, NOW()) as account_age_years,
        CASE 
          WHEN u.age > 30 THEN 'Senior'
          ELSE 'Junior'
        END as age_category
      FROM users u LIMIT 4`
    },
    {
      name: 'Aggregate with Aliases',
      sql: `SELECT
        COUNT(*) as total_users,
        AVG(age) as average_age,
        MIN(age) as youngest_age,
        MAX(age) as oldest_age
      FROM users`
    }
  ];

  for (const test of testQueries) {
    console.log(`\n📋 Testing: ${test.name}`);
    console.log(`SQL: ${test.sql.substring(0, 100)}...`);

    try {
      // Test JSON response first
      const jsonResponse = await axios.post(`${API_BASE}/query`, {
        sql: test.sql
      });

      if (jsonResponse.data.success) {
        console.log(`✅ JSON Success - Columns:`, jsonResponse.data.columns);
        console.log(`   Data sample:`, jsonResponse.data.data[0]);
        
        // Test Excel download
        const excelResponse = await axios.post(`${API_BASE}/query`, {
          sql: test.sql,
          download: true,
          filename: `test_${test.name.toLowerCase().replace(/ /g, '_')}`
        }, {
          responseType: 'arraybuffer'
        });

        console.log(`✅ Excel Generated - Size: ${excelResponse.data.length} bytes`);
        console.log(`   Headers in Excel will be:`, jsonResponse.data.columns);
        
      } else {
        console.log(`❌ Query Failed:`, jsonResponse.data.error);
      }

    } catch (error) {
      console.log(`❌ Test Failed:`, error.response?.data || error.message);
    }
  }
}

testSQLAliases();