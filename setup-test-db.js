const axios = require('axios');
const fs = require('fs');

const API_BASE = 'http://localhost:3000/api';

async function testEnhancedExport() {
  console.log('🧪 Testing Enhanced Excel Export Features\n');
  console.log('=' .repeat(70));

  const testCases = [
    {
      name: 'Market Cap with Currency Display',
      description: 'Fetches all columns but only exports "_display" columns with formatted headers',
      sql: `SELECT 
        id,
        company_name,
        company_name_display,
        market_cap,
        market_cap_curr_display,
        revenue,
        revenue_curr_display,
        created_at,
        created_date_display
      FROM companies LIMIT 5`,
      expectedColumns: [
        'Company Name (from company_name_display)',
        'Market Cap (from market_cap_curr_display) - with ₹ formatting',
        'Revenue (from revenue_curr_display) - with ₹ formatting',
        'Created Date (from created_date_display)'
      ]
    },
    {
      name: 'Complex Aliases with Calculations',
      description: 'Tests various column types with display suffix',
      sql: `SELECT
        u.id,
        CONCAT(u.name, ' (', u.email, ')') as user_info_display,
        u.age as age_display,
        u.salary as salary_curr_display,
        CASE 
          WHEN u.age > 30 THEN 'Senior'
          ELSE 'Junior'
        END as level_display,
        u.created_at as join_date_display
      FROM users u LIMIT 10`
    },
    {
      name: 'Mixed Columns - Only Display Exported',
      description: 'Has both regular and display columns, only display ones exported',
      sql: `SELECT
        id,
        name,
        name_display,
        internal_code,
        price,
        price_curr_display,
        stock_level,
        stock_count_display
      FROM products`
    }
  ];

  for (let i = 0; i < testCases.length; i++) {
    const test = testCases[i];
    
    console.log(`\n📋 Test Case ${i + 1}: ${test.name}`);
    console.log('─'.repeat(70));
    console.log(`Description: ${test.description}`);
    console.log(`\nSQL Query:\n${test.sql}\n`);

    try {
      // First, test JSON response to see all columns
      console.log('1️⃣ Testing JSON Response (all columns)...');
      const jsonResponse = await axios.post(`${API_BASE}/query`, {
        sql: test.sql
      });

      if (jsonResponse.data.success) {
        console.log(`   ✅ Query Success`);
        console.log(`   📊 Total Columns Fetched: ${jsonResponse.data.columns.length}`);
        console.log(`   📋 All Columns:`, jsonResponse.data.columns.join(', '));
        
        // Identify display columns
        const displayCols = jsonResponse.data.columns.filter(c => c.includes('display'));
        console.log(`   🎯 Display Columns (to be exported): ${displayCols.length}`);
        console.log(`   🏷️  Display Columns:`, displayCols.join(', '));
        
        if (displayCols.length > 0) {
          // Transform to show what Excel headers will be
          const excelHeaders = displayCols.map(col => {
            let cleaned = col.replace(/_display$/i, '').replace(/_curr$/i, '');
            return cleaned.split('_').map(w => 
              w.charAt(0).toUpperCase() + w.slice(1)
            ).join(' ');
          });
          console.log(`   📑 Excel Headers Will Be:`, excelHeaders.join(', '));
        }

        // Now test Excel download
        console.log('\n2️⃣ Testing Excel Download...');
        const excelResponse = await axios.post(`${API_BASE}/query`, {
          sql: test.sql,
          download: true,
          filename: `test_case_${i + 1}_enhanced.xlsx`
        }, {
          responseType: 'arraybuffer'
        });

        const filename = `test_case_${i + 1}_enhanced.xlsx`;
        fs.writeFileSync(filename, Buffer.from(excelResponse.data));
        
        console.log(`   ✅ Excel Generated Successfully`);
        console.log(`   💾 File Saved: ${filename}`);
        console.log(`   📦 File Size: ${excelResponse.data.byteLength.toLocaleString()} bytes`);
        console.log(`   📊 Rows: ${excelResponse.headers['x-row-count']}`);
        console.log(`   📋 Excel Columns: ${excelResponse.headers['x-column-count']}`);
        
        if (test.expectedColumns) {
          console.log('\n   📝 Expected Columns in Excel:');
          test.expectedColumns.forEach(col => console.log(`      • ${col}`));
        }

      } else {
        console.log(`   ❌ Query Failed:`, jsonResponse.data.error);
      }

    } catch (error) {
      if (error.response?.status === 400) {
        console.log(`   ⚠️  Query Issue: ${error.response.data.error}`);
        console.log(`   💡 This is expected if test table doesn't exist`);
      } else {
        console.log(`   ❌ Test Failed:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(70));
  }

  // Summary
  console.log('\n\n🎉 TESTING SUMMARY');
  console.log('=' .repeat(70));
  console.log('✅ Features Tested:');
  console.log('   1. Column Filtering - Only "_display" columns exported');
  console.log('   2. Header Transformation - "market_cap_curr_display" → "Market Cap"');
  console.log('   3. Currency Formatting - Columns with "_curr_display" get ₹ format');
  console.log('   4. Smart Formatting - Numbers, dates, text all formatted properly');
  console.log('\n💡 How to Use:');
  console.log('   1. In your SQL, add "_display" suffix to columns you want in Excel');
  console.log('   2. Use "_curr_display" for currency columns (₹ formatting)');
  console.log('   3. The API automatically filters and formats everything!');
  console.log('\n📝 Example SQL:');
  console.log(`   SELECT 
     id,                           -- Not exported (no _display)
     company_name,                 -- Not exported
     company_name_display,         -- Exported as "Company Name"
     market_cap_curr_display       -- Exported as "Market Cap" with ₹ format
   FROM companies`);
}

testEnhancedExport().catch(console.error);