
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkProducts() {
    const { data: products, error } = await supabase
        .from('products')
        .select('name, slug, is_published, description, category_id')
        .ilike('name', '%reconstitution%')

    if (error) console.error('Error fetching reconstitution:', error)
    else console.log('Reconstitution Products:', products)

    const { data: glp1, error: glp1Error } = await supabase
        .from('products')
        .select('name, slug, is_published, description, category_id')
        .ilike('name', '%semaglutide%')

    if (glp1Error) console.error('Error fetching GLP-1:', glp1Error)
    else console.log('GLP-1 Products:', glp1)

    const { data: categories, error: catError } = await supabase
        .from('product_categories')
        .select('*')

    if (catError) console.error('Error fetching categories:', catError)
    else console.log('Categories:', categories)
}

checkProducts()
