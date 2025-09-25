// Simple database connection test
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read .env.local file manually
let supabaseUrl, supabaseAnonKey;
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  const envLines = envContent.split('\n');

  for (const line of envLines) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1];
    }
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
      supabaseAnonKey = line.split('=')[1];
    }
  }
} catch (err) {
  console.error('Could not read .env.local file');
}

console.log('🔍 Testing Supabase Connection');
console.log('URL:', supabaseUrl);
console.log('Key present:', !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

async function testConnection() {
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('✅ Supabase client created');

    // Test basic connection
    console.log('🔌 Testing basic connection...');
    const { data, error } = await supabase
      .from('sessions')
      .select('id')
      .limit(1);

    if (error) {
      console.error('❌ Connection test failed:', error.message);
      console.error('Error details:', error);
    } else {
      console.log('✅ Database connection successful');
      console.log('Sample data:', data);
    }

    // Test all tables
    console.log('📋 Testing table access...');
    const tables = ['sessions', 'wheel_configurations', 'spin_results'];

    for (const table of tables) {
      try {
        const { error: tableError } = await supabase
          .from(table)
          .select('id')
          .limit(1);

        if (tableError) {
          console.error(`❌ Table '${table}' error:`, tableError.message);
        } else {
          console.log(`✅ Table '${table}' accessible`);
        }
      } catch (err) {
        console.error(`❌ Table '${table}' exception:`, err.message);
      }
    }

  } catch (err) {
    console.error('❌ Test failed:', err.message);
  }
}

testConnection().then(() => {
  console.log('🏁 Test complete');
});